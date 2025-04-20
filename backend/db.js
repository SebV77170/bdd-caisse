const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'objets' // ou le nom exact depuis ton .sql
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connecté à MySQL');
});

module.exports = db;
