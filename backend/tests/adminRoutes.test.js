jest.mock('../storeConfig', () => {
  let config = { localName: 'Test Store', registerNumber: 1 };
  return {
    getConfig: jest.fn(() => config),
    updateConfig: jest.fn((localName, registerNumber) => {
      config = { localName, registerNumber };
    })
  };
});

jest.mock('../syncScheduler', () => {
  let config = { interval: 5, enabled: false };
  return {
    getConfig: jest.fn(() => config),
    updateConfig: jest.fn((interval, enabled) => {
      config = { interval, enabled: typeof enabled === 'boolean' ? enabled : config.enabled };
    })
  };
});

jest.mock('../principalIpConfig', () => {
  let config = { ip: '192.168.1.10' };
  return {
    getConfig: jest.fn(() => config),
    updateConfig: jest.fn((ip) => {
      config = { ip };
    })
  };
});

jest.mock('../webdavConfig', () => ({
  getAvailableModes: jest.fn(() => [
    { key: 'dev', label: 'Dev' },
    { key: 'prod', label: 'Prod' }
  ])
}));

jest.mock('../webdavScheduler', () => {
  let config = { enabled: false, interval: 1, mode: 'dev' };
  return {
    getWebdavSchedulerConfig: jest.fn(() => config),
    updateWebdavSchedulerConfig: jest.fn((next) => {
      config = { ...config, ...next };
    }),
    runSync: jest.fn(async () => ({ count: 3 })),
    getWebdavState: jest.fn(() => ({ lastRun: '2026-06-08T00:00:00.000Z' }))
  };
});

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');
const storeConfig = require('../storeConfig');
const syncScheduler = require('../syncScheduler');
const principalIpConfig = require('../principalIpConfig');
const webdavScheduler = require('../webdavScheduler');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
}

describe('Routes admin locales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initTables();
    sqlite.prepare('DELETE FROM boutons_ventes').run();
    sqlite.prepare('DELETE FROM categories').run();
    sqlite.prepare('DELETE FROM motifs_correction').run();

    sqlite.prepare('INSERT INTO categories (id, parent_id, category, color) VALUES (?, ?, ?, ?)')
      .run(1, 'parent', 'Textile', '#fff');
    sqlite.prepare('INSERT INTO categories (id, parent_id, category, color) VALUES (?, ?, ?, ?)')
      .run(2, '1', 'Vestes', '#eee');
  });

  test('gère la création, modification et suppression de boutons', async () => {
    const create = await request(app)
      .post('/api/boutons')
      .send({ nom: 'Veste test', prix: 1200, id_cat: 1, id_souscat: 2 });

    expect(create.status).toBe(200);
    expect(create.body.success).toBe(true);

    const rows = await request(app).get('/api/boutons');
    expect(rows.body).toEqual([
      expect.objectContaining({
        nom: 'Veste test',
        prix: 1200,
        categorie: 'Textile',
        sous_categorie_affichee: 'Vestes'
      })
    ]);

    const update = await request(app)
      .put(`/api/boutons/${create.body.id}`)
      .send({ nom: 'Veste modifiée', prix: 1500, id_cat: 1, id_souscat: 2 });
    expect(update.status).toBe(200);

    const updated = sqlite.prepare('SELECT * FROM boutons_ventes WHERE id_bouton = ?').get(create.body.id);
    expect(updated.nom).toBe('Veste modifiée');
    expect(updated.prix).toBe(1500);

    const del = await request(app).delete(`/api/boutons/${create.body.id}`);
    expect(del.status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM boutons_ventes').get().count).toBe(0);
  });

  test('valide les champs des boutons', async () => {
    expect((await request(app).post('/api/boutons').send({ prix: 100 })).status).toBe(400);
    expect((await request(app).post('/api/boutons').send({ nom: 'X', prix: '100' })).status).toBe(400);
    expect((await request(app).put('/api/boutons/not-a-number').send({ nom: 'X', prix: 100 })).status).toBe(400);
    expect((await request(app).delete('/api/boutons/not-a-number')).status).toBe(400);
  });

  test('gère les motifs de correction', async () => {
    const invalid = await request(app).post('/api/motifs').send({ motif: '   ' });
    expect(invalid.status).toBe(400);

    const create = await request(app).post('/api/motifs').send({ motif: ' Erreur prix ' });
    expect(create.status).toBe(200);
    expect(create.body.motif).toBe('Erreur prix');

    const list = await request(app).get('/api/motifs');
    expect(list.body).toEqual([expect.objectContaining({ motif: 'Erreur prix' })]);

    expect((await request(app).delete('/api/motifs').send({ ids: [] })).status).toBe(400);
    const del = await request(app).delete('/api/motifs').send({ ids: [create.body.id] });
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(1);
  });

  test('lit et met à jour les configurations locales mockées', async () => {
    expect((await request(app).get('/api/store-config')).body.localName).toBe('Test Store');

    const store = await request(app)
      .post('/api/store-config')
      .send({ localName: 'Boutique', registerNumber: 2 });
    expect(store.status).toBe(200);
    expect(storeConfig.updateConfig).toHaveBeenCalledWith('Boutique', 2);
    expect((await request(app).post('/api/store-config').send({ localName: '', registerNumber: 1 })).status).toBe(400);

    const sync = await request(app)
      .post('/api/sync-config')
      .send({ interval: 10, enabled: true });
    expect(sync.status).toBe(200);
    expect(syncScheduler.updateConfig).toHaveBeenCalledWith(10, true);
    expect((await request(app).post('/api/sync-config').send({ interval: 0 })).status).toBe(400);

    const ip = await request(app)
      .post('/api/principal-ip')
      .send({ ip: '192.168.1.20' });
    expect(ip.status).toBe(200);
    expect(principalIpConfig.updateConfig).toHaveBeenCalledWith('192.168.1.20');
    expect((await request(app).post('/api/principal-ip').send({})).status).toBe(400);
  });

  test('gère la configuration et la synchronisation WebDAV sans réseau réel', async () => {
    const config = await request(app).get('/api/webdav/config');
    expect(config.body.mode).toBe('dev');

    const update = await request(app)
      .post('/api/webdav/config')
      .send({ interval: 3, enabled: true, mode: 'prod' });
    expect(update.status).toBe(200);
    expect(webdavScheduler.updateWebdavSchedulerConfig).toHaveBeenCalledWith({
      interval: 3,
      enabled: true,
      mode: 'prod'
    });

    expect((await request(app).post('/api/webdav/config').send({ interval: 0 })).status).toBe(400);
    expect((await request(app).post('/api/webdav/config').send({ interval: 1, mode: 'unknown' })).status).toBe(400);

    const sync = await request(app).post('/api/webdav/sync');
    expect(sync.status).toBe(200);
    expect(sync.body.count).toBe(3);

    const state = await request(app).get('/api/webdav/state');
    expect(state.body.lastRun).toBeDefined();
  });
});
