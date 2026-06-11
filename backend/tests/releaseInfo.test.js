const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadReleaseInfo } = require('../../electron-app/releaseInfo');

describe('Informations de version Electron', () => {
  test('retourne la version et les notes embarquées', () => {
    const filePath = path.join(os.tmpdir(), `release-info-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      version: '2.1.0',
      notes: 'Nouvelle fonctionnalité'
    }));

    expect(loadReleaseInfo(filePath, '1.0.0')).toEqual({
      version: '2.1.0',
      notes: 'Nouvelle fonctionnalité'
    });

    fs.unlinkSync(filePath);
  });

  test('utilise une valeur de repli si les métadonnées sont absentes', () => {
    expect(loadReleaseInfo('fichier-inexistant.json', '2.0.2')).toEqual({
      version: '2.0.2',
      notes: 'Aucune note de version disponible.'
    });
  });
});
