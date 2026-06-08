const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');

function initTables() {
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  sqlite.exec(schema);
}

function seedTicket(uuid = 'ticket-1') {
  const result = sqlite.prepare(`
    INSERT INTO ticketdecaisse (
      uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
      nbr_objet, moyen_paiement, prix_total, uuid_session_caisse
    ) VALUES (?, 'Alice', 'user-1', datetime('now'), 1, 'carte', 1250, 'session-1')
  `).run(uuid);

  sqlite.prepare(`
    INSERT INTO objets_vendus (
      uuid_ticket, nom_vendeur, id_vendeur, nom, categorie,
      date_achat, timestamp, prix, nbr, uuid_objet
    ) VALUES (?, 'Alice', 'user-1', 'Livre', 'Culture',
      datetime('now'), strftime('%s','now'), 1250, 1, 'object-1')
  `).run(uuid);

  sqlite.prepare(`
    INSERT INTO paiement_mixte (
      id_ticket, uuid_ticket, carte, espece, cheque, virement
    ) VALUES (?, ?, 1250, 0, 0, 0)
  `).run(result.lastInsertRowid, uuid);

  sqlite.prepare(
    'INSERT INTO uuid_mapping (uuid, id_friendly, type) VALUES (?, ?, ?)'
  ).run(uuid, 'T-0001', 'ticket');
}

describe('Routes /api/bilan', () => {
  beforeEach(() => {
    initTables();
    for (const table of [
      'journal_corrections',
      'paiement_mixte',
      'objets_vendus',
      'ticketdecaisse',
      'uuid_mapping',
      'bilan'
    ]) {
      sqlite.prepare(`DELETE FROM ${table}`).run();
    }
  });

  test('GET / liste les tickets avec leur identifiant lisible', async () => {
    seedTicket();

    const res = await request(app).get('/api/bilan');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      uuid_ticket: 'ticket-1',
      id_friendly: 'T-0001',
      ticket_corrige: 0,
      est_correction: 0
    });
  });

  test('GET /:id/objets renvoie les lignes du ticket', async () => {
    seedTicket();

    const res = await request(app).get('/api/bilan/ticket-1/objets');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ nom: 'Livre', prix: 1250 });
  });

  test('GET /:uuid/details renvoie ticket, objets et paiement mixte', async () => {
    seedTicket();

    const res = await request(app).get('/api/bilan/ticket-1/details');

    expect(res.status).toBe(200);
    expect(res.body.ticket.uuid_ticket).toBe('ticket-1');
    expect(res.body.objets).toHaveLength(1);
    expect(res.body.paiementMixte.carte).toBe(1250);
    expect(res.body.historique).toEqual([]);
  });

  test('GET /:uuid/details renvoie 404 pour un ticket absent', async () => {
    const res = await request(app).get('/api/bilan/inconnu/details');
    expect(res.status).toBe(404);
  });

  test('GET /jour renvoie un bilan nul en absence de ventes', async () => {
    const res = await request(app).get('/api/bilan/jour');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nombre_vente: 0, prix_total: 0 });
  });

  test('GET /jour renvoie les totaux de la date courante', async () => {
    sqlite.prepare(`
      INSERT INTO bilan (
        date, timestamp, nombre_vente, poids, prix_total,
        prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
      ) VALUES (date('now'), strftime('%s','now'), 2, 0, 3000, 1000, 0, 2000, 0)
    `).run();

    const res = await request(app).get('/api/bilan/jour');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre_vente: 2,
      prix_total: 3000,
      prix_total_espece: 1000,
      prix_total_carte: 2000
    });
  });

  test('les bilans de session exigent leur identifiant', async () => {
    const bilan = await request(app).get('/api/bilan/bilan_session_caisse');
    const reductions = await request(app).get('/api/bilan/reductions_session_caisse');

    expect(bilan.status).toBe(400);
    expect(reductions.status).toBe(400);
  });
});
