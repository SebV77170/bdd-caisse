const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  syncSqliteWithTemplate,
  assertDatabaseIntegrity,
  getPendingSchemaChanges
} = require('./syncSqliteWithTemplate');
const { createPreMigrationBackup } = require('./profileBackup');

function applySeedFile(db, filePath) {
  if (!fs.existsSync(filePath)) return;
  db.exec(fs.readFileSync(filePath, 'utf8'));
}

function initializePersistentDatabase({ userDataDir, resourceDir, ensureMigrations }) {
  const databasePath = path.join(userDataDir, 'ressourcebrie-sqlite.db');
  const templatePath = path.join(resourceDir, 'database', 'ressourcebrie-sqlite-template.db');
  const categorySeedPath = path.join(resourceDir, 'inserts_categories_boutons.sql');
  const userSeedPath = path.join(resourceDir, 'inserts_users.sql');

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(path.join(userDataDir, 'tickets'), { recursive: true });
  fs.mkdirSync(path.join(userDataDir, 'factures'), { recursive: true });

  let created = false;
  if (!fs.existsSync(databasePath)) {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template SQLite introuvable : ${templatePath}`);
    }

    const temporaryPath = `${databasePath}.installing-${process.pid}-${Date.now()}`;
    fs.copyFileSync(templatePath, temporaryPath);
    let temporaryDb;
    try {
      temporaryDb = new Database(temporaryPath);
      temporaryDb.transaction(() => {
        applySeedFile(temporaryDb, categorySeedPath);
        applySeedFile(temporaryDb, userSeedPath);
      })();
      assertDatabaseIntegrity(temporaryDb, 'Nouvelle base SQLite');
      temporaryDb.close();
      temporaryDb = null;
      fs.renameSync(temporaryPath, databasePath);
      created = true;
    } catch (error) {
      if (temporaryDb) temporaryDb.close();
      fs.rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  const db = new Database(databasePath);
  try {
    assertDatabaseIntegrity(db, 'Base SQLite utilisateur');
    const pendingChanges = getPendingSchemaChanges(db, templatePath);
    let preMigrationBackup = null;
    if (!created && pendingChanges.length > 0) {
      preMigrationBackup = createPreMigrationBackup({ userDataDir, databasePath, db });
    }
    const migration = syncSqliteWithTemplate(db, templatePath);
    if (ensureMigrations) ensureMigrations(db);
    assertDatabaseIntegrity(db, 'Base SQLite opérationnelle');
    return { db, databasePath, created, migration, preMigrationBackup };
  } catch (error) {
    db.close();
    throw error;
  }
}

module.exports = { initializePersistentDatabase };
