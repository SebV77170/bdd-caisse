const fs = require('fs');
const path = require('path');
const bcrypt = require('../../backend/node_modules/bcrypt');
const Database = require('../../backend/node_modules/better-sqlite3');

const root = path.resolve(__dirname, '../..');
const runtimeRoot = process.env.BDD_CAISSE_E2E_ROOT
  || path.join(root, '.e2e-runtime');
const homeDir = path.join(runtimeRoot, 'home');
const dataDir = path.join(homeDir, '.bdd-caisse');
const databasePath = path.join(dataDir, 'ressourcebrie-sqlite.db');
const templatePath = path.join(
  root,
  'backend',
  'database',
  'ressourcebrie-sqlite-template.db'
);

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(templatePath, databasePath);

const db = new Database(databasePath);

try {
  const mutableTables = [
    'bilan',
    'boutons_ventes',
    'categories',
    'code_postal',
    'facture',
    'journal_corrections',
    'motifs_correction',
    'objets_vendus',
    'paiement_mixte',
    'session_caisse',
    'sync_log',
    'ticketdecaisse',
    'ticketdecaissetemp',
    'users',
    'uuid_mapping',
    'vente'
  ];

  db.transaction(() => {
    for (const table of mutableTables) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    const password = bcrypt.hashSync('e2e-secret', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, pseudo_normalise,
        password, admin, mail, tel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
      'e2e-admin',
      'Test',
      'Responsable',
      'e2e-admin',
      'e2e-admin',
      password,
      2,
      'e2e@example.test',
      ''
    );
    insertUser.run(
      'e2e-alice',
      'Alice',
      'Martin',
      'e2e-alice',
      'e2e-alice',
      password,
      1,
      'alice@example.test',
      ''
    );
    insertUser.run(
      'e2e-bob',
      'Bob',
      'Durand',
      'e2e-bob',
      'e2e-bob',
      password,
      1,
      'bob@example.test',
      ''
    );
    insertUser.run(
      'e2e-claire',
      'Claire',
      'Bernard',
      'e2e-claire',
      'e2e-claire',
      password,
      1,
      'claire@example.test',
      ''
    );

    db.prepare(`
      INSERT INTO categories (id, parent_id, category, color)
      VALUES (1, NULL, 'Articles E2E', 'primary')
    `).run();
    db.prepare(`
      INSERT INTO categories (id, parent_id, category, color)
      VALUES (2, 1, 'Tests', 'primary')
    `).run();
    db.prepare(`
      INSERT INTO boutons_ventes (
        id_bouton, sous_categorie, nom, id_cat, id_souscat, prix
      ) VALUES (1, 'Tests', 'Article E2E', 1, 2, 1234)
    `).run();
    db.prepare(`
      INSERT INTO motifs_correction (motif)
      VALUES ('Erreur E2E')
    `).run();
  })();
} finally {
  db.close();
}

fs.writeFileSync(
  path.join(dataDir, 'syncConfig.json'),
  JSON.stringify({ interval: 60, enabled: false }, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, 'webdavSyncConfig.json'),
  JSON.stringify({ interval: 60, enabled: false, mode: null }, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, 'storeConfig.json'),
  JSON.stringify({ localName: 'E2E', registerNumber: 99 }, null, 2)
);

console.log(`Base E2E créée : ${databasePath}`);
