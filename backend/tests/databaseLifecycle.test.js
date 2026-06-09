const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { initializePersistentDatabase } = require('../databaseLifecycle');
const { syncSqliteWithTemplate } = require('../syncSqliteWithTemplate');

function createRuntimeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-caisse-lifecycle-'));
}

function copyResources(root) {
  const resourceDir = path.join(root, 'resources');
  fs.mkdirSync(path.join(resourceDir, 'database'), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, '../database/ressourcebrie-sqlite-template.db'),
    path.join(resourceDir, 'database/ressourcebrie-sqlite-template.db')
  );
  fs.copyFileSync(
    path.join(__dirname, '../inserts_categories_boutons.sql'),
    path.join(resourceDir, 'inserts_categories_boutons.sql')
  );
  fs.copyFileSync(
    path.join(__dirname, '../inserts_users.sql'),
    path.join(resourceDir, 'inserts_users.sql')
  );
  return resourceDir;
}

describe('Installation et migration SQLite', () => {
  let runtimeRoot;

  afterEach(() => {
    if (runtimeRoot) fs.rmSync(runtimeRoot, { recursive: true, force: true });
  });

  test('initialise atomiquement un profil neuf et ses dossiers', () => {
    runtimeRoot = createRuntimeRoot();
    const resourceDir = copyResources(runtimeRoot);
    const userDataDir = path.join(runtimeRoot, 'profile', '.bdd-caisse');

    const initialized = initializePersistentDatabase({ userDataDir, resourceDir });
    try {
      expect(initialized.created).toBe(true);
      expect(fs.existsSync(initialized.databasePath)).toBe(true);
      expect(fs.existsSync(path.join(userDataDir, 'tickets'))).toBe(true);
      expect(fs.existsSync(path.join(userDataDir, 'factures'))).toBe(true);
      expect(
        initialized.db.prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'"
        ).get().count
      ).toBeGreaterThan(10);
      expect(initialized.db.prepare('PRAGMA quick_check').get().quick_check).toBe('ok');
    } finally {
      initialized.db.close();
    }

    expect(
      fs.readdirSync(userDataDir).some(name => name.includes('.installing-'))
    ).toBe(false);
  });

  test('migre une ancienne base sans perdre les données ni les colonnes historiques', () => {
    runtimeRoot = createRuntimeRoot();
    const resourceDir = copyResources(runtimeRoot);
    const userDataDir = path.join(runtimeRoot, 'profile', '.bdd-caisse');
    fs.mkdirSync(userDataDir, { recursive: true });
    const databasePath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
    fs.copyFileSync(
      path.join(resourceDir, 'database', 'ressourcebrie-sqlite-template.db'),
      databasePath
    );

    const legacy = new Database(databasePath);
    legacy.exec(`
      ALTER TABLE users DROP COLUMN pseudo_normalise;
      ALTER TABLE users ADD COLUMN note_version_historique TEXT;
      DROP INDEX idx_ticketdecaisse_source_temp_vente;
      ALTER TABLE ticketdecaisse DROP COLUMN source_temp_vente;
      DROP INDEX idx_sync_log_operation_uuid;
      ALTER TABLE sync_log DROP COLUMN operation_uuid;
    `);
    legacy.prepare(`
      INSERT INTO users (
        uuid_user, prenom, nom, pseudo, password, admin, note_version_historique
      ) VALUES ('legacy-user', 'Ancien', 'Compte', 'ancien', 'hash', 0, 'à conserver')
    `).run();
    legacy.prepare(`
      INSERT INTO ticketdecaisse (
        nom_vendeur, id_vendeur, date_achat_dt, nbr_objet,
        moyen_paiement, prix_total, uuid_ticket
      ) VALUES ('Ancien', 'legacy-user', '2025-01-02', 1, 'carte', 1234, 'legacy-ticket')
    `).run();
    legacy.close();
    fs.writeFileSync(
      path.join(userDataDir, 'storeConfig.json'),
      JSON.stringify({ localName: 'ANCIEN', registerNumber: 7 })
    );

    const firstLaunch = initializePersistentDatabase({ userDataDir, resourceDir });
    try {
      expect(firstLaunch.created).toBe(false);
      expect(firstLaunch.migration.changed).toBe(true);
      expect(firstLaunch.preMigrationBackup).toBeTruthy();
      expect(fs.existsSync(
        path.join(firstLaunch.preMigrationBackup.backupDirectory, 'manifest.json')
      )).toBe(true);
      expect(firstLaunch.db.prepare(
        "SELECT pseudo, note_version_historique FROM users WHERE uuid_user = 'legacy-user'"
      ).get()).toEqual({
        pseudo: 'ancien',
        note_version_historique: 'à conserver'
      });
      expect(firstLaunch.db.prepare(
        "SELECT prix_total FROM ticketdecaisse WHERE uuid_ticket = 'legacy-ticket'"
      ).get().prix_total).toBe(1234);
      expect(
        firstLaunch.db.prepare('PRAGMA table_info(users)').all()
          .some(column => column.name === 'pseudo_normalise')
      ).toBe(true);
      expect(
        firstLaunch.db.prepare('PRAGMA table_info(ticketdecaisse)').all()
          .some(column => column.name === 'source_temp_vente')
      ).toBe(true);
      expect(
        firstLaunch.db.prepare('PRAGMA table_info(sync_log)').all()
          .some(column => column.name === 'operation_uuid')
      ).toBe(true);
    } finally {
      firstLaunch.db.close();
    }

    expect(JSON.parse(
      fs.readFileSync(path.join(userDataDir, 'storeConfig.json'), 'utf8')
    )).toEqual({ localName: 'ANCIEN', registerNumber: 7 });

    const secondLaunch = initializePersistentDatabase({ userDataDir, resourceDir });
    try {
      expect(secondLaunch.created).toBe(false);
      expect(secondLaunch.migration.changed).toBe(false);
      expect(secondLaunch.db.prepare(
        "SELECT COUNT(*) AS count FROM ticketdecaisse WHERE uuid_ticket = 'legacy-ticket'"
      ).get().count).toBe(1);
    } finally {
      secondLaunch.db.close();
    }
  });

  test('annule entièrement une migration impossible', () => {
    runtimeRoot = createRuntimeRoot();
    const templatePath = path.join(runtimeRoot, 'template.db');
    const targetPath = path.join(runtimeRoot, 'target.db');
    const template = new Database(templatePath);
    template.exec(`
      CREATE TABLE exemple (
        id INTEGER PRIMARY KEY,
        ajout_optionnel TEXT,
        ajout_obligatoire TEXT NOT NULL
      )
    `);
    template.close();
    const target = new Database(targetPath);
    target.exec('CREATE TABLE exemple (id INTEGER PRIMARY KEY)');
    target.prepare('INSERT INTO exemple (id) VALUES (1)').run();

    expect(() => syncSqliteWithTemplate(target, templatePath)).toThrow(
      /Migration manuelle requise/
    );
    expect(target.prepare('PRAGMA table_info(exemple)').all().map(row => row.name))
      .toEqual(['id']);
    expect(target.prepare('SELECT COUNT(*) AS count FROM exemple').get().count).toBe(1);
    target.close();
  });
});
