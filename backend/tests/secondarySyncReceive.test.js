const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { sqlite } = require('../db');
const createReceiveRouter = require('../routes/recevoir-de-secondaire');

function initTables() {
  sqlite.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
}

function createApp(io) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { nom: 'Responsable principale' } };
    next();
  });
  app.use('/sync', createReceiveRouter(io));
  return app;
}

describe('Synchronisation reçue depuis une caisse secondaire', () => {
  let io;
  let app;

  beforeEach(() => {
    initTables();
    for (const table of [
      'paiement_mixte',
      'objets_vendus',
      'ticketdecaisse',
      'session_caisse',
      'bilan',
      'journal_corrections',
      'sync_received_operations'
    ]) {
      sqlite.prepare(`DELETE FROM ${table}`).run();
    }
    io = { emit: jest.fn() };
    app = createApp(io);
  });

  test('expose une signature permettant d’identifier la caisse principale', async () => {
    const response = await request(app).get('/sync/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      role: 'caisse-principale',
      service: 'synchronisation-secondaire',
      principalSessionOpen: false,
      principalSessionId: null
    });
  });

  test('attend la confirmation humaine avant d’autoriser une ouverture secondaire', async () => {
    sqlite.prepare(`
      INSERT INTO session_caisse (
        id_session, opened_at_utc, fond_initial, issecondaire
      ) VALUES ('principal-1', datetime('now'), 0, 0)
    `).run();

    const demand = await request(app).post('/sync/ouverture/demande').send({
      sourceId: 'secondary-host',
      sourceName: 'Boutique',
      registerNumber: 2,
      requestedBy: 'Alice'
    });
    expect(demand.status).toBe(200);
    expect(io.emit).toHaveBeenCalledWith(
      'demande-ouverture-secondaire',
      expect.objectContaining({
        requestId: demand.body.requestId,
        sourceName: 'Boutique',
        registerNumber: 2
      })
    );

    const waiting = request(app)
      .post('/sync/ouverture/attente')
      .send({ requestId: demand.body.requestId })
      .then(response => response);

    const answer = await request(app).post('/sync/ouverture/repondre').send({
      requestId: demand.body.requestId,
      decision: 'accepter'
    });
    const result = await waiting;

    expect(answer.status).toBe(200);
    expect(result.body).toEqual({ success: true, decision: 'accepted' });
  });

  test('refuse la demande d’ouverture si aucune principale n’est ouverte', async () => {
    const response = await request(app)
      .post('/sync/ouverture/demande')
      .send({ sourceName: 'Boutique' });

    expect(response.status).toBe(409);
    expect(io.emit).not.toHaveBeenCalledWith(
      'demande-ouverture-secondaire',
      expect.anything()
    );
  });

  test('refuse une demande dont les logs ne sont pas un tableau', async () => {
    const res = await request(app).post('/sync/demande').send({ logs: {} });
    expect(res.status).toBe(400);
  });

  test('mémorise la demande et permet à la principale de la refuser', async () => {
    await request(app).post('/sync/demande').send({
      logs: [{ id: 1, type: 'bilan', operation: 'INSERT', payload: {} }]
    });

    const refusal = await request(app).post('/sync/valider').send({ decision: 'refuser' });
    const result = await request(app).post('/sync/attente-validation').send();

    expect(refusal.status).toBe(200);
    expect(result.body).toMatchObject({ success: false });
    expect(io.emit).toHaveBeenCalledWith(
      'demande-sync-secondaire',
      expect.objectContaining({ type: 'REFUS_SYNC' })
    );
  });

  test('déduplique une demande concurrente et rejoue son accusé de réception', async () => {
    const payload = {
      sourceId: 'caisse-a',
      logs: [{
        id: 50,
        operation_uuid: 'operation-bilan-rejouable',
        type: 'bilan',
        operation: 'INSERT',
        payload: {
          date: '2026-06-11',
          timestamp: 3,
          nombre_vente: 1,
          prix_total: 300
        }
      }]
    };

    const first = await request(app).post('/sync/demande').send(payload);
    const duplicate = await request(app).post('/sync/demande').send(payload);

    expect(duplicate.body).toMatchObject({
      requestId: first.body.requestId,
      duplicate: true
    });

    await request(app).post('/sync/valider').send({
      decision: 'accepter',
      requestId: first.body.requestId,
      uuid_session_caisse_principale: 'principal-1'
    });
    expect((await request(app).post('/sync/attente-validation').send({
      requestId: first.body.requestId
    })).body).toMatchObject({ success: true, ids: [50] });

    const replay = await request(app).post('/sync/demande').send(payload);
    expect(replay.body.replayed).toBe(true);
    expect((await request(app).post('/sync/attente-validation').send({
      requestId: replay.body.requestId
    })).body).toMatchObject({
      success: true,
      ids: [50],
      replayed: true
    });
  });

  test('applique atomiquement ticket, objet, paiement, bilan et session', async () => {
    const logs = [
      {
        id: 11,
        type: 'session_caisse',
        operation: 'INSERT',
        payload: {
          id_session: 'secondary-1',
          opened_at_utc: '2026-06-08T08:00:00.000Z',
          utilisateur_ouverture: 'Alice',
          responsable_ouverture: 'Admin',
          fond_initial: 0,
          issecondaire: 1
        }
      },
      {
        id: 12,
        type: 'ticketdecaisse',
        operation: 'INSERT',
        payload: {
          uuid_ticket: 'ticket-secondary',
          nom_vendeur: 'Alice',
          id_vendeur: 'user-1',
          date_achat_dt: '2026-06-08T09:00:00.000Z',
          nbr_objet: 1,
          moyen_paiement: 'carte',
          prix_total: 1200,
          uuid_session_caisse: 'secondary-1'
        }
      },
      {
        id: 13,
        type: 'objets_vendus',
        operation: 'INSERT',
        payload: {
          uuid_ticket: 'ticket-secondary',
          uuid_objet: 'object-1',
          nom: 'Livre',
          nom_vendeur: 'Alice',
          id_vendeur: 'user-1',
          categorie: 'Culture',
          souscat: 'Livres',
          date_achat: '2026-06-08',
          timestamp: 1780909200,
          prix: 1200,
          nbr: 1
        }
      },
      {
        id: 14,
        type: 'paiement_mixte',
        operation: 'INSERT',
        payload: {
          id_ticket: 1,
          uuid_ticket: 'ticket-secondary',
          carte: 1200
        }
      },
      {
        id: 15,
        type: 'bilan',
        operation: 'INSERT',
        payload: {
          date: '2026-06-08',
          timestamp: 1780909200,
          nombre_vente: 1,
          prix_total: 1200,
          prix_total_carte: 1200
        }
      }
    ];

    await request(app).post('/sync/demande').send({ logs });
    const validation = await request(app).post('/sync/valider').send({
      decision: 'accepter',
      uuid_session_caisse_principale: 'principal-1'
    });
    const result = await request(app).post('/sync/attente-validation').send();

    expect(validation.status).toBe(200);
    expect(result.body).toEqual({ success: true, ids: [11, 12, 13, 14, 15] });
    expect(sqlite.prepare(
      'SELECT uuid_caisse_principale_si_secondaire FROM session_caisse WHERE id_session = ?'
    ).get('secondary-1')).toEqual({
      uuid_caisse_principale_si_secondaire: 'principal-1'
    });
    expect(sqlite.prepare(
      'SELECT prix_total FROM ticketdecaisse WHERE uuid_ticket = ?'
    ).get('ticket-secondary')).toEqual({ prix_total: 1200 });
    expect(sqlite.prepare(
      'SELECT nom FROM objets_vendus WHERE uuid_ticket = ?'
    ).get('ticket-secondary')).toEqual({ nom: 'Livre' });
    expect(sqlite.prepare(
      'SELECT carte FROM paiement_mixte WHERE uuid_ticket = ?'
    ).get('ticket-secondary')).toEqual({ carte: 1200 });
    expect(sqlite.prepare(
      'SELECT nombre_vente, prix_total_carte FROM bilan WHERE date = ?'
    ).get('2026-06-08')).toEqual({ nombre_vente: 1, prix_total_carte: 1200 });
  });

  test('annule toute la transaction si un log est invalide', async () => {
    await request(app).post('/sync/demande').send({
      logs: [
        {
          id: 21,
          type: 'bilan',
          operation: 'INSERT',
          payload: {
            date: '2026-06-08',
            timestamp: 1,
            nombre_vente: 1,
            prix_total: 500
          }
        },
        {
          id: 22,
          type: 'type-inconnu',
          operation: 'INSERT',
          payload: { id: 1 }
        }
      ]
    });

    const res = await request(app).post('/sync/valider').send({
      decision: 'accepter',
      uuid_session_caisse_principale: 'principal-1'
    });

    expect(res.status).toBe(422);
    expect(res.body.accepted).toEqual([]);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM bilan').get().count).toBe(0);
  });

  test('refuse atomiquement un payload incomplet', async () => {
    const demand = await request(app).post('/sync/demande').send({
      sourceId: 'caisse-a',
      logs: [{
        id: 23,
        operation_uuid: 'operation-incomplete',
        type: 'ticketdecaisse',
        operation: 'INSERT',
        payload: { uuid_ticket: 'ticket-incomplet' }
      }]
    });

    const result = await request(app).post('/sync/valider').send({
      decision: 'accepter',
      requestId: demand.body.requestId
    });

    expect(result.status).toBe(422);
    expect(result.body.details).toMatch(/Payload ticketdecaisse:INSERT incomplet/);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ticketdecaisse').get().count).toBe(0);
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM sync_received_operations'
    ).get().count).toBe(0);
  });

  test('refuse un objet faisant référence à un ticket absent', async () => {
    const demand = await request(app).post('/sync/demande').send({
      sourceId: 'caisse-a',
      logs: [{
        id: 24,
        operation_uuid: 'operation-reference-absente',
        type: 'objets_vendus',
        operation: 'INSERT',
        payload: {
          uuid_ticket: 'ticket-absent',
          uuid_objet: 'objet-absent',
          id_vendeur: 'user-1',
          timestamp: 1,
          nbr: 1
        }
      }]
    });

    const result = await request(app).post('/sync/valider').send({
      decision: 'accepter',
      requestId: demand.body.requestId
    });

    expect(result.status).toBe(422);
    expect(result.body.details).toMatch(/ticket absent/);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM objets_vendus').get().count).toBe(0);
  });

  test('ignore le rejeu du même lot sans doubler le bilan', async () => {
    const logs = [{
      id: 31,
      operation_uuid: 'operation-bilan-31',
      type: 'bilan',
      operation: 'INSERT',
      payload: {
        date: '2026-06-09',
        timestamp: 1,
        nombre_vente: 1,
        prix_total: 700,
        prix_total_espece: 700
      }
    }];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const demand = await request(app).post('/sync/demande').send({
        sourceId: 'caisse-a',
        logs
      });
      await request(app).post('/sync/valider').send({
        decision: 'accepter',
        requestId: demand.body.requestId,
        uuid_session_caisse_principale: 'principal-1'
      });
      const result = await request(app).post('/sync/attente-validation').send({
        requestId: demand.body.requestId
      });
      expect(result.body.success).toBe(true);
    }

    expect(sqlite.prepare(
      'SELECT nombre_vente, prix_total, prix_total_espece FROM bilan WHERE date = ?'
    ).get('2026-06-09')).toEqual({
      nombre_vente: 1,
      prix_total: 700,
      prix_total_espece: 700
    });
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM sync_received_operations'
    ).get().count).toBe(1);
  });

  test('conserve séparément deux demandes de caisses simultanées', async () => {
    const first = await request(app).post('/sync/demande').send({
      sourceId: 'caisse-a',
      logs: [
        {
          id: 41,
          operation_uuid: 'operation-ticket-a',
          type: 'ticketdecaisse',
          operation: 'INSERT',
          payload: {
            uuid_ticket: 'ticket-a',
            id_vendeur: 'user-a',
            date_achat_dt: '2026-06-10T10:00:00.000Z',
            nbr_objet: 1,
            prix_total: 300
          }
        },
        {
          id: 42,
          operation_uuid: 'operation-bilan-a',
          type: 'bilan',
          operation: 'INSERT',
          payload: { date: '2026-06-10', timestamp: 1, nombre_vente: 1, prix_total: 300 }
        },
        {
          id: 43,
          operation_uuid: 'operation-correction-a',
          type: 'journal_corrections',
          operation: 'INSERT',
          payload: {
            uuid_ticket_original: 'original-a',
            uuid_ticket_annulation: 'annulation-a',
            utilisateur: 'Alice',
            motif: 'Correction A'
          }
        }
      ]
    });
    const second = await request(app).post('/sync/demande').send({
      sourceId: 'caisse-b',
      logs: [
        {
          id: 41,
          operation_uuid: 'operation-ticket-b',
          type: 'ticketdecaisse',
          operation: 'INSERT',
          payload: {
            uuid_ticket: 'ticket-b',
            id_vendeur: 'user-b',
            date_achat_dt: '2026-06-10T10:00:01.000Z',
            nbr_objet: 1,
            prix_total: 500
          }
        },
        {
          id: 42,
          operation_uuid: 'operation-bilan-b',
          type: 'bilan',
          operation: 'INSERT',
          payload: { date: '2026-06-10', timestamp: 2, nombre_vente: 1, prix_total: 500 }
        },
        {
          id: 43,
          operation_uuid: 'operation-correction-b',
          type: 'journal_corrections',
          operation: 'INSERT',
          payload: {
            uuid_ticket_original: 'original-b',
            uuid_ticket_annulation: 'annulation-b',
            utilisateur: 'Bob',
            motif: 'Correction B'
          }
        }
      ]
    });

    expect(first.body.requestId).not.toBe(second.body.requestId);

    for (const requestId of [second.body.requestId, first.body.requestId]) {
      expect((await request(app).post('/sync/valider').send({
        decision: 'accepter',
        requestId,
        uuid_session_caisse_principale: 'principal-1'
      })).status).toBe(200);
      expect((await request(app).post('/sync/attente-validation').send({
        requestId
      })).body.success).toBe(true);
    }

    expect(sqlite.prepare(
      'SELECT nombre_vente, prix_total FROM bilan WHERE date = ?'
    ).get('2026-06-10')).toEqual({
      nombre_vente: 2,
      prix_total: 800
    });
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM ticketdecaisse WHERE uuid_ticket IN (?, ?)'
    ).get('ticket-a', 'ticket-b').count).toBe(2);
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM journal_corrections'
    ).get().count).toBe(2);
  });
});
