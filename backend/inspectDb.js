const path = require('path');
const Database = require('better-sqlite3');

// 📍 Chemin vers ton fichier .db
const dbPath = path.join(__dirname, '..', 'database', 'ressourcebrie-sqlite.db');
const db = new Database(dbPath);

console.log('✅ Connexion à la base SQLite :', dbPath);

// Obtenir toutes les tables (hors tables système)
const tables = sqlite.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

if (tables.length === 0) {
  console.log('❌ Aucune table trouvée dans la base.');
  process.exit(0);
}

tables.forEach(({ name }) => {
  console.log(`\n📦 Table : ${name}`);

  // Récupérer les colonnes
  const columns = sqlite.prepare(`PRAGMA table_info(${name})`).all();
  console.log('   Colonnes :');
  columns.forEach(col => {
    console.log(`   • ${col.name} (${col.type})`);
  });

  // Compter les lignes
  const { count } = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get();
  console.log(`   Nombre de lignes : ${count}`);
});
