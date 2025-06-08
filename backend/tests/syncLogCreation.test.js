const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');;
const path = require('path');
const fs = require('fs');

// Mock explicite du module session
jest.mock('../session', () => ({
  getUser: jest.fn(),
  setUser: jest.fn()
}));
const { getUser } = require('../session');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

beforeEach(() => {
  initTables();
  getUser.mockReturnValue({ id: 1, nom: 'Testeur' });
});

test('✅ sync_log alimentée après une vente', async () => {
  sqlite.prepare(`
    INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
    VALUES ('1', 'Livre', 1000, 1000, 1, 'Culture', 'Roman', 0)
  `).run();
  sqlite.prepare(`INSERT INTO vente (id_temp_vente) VALUES ('1')`).run();

  const res = await request(app).post('/api/valider').send({
    id_temp_vente: '1',
    reductionType: 'trueClient',
    paiements: [{ moyen: 'espèces', montant: 500 }]
  });

  expect(res.body.success).toBe(true);

  const logs = sqlite.prepare('SELECT * FROM sync_log').all();
  const types = logs.map(l => l.type);


  expect(types).toContain('ticketdecaisse');
  expect(types).toContain('objets_vendus');
  expect(types).toContain('paiement_mixte');
  expect(types).toContain('bilan');
  expect(logs.every(l => l.synced === 0)).toBe(true);
});

test('✅ sync_log alimentée après une correction', async () => {
 

  const res = await request(app).post('/api/correction').send({
    id_ticket_original: 1,
    uuid_ticket_original: 'uuid-test',
    articles_origine: [{ nom: 'Livre', prix: 1000, nbr: 1, categorie: 'Culture' }],
    articles_correction: [{ nom: 'DVD', prix: 1500, nbr: 1, categorie: 'Culture' }],
    motif: 'Échange',
    moyen_paiement: 'mixte',
    reductionType: null,
    paiements: [{ moyen: 'mixte', montant: 1500 }]
  });

  expect(res.body.success).toBe(true);

  const logs = sqlite.prepare('SELECT * FROM sync_log').all();
  const types = logs.map(l => l.type);

  expect(types).toEqual(expect.arrayContaining([
    'ticketdecaisse',
    'objets_vendus',
    'paiement_mixte',
    'bilan'
  ]));
  expect(logs.every(l => l.synced === 0)).toBe(true);
});
