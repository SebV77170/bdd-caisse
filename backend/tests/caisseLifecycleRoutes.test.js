jest.mock('../utils/genererFriendlyIds', () => ({
  genererFriendlyIds: jest.fn()
}));

jest.mock('../utils/genererTicketCloturePdf', () => jest.fn().mockResolvedValue('/tmp/cloture.pdf'));

const request = require('supertest');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');
const genererTicketCloturePdf = require('../utils/genererTicketCloturePdf');
const { createSecondaryOpeningGrant } = require('../secondaryOpeningAuthorization');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
}

async function loginAsCashier() {
  const res = await request(app)
    .post('/api/session')
    .send({ pseudo: 'cashier', mot_de_passe: 'secret' });
  return res.headers['set-cookie'][0];
}

function seedUsers() {
  const cashierHash = bcrypt.hashSync('secret', 10);
  const adminHash = bcrypt.hashSync('adminSecret', 10);
  const regularHash = bcrypt.hashSync('regularSecret', 10);

  sqlite.prepare(`
    INSERT INTO users (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('cashier-1', 'Jean', 'Caisse', 'cashier', 'cashier', cashierHash, 0);

  sqlite.prepare(`
    INSERT INTO users (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin-1', 'Ada', 'Admin', 'admin', 'admin', adminHash, 2);

  sqlite.prepare(`
    INSERT INTO users (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('regular-1', 'Reg', 'User', 'regular', 'regular', regularHash, 1);
}

async function waitFor(check, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Condition asynchrone non satisfaite');
}

describe('Ouverture et fermeture de caisse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));

    initTables();
    [
      'ticketdecaisse',
      'paiement_mixte',
      'objets_vendus',
      'bilan',
      'session_caisse',
      'sync_log',
      'users'
    ].forEach(table => sqlite.prepare(`DELETE FROM ${table}`).run());
    seedUsers();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('refuse une ouverture sans utilisateur connecté', async () => {
    const res = await request(app)
      .post('/api/caisse/ouverture')
      .send({ fond_initial: 1000, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    expect(res.status).toBe(401);
  });

  test('ouvre une caisse principale avec responsable valide', async () => {
    const cookie = await loginAsCashier();
    const res = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 1000, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const session = sqlite.prepare('SELECT * FROM session_caisse WHERE id_session = ?').get(res.body.id_session);
    expect(session.fond_initial).toBe(1000);
    expect(session.issecondaire).toBe(0);
    expect(JSON.parse(session.caissiers)).toContain('Caisse');
  });

  test('refuse une seconde ouverture tant qu’une session est ouverte', async () => {
    const cookie = await loginAsCashier();
    await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 1000, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    const duplicate = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 1000, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toMatch(/déjà ouverte/i);
  });

  test('exige puis consomme une autorisation pour ouvrir une secondaire', async () => {
    const cookie = await loginAsCashier();
    const denied = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({
        fond_initial: 0,
        secondaire: true,
        responsable_pseudo: 'admin',
        mot_de_passe: 'adminSecret'
      });
    expect(denied.status).toBe(403);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM session_caisse').get().count).toBe(0);

    const token = createSecondaryOpeningGrant('192.168.1.20');
    const opened = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({
        fond_initial: 0,
        secondaire: true,
        authorization_token: token,
        responsable_pseudo: 'admin',
        mot_de_passe: 'adminSecret'
      });
    expect(opened.status).toBe(200);
    expect(sqlite.prepare(
      'SELECT issecondaire FROM session_caisse WHERE id_session = ?'
    ).get(opened.body.id_session).issecondaire).toBe(1);
  });

  test('refuse une ouverture avec responsable non administrateur ou mot de passe invalide', async () => {
    const cookie = await loginAsCashier();

    const regular = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 1000, responsable_pseudo: 'regular', mot_de_passe: 'regularSecret' });
    expect(regular.status).toBe(403);

    const wrongPassword = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 1000, responsable_pseudo: 'admin', mot_de_passe: 'wrong' });
    expect(wrongPassword.status).toBe(403);
  });

  test('ferme une caisse et crée un ticket de clôture', async () => {
    const cookie = await loginAsCashier();
    const open = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 500, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
        nbr_objet, moyen_paiement, prix_total, uuid_session_caisse
      ) VALUES (?, 'Caisse', 'cashier-1', datetime('now'), 1, 'mixte', 2000, ?)
    `).run('sale-1', open.body.id_session);

    const sale = sqlite.prepare('SELECT id_ticket FROM ticketdecaisse WHERE uuid_ticket = ?').get('sale-1');
    sqlite.prepare(`
      INSERT INTO paiement_mixte (
        id_ticket, uuid_ticket, espece, carte, cheque, virement
      ) VALUES (?, ?, 700, 1000, 300, 0)
    `).run(sale.id_ticket, 'sale-1');

    const close = await request(app)
      .post('/api/caisse/fermeture')
      .set('Cookie', cookie)
      .send({
        uuid_session_caisse: open.body.id_session,
        montant_reel: 1200,
        montant_reel_carte: 1000,
        montant_reel_cheque: 300,
        montant_reel_virement: 0,
        commentaire: 'OK',
        responsable_pseudo: 'admin',
        mot_de_passe: 'adminSecret'
      });

    expect(close.status).toBe(200);
    expect(close.body.success).toBe(true);

    const session = sqlite.prepare('SELECT * FROM session_caisse WHERE id_session = ?').get(open.body.id_session);
    expect(session.closed_at_utc).toBeTruthy();
    expect(session.ecart).toBe(0);

    const cloture = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE cloture = 1').get();
    expect(cloture).toEqual(expect.objectContaining({
      prix_total: 0,
      uuid_session_caisse: open.body.id_session
    }));
    expect(genererTicketCloturePdf).toHaveBeenCalledWith(open.body.id_session, cloture.uuid_ticket);
  });

  test('ferme la caisse localement même si la synchronisation finale est hors ligne', async () => {
    global.fetch.mockRejectedValueOnce(new Error('MySQL indisponible'));
    const cookie = await loginAsCashier();
    const open = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 500, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    const close = await request(app)
      .post('/api/caisse/fermeture')
      .set('Cookie', cookie)
      .send({
        uuid_session_caisse: open.body.id_session,
        montant_reel: 500,
        responsable_pseudo: 'admin',
        mot_de_passe: 'adminSecret'
      });

    expect(close.status).toBe(200);
    expect(close.body.success).toBe(true);
    await waitFor(() => global.fetch.mock.calls.length === 1);

    expect(sqlite.prepare(
      'SELECT closed_at_utc FROM session_caisse WHERE id_session = ?'
    ).get(open.body.id_session).closed_at_utc).toBeTruthy();
    expect(sqlite.prepare(
      'SELECT COUNT(*) AS count FROM ticketdecaisse WHERE cloture = 1'
    ).get().count).toBe(1);
  });

  test('refuse la fermeture sans session ouverte ou sans responsable valide', async () => {
    const cookie = await loginAsCashier();

    const noSession = await request(app)
      .post('/api/caisse/fermeture')
      .set('Cookie', cookie)
      .send({ responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });
    expect(noSession.status).toBe(400);

    const open = await request(app)
      .post('/api/caisse/ouverture')
      .set('Cookie', cookie)
      .send({ fond_initial: 0, responsable_pseudo: 'admin', mot_de_passe: 'adminSecret' });

    const invalidAdmin = await request(app)
      .post('/api/caisse/fermeture')
      .set('Cookie', cookie)
      .send({
        uuid_session_caisse: open.body.id_session,
        responsable_pseudo: 'regular',
        mot_de_passe: 'regularSecret'
      });
    expect(invalidAdmin.status).toBe(403);
  });
});
