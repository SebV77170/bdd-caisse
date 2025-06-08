jest.mock('../session');
const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');;
const path = require('path');
const fs = require('fs');

function initTables() {
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    sqlite.exec(schema);
  }
  

describe('Test modification prix article et mise à jour bilan', () => {
  const vendeur = { id: 1, nom: 'Testeur' };
  const articles = [
    { nom: 'Produit X', prix: 1000, nbr: 2, categorie: 'Test' },
    { nom: 'Produit Y', prix: 500, nbr: 1, categorie: 'Test' },
  ];

  let idTicket = null;
  let idCorrection = null;

  beforeAll(() => {
    initTables();
    const now = new Date().toISOString();
    const timestamp = Math.floor(Date.now() / 1000);
    const prixTotal = 1000 * 2 + 500 * 1;

    const result = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(now, vendeur.nom, vendeur.id, 3, prixTotal, 'carte');
    idTicket = result.lastInsertRowid;

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of articles) {
      insertArticle.run(idTicket, a.nom, a.prix, a.nbr, a.categorie, vendeur.nom, vendeur.id, now, timestamp);
    }

    sqlite.prepare(`
      INSERT INTO bilan (
        date, timestamp, nombre_vente, poids, prix_total,
        prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      now.slice(0, 10), timestamp, 1, 0, prixTotal, 0, 0, prixTotal, 0
    );
  });

  it('Corrige le prix d’un article et met à jour le bilan', async () => {
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);

    // Changement : Produit X passe de 1000 à 1500
    const articlesModifies = [
      { nom: 'Produit X', prix: 1500, nbr: 2, categorie: 'Test' },
      { nom: 'Produit Y', prix: 500, nbr: 1, categorie: 'Test' },
    ];

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idTicket,
      articles_origine: objets,
      articles_correction: articlesModifies,
      motif: 'Mauvais prix initial',
      moyen_paiement: 'carte',
      reductionType: ''
    });
    console.log('RESPONSE correction:', res.body);
    expect(res.body.success).toBe(true);
    idCorrection = res.body.id_corrige;

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    // Nouveau total : (1500 * 2) + (500 * 1) = 3500
    // Ancien total annulé : 2500 -> bilan final = 1000 de plus
    expect(bilan.prix_total).toBe(3500);
    expect(bilan.prix_total_carte).toBe(3500);
  });
});
