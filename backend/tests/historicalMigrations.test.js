const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');
const { initializePersistentDatabase } = require('../databaseLifecycle');

const root = path.resolve(__dirname, '../..');
const historicalVersions = [
  'v1.0',
  'v1.1.0',
  'v1.2.0',
  'version-stable-03092025',
  'version-en-prod-au-11092025'
];

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function insertCompatibleRow(db, table, values) {
  const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
  if (columns.length === 0) return false;

  const selected = [];
  const parameters = [];
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(values, column.name)) {
      selected.push(column.name);
      parameters.push(values[column.name]);
      continue;
    }
    if (column.pk || !column.notnull || column.dflt_value != null) continue;
    selected.push(column.name);
    parameters.push((column.type || '').toUpperCase().includes('INT') ? 0 : 'legacy-test');
  }

  const placeholders = selected.map(() => '?').join(', ');
  db.prepare(`
    INSERT INTO ${quoteIdentifier(table)}
      (${selected.map(quoteIdentifier).join(', ')})
    VALUES (${placeholders})
  `).run(...parameters);
  return true;
}

describe.each(historicalVersions)('Migration historique %s', version => {
  test('conserve les données et atteint le schéma courant', () => {
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-caisse-history-'));
    const userDataDir = path.join(runtimeRoot, 'profile', '.bdd-caisse');
    const resourceDir = path.join(runtimeRoot, 'resources');
    const databasePath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(path.join(resourceDir, 'database'), { recursive: true });

    try {
      const historicalDatabase = execFileSync(
        'git',
        ['show', `${version}:backend/database/ressourcebrie-sqlite-template.db`],
        { cwd: root, encoding: null, maxBuffer: 10 * 1024 * 1024 }
      );
      fs.writeFileSync(databasePath, historicalDatabase);
      fs.copyFileSync(
        path.join(__dirname, '../database/ressourcebrie-sqlite-template.db'),
        path.join(resourceDir, 'database/ressourcebrie-sqlite-template.db')
      );

      const legacy = new Database(databasePath);
      insertCompatibleRow(legacy, 'users', {
        uuid_user: `migration-${version}`,
        prenom: 'Test',
        nom: 'Migration',
        pseudo: `migration-${version}`,
        pseudo_normalise: `migration-${version}`,
        password: 'hash',
        admin: 0
      });
      insertCompatibleRow(legacy, 'ticketdecaisse', {
        uuid_ticket: `ticket-${version}`,
        nom_vendeur: 'Migration',
        id_vendeur: `migration-${version}`,
        date_achat_dt: '2025-01-02T10:00:00.000Z',
        nbr_objet: 1,
        moyen_paiement: 'carte',
        prix_total: 1234
      });
      legacy.close();
      fs.writeFileSync(
        path.join(userDataDir, 'storeConfig.json'),
        JSON.stringify({ localName: version, registerNumber: 4 })
      );

      const migrated = initializePersistentDatabase({ userDataDir, resourceDir });
      try {
        expect(migrated.db.prepare(
          'SELECT COUNT(*) AS count FROM users WHERE pseudo = ?'
        ).get(`migration-${version}`).count).toBe(1);
        expect(migrated.db.prepare(
          'SELECT COUNT(*) AS count FROM ticketdecaisse WHERE uuid_ticket = ?'
        ).get(`ticket-${version}`).count).toBe(1);
        expect(migrated.db.prepare('PRAGMA quick_check').get().quick_check).toBe('ok');
      } finally {
        migrated.db.close();
      }

      const secondLaunch = initializePersistentDatabase({ userDataDir, resourceDir });
      try {
        expect(secondLaunch.migration.changed).toBe(false);
      } finally {
        secondLaunch.db.close();
      }
      expect(JSON.parse(
        fs.readFileSync(path.join(userDataDir, 'storeConfig.json'), 'utf8')
      )).toEqual({ localName: version, registerNumber: 4 });
    } finally {
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    }
  });
});
