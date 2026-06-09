const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const {
  createProfileBackup,
  validateBackup,
  restoreProfileBackup
} = require('../profileBackup');
const { initializePersistentDatabase } = require('../databaseLifecycle');

function createProfile(root, name) {
  const profile = path.join(root, name, '.bdd-caisse');
  fs.mkdirSync(path.join(profile, 'tickets', '2026', '06'), { recursive: true });
  fs.mkdirSync(path.join(profile, 'factures'), { recursive: true });
  const db = new Database(path.join(profile, 'ressourcebrie-sqlite.db'));
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  db.prepare(`
    INSERT INTO ticketdecaisse (
      nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement,
      prix_total, uuid_ticket, uuid_session_caisse
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Caissier Test',
    'user-backup',
    '2026-06-09 10:00:00',
    2,
    'mixte',
    4250,
    'ticket-backup',
    'session-backup'
  );
  const ticketId = db.prepare(
    'SELECT id_ticket FROM ticketdecaisse WHERE uuid_ticket = ?'
  ).get('ticket-backup').id_ticket;
  db.prepare(`
    INSERT INTO paiement_mixte (
      id_ticket, espece, carte, cheque, virement, uuid_ticket
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(ticketId, 1250, 3000, 0, 0, 'ticket-backup');
  db.prepare(`
    INSERT INTO journal_corrections (
      date_correction, uuid_ticket_original, uuid_ticket_correction,
      utilisateur, motif
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    '2026-06-09 10:05:00',
    'ticket-original',
    'ticket-backup',
    'user-backup',
    'Test sauvegarde'
  );
  db.prepare(`
    INSERT INTO session_caisse (
      id_session, utilisateur_ouverture, fond_initial, caissiers, poste
    ) VALUES (?, ?, ?, ?, ?)
  `).run('session-backup', 'user-backup', 10000, 'Caissier Test', 3);
  fs.writeFileSync(
    path.join(profile, 'storeConfig.json'),
    JSON.stringify({ localName: 'SOURCE', registerNumber: 3 })
  );
  fs.writeFileSync(path.join(profile, 'sessions.sqlite'), 'session-temporaire');
  fs.writeFileSync(
    path.join(profile, 'tickets', '2026', '06', 'ticket.pdf'),
    'ticket-source'
  );
  fs.writeFileSync(path.join(profile, 'factures', 'facture.pdf'), 'facture-source');
  return { profile, db };
}

describe('Sauvegarde et restauration du profil', () => {
  let runtimeRoot;

  beforeEach(() => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-caisse-backup-'));
  });

  afterEach(() => {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  });

  test('sauvegarde puis restaure base, configurations, tickets et factures', async () => {
    const source = createProfile(runtimeRoot, 'source');
    const backupRoot = path.join(runtimeRoot, 'external-backups');
    const backup = await createProfileBackup({
      userDataDir: source.profile,
      backupRoot,
      db: source.db,
      reason: 'test-complet'
    });
    source.db.close();

    const manifest = validateBackup(backup.backupDirectory);
    expect(manifest.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'ressourcebrie-sqlite.db',
      'storeConfig.json',
      'tickets/2026/06/ticket.pdf',
      'factures/facture.pdf'
    ]));
    expect(manifest.files.map(file => file.path)).not.toContain('sessions.sqlite');

    const target = createProfile(runtimeRoot, 'target');
    target.db.prepare(
      'UPDATE ticketdecaisse SET prix_total = 9999 WHERE uuid_ticket = ?'
    ).run('ticket-backup');
    target.db.close();
    const restored = restoreProfileBackup({
      backupDirectory: backup.backupDirectory,
      userDataDir: target.profile
    });

    const restoredDb = new Database(path.join(target.profile, 'ressourcebrie-sqlite.db'));
    expect(restoredDb.prepare(
      'SELECT prix_total FROM ticketdecaisse WHERE uuid_ticket = ?'
    ).get('ticket-backup').prix_total).toBe(4250);
    expect(restoredDb.prepare(
      'SELECT espece, carte FROM paiement_mixte WHERE uuid_ticket = ?'
    ).get('ticket-backup')).toEqual({ espece: 1250, carte: 3000 });
    expect(restoredDb.prepare(
      'SELECT motif FROM journal_corrections WHERE uuid_ticket_correction = ?'
    ).get('ticket-backup').motif).toBe('Test sauvegarde');
    expect(restoredDb.prepare(
      'SELECT fond_initial FROM session_caisse WHERE id_session = ?'
    ).get('session-backup').fond_initial).toBe(10000);
    restoredDb.close();
    expect(JSON.parse(
      fs.readFileSync(path.join(target.profile, 'storeConfig.json'), 'utf8')
    )).toEqual({ localName: 'SOURCE', registerNumber: 3 });
    expect(fs.readFileSync(
      path.join(target.profile, 'tickets', '2026', '06', 'ticket.pdf'),
      'utf8'
    )).toBe('ticket-source');
    expect(fs.existsSync(path.join(target.profile, 'sessions.sqlite'))).toBe(false);
    expect(restored.rollbackDirectory).toBeTruthy();
    expect(fs.existsSync(restored.rollbackDirectory)).toBe(true);
  });

  test('refuse une sauvegarde dont un fichier a été modifié', async () => {
    const source = createProfile(runtimeRoot, 'source');
    const backup = await createProfileBackup({
      userDataDir: source.profile,
      backupRoot: path.join(runtimeRoot, 'backups'),
      db: source.db
    });
    source.db.close();
    fs.appendFileSync(
      path.join(backup.backupDirectory, 'data', 'storeConfig.json'),
      'altération'
    );

    expect(() => validateBackup(backup.backupDirectory)).toThrow(/altéré/);
  });

  test('refuse de sauvegarder une base absente', async () => {
    const emptyProfile = path.join(runtimeRoot, 'empty', '.bdd-caisse');
    fs.mkdirSync(emptyProfile, { recursive: true });
    await expect(createProfileBackup({
      userDataDir: emptyProfile,
      backupRoot: path.join(runtimeRoot, 'backups')
    })).rejects.toThrow(/Base SQLite absente/);
  });

  test('refuse une base locale tronquée sans la remplacer', () => {
    const userDataDir = path.join(runtimeRoot, 'broken', '.bdd-caisse');
    const resourceDir = path.join(runtimeRoot, 'resources');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(path.join(resourceDir, 'database'), { recursive: true });
    fs.copyFileSync(
      path.join(__dirname, '../database/ressourcebrie-sqlite-template.db'),
      path.join(resourceDir, 'database', 'ressourcebrie-sqlite-template.db')
    );
    const brokenPath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
    fs.writeFileSync(brokenPath, Buffer.from('base tronquée'));
    const original = fs.readFileSync(brokenPath);

    expect(() => initializePersistentDatabase({ userDataDir, resourceDir }))
      .toThrow();
    expect(fs.readFileSync(brokenPath)).toEqual(original);
  });
});
