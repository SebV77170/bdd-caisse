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
  if (!sql) return '';

  let result = sql;

  // Remplacer nom de table avec backticks
  result = result.replace(/CREATE TABLE IF NOT EXISTS "?(\w+)"?/i, 'CREATE TABLE `$1`');

  // Corriger TEXT utilisé dans des clés primaires ou indexées
  result = result.replace(
    /(\b\w+\b)\s+TEXT\s+PRIMARY KEY/gi,
    (match, col) => `\`${col}\` VARCHAR(255) PRIMARY KEY`
  );

  result = result.replace(
    /(\b\w+\b)\s+TEXT\s+UNIQUE/gi,
    (match, col) => `\`${col}\` VARCHAR(255) UNIQUE`
  );

  // Types généraux
  result = result
    .replace(/\bINTEGER\b/gi, 'INT')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bTEXT\b/gi, 'TEXT')
    .replace(/\bBOOLEAN\b/gi, 'TINYINT(1)')
    .replace(/\bAUTOINCREMENT\b/gi, 'AUTO_INCREMENT')
    .replace(/\bVARCHAR\b(?!\s*\()/gi, 'VARCHAR(255)')
    .replace(/\bVARCHAR\(\)/gi, 'VARCHAR(255)')
    .replace(/\bTEXT\(\d+\)/gi, 'TEXT')
    .replace(/\bINT\(\d+\)/gi, 'INT')
    .replace(/\bTIMESTAMP\(\d+\)/gi, 'TIMESTAMP');

  // Champ spécifique
  result = result.replace(/\bdateheure\b\s+TEXT/gi, 'dateheure DATETIME');

  // Supprimer contraintes SQLite
  result = result.replace(/\s+WITHOUT ROWID\s*;?/i, '');

  // Remplacer les noms de colonnes entre guillemets
  result = result.replace(/"(\w+)"/g, '`$1`');

  // Corriger les virgules avant les parenthèses fermantes
  result = result.replace(/,\s*\)/g, ')');

  // Corriger la longueur des VARCHAR en PRIMARY KEY pour éviter ER_TOO_LONG_KEY
result = result.replace(/`(\w+)`\s+VARCHAR\(255\)\s+PRIMARY KEY/gi, '`$1` VARCHAR(191) PRIMARY KEY');

  // Ajouter un ; final
  if (!result.trim().endsWith(';')) result += ';';

  return result;
}





function mysqlCreateToSqlite(sql) {
  if (!sql) return sql;
  let res = sql;
  // convert AUTO_INCREMENT columns to SQLite AUTOINCREMENT primary key
  res = res.replace(/`?(\w+)`?\s+int\(\d+\)\s+(?:NOT\s+NULL\s+)?AUTO_INCREMENT/gi, '$1 INTEGER PRIMARY KEY AUTOINCREMENT');
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
  // remove table-level primary key when AUTOINCREMENT already applied
  if (/AUTOINCREMENT/i.test(res)) {
    res = res.replace(/,?\s*PRIMARY KEY \([^)]+\)/i, '');
  }
  res = res.replace(/\s+/g, ' ').trim();
  return res;
}

module.exports = {
  mapSqliteTypeToMysql,
  mapMysqlTypeToSqlite,
  sqliteCreateToMysql,
  mysqlCreateToSqlite,
};
