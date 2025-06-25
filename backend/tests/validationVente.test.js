jest.mock('../session');
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: jest.fn().mockResolvedValue(true) }) }));
jest.mock('../utils/genererTicketPdf', () => jest.fn().mockResolvedValue('/tmp/ticket.pdf'));

const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');
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

// Helper to create a simple temporary sale
function createTempSale(id = '1') {
  sqlite.prepare(
    'INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'Produit Test', 1000, 1000, 1, 'Test', 'Standard');
  sqlite.prepare('INSERT INTO vente (id_temp_vente) VALUES (?)').run(id);
}

describe('Test de validation de la route validerVente.routes.js', () => {
  const moyens = [
  { moyen: 'carte', champ: 'prix_total_carte' },
  { moyen: 'espèce', champ: 'prix_total_espece' },  // 🔁 accent ici
  { moyen: 'chèque', champ: 'prix_total_cheque' },  // 🔁 accent ici
  { moyen: 'virement', champ: 'prix_total_virement' }
];


  for (const { moyen, champ } of moyens) {
  test(`Valide une vente payée en ${moyen}`, async () => {
    // Réinitialiser les tables avant chaque test
    sqlite.prepare('DELETE FROM ticketdecaisse').run();
    sqlite.prepare('DELETE FROM bilan').run();

    createTempSale();

    const res = await request(app).post('/api/valider').send({
      id_temp_vente: '1',
      reductionType: '',
      paiements: [{ moyen, montant: 1000 }]
    });

    expect(res.body.success).toBe(true);

    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse').get();
    expect(ticket.moyen_paiement).toBe(moyen);
    expect(ticket.prix_total).toBe(1000);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    console.log(bilan);
    expect(bilan[champ]).toBe(1000);
  });
}

  test('Valide une vente avec paiement mixte', async () => {
    createTempSale();
    const res = await request(app).post('/api/valider').send({
      id_temp_vente: '1',
      reductionType: '',
      paiements: [
        { moyen: 'carte', montant: 400 },
        { moyen: 'espèce', montant: 600 }
      ]
    });

    expect(res.body.success).toBe(true);
    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse').get();
    expect(ticket.moyen_paiement).toBe('mixte');
    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan.prix_total_carte).toBe(400);
    expect(bilan.prix_total_espece).toBe(600);
  });

  const reductions = [
    { type: 'trueClient', champ: 'reducclient', reduction: 500 },
    { type: 'trueBene', champ: 'reducbene', reduction: 1000 },
    { type: 'trueGrosPanierClient', champ: 'reducgrospanierclient', reduction: 100 },
    { type: 'trueGrosPanierBene', champ: 'reducgrospanierbene', reduction: 200 }
  ];

  for (const { type, champ, reduction } of reductions) {
    test(`Applique la réduction ${type}`, async () => {
      createTempSale();
      const montant = 1000 - reduction;
      const res = await request(app).post('/api/valider').send({
        id_temp_vente: '1',
        reductionType: type,
        paiements: [{ moyen: 'carte', montant }]
      });

      expect(res.body.success).toBe(true);
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse').get();
      expect(ticket[champ]).toBe(1);
      expect(ticket.prix_total).toBe(montant);
      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total_carte).toBe(montant);
    });
  }

  test('Retourne une erreur si id_temp_vente manquant', async () => {
    const res = await request(app).post('/api/valider').send({
      reductionType: '',
      paiements: [{ moyen: 'carte', montant: 500 }]
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/donn.+manquantes/i);
  });
});