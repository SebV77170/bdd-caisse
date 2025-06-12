const { sqlite, mysql } = require('./db');

async function compareSchemas() {
  const sqliteTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(r => r.name);

  const [mysqlTableRows] = await mysql.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  const mysqlTables = mysqlTableRows.map(r => r.TABLE_NAME);

  const result = {
    mysqlChanges: [],
    sqliteChanges: []
  };

  for (const table of sqliteTables) {
    if (!mysqlTables.includes(table)) {
      result.mysqlChanges.push(`Créer la table '${table}'`);
    }
  }

  for (const table of mysqlTables) {
    if (!sqliteTables.includes(table)) {
      result.sqliteChanges.push(`Créer la table '${table}'`);
    }
  }

  for (const table of sqliteTables) {
    if (!mysqlTables.includes(table)) continue;

    const sqliteColumns = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map(c => c.name);

    const [mysqlColumnRows] = await mysql.query(
      `SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    const mysqlColumns = mysqlColumnRows.map(c => c.name);

    for (const col of sqliteColumns) {
      if (!mysqlColumns.includes(col)) {
        result.mysqlChanges.push(`Ajouter la colonne '${col}' dans '${table}'`);
        result.sqliteChanges.push(`Supprimer la colonne '${col}' de '${table}'`);
      }
    }

    for (const col of mysqlColumns) {
      if (!sqliteColumns.includes(col)) {
        result.sqliteChanges.push(`Ajouter la colonne '${col}' dans '${table}'`);
        result.mysqlChanges.push(`Supprimer la colonne '${col}' de '${table}'`);
      }
    }
  }

  return result;
}

module.exports = compareSchemas;
