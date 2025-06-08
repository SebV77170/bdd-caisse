jest.mock('../session');
const request = require('supertest');
const app = require('../app'); // Ton fichier Express principal
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

describe('Test complet des corrections avec bilan', () => {
  let idOriginal = null;
  let idCorrection1 = null;
  let idCorrection2 = null;
  let idCorrection3 = null;

  const articles = [
    { nom: 'Objet A', prix: 1000, nbr: 2, categorie: 'Divers' },
    { nom: 'Objet B', prix: 500, nbr: 1, categorie: 'Divers' },
  ];

  it('Crée une vente initiale simple (sans réduction)', async () => {
    const now = new Date().toISOString();
    const timestamp = Math.floor(Date.now() / 1000);
    const prixTotal = 1000 * 2 + 500 * 1;

    const result = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(now, 'Testeur', 1, 3, prixTotal, 'carte');

    idOriginal = result.lastInsertRowid;

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        id_ticket, nom, prix, nbr, categorie, nom_vendeur, id_vendeur, date_achat, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of articles) {
      insertArticle.run(idOriginal, a.nom, a.prix, a.nbr, a.categorie, 'Testeur', 1, now, timestamp);
    }

    // Simule ajout au bilan
    sqlite.prepare(`
      INSERT INTO bilan (
        date, timestamp, nombre_vente, poids, prix_total,
        prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      now.slice(0, 10), timestamp, 1, 0,
      prixTotal, 0, 0, prixTotal, 0
    );

    const check = sqlite.prepare('SELECT * FROM bilan').get();
    expect(check.prix_total).toBe(prixTotal);
  });

  it('Corrige la vente avec réduction bénévole', async () => {
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idOriginal);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idOriginal,
      articles_origine: objets,
      articles_correction: articles,
      motif: 'Correction 1',
      moyen_paiement: 'carte',
      reductionType: 'trueBene'
    });
    console.log('RESPONSE 1:', res.body);
    expect(res.body.success).toBe(true);
    idCorrection1 = res.body.id_ticket_correction;


    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(1500);
    expect(bilan.prix_total_carte).toBe(1500);
  });

  it('Corrige à réduction client', async () => {
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idCorrection1);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idCorrection1,
      articles_origine: objets,
      articles_correction: articles,
      motif: 'Correction 2',
      moyen_paiement: 'carte',
      reductionType: 'trueClient'
    });
    console.log('RESPONSE 2:', res.body);
    expect(res.body.success).toBe(true);
    idCorrection2 = res.body.id_ticket_correction;


    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(2000);
    expect(bilan.prix_total_carte).toBe(2000);
  });

  it('Corrige à réduction gros panier bénévole', async () => {
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idCorrection2);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idCorrection2,
      articles_origine: objets,
      articles_correction: articles,
      motif: 'Correction 3',
      moyen_paiement: 'carte',
      reductionType: 'trueGrosPanierBene'
    });
    console.log('RESPONSE 3:', res.body);
    expect(res.body.success).toBe(true);
    idCorrection3 = res.body.id_ticket_correction;


    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(2000);
    expect(bilan.prix_total_carte).toBe(2000);
  });

  it('Corrige encore à réduction gros panier client', async () => {
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(idCorrection3);

    const res = await request(app).post('/api/correction').send({
      id_ticket_original: idCorrection3,
      articles_origine: objets,
      articles_correction: articles,
      motif: 'Correction 4',
      moyen_paiement: 'carte',
      reductionType: 'trueGrosPanierClient'
    });
    console.log('RESPONSE 4:', res.body);
    expect(res.body.success).toBe(true);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total).toBe(2250);
    expect(bilan.prix_total_carte).toBe(2250);
  });
});
