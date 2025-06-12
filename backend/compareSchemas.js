const { sqlite, mysql } = require('./db');

function normalizeType(type) {
  if (!type) return '';
  type = type.toUpperCase();
  // Remove length/precision details like VARCHAR(255) -> VARCHAR
  type = type.replace(/\(.+\)/, '');
  if (type.startsWith('INTEGER')) return 'INT';
  if (type.startsWith('INT')) return 'INT';
  if (type.startsWith('VAR')) return 'VARCHAR';
  if (type.startsWith('VARCHAR')) return 'VARCHAR';
  return type;
}

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
      .map(c => ({
        name: c.name,
        type: c.type.toUpperCase(),
        normType: normalizeType(c.type)
      }));

    const [mysqlColumnRows] = await mysql.query(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    const mysqlColumns = mysqlColumnRows.map(c => ({
      name: c.name,
      type: c.type.toUpperCase(),
      normType: normalizeType(c.type)
    }));

    for (const col of sqliteColumns) {
      const match = mysqlColumns.find(c => c.name === col.name);
      if (!match) {
        result.mysqlChanges.push(`Ajouter la colonne '${col.name}' dans '${table}'`);
      } else if (match.normType !== col.normType) {
        result.mysqlChanges.push(`Mettre à jour la colonne '${col.name}' dans '${table}'`);
        result.sqliteChanges.push(`Mettre à jour la colonne '${col.name}' dans '${table}'`);
      }
    }

    for (const col of mysqlColumns) {
      const match = sqliteColumns.find(c => c.name === col.name);
      if (!match) {
        result.sqliteChanges.push(`Ajouter la colonne '${col.name}' dans '${table}'`);
      }
    }
  }

  return result;
}

module.exports = compareSchemas;
