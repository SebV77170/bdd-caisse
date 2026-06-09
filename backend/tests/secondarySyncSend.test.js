const mockFetch = jest.fn();
const mockVerifyAdmin = jest.fn();
const mockLogSync = jest.fn();

jest.mock('node-fetch', () => mockFetch);
jest.mock('../utils/verifyAdmin', () => mockVerifyAdmin);
jest.mock('../logSync', () => mockLogSync);
jest.mock('../principalIpConfig', () => ({
  getConfig: () => ({ ip: '192.0.2.10' })
}));

const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { sqlite } = require('../db');
const router = require('../routes/envoyer-secondaire-vers-principal');

function initTables() {
  sqlite.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body)
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { nom: 'Alice' } };
    next();
  });
  app.use('/send', router);
  return app;
}

describe('Envoi d’une caisse secondaire vers la principale', () => {
  beforeEach(() => {
    initTables();
    sqlite.prepare('DELETE FROM sync_log').run();
    sqlite.prepare('DELETE FROM session_caisse').run();
    mockFetch.mockReset();
    mockVerifyAdmin.mockReset();
    mockLogSync.mockReset();
    mockVerifyAdmin.mockReturnValue({
      valid: true,
      user: { nom: 'Responsable' }
    });
  });

  test('ferme la secondaire puis marque les logs validés comme envoyés', async () => {
    sqlite.prepare(`
      INSERT INTO session_caisse (
        id_session, opened_at_utc, fond_initial, issecondaire
      ) VALUES ('secondary-1', datetime('now'), 0, 1)
    `).run();
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{"date":"2026-06-08"}', 0, 0)
    `).run();
    const logId = sqlite.prepare('SELECT id FROM sync_log').get().id;

    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, {
        message: 'demande reçue',
        requestId: 'request-1'
      }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, ids: [logId] }));

    const res = await request(createApp()).post('/send').send({
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret',
      commentaire: 'fin de journée'
    });

    expect(res.status).toBe(200);
    expect(res.body.ids).toEqual([logId]);
    expect(sqlite.prepare(
      'SELECT closed_at_utc, responsable_fermeture FROM session_caisse'
    ).get()).toMatchObject({ responsable_fermeture: 'Responsable' });
    expect(sqlite.prepare(
      'SELECT senttoprincipal FROM sync_log WHERE id = ?'
    ).get(logId)).toEqual({ senttoprincipal: 1 });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://192.0.2.10:3001/api/sync/recevoir-de-secondaire/demande',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://192.0.2.10:3001/api/sync/recevoir-de-secondaire/attente-validation',
      expect.objectContaining({
        body: JSON.stringify({ requestId: 'request-1' })
      })
    );
  });

  test('ne marque aucun log si la principale refuse la demande', async () => {
    sqlite.prepare(`
      INSERT INTO session_caisse (
        id_session, opened_at_utc, fond_initial, issecondaire
      ) VALUES ('secondary-1', datetime('now'), 0, 1)
    `).run();
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{}', 0, 0)
    `).run();
    mockFetch.mockResolvedValueOnce(jsonResponse(503, { message: 'indisponible' }));

    const res = await request(createApp()).post('/send').send({
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret'
    });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PRINCIPAL_UNREACHABLE',
      configuredIp: '192.0.2.10',
      recovery: {
        sessionId: 'secondary-1',
        configuredIp: '192.0.2.10'
      }
    });
    expect(res.body.recovery.startISO).toBeTruthy();
    expect(res.body.recovery.endISO).toBeTruthy();
    expect(sqlite.prepare('SELECT senttoprincipal FROM sync_log').get()).toEqual({
      senttoprincipal: 0
    });
    expect(sqlite.prepare(
      'SELECT closed_at_utc FROM session_caisse WHERE id_session = ?'
    ).get('secondary-1').closed_at_utc).toBeTruthy();
  });

  test('ignore les identifiants étrangers retournés par la principale', async () => {
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{"date":"2026-06-09"}', 0, 0)
    `).run();
    const sentId = sqlite.prepare('SELECT id FROM sync_log').get().id;
    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload, synced, senttoprincipal)
      VALUES ('bilan', 'INSERT', '{"date":"2026-06-10"}', 0, 1)
    `).run();
    const foreignId = sqlite.prepare(
      'SELECT id FROM sync_log WHERE id <> ?'
    ).get(sentId).id;

    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { requestId: 'request-2' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        success: true,
        ids: [sentId, foreignId]
      }));

    const res = await request(createApp()).post('/send').send({
      mode: 'resendWindow',
      window: {
        startISO: '2000-01-01T00:00:00.000Z',
        endISO: '2100-01-01T00:00:00.000Z'
      },
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret'
    });

    expect(res.body.ids).toEqual([sentId]);
  });

  test('le mode de rattrapage exige une fenêtre et des identifiants valides', async () => {
    mockVerifyAdmin.mockReturnValue({ valid: false, error: 'Accès refusé' });

    const invalidAdmin = await request(createApp()).post('/send').send({
      mode: 'resendWindow',
      responsable_pseudo: 'x',
      mot_de_passe: 'y'
    });

    expect(invalidAdmin.status).toBe(403);

    mockVerifyAdmin.mockReturnValue({ valid: true, user: { nom: 'Admin' } });
    const missingWindow = await request(createApp()).post('/send').send({
      mode: 'resendWindow',
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret'
    });

    expect(missingWindow.status).toBe(400);
  });
});
