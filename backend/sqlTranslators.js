function mapSqliteTypeToMysql(type) {
  if (!type) return '';
  const t = type.toUpperCase();
  if (t === 'INTEGER') return 'INT';
  if (t.startsWith('VARCHAR')) return t; // keep varchar sizes
  if (t === 'REAL') return 'DOUBLE';
  if (t === 'TEXT') return 'TEXT';
  if (t === 'DATETIME') return 'DATETIME';
  return t;
}

function mapMysqlTypeToSqlite(type) {
  if (!type) return '';
  const t = type.toUpperCase();
  if (t === 'INT' || t === 'INTEGER') return 'INTEGER';
  if (t.startsWith('VARCHAR')) return t;
  if (t === 'DOUBLE' || t === 'FLOAT' || t === 'DECIMAL') return 'REAL';
  if (t === 'TEXT' || t.includes('TEXT')) return 'TEXT';
  if (t === 'DATETIME' || t.includes('TIMESTAMP')) return 'TEXT';
  return t;
}

function sqliteCreateToMysql(sql) {
  if (!sql) return sql;
  let res = sql;
  res = res.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
  res = res.replace(/"/g, '`');
  res = res.replace(/INTEGER PRIMARY KEY AUTO_INCREMENT/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  res = res.replace(/INTEGER PRIMARY KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  res = res.replace(/INTEGER/gi, 'INT');
  return res;
}

function mysqlCreateToSqlite(sql) {
  if (!sql) return sql;
  let res = sql;
  res = res.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');
  res = res.replace(/`/g, '');
  res = res.replace(/INT\b/gi, 'INTEGER');
  res = res.replace(/ENGINE=.*?;/i, ';');
  return res;
}

module.exports = {
  mapSqliteTypeToMysql,
  mapMysqlTypeToSqlite,
  sqliteCreateToMysql,
  mysqlCreateToSqlite,
};
