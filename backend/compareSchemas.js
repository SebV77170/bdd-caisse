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

  const changes = [];

  const missingInMysql = sqliteTables.filter(t => !mysqlTables.includes(t));
  const missingInSqlite = mysqlTables.filter(t => !sqliteTables.includes(t));

  if (missingInMysql.length) {
    changes.push(`Tables missing in MySQL: ${missingInMysql.join(', ')}`);
  }
  if (missingInSqlite.length) {
    changes.push(`Tables missing in SQLite: ${missingInSqlite.join(', ')}`);
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
        changes.push(`Column '${col.name}' missing in MySQL table '${table}'`);
      } else if (!match.type.includes(col.type)) {
        changes.push(`Column '${col.name}' type mismatch in table '${table}': SQLite ${col.type} vs MySQL ${match.type}`);
      }
    }

    for (const col of mysqlColumns) {
      const match = sqliteColumns.find(c => c.name === col.name);
      if (!match) {
        changes.push(`Column '${col.name}' missing in SQLite table '${table}'`);
      }
    }
  }

  let output = [];
  if (changes.length === 0) {
    output.push('✅ The schemas appear identical.');
  } else {
    output.push('❌ Differences found:');
    output.push(...changes.map(ch => `- ${ch}`));
  }
  return output;
}

module.exports = compareSchemas;
