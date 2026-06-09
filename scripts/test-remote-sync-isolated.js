const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');

process.env.NODE_ENV = 'test';
process.env.BDD_CAISSE_ALLOW_ISOLATED_SYNC = 'true';
process.env.BDD_CAISSE_SYNC_TABLE_PREFIX =
  `codexsync_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}_`;

require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env')
});
require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env.local')
});

const mysql = require(path.join(backendDir, 'node_modules', 'mysql2', 'promise'));
const request = require(path.join(backendDir, 'node_modules', 'supertest'));
const bcrypt = require(path.join(backendDir, 'node_modules', 'bcrypt'));

const SOURCE_TABLES = [
  'ticketdecaisse',
  'objets_vendus',
  'paiement_mixte',
  'bilan',
  'journal_corrections',
  'uuid_mapping'
];
const RECEIPT_TABLE = 'bdd_caisse_sync_operations';
const prefix = process.env.BDD_CAISSE_SYNC_TABLE_PREFIX;
const testTable = name => `${prefix}${name}`;

function parseRemoteMysqlPreset() {
  const raw = process.env.MYSQL_PRESET_REMOTE;
  if (!raw) throw new Error('MYSQL_PRESET_REMOTE absent');
  const [host, user, password, database, port] = raw.split('|');
  return {
    host,
    user,
    password,
    database,
    port: port ? Number(port) : 3306,
    connectTimeout: 10000
  };
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(identifier)) {
    throw new Error(`Identifiant SQL invalide : ${identifier}`);
  }
  return `\`${identifier}\``;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numericRow(row, fields) {
  return Object.fromEntries(fields.map(field => [field, Number(row[field] || 0)]));
}

async function createIsolatedTables(connection) {
  for (const source of SOURCE_TABLES) {
    await connection.query(
      `CREATE TABLE ${quoteIdentifier(testTable(source))} LIKE ${quoteIdentifier(source)}`
    );
  }
  await connection.query(`
    CREATE TABLE ${quoteIdentifier(testTable(RECEIPT_TABLE))} (
      operation_uuid VARCHAR(64) PRIMARY KEY,
      resource_type VARCHAR(64) NOT NULL,
      operation_type VARCHAR(16) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function dropIsolatedTables(connection) {
  const names = [...SOURCE_TABLES, RECEIPT_TABLE].reverse();
  for (const name of names) {
    await connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(testTable(name))}`);
  }
}

async function verifyCleanup(connection) {
  const names = [...SOURCE_TABLES, RECEIPT_TABLE].map(testTable);
  const placeholders = names.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${placeholders})`,
    names
  );
  if (rows.length > 0) {
    throw new Error(`Tables de test non supprimées : ${rows.map(row => row.TABLE_NAME).join(', ')}`);
  }
}

function initializeSqlite(sqlite) {
  sqlite.exec(fs.readFileSync(path.join(backendDir, 'schema.sql'), 'utf8'));
  for (const table of [
    'journal_corrections',
    'paiement_mixte',
    'objets_vendus',
    'ticketdecaisse',
    'ticketdecaissetemp',
    'vente',
    'bilan',
    'sync_log',
    'uuid_mapping',
    'users'
  ]) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
  }
}

async function login(app, pseudo, password) {
  const response = await request(app)
    .post('/api/session')
    .send({ pseudo, mot_de_passe: password });
  assert(response.status === 200, `Connexion de ${pseudo} refusée (${response.status}).`);
  return response.headers['set-cookie'].join(';');
}

async function createSale(app, sqlite, cookie, index, payments) {
  const id = 900000 + index;
  const total = payments.reduce((sum, payment) => sum + payment.montant, 0);
  sqlite.prepare(`
    INSERT INTO ticketdecaissetemp
      (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat)
    VALUES (?, ?, ?, ?, 1, 'Test distant', 'Synchronisation')
  `).run(id, `Article distant ${index}`, total, total);
  sqlite.prepare('INSERT INTO vente (id_temp_vente) VALUES (?)').run(id);

  const response = await request(app)
    .post('/api/valider')
    .set('Cookie', cookie)
    .send({ id_temp_vente: id, reductionType: '', paiements: payments });
  assert(response.status === 200 && response.body.success, `Vente ${index} refusée.`);
  return response.body.uuid_ticket;
}

async function createCorrection(app, sqlite, cookie, originalUuid) {
  const ticket = sqlite.prepare(
    'SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?'
  ).get(originalUuid);
  const articles = sqlite.prepare(
    'SELECT nom, prix, nbr, categorie, souscat FROM objets_vendus WHERE uuid_ticket = ?'
  ).all(originalUuid);

  const response = await request(app)
    .post('/api/correction')
    .set('Cookie', cookie)
    .send({
      id_ticket_original: ticket.id_ticket,
      uuid_ticket_original: ticket.uuid_ticket,
      uuid_session_caisse: 'remote-sync-session',
      articles_origine: articles,
      articles_correction: articles.map(article => ({ ...article, prix: 1800 })),
      reductionType: '',
      motif: 'Test distant isolé',
      paiements: [
        { moyen: 'carte', montant: 1100 },
        { moyen: 'especes', montant: 700 }
      ],
      responsable_pseudo: 'remote-admin',
      mot_de_passe: 'remote-admin-secret'
    });
  assert(response.status === 200 && response.body.success, 'La correction distante a échoué.');
}

async function compareLocalAndRemote(connection, sqlite) {
  const localBilan = sqlite.prepare('SELECT * FROM bilan').get();
  const fields = [
    'nombre_vente',
    'poids',
    'prix_total',
    'prix_total_espece',
    'prix_total_cheque',
    'prix_total_carte',
    'prix_total_virement'
  ];
  const remoteDate = localBilan.date.split('-').reverse().join('/');
  const [remoteBilans] = await connection.query(
    `SELECT ${fields.join(', ')}
       FROM ${quoteIdentifier(testTable('bilan'))}
      WHERE date = ?`,
    [remoteDate]
  );
  assert(remoteBilans.length === 1, 'Le bilan MySQL isolé est absent ou dupliqué.');
  assert(
    JSON.stringify(numericRow(remoteBilans[0], fields)) ===
      JSON.stringify(numericRow(localBilan, fields)),
    `Bilan différent. SQLite=${JSON.stringify(numericRow(localBilan, fields))} ` +
      `MySQL=${JSON.stringify(numericRow(remoteBilans[0], fields))}`
  );

  const paymentFields = ['espece', 'carte', 'cheque', 'virement'];
  const localPayments = sqlite.prepare(`
    SELECT SUM(espece) AS espece, SUM(carte) AS carte,
           SUM(cheque) AS cheque, SUM(virement) AS virement
      FROM paiement_mixte
  `).get();
  const [remotePayments] = await connection.query(`
    SELECT SUM(espece) AS espece, SUM(carte) AS carte,
           SUM(cheque) AS cheque, SUM(virement) AS virement
      FROM ${quoteIdentifier(testTable('paiement_mixte'))}
  `);
  assert(
    JSON.stringify(numericRow(remotePayments[0], paymentFields)) ===
      JSON.stringify(numericRow(localPayments, paymentFields)),
    `Paiements différents. SQLite=${JSON.stringify(numericRow(localPayments, paymentFields))} ` +
      `MySQL=${JSON.stringify(numericRow(remotePayments[0], paymentFields))}`
  );

  const localTicketCount = sqlite.prepare(
    'SELECT COUNT(*) AS count FROM ticketdecaisse'
  ).get().count;
  const [remoteTickets] = await connection.query(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(testTable('ticketdecaisse'))}`
  );
  assert(Number(remoteTickets[0].count) === localTicketCount, 'Nombre de tickets différent.');

  return {
    bilan: numericRow(localBilan, fields),
    paiements: numericRow(localPayments, paymentFields),
    tickets: localTicketCount
  };
}

async function main() {
  const config = parseRemoteMysqlPreset();
  const adminConnection = await mysql.createConnection(config);
  let db;
  let cleanupError;

  try {
    await createIsolatedTables(adminConnection);

    const dbModule = require(path.join(backendDir, 'db'));
    db = dbModule;
    dbModule.updateMysqlConfig(config);
    const app = require(path.join(backendDir, 'app'));
    const { sqlite } = dbModule;
    initializeSqlite(sqlite);

    sqlite.prepare(`
      INSERT INTO users
        (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'remote-user',
      'Test',
      'Distant',
      'remote-user',
      'remote-user',
      bcrypt.hashSync('remote-user-secret', 10),
      0
    );
    sqlite.prepare(`
      INSERT INTO users
        (uuid_user, prenom, nom, pseudo, pseudo_normalise, password, admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'remote-admin',
      'Admin',
      'Distant',
      'remote-admin',
      'remote-admin',
      bcrypt.hashSync('remote-admin-secret', 10),
      2
    );

    const cookie = await login(app, 'remote-user', 'remote-user-secret');
    const cardTicket = await createSale(app, sqlite, cookie, 1, [
      { moyen: 'carte', montant: 2000 }
    ]);
    await createSale(app, sqlite, cookie, 2, [
      { moyen: 'especes', montant: 900 }
    ]);
    await createSale(app, sqlite, cookie, 3, [
      { moyen: 'cheque', montant: 1200 }
    ]);
    await createSale(app, sqlite, cookie, 4, [
      { moyen: 'virement', montant: 1300 }
    ]);
    await createSale(app, sqlite, cookie, 5, [
      { moyen: 'carte', montant: 600 },
      { moyen: 'especes', montant: 400 }
    ]);
    await createCorrection(app, sqlite, cookie, cardTicket);

    const firstSync = await request(app).post('/api/sync?debug=true');
    assert(firstSync.status === 200 && firstSync.body.success, 'La synchronisation réelle a échoué.');
    assert(
      sqlite.prepare('SELECT COUNT(*) AS count FROM sync_log WHERE synced <> 1').get().count === 0,
      'Certaines opérations SQLite ne sont pas marquées synchronisées.'
    );

    const firstComparison = await compareLocalAndRemote(adminConnection, sqlite);

    sqlite.prepare('UPDATE sync_log SET synced = 0').run();
    const replay = await request(app).post('/api/sync?debug=true');
    assert(replay.status === 200 && replay.body.success, 'Le rejeu de synchronisation a échoué.');
    const secondComparison = await compareLocalAndRemote(adminConnection, sqlite);
    assert(
      JSON.stringify(secondComparison) === JSON.stringify(firstComparison),
      'Le rejeu a modifié les totaux MySQL.'
    );

    process.stdout.write('\n=== Synchronisation SQLite vers MySQL isolée ===\n');
    process.stdout.write(`[RÉUSSI] Tables isolées : ${prefix}*\n`);
    process.stdout.write(`[RÉUSSI] Tickets comparés : ${firstComparison.tickets}\n`);
    process.stdout.write(`[RÉUSSI] Total carte : ${firstComparison.bilan.prix_total_carte}\n`);
    process.stdout.write(`[RÉUSSI] Paiements mixtes et correction comparés\n`);
    process.stdout.write(`[RÉUSSI] Rejeu idempotent sans double comptage\n`);
  } finally {
    try {
      await dropIsolatedTables(adminConnection);
      await verifyCleanup(adminConnection);
      process.stdout.write('[RÉUSSI] Nettoyage MySQL vérifié : aucune table de test restante\n');
    } catch (error) {
      cleanupError = error;
    }

    if (db?.getMysqlPool) {
      await db.getMysqlPool().end().catch(() => {});
    }
    await adminConnection.end().catch(() => {});
    if (cleanupError) throw cleanupError;
  }
}

main().catch(error => {
  process.stderr.write(`\n[ÉCHOUÉ] Test de synchronisation distante : ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
