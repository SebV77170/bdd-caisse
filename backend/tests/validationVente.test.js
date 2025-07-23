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


// Helper to create a simple temporary sale
function createTempSale(id = '1') {
  sqlite.prepare(
    'INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'Produit Test', 1000, 1000, 1, 'Test', 'Standard');
  sqlite.prepare('INSERT INTO vente (id_temp_vente) VALUES (?)').run(id);
}

let cookie;

beforeEach(async () => {
  initTables();
  // Crée un utilisateur
  const hash = require('bcrypt').hashSync('secret', 10);
  sqlite.prepare(
    'INSERT INTO users (uuid_user, prenom, nom, pseudo, password, admin) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('user-1', 'Jean', 'Test', 'jtest', hash, 0);

  // Se connecte pour récupérer le cookie
  const loginRes = await request(app)
    .post('/api/session')
    .send({ pseudo: 'jtest', mot_de_passe: 'secret' });
  cookie = loginRes.headers['set-cookie'][0];

  sqlite.prepare('DELETE FROM ticketdecaisse').run();
  sqlite.prepare('DELETE FROM bilan').run();
  sqlite.prepare('DELETE FROM vente').run();
});


describe('Test de validation de la route validerVente.routes.js', () => {
  const moyens = [
  { moyen: 'carte', champ: 'prix_total_carte' },
  { moyen: 'espece', champ: 'prix_total_espece' },  // 🔁 accent ici
  { moyen: 'cheque', champ: 'prix_total_cheque' },  // 🔁 accent ici
  { moyen: 'virement', champ: 'prix_total_virement' }
];


  for (const { moyen, champ } of moyens) {
  test(`Valide une vente payée en ${moyen}`, async () => {
   
    createTempSale();

    const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
      id_temp_vente: '1',
      reductionType: '',
      paiements: [{ moyen, montant: 1000 }]
    });

    expect(res.body.success).toBe(true);

    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse').get();
    expect(ticket.moyen_paiement).toBe(moyen);
    expect(ticket.prix_total).toBe(1000);

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();
    expect(bilan[champ]).toBe(1000);
  });
}

  test('Valide une vente avec paiement mixte', async () => {
   
    createTempSale();
    const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
      id_temp_vente: '1',
      reductionType: '',
      paiements: [
        { moyen: 'carte', montant: 400 },
        { moyen: 'especes', montant: 600 }
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
      const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
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

  test('Effectue 20 ventes avec paiements mixtes et réductions aléatoires, vérifie le bilan', async () => {
    const simples = ['carte', 'espece', 'cheque', 'virement'];
    const mixtes = [
      ['carte', 'espece'],
      ['cheque', 'virement'],
      ['carte', 'cheque'],
      ['espece', 'virement']
    ];

    const reductionTypes = [
      '', // pas de réduction
      'trueClient',
      'trueBene',
      'trueGrosPanierClient',
      'trueGrosPanierBene'
    ];

    // Logique des réductions (doit correspondre à ton backend)
    const applyReduction = (type, total) => {
      switch (type) {
        case 'trueClient': return 500;
        case 'trueBene': return 1000;
        case 'trueGrosPanierClient': return Math.round(total * 0.10);
        case 'trueGrosPanierBene': return Math.round(total * 0.20);
        default: return 0;
      }
    };

    const montantVenteBrut = 1000;

    // Pour comptabiliser les montants réellement enregistrés
    const cumuls = {
      carte: 0,
      espece: 0,
      cheque: 0,
      virement: 0,
      prix_total: 0
    };

    for (let i = 0; i < 20; i++) {
      const idVente = `${i + 1}`;
      createTempSale(idVente);

      const reductionType = reductionTypes[Math.floor(Math.random() * reductionTypes.length)];
      const reduction = applyReduction(reductionType, montantVenteBrut);
      const montantFinal = montantVenteBrut - reduction;

      let paiements;

      if (i % 2 === 0) {
        // Paiement simple
        const moyen = simples[i % simples.length];
        paiements = [{ moyen, montant: montantFinal }];
        cumuls[moyen] += montantFinal;
      } else {
        // Paiement mixte
        const [m1, m2] = mixtes[i % mixtes.length];
        const half1 = Math.floor(montantFinal / 2);
        const half2 = montantFinal - half1;
        paiements = [
          { moyen: m1, montant: half1 },
          { moyen: m2, montant: half2 }
        ];
        cumuls[m1] += half1;
        cumuls[m2] += half2;
      }

      const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
        id_temp_vente: idVente,
        reductionType,
        paiements
      });

      expect(res.body.success).toBe(true);
      cumuls.prix_total += montantFinal;
    }

    const bilan = sqlite.prepare('SELECT * FROM bilan').get();

    expect(bilan.nombre_vente).toBe(20);
    expect(bilan.prix_total).toBe(cumuls.prix_total);

    expect(bilan.prix_total_carte).toBe(cumuls.carte);
    expect(bilan.prix_total_espece).toBe(cumuls.espece);
    expect(bilan.prix_total_cheque).toBe(cumuls.cheque);
    expect(bilan.prix_total_virement).toBe(cumuls.virement);
  });

  test('Rollback : en cas d\'erreur simulée pendant la transaction, aucun enregistrement n\'est effectué', async () => {
  const id_temp_vente = '999';
  createTempSale(id_temp_vente);

  // Intercepter le run() spécifique à insertTicket
  const originalPrepare = sqlite.prepare;
  const spy = jest.spyOn(sqlite, 'prepare').mockImplementation((sql) => {
    const stmt = originalPrepare.call(sqlite, sql);
    if (sql.includes('INSERT INTO ticketdecaisse')) {
      jest.spyOn(stmt, 'run').mockImplementation(() => {
        throw new Error('Erreur simulée pendant insertTicket');
      });
    }
    return stmt;
  });

  const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
    id_temp_vente,
    reductionType: '',
    paiements: [{ moyen: 'carte', montant: 1000 }]
  });

  expect(res.status).toBe(500);
  expect(res.body.error).toMatch(/erreur simulée/i);

  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse').get();
  expect(ticket).toBeUndefined();

  const bilan = sqlite.prepare('SELECT * FROM bilan').get();
  expect(bilan).toBeUndefined();

  const temp = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?').get(id_temp_vente);
  expect(temp).not.toBeUndefined();

  spy.mockRestore();
});


  test('Retourne une erreur si id_temp_vente manquant', async () => {
    const res = await request(app).post('/api/valider').set('Cookie', cookie).send({
      reductionType: '',
      paiements: [{ moyen: 'carte', montant: 500 }]
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/donn.+manquantes/i);
  });
});