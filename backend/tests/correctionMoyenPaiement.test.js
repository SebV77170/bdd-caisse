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
  
  beforeEach(() => {
    initTables();
  });

describe('Test modification des moyens de paiement et mise à jour du bilan', () => {
  const vendeur = { id: 1, nom: 'Testeur' };
  const articles = [
    { nom: 'Produit P', prix: 1000, nbr: 2, categorie: 'Paiement' },
  ];
  const prixTotal = 2000;
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const timestamp = Math.floor(Date.now() / 1000);

  const moyens = ['espèce', 'cheque', 'carte', 'virement'];
  const champs = {
    'espèce': 'prix_total_espece',
    'cheque': 'prix_total_cheque',
    'carte': 'prix_total_carte',
    'virement': 'prix_total_virement',
  };

  beforeEach(() => {
    sqlite.prepare('DELETE FROM ticketdecaisse').run();
    sqlite.prepare('DELETE FROM objets_vendus').run();
    sqlite.prepare('DELETE FROM bilan').run();
    sqlite.prepare('DELETE FROM journal_corrections').run();
    sqlite.prepare('DELETE FROM paiement_mixte').run();
  });

  for (const moyen of moyens) {
    it(`Corrige le moyen de paiement vers ${moyen}`, async () => {
      const result = sqlite.prepare(`
        INSERT INTO ticketdecaisse (date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(now, vendeur.nom, vendeur.id, 2, prixTotal, 'carte');
      const idTicket = result.lastInsertRowid;

      const insertArticle = sqlite.prepare(`
        INSERT INTO objets_vendus (id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of articles) {
        insertArticle.run(idTicket, a.nom, a.prix, a.nbr, a.categorie, vendeur.nom, vendeur.id, now, timestamp);
      }

      sqlite.prepare(`
        INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(date, timestamp, 1, 0, prixTotal, 0, 0, prixTotal, 0);

      const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);

      const res = await request(app).post('/api/correction').send({
        id_ticket_original: idTicket,
        articles_origine: objets,
        articles_correction: articles,
        motif: `Changement vers ${moyen}`,
        moyen_paiement: moyen,
        reductionType: ''
      });

      console.log(`RESPONSE ${moyen}:`, res.body);
      expect(res.body.success).toBe(true);

      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total).toBe(2000);
      expect(bilan[champs[moyen]]).toBe(2000);
      for (const m of Object.keys(champs)) {
        if (m !== moyen) expect(bilan[champs[m]]).toBe(0);
      }
    });
  }

  it('Corrige vers un paiement mixte', async () => {
    const result = sqlite.prepare(`
      INSERT INTO ticketdecaisse (date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(now, vendeur.nom, vendeur.id, 2, prixTotal, 'carte');
    const idTicket = result.lastInsertRowid;

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of articles) {
      insertArticle.run(idTicket, a.nom, a.prix, a.nbr, a.categorie, vendeur.nom, vendeur.id, now, timestamp);
    }

    sqlite.prepare(`
      INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(date, timestamp, 1, 0, prixTotal, 0, 0, prixTotal, 0);

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idTicket);

    const paiements = [
      { moyen: 'espèce', montant: 500 },
      { moyen: 'cheque', montant: 500 },
      { moyen: 'carte', montant: 500 },
      { moyen: 'virement', montant: 500 },
    ];

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idTicket,
      articles_origine: objets,
      articles_correction: articles,
      motif: 'Changement vers mixte',
      moyen_paiement: 'mixte',
      reductionType: '',
      paiements
    });

    console.log('RESPONSE mixte:', res.body);
    expect(res.body.success).toBe(true);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(2000);
    expect(bilan.prix_total_espece).toBe(500);
    expect(bilan.prix_total_cheque).toBe(500);
    expect(bilan.prix_total_carte).toBe(500);
    expect(bilan.prix_total_virement).toBe(500);
  });
});
