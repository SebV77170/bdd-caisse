const request = require('supertest');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

describe('Routes /api/session', () => {
  let cookie;

  beforeEach(async () => {
    initTables();
    sqlite.prepare('DELETE FROM users').run();
    sqlite.prepare('DELETE FROM session_caisse').run();
    sqlite.prepare('DELETE FROM sync_log').run();

    const hash = bcrypt.hashSync('secret', 10);
    sqlite.prepare(
      'INSERT INTO users (uuid_user, prenom, nom, pseudo, password, admin) VALUES (?,?,?,?,?,0)'
    ).run(1, 'John', 'Doe', 'jdoe', hash);

    // Login pour récupérer le cookie utilisé dans les tests
    const loginRes = await request(app)
      .post('/api/session')
      .send({ pseudo: 'jdoe', mot_de_passe: 'secret' });

    cookie = loginRes.headers['set-cookie'][0];
  });

  test('POST /api/session success', async () => {
    expect(cookie).toBeDefined();
  });

  test('POST /api/session wrong password', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ pseudo: 'jdoe', mot_de_passe: 'oops' });
    expect(res.status).toBe(403);
  });

  test('POST /api/session user not found', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ pseudo: 'inconnu', mot_de_passe: 'secret' });
    expect(res.status).toBe(404);
  });

  test('POST /api/session missing fields', async () => {
    const res = await request(app).post('/api/session').send({ pseudo: 'jdoe' });
    expect(res.status).toBe(400);
  });

  test('GET /api/session returns logged user', async () => {
    const res = await request(app).get('/api/session').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.pseudo).toBe('jdoe');
  });

  test('GET /api/session without login', async () => {
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/session clears user', async () => {
    const del = await request(app).delete('/api/session').set('Cookie', cookie);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const res = await request(app).get('/api/session').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  test('GET /api/session/etat-caisse false when none', async () => {
    const res = await request(app).get('/api/session/etat-caisse');
    expect(res.status).toBe(200);
    expect(res.body.ouverte).toBe(false);
  });

  test('GET /api/session/etat-caisse true when open', async () => {
    sqlite.prepare(
      'INSERT INTO session_caisse (id_session, date_ouverture, heure_ouverture, fond_initial) VALUES (?,?,?,?)'
    ).run('sess-1', '2024-01-01', '08:00', 0);

    const res = await request(app).get('/api/session/etat-caisse');
    expect(res.status).toBe(200);
    expect(res.body.ouverte).toBe(true);
    expect(res.body.id_session).toBe('sess-1');
  });

  test('POST /api/session/ajouter-caissier adds caissier', async () => {
    sqlite.prepare(
      'INSERT INTO session_caisse (id_session, date_ouverture, heure_ouverture, fond_initial, caissiers) VALUES (?,?,?,?,?)'
    ).run('sess-1', '2024-01-01', '08:00', 0, JSON.stringify(['Alice']));

    const res = await request(app)
      .post('/api/session/ajouter-caissier')
      .set('Cookie', cookie)
      .send({ nom: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.caissiers).toEqual(expect.arrayContaining(['Alice', 'Bob']));

    const row = sqlite.prepare('SELECT caissiers FROM session_caisse').get();
    const list = JSON.parse(row.caissiers);
    expect(list).toContain('Bob');
  });

  test('POST /api/session/ajouter-caissier without session', async () => {
    const res = await request(app)
      .post('/api/session/ajouter-caissier')
      .set('Cookie', cookie)
      .send({ nom: 'Bob' });
    expect(res.status).toBe(400);
  });

  test('POST /api/session/ajouter-caissier missing name', async () => {
    sqlite.prepare(
      'INSERT INTO session_caisse (id_session, date_ouverture, heure_ouverture, fond_initial) VALUES (?,?,?,?)'
    ).run('sess-1', '2024-01-01', '08:00', 0);

    const res = await request(app)
      .post('/api/session/ajouter-caissier')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
  });
});
