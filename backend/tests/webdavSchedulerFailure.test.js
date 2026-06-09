const path = require('path');

const mockHomeDir = path.join(__dirname, '.tmp-webdav-scheduler-home');
const mockUploadTicketsAndFactures = jest.fn();

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockHomeDir
}));

jest.mock('../webdavSync', () => ({
  uploadTicketsAndFactures: mockUploadTicketsAndFactures
}));

jest.mock('../webdavConfig', () => ({
  getWebdavConfig: jest.fn(() => ({ enabled: false, interval: 5 })),
  updateWebdavConfig: jest.fn(),
  getActiveCredentials: jest.fn(() => null)
}));

const fs = require('fs');
const { runSync, getWebdavState } = require('../webdavScheduler');

describe('Reprise WebDAV après panne', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.rmSync(mockHomeDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(mockHomeDir, '.bdd-caisse'), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(mockHomeDir, { recursive: true, force: true });
  });

  test('ne déclare pas réussi un transfert partiel puis accepte la reprise', async () => {
    mockUploadTicketsAndFactures
      .mockResolvedValueOnce({
        tickets: { success: 0, failed: 1, total: 1 },
        factures: { success: 1, failed: 0, total: 1 }
      })
      .mockResolvedValueOnce({
        tickets: { success: 1, failed: 0, total: 1 },
        factures: { success: 1, failed: 0, total: 1 }
      });

    await expect(runSync()).rejects.toThrow('1 fichier(s) WebDAV non transfere(s)');
    expect(getWebdavState()).toEqual(expect.objectContaining({
      lastResult: 'error'
    }));

    await expect(runSync()).resolves.toEqual(expect.objectContaining({
      success: true,
      count: 2
    }));
    expect(mockUploadTicketsAndFactures).toHaveBeenCalledTimes(2);
    expect(getWebdavState()).toEqual(expect.objectContaining({
      lastResult: 'success',
      lastCount: 2
    }));
  });
});
