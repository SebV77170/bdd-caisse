const fs = require('fs');
const path = require('path');
const { sqlite } = require('../db');
const logSync = require('../logsync');

describe('Identité des opérations de synchronisation', () => {
  beforeEach(() => {
    sqlite.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    sqlite.prepare('DELETE FROM sync_log').run();
  });

  test('attribue un UUID distinct à chaque opération', () => {
    logSync('bilan', 'INSERT', { date: '2026-06-09' });
    logSync('bilan', 'INSERT', { date: '2026-06-09' });

    const rows = sqlite.prepare(
      'SELECT operation_uuid FROM sync_log ORDER BY id'
    ).all();
    expect(rows).toHaveLength(2);
    expect(rows[0].operation_uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(rows[1].operation_uuid).not.toBe(rows[0].operation_uuid);
  });
});
