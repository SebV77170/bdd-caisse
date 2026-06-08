const mockQuery = jest.fn();

jest.mock('../db', () => {
  const actual = jest.requireActual('../db');
  return {
    ...actual,
    getMysqlPool: () => ({ query: mockQuery }),
    getMysqlConfig: () => ({ host: 'mysql.test', port: 3306 })
  };
});

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');

function initTables() {
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  sqlite.exec(schema);
}

const remoteUser = {
  uuid_user: 'remote-1',
  prenom: 'Élodie',
  nom: 'Durand',
  pseudo: 'Élodie.D',
  pseudo_normalise: null,
  password: 'hash',
  admin: 1,
  mail: 'elodie@example.test',
  tel: '0102030405'
};

describe('Routes /api/users', () => {
  beforeEach(() => {
    initTables();
    sqlite.prepare('DELETE FROM users').run();
    mockQuery.mockReset();
  });

  test('GET / ne divulgue pas les mots de passe', async () => {
    sqlite.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin
      ) VALUES ('local-1', 'Jean', 'Dupont', 'jdupont', 'jdupont', 'secret', 0)
    `).run();

    const res = await request(app).get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual({
      uuid_user: 'local-1',
      nom: 'Dupont',
      pseudo: 'jdupont'
    });
    expect(res.body[0].password).toBeUndefined();
  });

  test('POST /sync remplace les utilisateurs locaux et normalise le pseudo', async () => {
    sqlite.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin
      ) VALUES ('obsolete', '', '', 'old', 'old', 'hash', 0)
    `).run();
    mockQuery.mockResolvedValue([[remoteUser]]);

    const res = await request(app).post('/api/users/sync');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, count: 1 });
    const users = sqlite.prepare('SELECT * FROM users').all();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      uuid_user: 'remote-1',
      pseudo: 'Élodie.D',
      pseudo_normalise: 'elodie.d'
    });
  });

  test('GET /compare détecte les utilisateurs manquants, en trop et différents', async () => {
    sqlite.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin, mail, tel
      ) VALUES
        ('remote-1', 'Élodie', 'Durand', 'Élodie.D', 'elodie.d', 'ancien', 1, 'elodie@example.test', '0102030405'),
        ('extra-1', 'Local', 'Seulement', 'local', 'local', 'hash', 0, '', '')
    `).run();
    mockQuery.mockResolvedValue([[remoteUser, {
      ...remoteUser,
      uuid_user: 'missing-1',
      pseudo: 'Nouveau',
      pseudo_normalise: 'nouveau'
    }]]);

    const res = await request(app).get('/api/users/compare');

    expect(res.status).toBe(200);
    expect(res.body.missing.map(user => user.uuid_user)).toEqual(['missing-1']);
    expect(res.body.extra.map(user => user.uuid_user)).toEqual(['extra-1']);
    expect(res.body.different.map(user => user.uuid_user)).toEqual(['remote-1']);
  });

  test('une panne MySQL renvoie un diagnostic sans modifier les données locales', async () => {
    sqlite.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin
      ) VALUES ('local-1', '', '', 'local', 'local', 'hash', 0)
    `).run();
    const error = Object.assign(new Error('connexion refusée'), { code: 'ECONNREFUSED' });
    mockQuery.mockRejectedValue(error);

    const res = await request(app).post('/api/users/sync');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: 'ECONNREFUSED',
      host: 'mysql.test',
      port: 3306
    });
    expect(sqlite.prepare('SELECT uuid_user FROM users').all()).toEqual([
      { uuid_user: 'local-1' }
    ]);
  });
});
