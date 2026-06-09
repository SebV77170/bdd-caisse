const path = require('path');
const os = require('os');
const fs = require('fs');

const roots = [
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '..', '..')
];
const root = roots.find(candidate =>
  fs.existsSync(path.join(candidate, 'backend', 'profileBackup.js'))
);
if (!root) {
  throw new Error('Module de sauvegarde backend introuvable.');
}
const {
  defaultBackupRoot,
  createProfileBackup,
  validateBackup,
  restoreProfileBackup
} = require(path.join(root, 'backend', 'profileBackup'));

function usage() {
  process.stdout.write([
    'Utilisation :',
    '  profile-backup.js backup [dossier-destination]',
    '  profile-backup.js verify <dossier-sauvegarde>',
    '  profile-backup.js restore <dossier-sauvegarde>',
    '',
    "L'application doit être fermée pour une restauration."
  ].join('\n'));
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  const userDataDir = path.join(os.homedir(), '.bdd-caisse');

  if (command === 'backup') {
    const backupRoot = argument
      ? path.resolve(argument)
      : defaultBackupRoot(userDataDir);
    const result = await createProfileBackup({
      userDataDir,
      backupRoot,
      reason: 'manual',
      includeDocuments: true
    });
    process.stdout.write(`Sauvegarde créée et vérifiée :\n${result.backupDirectory}\n`);
    return;
  }

  if (command === 'verify') {
    if (!argument) throw new Error('Le dossier de sauvegarde est obligatoire.');
    const backupDirectory = path.resolve(argument);
    const manifest = validateBackup(backupDirectory);
    process.stdout.write(
      `Sauvegarde valide : ${backupDirectory}\n` +
      `${manifest.files.length} fichiers contrôlés.\n`
    );
    return;
  }

  if (command === 'restore') {
    if (!argument) throw new Error('Le dossier de sauvegarde est obligatoire.');
    const backupDirectory = path.resolve(argument);
    const result = restoreProfileBackup({ backupDirectory, userDataDir });
    process.stdout.write(`Profil restauré : ${result.restoredDirectory}\n`);
    if (result.rollbackDirectory) {
      process.stdout.write(`Ancien profil conservé : ${result.rollbackDirectory}\n`);
    }
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`Échec : ${error.message}\n`);
  process.exitCode = 1;
});
