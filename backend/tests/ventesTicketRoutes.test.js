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

function openSession(id = 'session-1') {
  sqlite.prepare(`
    INSERT INTO session_caisse (
      id_session, date_ouverture, heure_ouverture, fond_initial
    ) VALUES (?, date('now'), time('now'), 0)
  `).run(id);
}

function deleteSession(id = 'session-1') {
    sqlite.prepare(`
    DELETE FROM session_caisse WHERE id_session = ?  
    `).run(id);
}

function createProduct() {
  sqlite.prepare(
    "INSERT INTO categories (id, parent_id, category, color) VALUES (1, NULL, 'Cat', '')"
  ).run();
  sqlite.prepare(
    "INSERT INTO categories (id, parent_id, category, color) VALUES (2, 1, 'Sub', '')"
  ).run();
  sqlite.prepare(
    "INSERT INTO boutons_ventes (id_bouton, sous_categorie, nom, id_cat, id_souscat, prix) VALUES (1, 'Sub', 'Article', '1', 2, 100)"
  ).run();
}

beforeEach(() => {
  initTables();
});

test('POST /api/ventes refuse sans session ouverte', async () => {
  const res = await request(app).post('/api/ventes').send();
  expect(res.status).toBe(403);
});

test('POST /api/ventes crée une vente avec session ouverte', async () => {
    
  openSession();
  const res = await request(app).post('/api/ventes').send();
  expect(res.status).toBe(200);
  expect(res.body.id_temp_vente).toBe(1);
  const row = sqlite.prepare('SELECT id_temp_vente FROM vente').get();
  expect(row.id_temp_vente).toBe(1);
});

test('Ajout, modification et suppression d\'articles', async () => {
    deleteSession();
  openSession();
  createProduct();
  const { body } = await request(app).post('/api/ventes').send();
  const idVente = body.id_temp_vente;

  let res = await request(app).post('/api/ticket').send({
    id_produit: 1,
    quantite: 2,
    id_temp_vente: idVente
  });
  expect(res.status).toBe(200);

  let article = sqlite
    .prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?')
    .get(idVente);
  expect(article.nom).toBe('Article');
  expect(article.nbr).toBe(2);
  const articleId = article.id;

  res = await request(app).put(`/api/ticket/${articleId}`).send({ nbr: 3, prix: 150 });
  expect(res.status).toBe(200);

  article = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id = ?').get(articleId);
  expect(article.nbr).toBe(3);
  expect(article.prix).toBe(150);
  expect(article.prixt).toBe(450);

  await request(app).delete(`/api/ticket/${articleId}`);
  article = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id = ?').get(articleId);
  expect(article).toBeUndefined();
});

test('DELETE /api/ventes/:id_temp_vente vide ticketdecaissetemp', async () => {
    deleteSession();
  openSession();
  createProduct();
  const { body } = await request(app).post('/api/ventes').send();
  const idVente = body.id_temp_vente;
  await request(app).post('/api/ticket').send({ id_produit: 1, quantite: 1, id_temp_vente: idVente });
  await request(app).post('/api/ticket').send({ id_produit: 1, quantite: 2, id_temp_vente: idVente });

  let count = sqlite.prepare('SELECT COUNT(*) AS c FROM ticketdecaissetemp WHERE id_temp_vente = ?').get(idVente).c;
  expect(count).toBe(2);

  await request(app).delete(`/api/ventes/${idVente}`);

  count = sqlite.prepare('SELECT COUNT(*) AS c FROM ticketdecaissetemp WHERE id_temp_vente = ?').get(idVente).c;
  expect(count).toBe(0);
});