jest.mock('../utils/genererTicketPdf', () => jest.fn().mockResolvedValue('/tmp/ticket.pdf'));
jest.mock('../utils/genererTicketCloturePdf', () => {
  const actual = jest.requireActual('../utils/genererTicketCloturePdf');
  const mock = jest.fn().mockResolvedValue('/tmp/cloture.pdf');
  mock.buildClosureDetails = actual.buildClosureDetails;
  mock.formatMontant = actual.formatMontant;
  return mock;
});

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const { sqlite } = require('../db');
const { getBusinessDate } = require('../utils/dateTime');
const {
  getAccountingSnapshot,
  assertAccountingConsistency
} = require('../utils/accountingConsistency');
const {
  buildClosureDetails,
  formatMontant
} = require('../utils/genererTicketCloturePdf');

const SESSION_ID = 'session-comptable';
let cookie;

function initData() {
  sqlite.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  for (const table of [
    'journal_corrections',
    'paiement_mixte',
    'objets_vendus',
    'ticketdecaisse',
    'ticketdecaissetemp',
    'vente',
    'bilan',
    'session_caisse',
    'sync_log',
    'users'
  ]) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
  }

  sqlite.prepare(`
    INSERT INTO users (
      uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin
    ) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cashier-accounting',
    'Jean',
    'Caisse',
    'cashier-accounting',
    'cashier-accounting',
    bcrypt.hashSync('secret', 10),
    0,
    'admin-accounting',
    'Ada',
    'Admin',
    'admin-accounting',
    'admin-accounting',
    bcrypt.hashSync('adminSecret', 10),
    2
  );

  sqlite.prepare(`
    INSERT INTO session_caisse (
      id_session, opened_at_utc, utilisateur_ouverture,
      responsable_ouverture, fond_initial, caissiers, issecondaire, poste
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1)
  `).run(
    SESSION_ID,
    '2026-06-09T08:00:00.000Z',
    'Caisse',
    'Admin',
    10000,
    JSON.stringify(['Caisse'])
  );
}

function createTempSale(id, lines) {
  sqlite.prepare('INSERT INTO vente (id_temp_vente) VALUES (?)').run(id);
  const insert = sqlite.prepare(`
    INSERT INTO ticketdecaissetemp (
      id_temp_vente, nom, categorie, souscat, prix, nbr, prixt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const line of lines) {
    insert.run(
      id,
      line.nom,
      line.categorie || 'Test',
      line.souscat || 'Standard',
      line.prix,
      line.nbr,
      line.prix * line.nbr
    );
  }
}

async function validateSale(id, payments, reductionType = '') {
  return request(app)
    .post('/api/valider')
    .set('Cookie', cookie)
    .send({
      id_temp_vente: id,
      uuid_session_caisse: SESSION_ID,
      reductionType,
      paiements: payments
    });
}

function expectConsistent(date = getBusinessDate()) {
  const snapshot = getAccountingSnapshot({ sessionId: SESSION_ID, date });
  expect(assertAccountingConsistency(snapshot)).toBe(true);
  return snapshot;
}

beforeEach(async () => {
  jest.useRealTimers();
  initData();
  const login = await request(app)
    .post('/api/session')
    .send({ pseudo: 'cashier-accounting', mot_de_passe: 'secret' });
  cookie = login.headers['set-cookie'][0];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Exactitude comptable renforcée', () => {
  test('une session sans vente renvoie uniquement des zéros', async () => {
    const response = await request(app)
      .get('/api/bilan/bilan_session_caisse')
      .query({ uuid_session_caisse: SESSION_ID });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      nombre_ventes: 0,
      prix_total_espece: 0,
      prix_total_carte: 0,
      prix_total_cheque: 0,
      prix_total_virement: 0,
      prix_total: 0
    });
    expectConsistent();

    global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));
    const close = await request(app)
      .post('/api/caisse/fermeture')
      .set('Cookie', cookie)
      .send({
        uuid_session_caisse: SESSION_ID,
        montant_reel: 10000,
        montant_reel_carte: 0,
        montant_reel_cheque: 0,
        montant_reel_virement: 0,
        responsable_pseudo: 'admin-accounting',
        mot_de_passe: 'adminSecret'
      });
    expect(close.status).toBe(200);
    expect(sqlite.prepare(
      'SELECT ecart FROM session_caisse WHERE id_session = ?'
    ).get(SESSION_ID).ecart).toBe(0);
    expect(getAccountingSnapshot({
      sessionId: SESSION_ID,
      date: getBusinessDate()
    }).session.nombre_ventes).toBe(0);
    delete global.fetch;
  });

  test('compare toutes les sources avec une vente par moyen de paiement', async () => {
    const sales = [
      [1, 'cash', 'espèces', 1],
      [2, 'card', 'carte', 2],
      [3, 'check', 'chèque', 3],
      [4, 'transfer', 'virement', 4]
    ];

    for (const [id, label, method, amount] of sales) {
      createTempSale(id, [{ nom: label, prix: amount, nbr: 1 }]);
      const response = await validateSale(id, [{ moyen: method, montant: amount }]);
      expect(response.status).toBe(200);
    }

    const snapshot = expectConsistent();
    expect(snapshot.payments).toMatchObject({
      espece: 1,
      carte: 2,
      cheque: 3,
      virement: 4,
      total: 10
    });
    expect(snapshot.daily.nombre_vente).toBe(4);
    expect(snapshot.session.nombre_ventes).toBe(4);
  });

  test('arrondit les réductions proportionnelles au centime', async () => {
    createTempSale(10, [{ nom: 'Montant impair', prix: 1005, nbr: 1 }]);
    expect((await validateSale(
      10,
      [{ moyen: 'carte', montant: 904 }],
      'trueGrosPanierClient'
    )).status).toBe(200);

    createTempSale(20, [{ nom: 'Montant impair', prix: 1005, nbr: 1 }]);
    expect((await validateSale(
      20,
      [{ moyen: 'espece', montant: 804 }],
      'trueGrosPanierBene'
    )).status).toBe(200);

    const tickets = sqlite.prepare(`
      SELECT source_temp_vente, prix_total
      FROM ticketdecaisse
      ORDER BY source_temp_vente
    `).all();
    expect(tickets).toEqual([
      { source_temp_vente: '10', prix_total: 904 },
      { source_temp_vente: '20', prix_total: 804 }
    ]);
    expectConsistent();
  });

  test('combine une réduction et un paiement mixte exact', async () => {
    createTempSale(25, [{ nom: 'Panier réduit', prix: 2505, nbr: 1 }]);
    const response = await validateSale(
      25,
      [
        { moyen: 'carte', montant: 1000 },
        { moyen: 'espèces', montant: 1254 }
      ],
      'trueGrosPanierClient'
    );

    expect(response.status).toBe(200);
    const snapshot = expectConsistent();
    expect(snapshot.payments).toMatchObject({
      carte: 1000,
      espece: 1254,
      total: 2254
    });
  });

  test('plafonne une réduction fixe sans produire un total négatif', async () => {
    createTempSale(30, [{ nom: 'Petit montant', prix: 1, nbr: 1 }]);
    const response = await validateSale(
      30,
      [{ moyen: 'carte', montant: 0 }],
      'trueBene'
    );

    expect(response.status).toBe(200);
    expect(sqlite.prepare(
      'SELECT prix_total FROM ticketdecaisse WHERE source_temp_vente = ?'
    ).get('30').prix_total).toBe(0);
    expectConsistent();
  });

  test('refuse une répartition de paiements différente du total', async () => {
    createTempSale(40, [{ nom: 'Produit', prix: 1000, nbr: 1 }]);
    const response = await validateSale(40, [
      { moyen: 'carte', montant: 600 },
      { moyen: 'espece', montant: 399 }
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/total des paiements/i);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ticketdecaisse').get().count).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM bilan').get().count).toBe(0);
  });

  test('refuse aussi une correction dont les paiements sont inexacts', async () => {
    createTempSale(45, [{ nom: 'Produit', prix: 1000, nbr: 1 }]);
    const initial = await validateSale(45, [{ moyen: 'carte', montant: 1000 }]);
    expect(initial.status).toBe(200);

    const correction = await request(app)
      .post('/api/correction')
      .set('Cookie', cookie)
      .send({
        uuid_ticket_original: initial.body.uuid_ticket,
        uuid_session_caisse: SESSION_ID,
        articles_origine: [{ nom: 'Produit', prix: 1000, nbr: 1, categorie: 'Test' }],
        articles_correction: [{ nom: 'Produit', prix: 900, nbr: 1, categorie: 'Test' }],
        reductionType: '',
        motif: 'Paiement incomplet',
        paiements: [{ moyen: 'carte', montant: 899 }],
        responsable_pseudo: 'admin-accounting',
        mot_de_passe: 'adminSecret'
      });

    expect(correction.status).toBe(400);
    expect(correction.body.error).toMatch(/total des paiements/i);
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM journal_corrections'
    ).get().count).toBe(0);
    expect(expectConsistent().payments.total).toBe(1000);
  });

  test('reste cohérent après deux corrections successives', async () => {
    createTempSale(50, [{ nom: 'Produit', prix: 1000, nbr: 1 }]);
    const initial = await validateSale(50, [{ moyen: 'carte', montant: 1000 }]);
    expect(initial.status).toBe(200);

    const correction1 = await request(app)
      .post('/api/correction')
      .set('Cookie', cookie)
      .send({
        uuid_ticket_original: initial.body.uuid_ticket,
        uuid_session_caisse: SESSION_ID,
        articles_origine: [{ nom: 'Produit', prix: 1000, nbr: 1, categorie: 'Test' }],
        articles_correction: [{ nom: 'Produit', prix: 900, nbr: 1, categorie: 'Test' }],
        reductionType: '',
        motif: 'Première correction',
        paiements: [{ moyen: 'espece', montant: 900 }],
        responsable_pseudo: 'admin-accounting',
        mot_de_passe: 'adminSecret'
      });
    expect(correction1.status).toBe(200);

    const correction2 = await request(app)
      .post('/api/correction')
      .set('Cookie', cookie)
      .send({
        uuid_ticket_original: correction1.body.id_ticket_correction,
        uuid_session_caisse: SESSION_ID,
        articles_origine: [{ nom: 'Produit', prix: 900, nbr: 1, categorie: 'Test' }],
        articles_correction: [{ nom: 'Produit', prix: 1100, nbr: 1, categorie: 'Test' }],
        reductionType: '',
        motif: 'Deuxième correction',
        paiements: [
          { moyen: 'carte', montant: 600 },
          { moyen: 'virement', montant: 500 }
        ],
        responsable_pseudo: 'admin-accounting',
        mot_de_passe: 'adminSecret'
      });
    expect(correction2.status).toBe(200);

    const snapshot = expectConsistent();
    expect(snapshot.payments).toMatchObject({
      espece: 0,
      carte: 600,
      cheque: 0,
      virement: 500,
      total: 1100
    });
    expect(snapshot.session.nombre_ventes).toBe(1);
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM journal_corrections'
    ).get().count).toBe(2);
  });

  test('une annulation totale ramène tous les totaux à zéro', async () => {
    createTempSale(55, [{ nom: 'Produit annulé', prix: 700, nbr: 1 }]);
    const initial = await validateSale(55, [{ moyen: 'chèque', montant: 700 }]);
    expect(initial.status).toBe(200);

    const cancellation = await request(app)
      .post(`/api/correction/${initial.body.uuid_ticket}/supprimer`)
      .set('Cookie', cookie);
    expect(cancellation.status).toBe(200);

    const snapshot = expectConsistent();
    expect(snapshot.payments.total).toBe(0);
    expect(snapshot.tickets.total).toBe(0);
    expect(snapshot.objects.total).toBe(0);
    expect(snapshot.session.nombre_ventes).toBe(1);
  });

  test('le résumé PDF reprend exactement le bilan par moyen de paiement', () => {
    const summary = buildClosureDetails(
      {
        fond_initial: 10000,
        montant_reel: 11250,
        montant_reel_carte: 3000,
        montant_reel_cheque: 500,
        montant_reel_virement: 750
      },
      {
        prix_total_espece: 1250,
        prix_total_carte: 3000,
        prix_total_cheque: 500,
        prix_total_virement: 750
      }
    );

    expect(summary.ecartTotal).toBe(0);
    expect(summary.details.map(detail => detail.attendu)).toEqual([
      11250,
      3000,
      500,
      750
    ]);
    expect(formatMontant(summary.details[0].attendu)).toContain('112.50');
  });

  test('utilise la date de Paris lors du passage à minuit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T23:30:00.000Z'));
    createTempSale(60, [{ nom: 'Après minuit local', prix: 250, nbr: 1 }]);
    const response = await validateSale(60, [{ moyen: 'carte', montant: 250 }]);

    expect(response.status).toBe(200);
    expect(sqlite.prepare('SELECT date FROM bilan').get().date).toBe('2026-01-16');
    expectConsistent('2026-01-16');
  });

  test('conserve la bonne date durant les changements heure été et hiver', () => {
    expect(getBusinessDate(new Date('2026-03-29T00:30:00.000Z'))).toBe('2026-03-29');
    expect(getBusinessDate(new Date('2026-03-29T01:30:00.000Z'))).toBe('2026-03-29');
    expect(getBusinessDate(new Date('2026-10-25T00:30:00.000Z'))).toBe('2026-10-25');
    expect(getBusinessDate(new Date('2026-10-25T01:30:00.000Z'))).toBe('2026-10-25');
  });
});
