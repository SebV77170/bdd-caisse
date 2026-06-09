const {
  startUpdateCheckInBackground
} = require('../../electron-app/updateStartupPolicy');

describe('Politique de démarrage des mises à jour Electron', () => {
  test('ne bloque pas le démarrage pendant une vérification distante', async () => {
    let resolveUpdate;
    const update = new Promise(resolve => {
      resolveUpdate = resolve;
    });
    const checkForUpdates = jest.fn(() => update);

    startUpdateCheckInBackground(checkForUpdates);

    expect(checkForUpdates).not.toHaveBeenCalled();
    await new Promise(resolve => setImmediate(resolve));
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    resolveUpdate();
    await update;
  });

  test('absorbe une panne distante sans exception non gérée', async () => {
    const onError = jest.fn();
    startUpdateCheckInBackground(
      () => Promise.reject(new Error('Téléchargement interrompu')),
      onError
    );

    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Téléchargement interrompu' })
    );
  });
});
