const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
const { syncSqliteWithTemplate } = require('./syncSqliteWithTemplate');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const os = require('os');
const baseDir = path.join(os.homedir(), '.bdd-caisse');
const dbConfigPath = path.join(baseDir, 'dbConfig.json');
fs.mkdirSync(baseDir, { recursive: true });

function getMysqlPresets() {
  const presets = [];
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MYSQL_PRESET_')) {
      const name = key.substring('MYSQL_PRESET_'.length).toLowerCase();
      const [host = '', user = '', password = '', database = '', port = ''] =
        process.env[key].split('|');
      presets.push(cleanMysqlConfig({ name, host, user, password, database, port }));
    }
  }
  return presets;
}

function getMysqlPreset(name) {
  return getMysqlPresets().find(p => p.name === name);
}

const bundledDbConfigPath = path.join(__dirname, 'dbConfig.json');

function readJsonConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`Erreur lecture ${configPath}:`, err);
    return {};
  }
}

function cleanMysqlConfig(config) {
  const cleaned = {};

  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }

  if (cleaned.port !== undefined) {
    const port = Number(cleaned.port);
    if (Number.isInteger(port) && port > 0) {
      cleaned.port = port;
    } else {
      delete cleaned.port;
    }
  }

  if (cleaned.connectTimeout !== undefined) {
    const connectTimeout = Number(cleaned.connectTimeout);
    if (Number.isInteger(connectTimeout) && connectTimeout > 0) {
      cleaned.connectTimeout = connectTimeout;
    } else {
      delete cleaned.connectTimeout;
    }
  }

  return cleaned;
}

function readEnvMysqlConfig() {
  return cleanMysqlConfig({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: process.env.MYSQL_PORT,
    connectTimeout: process.env.MYSQL_CONNECT_TIMEOUT
  });
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

function getAutomaticMysqlConfig() {
  const presetName = isProductionRuntime() ? 'remote' : 'local';
  const presetConfig = getMysqlPreset(presetName);

  if (presetConfig) {
    return presetConfig;
  }

  if (isProductionRuntime()) {
    return readJsonConfig(bundledDbConfigPath);
  }

  return readEnvMysqlConfig();
}

function loadMysqlConfig() {
  const defaultConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'objets',
    port: 3306,
    connectTimeout: 5000
  };

  return cleanMysqlConfig({
    ...defaultConfig,
    ...getAutomaticMysqlConfig()
  });
}

let mysqlConfig = loadMysqlConfig();
let pool = createMysqlPool(mysqlConfig);

function createMysqlPool(config) {
  return mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port,
    connectTimeout: config.connectTimeout,
    waitForConnections: true,
    connectionLimit: 10
  });
}

function updateMysqlConfig(newConfig) {
  const previousPool = pool;
  mysqlConfig = cleanMysqlConfig({ ...mysqlConfig, ...newConfig });
  fs.writeFileSync(dbConfigPath, JSON.stringify(mysqlConfig, null, 2));
  pool = createMysqlPool(mysqlConfig); // recrée le pool

  if (previousPool) {
    previousPool.end().catch(err => {
      console.error('Erreur fermeture ancien pool MySQL:', err.message);
    });
  }

  console.log('✅ Nouvelle configuration MySQL appliquée');
}

// ✅ nouvelle fonction dynamique
function getMysqlPool() {
  return pool;
}

function getMysqlConfig() {
  return { ...mysqlConfig };
}

// Connexion SQLite




let db;

if (process.env.NODE_ENV === 'test') {
  db = new Database(':memory:');
  console.log('✅ Connecté à SQLite en mémoire (mode test)');
} else {
  // 📁 Dossier utilisateur pour la base persistante
  const userDataDir = path.join(os.homedir(), '.bdd-caisse');
  const dbPath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
  console.log('🪛 Chemin recherché pour SQLite :', dbPath);

  // 🔍 Détection de l'environnement d'exécution (Electron ou Node.js)
  let appPath;

  if (process.versions.electron) {
    const { app } = require('electron');
    appPath = process.env.NODE_ENV === 'development'
      ? __dirname // En dev : dans ton dossier source
      : process.resourcesPath; // En prod : dossier /resources
  } else {
    // Fallback Node.js pur (ex: `nodemon`, `node index.js`)
    appPath = __dirname;
  }

  const templatePath = path.join(appPath, 'database', 'ressourcebrie-sqlite-template.db');
  const insertionsPath = path.join(appPath, 'inserts_categories_boutons.sql');
  const insertsUsersPath = path.join(appPath, 'inserts_users.sql');

  // ⛏️ Si la BDD utilisateur n'existe pas, on copie depuis le template + inserts
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(userDataDir, { recursive: true });

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);

      const dbTemp = new Database(dbPath);

      if (fs.existsSync(insertionsPath)) {
        const insertions = fs.readFileSync(insertionsPath, 'utf-8');
        dbTemp.exec(insertions);
      }

      if (fs.existsSync(insertsUsersPath)) {
        const insertsUsers = fs.readFileSync(insertsUsersPath, 'utf-8');
        dbTemp.exec(insertsUsers);
      }

      dbTemp.close();
      console.log('📂 Base initialisée depuis le modèle');
    } else {
      throw new Error(`⚠️ Fichier modèle introuvable à : ${templatePath}`);
    }
  }

  // 🎯 Connexion active à la BDD
  db = new Database(dbPath);
  console.log('✅ Connecté à SQLite :', dbPath);
  

  try {
    syncSqliteWithTemplate(db, templatePath);
  } catch (err) {
    console.error('⚠️ Erreur lors de la synchronisation du schéma SQLite :', err.message);
  }
}

module.exports = db;


module.exports = {
  sqlite: db,
  getMysqlPool, // ✅ export dynamique
  getMysqlConfig,
  updateMysqlConfig,
  getMysqlPresets
};
