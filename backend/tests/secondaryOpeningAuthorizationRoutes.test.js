const mockFetchJson = jest.fn();
const mockIsPrincipalCandidate = jest.fn();
const mockInspectPrincipalCandidate = jest.fn();
const mockDiscoverCandidates = jest.fn();
const mockUpdateConfig = jest.fn();

jest.mock('../utils/principalDiscovery', () => ({
  fetchJsonWithTimeout: (...args) => mockFetchJson(...args),
  normalizePrincipalHost: value => String(value || '').trim(),
  inspectPrincipalCandidate: (...args) => mockInspectPrincipalCandidate(...args),
  isPrincipalCandidate: (...args) => mockIsPrincipalCandidate(...args),
  discoverPrincipalCandidates: (...args) => mockDiscoverCandidates(...args)
}));
jest.mock('../principalIpConfig', () => ({
  getConfig: () => ({ ip: '192.168.1.99' }),
  updateConfig: (...args) => mockUpdateConfig(...args)
}));
jest.mock('../storeConfig', () => ({
  getConfig: () => ({ localName: 'Boutique', registerNumber: 2 })
}));

const express = require('express');
const request = require('supertest');
const router = require('../routes/secondaryOpening.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { nom: 'Alice' } };
    next();
  });
  app.use('/secondary-opening', router);
  return app;
}

function remote(ok, data) {
  return { response: { ok }, data };
}

describe('Autorisation d’ouverture d’une caisse secondaire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInspectPrincipalCandidate.mockResolvedValue({
      host: '192.168.1.99',
      reachable: false,
      isPrincipal: false,
      isPrincipalOpen: false,
      reason: 'Le poste 192.168.1.99 ne répond pas sur le port 3001 dans le délai prévu.'
    });
  });

  test('découvre une autre IP, attend son accord et l’enregistre', async () => {
    mockInspectPrincipalCandidate.mockResolvedValue({
      isPrincipalOpen: false,
      reason: 'Adresse configurée indisponible.'
    });
    mockDiscoverCandidates.mockResolvedValue(['192.168.1.20']);
    mockFetchJson
      .mockResolvedValueOnce(remote(true, { requestId: 'request-1' }))
      .mockResolvedValueOnce(remote(true, { success: true, decision: 'accepted' }));

    const response = await request(createApp())
      .post('/secondary-opening/authorize')
      .send();

    expect(response.status).toBe(200);
    expect(response.body.authorizationToken).toBeTruthy();
    expect(response.body.principalIp).toBe('192.168.1.20');
    expect(mockUpdateConfig).toHaveBeenCalledWith('192.168.1.20');
    expect(mockDiscoverCandidates).toHaveBeenCalled();
  });

  test('n’ouvre pas la voie lorsque la principale refuse', async () => {
    mockInspectPrincipalCandidate.mockResolvedValue({ isPrincipalOpen: true });
    mockFetchJson
      .mockResolvedValueOnce(remote(true, { requestId: 'request-2' }))
      .mockResolvedValueOnce(remote(true, { success: false, decision: 'refused' }));

    const response = await request(createApp())
      .post('/secondary-opening/authorize')
      .send();

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PRINCIPAL_REFUSED');
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  test('explique qu’aucune principale ouverte n’a été trouvée', async () => {
    mockDiscoverCandidates.mockResolvedValue([]);

    const response = await request(createApp())
      .post('/secondary-opening/authorize')
      .send();

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PRINCIPAL_NOT_FOUND');
    expect(response.body.diagnostic).toContain('192.168.1.99');
    expect(response.body.diagnostic).toContain('port 3001');
    expect(mockInspectPrincipalCandidate).toHaveBeenCalledTimes(2);
  });
  test('transmet la demande au poste principal joignable et remonte son refus métier', async () => {
    mockInspectPrincipalCandidate.mockResolvedValue({
      isPrincipal: true,
      isPrincipalOpen: false,
      reason: 'Aucune session principale ouverte.'
    });
    mockFetchJson.mockResolvedValueOnce(remote(false, {
      error: "Aucune session de caisse principale n'est ouverte sur ce poste."
    }));

    const response = await request(createApp())
      .post('/secondary-opening/authorize')
      .send();

    expect(response.status).toBe(504);
    expect(response.body.diagnostic).toContain('Aucune session de caisse principale');
    expect(mockFetchJson).toHaveBeenCalledWith(
      'http://192.168.1.99:3001/api/sync/recevoir-de-secondaire/ouverture/demande',
      expect.any(Object),
      3000
    );
    expect(mockDiscoverCandidates).not.toHaveBeenCalled();
  });
});
