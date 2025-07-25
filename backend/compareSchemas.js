const { sqlite, getMysqlPool } = require('./db');
const {
  mapSqliteTypeToMysql,
  mapMysqlTypeToSqlite,
  sqliteCreateToMysql,
  mysqlCreateToSqlite,
} = require('./sqlTranslators');

function normalizeType(type) {
  if (!type) return '';
  return type.toUpperCase().replace(/\(.+\)/, '').replace(/^INT$/, 'INTEGER').replace(/^VAR$/, 'VARCHAR');
}

async function getSqliteCreate(table) {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return row ? row.sql : null;
}

async function getMysqlCreate(table) {
  const pool = getMysqlPool();
  if (!table || typeof table !== 'string') throw new Error(`Nom de table invalide : ${table}`);
  const [rows] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
  return rows && rows[0] ? rows[0]['Create Table'] : null;
}


async function compareSchemas() {
  const pool = getMysqlPool();
  const sqliteTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(r => r.name);

  const [mysqlTableRows] = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  const mysqlTables = mysqlTableRows.map(r => Object.values(r)[0]).filter(Boolean);


  const result = {
    mysqlChanges: [],
    sqliteChanges: []
  };

 for (const table of sqliteTables) {
  if (!table || typeof table !== 'string') {
    console.warn('Nom de table SQLite invalide détecté :', table);
    continue;
  }

  if (!mysqlTables.includes(table)) {
    const createSQL = await getSqliteCreate(table);
    result.mysqlChanges.push({ action: 'createTable', table, createSQL });
  }
}


  for (const table of mysqlTables) {
  if (!table || typeof table !== 'string') {
    console.warn('Nom de table MySQL invalide détecté :', table);
    continue;
  }

  if (!sqliteTables.includes(table)) {
    const createSQL = await getMysqlCreate(table);
    result.sqliteChanges.push({ action: 'createTable', table, createSQL });
  }
}


  for (const table of sqliteTables) {
    if (!mysqlTables.includes(table)) continue;

    const sqliteColumns = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map(c => ({ name: c.name, type: normalizeType(c.type) }));

    const [mysqlColumnRows] = await pool.query(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    const mysqlColumns = mysqlColumnRows.map(c => ({ name: c.name, type: normalizeType(c.type) }));
    const mysqlColNames = mysqlColumns.map(c => c.name);
    const sqliteColNames = sqliteColumns.map(c => c.name);

    for (const col of sqliteColumns) {
      if (!mysqlColNames.includes(col.name)) {
        result.mysqlChanges.push({ action: 'addColumn', table, column: col.name, type: col.type });
        result.sqliteChanges.push({ action: 'dropColumn', table, column: col.name });
      }
    }

    for (const col of mysqlColumns) {
      if (!sqliteColNames.includes(col.name)) {
        result.sqliteChanges.push({ action: 'addColumn', table, column: col.name, type: col.type });
        result.mysqlChanges.push({ action: 'dropColumn', table, column: col.name });
      }
    }
  }

  return result;
}

async function applySchemaChanges(mysqlChanges = [], sqliteChanges = []) {
  const pool = getMysqlPool();
  for (const change of mysqlChanges) {
    if (change.action === 'createTable' && change.createSQL) {
      const sql = sqliteCreateToMysql(change.createSQL);
      await pool.query(sql);
    } else if (change.action === 'addColumn') {
      const type = mapSqliteTypeToMysql(change.type);
      await pool.query(`ALTER TABLE \`${change.table}\` ADD COLUMN \`${change.column}\` ${type}`);
    } else if (change.action === 'dropColumn') {
      await pool.query(`ALTER TABLE \`${change.table}\` DROP COLUMN \`${change.column}\``);
    }
  }

  for (const change of sqliteChanges) {
    if (change.action === 'createTable' && change.createSQL) {
      const sql = mysqlCreateToSqlite(change.createSQL);
      sqlite.prepare(sql).run();
    } else if (change.action === 'addColumn') {
      const type = mapMysqlTypeToSqlite(change.type);
      sqlite.prepare(`ALTER TABLE ${change.table} ADD COLUMN ${change.column} ${type}`).run();
    } else if (change.action === 'dropColumn') {
      sqlite.prepare(`ALTER TABLE ${change.table} DROP COLUMN ${change.column}`).run();
    }
  }
}

module.exports = { compareSchemas, applySchemaChanges };
