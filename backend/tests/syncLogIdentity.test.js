const fs = require('fs');
const path = require('path');
const { sqlite } = require('../db');
const logSync = require('../logSync');

describe('Identité des opérations de synchronisation', () => {
  beforeEach(() => {
    sqlite.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    sqlite.prepare('DELETE FROM sync_log').run();
    sqlite.prepare('DELETE FROM session_caisse').run();
    sqlite.prepare('DELETE FROM app_migrations').run();
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

  test('marque immédiatement les opérations d’une caisse principale', () => {
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{}', 0)
    `).run();
    sqlite.prepare(`
      INSERT INTO session_caisse (id_session, fond_initial, issecondaire)
      VALUES ('principal-1', 0, 0)
    `).run();

    logSync('bilan', 'INSERT', { date: '2026-06-11' });

    expect(sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM sync_log
      WHERE senttoprincipal = 0
    `).get().count).toBe(0);
    expect(sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM app_migrations
      WHERE name = 'sync_log_senttoprincipal_principal_v1'
    `).get().count).toBe(1);
  });

  test('conserve les opérations d’une caisse secondaire en attente', () => {
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{}', 0)
    `).run();
    sqlite.prepare(`
      INSERT INTO session_caisse (id_session, fond_initial, issecondaire)
      VALUES ('secondary-1', 0, 1)
    `).run();

    logSync('bilan', 'INSERT', { date: '2026-06-11' });

    expect(sqlite.prepare(`
      SELECT senttoprincipal
      FROM sync_log
      ORDER BY id
    `).all()).toEqual([
      { senttoprincipal: 0 },
      { senttoprincipal: 0 }
    ]);
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM app_migrations'
    ).get().count).toBe(0);
  });

  test('utilise le rôle explicite avant l’insertion de la session', () => {
    logSync(
      'uuid_mapping',
      'INSERT',
      { uuid: 'session-principale' },
      { isSecondary: false }
    );
    logSync(
      'uuid_mapping',
      'INSERT',
      { uuid: 'session-secondaire' },
      { isSecondary: true }
    );

    expect(sqlite.prepare(`
      SELECT senttoprincipal
      FROM sync_log
      ORDER BY id
    `).all()).toEqual([
      { senttoprincipal: 1 },
      { senttoprincipal: 0 }
    ]);
  });
});
