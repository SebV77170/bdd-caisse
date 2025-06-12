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
      .map(c => ({ name: c.name, type: c.type.toUpperCase() }));

    const [mysqlColumnRows] = await mysql.query(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    const mysqlColumns = mysqlColumnRows.map(c => ({ name: c.name, type: c.type.toUpperCase() }));

    for (const col of sqliteColumns) {
      const match = mysqlColumns.find(c => c.name === col.name);
      if (!match) {
        result.mysqlChanges.push(`Ajouter la colonne '${col.name}' dans '${table}' (${col.type})`);
      } else if (match.type !== col.type) {
        result.mysqlChanges.push(`Modifier le type de '${col.name}' dans '${table}' en ${col.type} (actuel ${match.type})`);
        result.sqliteChanges.push(`Modifier le type de '${col.name}' dans '${table}' en ${match.type} (actuel ${col.type})`);
      }
    }

    for (const col of mysqlColumns) {
      const match = sqliteColumns.find(c => c.name === col.name);
      if (!match) {
        result.sqliteChanges.push(`Ajouter la colonne '${col.name}' dans '${table}' (${col.type})`);
      }
    }
  }

  return result;
}

module.exports = compareSchemas;
