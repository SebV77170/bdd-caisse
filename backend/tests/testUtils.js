const { sqlite } = require('../db');
const fs = require('fs');
const path = require('path');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

module.exports = { initTables };
