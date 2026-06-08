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
      'bilan'
    ]) {
      sqlite.prepare(`DELETE FROM ${table}`).run();
    }
    io = { emit: jest.fn() };
    app = createApp(io);
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

    expect(res.status).toBe(500);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM bilan').get().count).toBe(0);
  });
});
