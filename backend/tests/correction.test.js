// correction.test.js

jest.mock('../session', () => ({
  getUser: () => ({ id: 1, nom: 'Testeur' })
}));

jest.mock('../utils/genererTicketPdf', () => jest.fn().mockResolvedValue('/tmp/correction.pdf'));

const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');
const path = require('path');
const fs = require('fs');
const genererTicketPdf = require('../utils/genererTicketPdf');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

function createInitialTicket(uuid_ticket = 'uuid-original') {
  const stmt = sqlite.prepare(`
    INSERT INTO ticketdecaisse (
      uuid_ticket, date_achat_dt, nom_vendeur, id_vendeur,
      nbr_objet, prix_total, moyen_paiement, uuid_session_caisse
    ) VALUES (?, datetime('now'), 'Testeur', 1, 1, 1000, 'carte', 'session-1')
  `);

  const result = stmt.run(uuid_ticket);
  const id_ticket = result.lastInsertRowid;

  sqlite.prepare(`
    INSERT INTO objets_vendus (
      uuid_ticket, nom, prix, nbr, categorie,
      nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
    ) VALUES (?, 'Produit A', 1000, 1, 'Test', 'Testeur', 1, datetime('now'), strftime('%s','now'), 'uuid-article')
  `).run(uuid_ticket);

  sqlite.prepare(`
    INSERT INTO paiement_mixte (
      id_ticket, uuid_ticket, carte, espece, cheque, virement
    ) VALUES (?, ?, 1000, 0, 0, 0)
  `).run(id_ticket, uuid_ticket);

  sqlite.prepare(`
    INSERT INTO bilan (
      date, timestamp, nombre_vente, poids,
      prix_total, prix_total_espece, prix_total_cheque,
      prix_total_carte, prix_total_virement
    )
    VALUES (date('now'), strftime('%s','now'), 1, 0, 1000, 0, 0, 1000, 0)
  `).run();
}

beforeEach(() => {
  initTables();
  sqlite.prepare('DELETE FROM ticketdecaisse').run();
  sqlite.prepare('DELETE FROM bilan').run();
});

describe('Tests de correction de ticket', () => {
  test('Crée une correction sans réduction', async () => {
    createInitialTicket();

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 1,
      uuid_ticket_original: 'uuid-original',
      uuid_session_caisse: 'session-1',
      articles_origine: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      articles_correction: [
        { nom: 'Produit A', prix: 900, nbr: 1, categorie: 'Test' }
      ],
      reductionType: '',
      motif: 'Erreur prix',
      paiements: [{ moyen: 'carte', montant: 900 }]
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tickets = sqlite.prepare('SELECT * FROM ticketdecaisse').all();
    expect(tickets.length).toBe(3);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(900);
    expect(bilan.prix_total_espece).toBe(0);
    expect(bilan.prix_total_cheque).toBe(0);
    expect(bilan.prix_total_carte).toBe(900);
    expect(bilan.prix_total_virement).toBe(0);

    expect(genererTicketPdf).toHaveBeenCalledTimes(2);
  });

  test('Correction avec réduction trueClient appliquée', async () => {
    createInitialTicket();

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 1,
      uuid_ticket_original: 'uuid-original',
      uuid_session_caisse: 'session-1',
      articles_origine: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      articles_correction: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      reductionType: 'trueClient',
      motif: 'Remise client',
      paiements: [{ moyen: 'carte', montant: 500 }]
    });

    expect(res.body.success).toBe(true);

    const ticketCorrection = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE flag_correction = 1').get();
    expect(ticketCorrection.reducclient).toBe(1);
    expect(ticketCorrection.prix_total).toBe(500);

    const articleReduc = sqlite.prepare("SELECT * FROM objets_vendus WHERE uuid_ticket = ? AND categorie = 'Réduction'").get(ticketCorrection.uuid_ticket);
    expect(articleReduc).toBeDefined();
    expect(articleReduc.prix).toBe(-500);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    console.log(bilan);
    // Vérifie les montants attendus
    expect(bilan.prix_total).toBe(500);
    expect(bilan.prix_total_espece).toBe(0);
    expect(bilan.prix_total_cheque).toBe(0);
    expect(bilan.prix_total_carte).toBe(500);
    expect(bilan.prix_total_virement).toBe(0);
  });

  test('Échec de correction si ticket original introuvable', async () => {
    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 999,
      uuid_ticket_original: 'uuid-invalide',
      uuid_session_caisse: 'session-1',
      articles_origine: [],
      articles_correction: [],
      reductionType: '',
      motif: 'Test',
      paiements: []
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/insertion de la correction/i);
  });

  test('Correction avec ajout d’un article', async () => {
    createInitialTicket();

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 1,
      uuid_ticket_original: 'uuid-original',
      uuid_session_caisse: 'session-1',
      articles_origine: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      articles_correction: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' },
        { nom: 'Produit B', prix: 200, nbr: 1, categorie: 'Test' }
      ],
      reductionType: '',
      motif: 'Ajout article',
      paiements: [{ moyen: 'carte', montant: 1200 }]
    });

    expect(res.body.success).toBe(true);

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(res.body.id_ticket_correction);
    expect(objets.length).toBe(2);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    console.log(bilan);
    // Vérifie les montants attendus
    expect(bilan.prix_total).toBe(1200);
    expect(bilan.prix_total_espece).toBe(0);
    expect(bilan.prix_total_cheque).toBe(0);
    expect(bilan.prix_total_carte).toBe(1200);
    expect(bilan.prix_total_virement).toBe(0);
  });

  test('Correction avec suppression d’un article', async () => {
    createInitialTicket();

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 1,
      uuid_ticket_original: 'uuid-original',
      uuid_session_caisse: 'session-1',
      articles_origine: [
        { nom: 'Produit A', prix: 500, nbr: 1, categorie: 'Test' },
        { nom: 'Produit B', prix: 500, nbr: 1, categorie: 'Test' }
      ],
      articles_correction: [
        { nom: 'Produit A', prix: 500, nbr: 1, categorie: 'Test' }
      ],
      reductionType: '',
      motif: 'Suppression article',
      paiements: [{ moyen: 'carte', montant: 500 }]
    });

    expect(res.body.success).toBe(true);

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(res.body.id_ticket_correction);
    expect(objets.length).toBe(1);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    console.log(bilan);
    // Vérifie les montants attendus
    expect(bilan.prix_total).toBe(500);
    expect(bilan.prix_total_espece).toBe(0);
    expect(bilan.prix_total_cheque).toBe(0);
    expect(bilan.prix_total_carte).toBe(500);
    expect(bilan.prix_total_virement).toBe(0);
  });

  test('Correction avec paiement mixte carte + espèces', async () => {
    createInitialTicket();

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: 1,
      uuid_ticket_original: 'uuid-original',
      uuid_session_caisse: 'session-1',
      articles_origine: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      articles_correction: [
        { nom: 'Produit A', prix: 1000, nbr: 1, categorie: 'Test' }
      ],
      reductionType: '',
      motif: 'Paiement divisé',
      paiements: [
        { moyen: 'carte', montant: 600 },
        { moyen: 'espece', montant: 400 }
      ]
    });
    

    expect(res.body.success).toBe(true);

    const mixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE uuid_ticket = ?').get(res.body.id_ticket_correction);
    expect(Number(mixte?.carte || 0)).toBe(600);
    expect(Number(mixte?.espece || 0)).toBe(400);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    console.log(bilan);
    // Vérifie les montants attendus
    expect(bilan.prix_total).toBe(1000);
    expect(bilan.prix_total_espece).toBe(400);
    expect(bilan.prix_total_cheque).toBe(0);
    expect(bilan.prix_total_carte).toBe(600);
    expect(bilan.prix_total_virement).toBe(0);
  });
});
