jest.mock('../session', () => ({
  getUser: jest.fn(() => ({ id: 1, nom: 'Testeur' }))
}));
const session = require('../session');
const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');
const fs = require('fs');
const path = require('path');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

describe('Transactions', () => {
  beforeEach(() => {
    initTables();
  });

  test('vente rollback si erreur', async () => {
    const resVente = await request(app).post('/api/ventes/').send();
    const id_temp_vente = resVente.body.id_temp_vente.toString();
    sqlite.prepare(
      `INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
       VALUES (?, 'A', 100, 100, 1, 'Test', 'Sub', 0)`
    ).run(id_temp_vente);

    const res = await request(app).post('/api/valider').send({
      id_temp_vente,
      reductionType: '',
      paiements: [{ moyen: 'carte', montant: 100 }],
      simulateError: true
    });

    expect(res.status).toBe(500);
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM ticketdecaisse').get().c;
    expect(count).toBe(0);
  });

  test('vente reussie', async () => {
    const resVente = await request(app).post('/api/ventes/').send();
    const id_temp_vente = resVente.body.id_temp_vente.toString();
    sqlite.prepare(
      `INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
       VALUES (?, 'A', 100, 100, 1, 'Test', 'Sub', 0)`
    ).run(id_temp_vente);

    const res = await request(app).post('/api/valider').send({
      id_temp_vente,
      reductionType: '',
      paiements: [{ moyen: 'carte', montant: 100 }]
    });

    expect(res.body.success).toBe(true);
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM ticketdecaisse').get().c;
    expect(count).toBe(1);
  });

  test('correction rollback si erreur', async () => {
    const now = new Date().toISOString();
    const ts = Math.floor(Date.now() / 1000);
    const result = sqlite.prepare(
      `INSERT INTO ticketdecaisse (date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(now, 'Testeur', 1, 1, 100, 'carte');
    const idTicket = result.lastInsertRowid;
    sqlite.prepare(
      `INSERT INTO objets_vendus (id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp)
       VALUES (?, 'A', 100, 1, 'Test', 'Testeur', 1, ?, ?)`
    ).run(idTicket, now, ts);
    sqlite.prepare(
      `INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
       VALUES (?, ?, 1, 0, 100, 0, 0, 100, 0)`
    ).run(now.slice(0,10), ts);

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idTicket,
      articles_origine: objets,
      articles_correction: objets,
      motif: 'bug',
      moyen_paiement: 'carte',
      reductionType: '',
      simulateError: true
    });

    expect(res.status).toBe(500);
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM ticketdecaisse').get().c;
    expect(count).toBe(1);
  });

  test('correction reussie', async () => {
    const now = new Date().toISOString();
    const ts = Math.floor(Date.now() / 1000);
    const result = sqlite.prepare(
      `INSERT INTO ticketdecaisse (date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(now, 'Testeur', 1, 1, 100, 'carte');
    const idTicket = result.lastInsertRowid;
    sqlite.prepare(
      `INSERT INTO objets_vendus (id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp)
       VALUES (?, 'A', 100, 1, 'Test', 'Testeur', 1, ?, ?)`
    ).run(idTicket, now, ts);
    sqlite.prepare(
      `INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
       VALUES (?, ?, 1, 0, 100, 0, 0, 100, 0)`
    ).run(now.slice(0,10), ts);

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idTicket,
      articles_origine: objets,
      articles_correction: objets,
      motif: 'ok',
      moyen_paiement: 'carte',
      reductionType: ''
    });

    expect(res.body.success).toBe(true);
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM ticketdecaisse').get().c;
    expect(count).toBe(3);
  });
});
