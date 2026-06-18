const request = require('supertest');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const { sqlite } = require('../db');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
}

async function login() {
  const hash = bcrypt.hashSync('secret', 10);
  sqlite.prepare(`
    INSERT INTO users (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('user-pre-ticket', 'Jean', 'PreTicket', 'pre', 'pre', hash, 0);

  const res = await request(app)
    .post('/api/session')
    .send({ pseudo: 'pre', mot_de_passe: 'secret' });
  return res.headers['set-cookie'][0];
}

function seedProduct() {
  sqlite.prepare('INSERT INTO categories (id, parent_id, category, color) VALUES (?, ?, ?, ?)')
    .run(1, null, 'Textile', 'primary');
  sqlite.prepare('INSERT INTO categories (id, parent_id, category, color) VALUES (?, ?, ?, ?)')
    .run(2, 1, 'Pulls', 'primary');
  sqlite.prepare(`
    INSERT INTO boutons_ventes (id_bouton, nom, id_cat, id_souscat, prix)
    VALUES (?, ?, ?, ?, ?)
  `).run(10, 'Pull bleu', 1, 2, 1200);
}

beforeEach(() => {
  initTables();
  sqlite.prepare('DELETE FROM pre_ticket_items').run();
  sqlite.prepare('DELETE FROM pre_tickets').run();
  sqlite.prepare('DELETE FROM ticketdecaissetemp').run();
  sqlite.prepare('DELETE FROM vente').run();
  sqlite.prepare('DELETE FROM boutons_ventes').run();
  sqlite.prepare('DELETE FROM categories').run();
  sqlite.prepare('DELETE FROM users').run();
  seedProduct();
});

describe('preTickets.routes', () => {
  test('cree, envoie et convertit un pre-ticket en vente temporaire', async () => {
    const cookie = await login();

    const created = await request(app)
      .post('/api/pre-tickets')
      .set('Cookie', cookie)
      .send({ client_label: 'Client manteau rouge' });
    expect(created.status).toBe(201);
    expect(created.body.statut).toBe('brouillon');

    const uuid = created.body.uuid_pre_ticket;
    const withItem = await request(app)
      .post(`/api/pre-tickets/${uuid}/items`)
      .set('Cookie', cookie)
      .send({ id_produit: 10, quantite: 2 });
    expect(withItem.status).toBe(201);
    expect(withItem.body.items).toHaveLength(1);
    expect(withItem.body.total).toBe(2400);

    const sent = await request(app)
      .post(`/api/pre-tickets/${uuid}/envoyer`)
      .set('Cookie', cookie)
      .send();
    expect(sent.status).toBe(200);
    expect(sent.body.statut).toBe('en_attente');

    const pending = await request(app)
      .get('/api/pre-tickets?statut=en_attente')
      .set('Cookie', cookie);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toEqual(expect.objectContaining({
      uuid_pre_ticket: uuid,
      articles: 2,
      total: 2400
    }));

    const converted = await request(app)
      .post(`/api/pre-tickets/${uuid}/convertir`)
      .set('Cookie', cookie)
      .send();
    expect(converted.status).toBe(200);
    expect(converted.body.success).toBe(true);
    expect(converted.body.id_temp_vente).toBeTruthy();

    const tempItems = sqlite.prepare(
      'SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?'
    ).all(converted.body.id_temp_vente);
    expect(tempItems).toHaveLength(1);
    expect(tempItems[0]).toEqual(expect.objectContaining({
      nom: 'Pull bleu',
      nbr: 2,
      prixt: 2400
    }));

    const finalPreTicket = sqlite.prepare(
      'SELECT * FROM pre_tickets WHERE uuid_pre_ticket = ?'
    ).get(uuid);
    expect(finalPreTicket.statut).toBe('converti');
    expect(finalPreTicket.converted_id_temp_vente).toBe(converted.body.id_temp_vente);
  });

  test('ne convertit pas deux fois le meme pre-ticket', async () => {
    const cookie = await login();
    const created = await request(app).post('/api/pre-tickets').set('Cookie', cookie).send();
    const uuid = created.body.uuid_pre_ticket;

    await request(app)
      .post(`/api/pre-tickets/${uuid}/items`)
      .set('Cookie', cookie)
      .send({ id_produit: 10, quantite: 1 });
    await request(app).post(`/api/pre-tickets/${uuid}/envoyer`).set('Cookie', cookie).send();

    const first = await request(app).post(`/api/pre-tickets/${uuid}/convertir`).set('Cookie', cookie).send();
    const second = await request(app).post(`/api/pre-tickets/${uuid}/convertir`).set('Cookie', cookie).send();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.id_temp_vente).toBe(first.body.id_temp_vente);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM vente').get().count).toBe(1);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ticketdecaissetemp').get().count).toBe(1);
  });

  test('modifie un pre-ticket en attente avant sa conversion', async () => {
    const cookie = await login();
    const created = await request(app)
      .post('/api/pre-tickets')
      .set('Cookie', cookie)
      .send({ client_label: 'Client bonnet' });
    const uuid = created.body.uuid_pre_ticket;

    const withItem = await request(app)
      .post(`/api/pre-tickets/${uuid}/items`)
      .set('Cookie', cookie)
      .send({ id_produit: 10, quantite: 1 });
    const itemId = withItem.body.items[0].id;

    await request(app)
      .post(`/api/pre-tickets/${uuid}/envoyer`)
      .set('Cookie', cookie)
      .send();

    const updatedQuantity = await request(app)
      .put(`/api/pre-tickets/${uuid}/items/${itemId}`)
      .set('Cookie', cookie)
      .send({ nbr: 3 });
    expect(updatedQuantity.status).toBe(200);
    expect(updatedQuantity.body.statut).toBe('en_attente');
    expect(updatedQuantity.body.items[0]).toEqual(expect.objectContaining({
      nbr: 3,
      prixt: 3600
    }));

    const updatedMeta = await request(app)
      .patch(`/api/pre-tickets/${uuid}`)
      .set('Cookie', cookie)
      .send({ client_label: 'Client bonnet + echarpe' });
    expect(updatedMeta.status).toBe(200);
    expect(updatedMeta.body.client_label).toBe('Client bonnet + echarpe');

    const converted = await request(app)
      .post(`/api/pre-tickets/${uuid}/convertir`)
      .set('Cookie', cookie)
      .send();
    expect(converted.status).toBe(200);

    const tempItems = sqlite.prepare(
      'SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?'
    ).all(converted.body.id_temp_vente);
    expect(tempItems).toHaveLength(1);
    expect(tempItems[0]).toEqual(expect.objectContaining({
      nbr: 3,
      prixt: 3600
    }));
  });

  test('annule un pre-ticket en attente avant sa conversion', async () => {
    const cookie = await login();
    const created = await request(app)
      .post('/api/pre-tickets')
      .set('Cookie', cookie)
      .send({ client_label: 'Client annulation' });
    const uuid = created.body.uuid_pre_ticket;

    await request(app)
      .post(`/api/pre-tickets/${uuid}/items`)
      .set('Cookie', cookie)
      .send({ id_produit: 10, quantite: 1 });
    await request(app)
      .post(`/api/pre-tickets/${uuid}/envoyer`)
      .set('Cookie', cookie)
      .send();

    const cancelled = await request(app)
      .post(`/api/pre-tickets/${uuid}/annuler`)
      .set('Cookie', cookie)
      .send();
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.statut).toBe('annule');

    const pending = await request(app)
      .get('/api/pre-tickets?statut=en_attente')
      .set('Cookie', cookie);
    expect(pending.body).toHaveLength(0);

    const converted = await request(app)
      .post(`/api/pre-tickets/${uuid}/convertir`)
      .set('Cookie', cookie)
      .send();
    expect(converted.status).toBe(409);
  });
});
