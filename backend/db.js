const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfigPath = path.join(__dirname, 'dbConfig.json');

function getMysqlPresets() {
  const presets = [];
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MYSQL_PRESET_')) {
      const name = key.substring('MYSQL_PRESET_'.length).toLowerCase();
      const [host = '', user = '', password = '', database = ''] =
        process.env[key].split('|');
      presets.push({ name, host, user, password, database });
    }
  }
  return presets;
}

// Config par défaut
let mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || '',
  database: process.env.MYSQL_DB || 'objets'
};

// Surcharge avec config locale si présente
if (fs.existsSync(dbConfigPath)) {
  try {
    const conf = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
    mysqlConfig = { ...mysqlConfig, ...conf };
  } catch (err) {
    console.error('Erreur lecture dbConfig.json:', err);
  }
}

let pool = createMysqlPool(mysqlConfig);

function createMysqlPool(config) {
  return mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10
  });
}

function updateMysqlConfig(newConfig) {
  mysqlConfig = { ...mysqlConfig, ...newConfig };
  fs.writeFileSync(dbConfigPath, JSON.stringify(mysqlConfig, null, 2));
  pool = createMysqlPool(mysqlConfig); // recrée le pool
  console.log('✅ Nouvelle configuration MySQL appliquée');
}

// ✅ nouvelle fonction dynamique
function getMysqlPool() {
  return pool;
}

// Connexion SQLite


const os = require('os');


let db;

if (process.env.NODE_ENV === 'test') {
  db = new Database(':memory:');
  console.log('✅ Connecté à SQLite en mémoire (mode test)');
} else {
  // 📁 Chemin vers le répertoire persistant de l'utilisateur
  const userDataDir = path.join(os.homedir(), '.bdd-caisse');
  const dbPath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
console.log('🪛 Chemin recherché pour SQLite :', dbPath);

  // 📦 Si le fichier n'existe pas encore, on copie un modèle depuis l'app (template)
  const templatePath = path.join(__dirname, '..', 'database', 'ressourcebrie-sqlite-template.db');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(userDataDir, { recursive: true });
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);
      console.log('📂 Base initialisée depuis le modèle');
    } else {
      throw new Error(`⚠️ Fichier modèle introuvable à : ${templatePath}`);
    }
  }

  db = new Database(dbPath);
  console.log('✅ Connecté à SQLite :', dbPath);
}

module.exports = db;


module.exports = {
  sqlite: db,
  getMysqlPool, // ✅ export dynamique
  updateMysqlConfig,
  getMysqlPresets
};
