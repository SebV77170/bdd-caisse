const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { sqlite } = require('../db');
const app = require('../app');

describe('Ordre des routes de production', () => {
  beforeAll(() => {
    sqlite.exec(
      fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8')
    );
  });

  test('sert le statut de la caisse principale en JSON avant le fallback React', async () => {
    const response = await request(app)
      .get('/api/sync/recevoir-de-secondaire/status');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual(expect.objectContaining({
      role: 'caisse-principale',
      service: 'synchronisation-secondaire',
      principalSessionOpen: false
    }));
  });
});
