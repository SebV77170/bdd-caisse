const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { assertDatabaseIntegrity } = require('./syncSqliteWithTemplate');

const BACKUP_FORMAT_VERSION = 1;
const DATABASE_NAME = 'ressourcebrie-sqlite.db';
const DOCUMENT_DIRECTORIES = ['tickets', 'factures'];
const EXCLUDED_ROOT_FILES = new Set(['sessions.sqlite']);

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace('.', '-');
}

function uniqueBackupId(reason) {
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${timestampId()}-${safeReason}-${crypto.randomBytes(3).toString('hex')}`;
}

function defaultBackupRoot(userDataDir) {
  return path.join(path.dirname(userDataDir), '.bdd-caisse-backups');
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function listFiles(directory, relativeBase = '') {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeBase, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function copyFileWithParents(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyProfileFiles(userDataDir, dataDirectory, includeDocuments) {
  const copied = [];
  for (const entry of fs.readdirSync(userDataDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === DATABASE_NAME || EXCLUDED_ROOT_FILES.has(entry.name)) continue;
    if (path.extname(entry.name).toLowerCase() !== '.json') continue;
    copyFileWithParents(
      path.join(userDataDir, entry.name),
      path.join(dataDirectory, entry.name)
    );
    copied.push(entry.name);
  }

  if (includeDocuments) {
    for (const directoryName of DOCUMENT_DIRECTORIES) {
      const sourceDirectory = path.join(userDataDir, directoryName);
      for (const relativeFile of listFiles(sourceDirectory)) {
        const backupRelativePath = path.join(directoryName, relativeFile);
        copyFileWithParents(
          path.join(sourceDirectory, relativeFile),
          path.join(dataDirectory, backupRelativePath)
        );
        copied.push(backupRelativePath);
      }
    }
  }
  return copied;
}

function writeManifest(backupDirectory, metadata) {
  const dataDirectory = path.join(backupDirectory, 'data');
  const files = listFiles(dataDirectory)
    .sort()
    .map(relativePath => {
      const fullPath = path.join(dataDirectory, relativePath);
      return {
        path: relativePath.replace(/\\/g, '/'),
        size: fs.statSync(fullPath).size,
        sha256: hashFile(fullPath)
      };
    });
  const manifest = {
    format: 'bdd-caisse-backup',
    version: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    reason: metadata.reason || 'manual',
    includeDocuments: metadata.includeDocuments !== false,
    files
  };
  fs.writeFileSync(
    path.join(backupDirectory, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  return manifest;
}

function validateBackup(backupDirectory) {
  const manifestPath = path.join(backupDirectory, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest de sauvegarde introuvable.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'bdd-caisse-backup' || manifest.version !== BACKUP_FORMAT_VERSION) {
    throw new Error('Format de sauvegarde non reconnu.');
  }
  if (!Array.isArray(manifest.files)) {
    throw new Error('Liste des fichiers de sauvegarde invalide.');
  }

  const dataDirectory = path.join(backupDirectory, 'data');
  for (const file of manifest.files) {
    if (!file.path || file.path.includes('..') || path.isAbsolute(file.path)) {
      throw new Error(`Chemin de sauvegarde invalide : ${file.path}`);
    }
    const fullPath = path.join(dataDirectory, ...file.path.split('/'));
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier sauvegardé manquant : ${file.path}`);
    }
    if (fs.statSync(fullPath).size !== file.size || hashFile(fullPath) !== file.sha256) {
      throw new Error(`Fichier sauvegardé altéré : ${file.path}`);
    }
  }

  const databasePath = path.join(dataDirectory, DATABASE_NAME);
  if (!fs.existsSync(databasePath)) {
    throw new Error('La sauvegarde ne contient pas la base SQLite.');
  }
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    assertDatabaseIntegrity(db, 'Base SQLite sauvegardée');
  } finally {
    db.close();
  }
  return manifest;
}

async function createProfileBackup({
  userDataDir,
  backupRoot = defaultBackupRoot(userDataDir),
  db,
  reason = 'manual',
  includeDocuments = true
}) {
  const databasePath = path.join(userDataDir, DATABASE_NAME);
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Base SQLite absente : ${databasePath}`);
  }

  fs.mkdirSync(backupRoot, { recursive: true });
  const backupDirectory = path.join(backupRoot, uniqueBackupId(reason));
  const dataDirectory = path.join(backupDirectory, 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });

  try {
    const backupDatabasePath = path.join(dataDirectory, DATABASE_NAME);
    if (db) {
      await db.backup(backupDatabasePath);
    } else {
      const source = new Database(databasePath, { readonly: true, fileMustExist: true });
      try {
        assertDatabaseIntegrity(source, 'Base SQLite source');
        await source.backup(backupDatabasePath);
      } finally {
        source.close();
      }
    }
    copyProfileFiles(userDataDir, dataDirectory, includeDocuments);
    const manifest = writeManifest(backupDirectory, { reason, includeDocuments });
    validateBackup(backupDirectory);
    return { backupDirectory, manifest };
  } catch (error) {
    fs.rmSync(backupDirectory, { recursive: true, force: true });
    throw error;
  }
}

function createPreMigrationBackup({
  userDataDir,
  databasePath,
  db,
  reason = 'pre-migration'
}) {
  const backupRoot = defaultBackupRoot(userDataDir);
  fs.mkdirSync(backupRoot, { recursive: true });
  const backupDirectory = path.join(backupRoot, uniqueBackupId(reason));
  const dataDirectory = path.join(backupDirectory, 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });
  try {
    const backupDatabasePath = path.join(dataDirectory, DATABASE_NAME);
    if (db) {
      db.prepare('VACUUM INTO ?').run(backupDatabasePath);
    } else {
      const source = new Database(databasePath, { readonly: true, fileMustExist: true });
      try {
        assertDatabaseIntegrity(source, 'Base SQLite avant migration');
        source.prepare('VACUUM INTO ?').run(backupDatabasePath);
      } finally {
        source.close();
      }
    }
    copyProfileFiles(userDataDir, dataDirectory, true);
    const manifest = writeManifest(backupDirectory, { reason, includeDocuments: true });
    validateBackup(backupDirectory);
    return { backupDirectory, manifest };
  } catch (error) {
    fs.rmSync(backupDirectory, { recursive: true, force: true });
    throw error;
  }
}

function restoreProfileBackup({ backupDirectory, userDataDir }) {
  validateBackup(backupDirectory);
  const parentDirectory = path.dirname(userDataDir);
  const stagingDirectory = path.join(
    parentDirectory,
    `.bdd-caisse-restoring-${process.pid}-${Date.now()}`
  );
  const rollbackDirectory = path.join(
    parentDirectory,
    uniqueBackupId('.bdd-caisse-rollback')
  );
  const dataDirectory = path.join(backupDirectory, 'data');

  fs.mkdirSync(stagingDirectory, { recursive: true });
  try {
    for (const relativeFile of listFiles(dataDirectory)) {
      copyFileWithParents(
        path.join(dataDirectory, relativeFile),
        path.join(stagingDirectory, relativeFile)
      );
    }
    fs.mkdirSync(path.join(stagingDirectory, 'tickets'), { recursive: true });
    fs.mkdirSync(path.join(stagingDirectory, 'factures'), { recursive: true });

    const stagedDb = new Database(
      path.join(stagingDirectory, DATABASE_NAME),
      { readonly: true, fileMustExist: true }
    );
    try {
      assertDatabaseIntegrity(stagedDb, 'Base SQLite à restaurer');
    } finally {
      stagedDb.close();
    }

    if (fs.existsSync(userDataDir)) fs.renameSync(userDataDir, rollbackDirectory);
    try {
      fs.renameSync(stagingDirectory, userDataDir);
    } catch (error) {
      if (fs.existsSync(rollbackDirectory) && !fs.existsSync(userDataDir)) {
        fs.renameSync(rollbackDirectory, userDataDir);
      }
      throw error;
    }
    return {
      restoredDirectory: userDataDir,
      rollbackDirectory: fs.existsSync(rollbackDirectory) ? rollbackDirectory : null
    };
  } catch (error) {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  DATABASE_NAME,
  defaultBackupRoot,
  createProfileBackup,
  createPreMigrationBackup,
  validateBackup,
  restoreProfileBackup
};
