const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

describe('Configuration de l’installation Windows', () => {
  test('embarque les ressources indispensables au premier lancement', () => {
    const electronPackage = JSON.parse(
      fs.readFileSync(path.join(root, 'electron-app/package.json'), 'utf8')
    );
    const resources = electronPackage.build.extraResources;

    expect(electronPackage.build.win.target).toBe('nsis');
    expect(electronPackage.build.nsis.include).toBe('installer.nsh');
    expect(resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: 'backend' }),
      expect.objectContaining({ to: 'node.exe' }),
      expect.objectContaining({ to: 'database' }),
      expect.objectContaining({ to: 'frontend_build' }),
      expect.objectContaining({ to: 'tools/profile-backup.js' }),
      expect.objectContaining({ to: 'tools/sauvegarder-caisse.ps1' }),
      expect.objectContaining({ to: 'tools/restaurer-caisse.ps1' })
    ]));
  });

  test('ne programme aucune suppression du profil de caisse à la désinstallation', () => {
    const installer = fs.readFileSync(
      path.join(root, 'electron-app/assets/installer.nsh'),
      'utf8'
    );

    expect(installer).not.toMatch(/\.bdd-caisse/i);
    expect(installer).not.toMatch(/\bRMDir\b|\bDelete\b/i);
    expect(installer).toMatch(/taskkill/i);
  });
});
