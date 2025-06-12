const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');
const { initTables } = require('./testUtils');

test('Processus complet des corrections avec bilan', async () => {
  initTables();
  const now = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000);
  const articles = [
    { nom: 'Objet A', prix: 1000, nbr: 2, categorie: 'Divers' },
    { nom: 'Objet B', prix: 500, nbr: 1, categorie: 'Divers' },
  ];
  const prixTotal = 1000 * 2 + 500 * 1;

  // Création de la vente initiale
  const result = sqlite.prepare(`
    INSERT INTO ticketdecaisse (date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(now, 'Testeur', 1, 3, prixTotal, 'carte');
  let idTicket = result.lastInsertRowid;

  const insertArticle = sqlite.prepare(`
    INSERT INTO objets_vendus (id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of articles) {
    insertArticle.run(idTicket, a.nom, a.prix, a.nbr, a.categorie, 'Testeur', 1, now, timestamp);
  }

  sqlite.prepare(`
    INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total,
      prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(now.slice(0, 10), timestamp, 1, 0, prixTotal, 0, 0, prixTotal, 0);

  // Vérification vente initiale
  let bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan.prix_total).toBe(prixTotal);

  // Correction 1 : réduction bénévole
  let objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);
  let res = await request(app).post('/api/correction').send({
    id_ticket_original: idTicket,
    articles_origine: objets,
    articles_correction: articles,
    motif: 'Correction 1',
    moyen_paiement: 'carte',
    reductionType: 'trueBene'
  });
  expect(res.body.success).toBe(true);
  idTicket = res.body.id_ticket_correction;
  bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan.prix_total).toBe(1500);

  // Correction 2 : réduction client
  objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);
  res = await request(app).post('/api/correction').send({
    id_ticket_original: idTicket,
    articles_origine: objets,
    articles_correction: articles,
    motif: 'Correction 2',
    moyen_paiement: 'carte',
    reductionType: 'trueClient'
  });
  expect(res.body.success).toBe(true);
  idTicket = res.body.id_ticket_correction;
  bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan.prix_total).toBe(2000);

  // Correction 3 : réduction gros panier bénévole
  objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);
  res = await request(app).post('/api/correction').send({
    id_ticket_original: idTicket,
    articles_origine: objets,
    articles_correction: articles,
    motif: 'Correction 3',
    moyen_paiement: 'carte',
    reductionType: 'trueGrosPanierBene'
  });
  expect(res.body.success).toBe(true);
  idTicket = res.body.id_ticket_correction;
  bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan.prix_total).toBe(2000);

  // Correction 4 : réduction gros panier client
  objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);
  res = await request(app).post('/api/correction').send({
    id_ticket_original: idTicket,
    articles_origine: objets,
    articles_correction: articles,
    motif: 'Correction 4',
    moyen_paiement: 'carte',
    reductionType: 'trueGrosPanierClient'
  });
  expect(res.body.success).toBe(true);
  bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan.prix_total).toBe(2250);
});
