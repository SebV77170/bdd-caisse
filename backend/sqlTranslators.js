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
  if (/^INT(\(\d+\))?$/.test(t) || t === 'INTEGER') return 'INTEGER';
  if (/^BIGINT(\(\d+\))?$/.test(t)) return 'INTEGER';
  if (t.startsWith('VARCHAR')) return t;
  if (/^(DOUBLE|FLOAT|DECIMAL)/.test(t)) return 'REAL';
  if (t.includes('TEXT') || t.startsWith('CHAR')) return 'TEXT';
  if (t === 'DATETIME' || t.includes('TIMESTAMP')) return 'TEXT';
  return 'TEXT';
}

function sqliteCreateToMysql(sql) {
  if (!sql) return sql;
  let res = sql;
  res = res.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
  res = res.replace(/"/g, '`');
  res = res.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  res = res.replace(/INTEGER PRIMARY KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  res = res.replace(/\bINTEGER\b/gi, 'INT');
  res = res.replace(/REAL/gi, 'DOUBLE');
  return res;
}

function mysqlCreateToSqlite(sql) {
  if (!sql) return sql;
  let res = sql;
  res = res.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');
  res = res.replace(/`/g, '');
  res = res.replace(/int\(\d+\)/gi, 'INTEGER');
  res = res.replace(/\bINT\b/gi, 'INTEGER');
  res = res.replace(/bigint\(\d+\)/gi, 'INTEGER');
  res = res.replace(/(double|float|decimal)\([^)]+\)/gi, 'REAL');
  res = res.replace(/UNSIGNED/gi, '');
  res = res.replace(/ENGINE=[^;]+/i, '');
  res = res.replace(/DEFAULT CHARSET=[^;]+/i, '');
  res = res.replace(/COLLATE [^ ]+/gi, '');
  res = res.replace(/\s+/g, ' ').trim();
  return res;
}

module.exports = {
  mapSqliteTypeToMysql,
  mapMysqlTypeToSqlite,
  sqliteCreateToMysql,
  mysqlCreateToSqlite,
};
