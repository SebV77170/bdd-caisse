const mockGetMysqlPool = jest.fn();

jest.mock('../db', () => {
  const actual = jest.requireActual('../db');
  return {
    ...actual,
    getMysqlPool: mockGetMysqlPool
  };
});

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const { sqlite } = require('../db');

describe('Reprise de la synchronisation MySQL', () => {
  beforeEach(() => {
    const schemaPath = path.join(__dirname, '../schema.sql');
    sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
    sqlite.prepare('DELETE FROM sync_log').run();
    jest.clearAllMocks();
  });

  test('remet une ligne en attente après une coupure puis la synchronise au rejeu', async () => {
    let objectAttempts = 0;
    const connection = {
      query: jest.fn(async sql => {
        if (sql.includes('INSERT IGNORE INTO bdd_caisse_sync_operations')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO objets_vendus')) {
          objectAttempts += 1;
          if (objectAttempts === 1) throw new Error('Connexion MySQL perdue');
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn()
    };
    const pool = {
      getConnection: jest.fn().mockResolvedValue(connection),
    };
    mockGetMysqlPool.mockReturnValue(pool);

    const payload = {
      uuid_ticket: 'ticket-offline',
      uuid_objet: 'objet-offline',
      nom: 'Objet test',
      nom_vendeur: 'Caisse',
      id_vendeur: 'user-1',
      categorie: 'Test',
      souscat: 'Test',
      date_achat: '2026-06-09',
      timestamp: 1,
      prix: 100,
      nbr: 1
    };
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced)
      VALUES ('objets_vendus', 'INSERT', ?, 0)
    `).run(JSON.stringify(payload));

    const failed = await request(app).post('/api/sync');
    expect(failed.status).toBe(500);
    expect(failed.body.success).toBe(false);
    expect(sqlite.prepare('SELECT synced FROM sync_log').get().synced).toBe(0);

    const recovered = await request(app).post('/api/sync');
    expect(recovered.status).toBe(200);
    expect(recovered.body.success).toBe(true);
    expect(sqlite.prepare('SELECT synced FROM sync_log').get().synced).toBe(1);
  });

  test('ne réapplique pas une opération déjà validée à distance', async () => {
    let receiptAttempts = 0;
    let objectInserts = 0;
    const connection = {
      query: jest.fn(async sql => {
        if (sql.includes('INSERT IGNORE INTO bdd_caisse_sync_operations')) {
          receiptAttempts += 1;
          return [{ affectedRows: receiptAttempts === 1 ? 1 : 0 }];
        }
        if (sql.includes('INSERT INTO objets_vendus')) {
          objectInserts += 1;
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn()
    };
    mockGetMysqlPool.mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(connection)
    });

    sqlite.prepare(`
      INSERT INTO sync_log (
        operation_uuid, type, operation, payload, synced
      ) VALUES (?, 'objets_vendus', 'INSERT', ?, 0)
    `).run('operation-deja-distante', JSON.stringify({
      uuid_ticket: 'ticket-1',
      uuid_objet: 'objet-1',
      nom: 'Objet',
      id_vendeur: 'user-1',
      timestamp: 1,
      nbr: 1
    }));

    expect((await request(app).post('/api/sync')).status).toBe(200);
    sqlite.prepare('UPDATE sync_log SET synced = 0').run();
    expect((await request(app).post('/api/sync')).status).toBe(200);
    expect((await request(app).post('/api/sync')).status).toBe(200);

    expect(objectInserts).toBe(1);
    expect(receiptAttempts).toBe(2);
    expect(sqlite.prepare('SELECT synced FROM sync_log').get().synced).toBe(1);
  });

  test('laisse une opération inconnue en attente avec un diagnostic', async () => {
    let objectInserts = 0;
    const connection = {
      query: jest.fn(async sql => {
        if (sql.includes('INSERT IGNORE INTO bdd_caisse_sync_operations')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO objets_vendus')) objectInserts += 1;
        return [[]];
      }),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn()
    };
    mockGetMysqlPool.mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(connection)
    });
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced)
      VALUES ('objets_vendus', 'INSERT', ?, 0)
    `).run(JSON.stringify({
      uuid_ticket: 'ticket-valide',
      uuid_objet: 'objet-valide',
      id_vendeur: 'user-1',
      timestamp: 1,
      nbr: 1
    }));
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced)
      VALUES ('inconnu', 'INSERT', '{}', 0)
    `).run();

    const result = await request(app).post('/api/sync');

    expect(result.status).toBe(422);
    expect(result.body.accepted).toEqual([]);
    expect(result.body.failed[0]).toEqual(expect.objectContaining({
      type: 'inconnu',
      error: expect.stringContaining('Type non reconnu')
    }));
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM sync_log WHERE synced = 0'
    ).get().count).toBe(2);
    expect(objectInserts).toBe(0);
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });

  test('conserve le montant carte des anciens payloads de bilan', async () => {
    let bilanUpdateParams;
    const connection = {
      query: jest.fn(async (sql, params) => {
        if (sql.includes('INSERT IGNORE INTO bdd_caisse_sync_operations')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('UPDATE bilan SET')) {
          bilanUpdateParams = params;
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn()
    };
    mockGetMysqlPool.mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(connection)
    });

    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced)
      VALUES ('bilan', 'UPDATE', ?, 0)
    `).run(JSON.stringify({
      date: '2026-06-09',
      timestamp: 123,
      nombre_vente: 1,
      poids: 0,
      prix_total: 2500,
      prix_total_espece: 0,
      prix_total_cheque: 0,
      prix_total_carte: 2500,
      prix_total_virement: 0
    }));

    const result = await request(app).post('/api/sync');

    expect(result.status).toBe(200);
    expect(bilanUpdateParams).toEqual([
      123, 1, 0, 2500, 0, 0, 2500, 0, '09/06/2026'
    ]);
    expect(sqlite.prepare('SELECT synced FROM sync_log').get().synced).toBe(1);
  });
});
