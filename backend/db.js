const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');

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
  host: 'localhost',     // ou l'IP du serveur
  user: 'root',
  password: '',
  database: 'objets',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = {
  sqlite: db,
  mysql: pool
};
