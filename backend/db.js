const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
const dbConfigPath = path.join(__dirname, 'dbConfig.json');
let mysqlConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'objets'
};

if (fs.existsSync(dbConfigPath)) {
  try {
    const conf = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
    mysqlConfig = { ...mysqlConfig, ...conf };
  } catch (err) {
    console.error('Erreur lecture dbConfig.json:', err);
  }
}

let db;

// Si on est en test, on utilise une base en mémoire (isolée)
if (process.env.NODE_ENV === 'test') {
  db = new Database(':memory:');
  console.log('Connecté à SQLite en mémoire (tests isolés)');
} else {
  const dbPath = path.join(__dirname, '..', 'database', 'ressourcebrie-sqlite.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Base de données SQLite introuvable à : ${dbPath}`);
  }

  db = new Database(dbPath);
  console.log('Connecté à SQLite :', dbPath);
}

const pool = mysql.createPool({
  host: mysqlConfig.host,
  user: mysqlConfig.user,
  password: mysqlConfig.password,
  database: mysqlConfig.database,
  waitForConnections: true,
  connectionLimit: 10
});

function updateMysqlConfig(newConfig) {
  mysqlConfig = { ...mysqlConfig, ...newConfig };
  fs.writeFileSync(dbConfigPath, JSON.stringify(mysqlConfig, null, 2));
}

module.exports = {
  sqlite: db,
  mysql: pool,
  updateMysqlConfig
};
