jest.mock('../utils/genererTicketPdf', () => jest.fn().mockResolvedValue('/tmp/ticket.pdf'));
jest.setTimeout(120000);

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { performance } = require('perf_hooks');
const app = require('../app');
const { sqlite } = require('../db');

const SESSION_ID = 'performance-session';
let cookie;

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function clearOperationalData() {
  for (const table of [
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
}

function createTempSale(id, amount) {
  sqlite.prepare('INSERT INTO vente (id_temp_vente) VALUES (?)').run(id);
  sqlite.prepare(`
    INSERT INTO ticketdecaissetemp (
      id_temp_vente, nom, categorie, souscat, prix, nbr, prixt
    ) VALUES (?, 'Produit performance', 'Test', 'Charge', ?, 1, ?)
  `).run(id, amount, amount);
}

beforeAll(async () => {
  sqlite.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  clearOperationalData();

  sqlite.prepare(`
    INSERT INTO users (
      uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'performance-user',
    'Test',
    'Performance',
    'performance',
    'performance',
    bcrypt.hashSync('secret', 10),
    0
  );
  sqlite.prepare(`
    INSERT INTO session_caisse (
      id_session, opened_at_utc, utilisateur_ouverture,
      responsable_ouverture, fond_initial, caissiers, issecondaire, poste
    ) VALUES (?, ?, 'Performance', 'Performance', 0, '["Performance"]', 0, 1)
  `).run(SESSION_ID, new Date().toISOString());

  const login = await request(app)
    .post('/api/session')
    .send({ pseudo: 'performance', mot_de_passe: 'secret' });
  cookie = login.headers['set-cookie'][0];
});

afterAll(() => {
  clearOperationalData();
});

describe('Performance et endurance opérationnelle', () => {
  test('valide 1 000 ventes dans une session et conserve des bilans rapides', async () => {
    const durations = [];
    const heapBefore = process.memoryUsage().heapUsed;
    let expectedTotal = 0;
    let checkpoint500 = null;

    for (let index = 1; index <= 1000; index += 1) {
      const amount = 100 + (index % 900);
      expectedTotal += amount;
      createTempSale(index, amount);

      const started = performance.now();
      const response = await request(app)
        .post('/api/valider')
        .set('Cookie', cookie)
        .send({
          id_temp_vente: index,
          uuid_session_caisse: SESSION_ID,
          reductionType: '',
          paiements: [{
            moyen: index % 2 === 0 ? 'carte' : 'espece',
            montant: amount
          }]
        });
      durations.push(performance.now() - started);
      expect(response.status).toBe(200);

      if (index === 500) {
        const checkpointStarted = performance.now();
        const checkpointBalance = await request(app)
          .get('/api/bilan/bilan_session_caisse')
          .query({ uuid_session_caisse: SESSION_ID });
        checkpoint500 = {
          status: checkpointBalance.status,
          sales: checkpointBalance.body.nombre_ventes,
          durationMs: performance.now() - checkpointStarted
        };
      }
    }

    const balanceStarted = performance.now();
    const balance = await request(app)
      .get('/api/bilan/bilan_session_caisse')
      .query({ uuid_session_caisse: SESSION_ID });
    const balanceDuration = performance.now() - balanceStarted;

    const heapGrowthMb = (
      process.memoryUsage().heapUsed - heapBefore
    ) / (1024 * 1024);
    const syncLogStats = sqlite.prepare(`
      SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(payload)), 0) AS payloadBytes
      FROM sync_log
    `).get();

    expect(balance.status).toBe(200);
    expect(checkpoint500).toEqual(expect.objectContaining({
      status: 200,
      sales: 500
    }));
    expect(checkpoint500.durationMs).toBeLessThan(3000);
    expect(balance.body.nombre_ventes).toBe(1000);
    expect(balance.body.prix_total).toBe(expectedTotal);
    expect(percentile(durations, 0.95)).toBeLessThan(2000);
    expect(balanceDuration).toBeLessThan(3000);
    expect(heapGrowthMb).toBeLessThan(192);
    expect(syncLogStats.rows).toBeGreaterThanOrEqual(4000);

    console.log('PERFORMANCE_1000_SALES', {
      averageMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      p95Ms: Math.round(percentile(durations, 0.95)),
      maxMs: Math.round(Math.max(...durations)),
      balance500Ms: Math.round(checkpoint500.durationMs),
      balanceMs: Math.round(balanceDuration),
      heapGrowthMb: Number(heapGrowthMb.toFixed(1)),
      syncLogRows: syncLogStats.rows,
      syncLogPayloadMb: Number((syncLogStats.payloadBytes / 1024 / 1024).toFixed(2))
    });
  });

  test('reste utilisable avec cinq années et 20 000 ventes archivées', async () => {
    clearOperationalData();
    const insertSession = sqlite.prepare(`
      INSERT INTO session_caisse (
        id_session, opened_at_utc, closed_at_utc, fond_initial, issecondaire
      ) VALUES (?, ?, ?, 0, 0)
    `);
    const insertTicket = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
        nbr_objet, moyen_paiement, prix_total, uuid_session_caisse
      ) VALUES (?, 'Archive', 'archive-user', ?, 1, 'carte', ?, ?)
    `);
    const insertPayment = sqlite.prepare(`
      INSERT INTO paiement_mixte (
        id_ticket, uuid_ticket, espece, carte, cheque, virement
      ) VALUES (?, ?, 0, ?, 0, 0)
    `);

    const seed = sqlite.transaction(() => {
      for (let year = 2022; year <= 2026; year += 1) {
        for (let sessionIndex = 0; sessionIndex < 20; sessionIndex += 1) {
          const sessionId = `archive-${year}-${sessionIndex}`;
          const date = `${year}-06-${String((sessionIndex % 28) + 1).padStart(2, '0')}T08:00:00.000Z`;
          insertSession.run(sessionId, date, date);
          for (let sale = 0; sale < 200; sale += 1) {
            const uuid = `${sessionId}-${sale}`;
            const amount = 100 + (sale % 500);
            const ticket = insertTicket.run(uuid, date, amount, sessionId);
            insertPayment.run(ticket.lastInsertRowid, uuid, amount);
          }
        }
      }
    });
    seed();

    const listStarted = performance.now();
    const tickets = await request(app).get('/api/bilan');
    const listDuration = performance.now() - listStarted;

    const sessionStarted = performance.now();
    const sessionBalance = await request(app)
      .get('/api/bilan/bilan_session_caisse')
      .query({ uuid_session_caisse: 'archive-2026-19' });
    const sessionDuration = performance.now() - sessionStarted;

    expect(tickets.status).toBe(200);
    expect(tickets.body).toHaveLength(20000);
    expect(sessionBalance.status).toBe(200);
    expect(sessionBalance.body.nombre_ventes).toBe(200);
    expect(listDuration).toBeLessThan(3000);
    expect(sessionDuration).toBeLessThan(3000);

    console.log('PERFORMANCE_MULTI_YEAR', {
      tickets: tickets.body.length,
      fullListMs: Math.round(listDuration),
      sessionBalanceMs: Math.round(sessionDuration)
    });
  });
});
