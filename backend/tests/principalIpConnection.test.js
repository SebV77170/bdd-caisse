const mockFetch = jest.fn();
const mockUpdateConfig = jest.fn();

jest.mock('node-fetch', () => mockFetch);
jest.mock('../principalIpConfig', () => ({
  getConfig: () => ({ ip: '192.168.1.10' }),
  updateConfig: mockUpdateConfig
}));

const express = require('express');
const request = require('supertest');
const router = require('../routes/principalIp.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/principal-ip', router);
  return app;
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body)
  };
}

describe('Diagnostic de la caisse principale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('enregistre l’adresse uniquement après identification de la principale', async () => {
    mockFetch.mockResolvedValueOnce(response(200, {
      role: 'caisse-principale',
      service: 'synchronisation-secondaire',
      principalSessionOpen: true
    }));

    const result = await request(createApp())
      .post('/principal-ip/test-and-save')
      .send({ ip: '192.168.1.25' });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith('192.168.1.25');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.1.25:3001/api/sync/recevoir-de-secondaire/status',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  test('refuse de sauvegarder une adresse qui ne répond pas comme une principale', async () => {
    mockFetch.mockResolvedValueOnce(response(200, { role: 'autre-service' }));

    const result = await request(createApp())
      .post('/principal-ip/test-and-save')
      .send({ ip: '192.168.1.99' });

    expect(result.status).toBe(502);
    expect(result.body.success).toBe(false);
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  test('normalise une URL et exige une session principale ouverte', async () => {
    mockFetch.mockResolvedValueOnce(response(200, {
      role: 'caisse-principale',
      principalSessionOpen: false
    }));

    const result = await request(createApp())
      .post('/principal-ip/test-and-save')
      .send({ ip: 'http://192.168.1.25:3001/' });

    expect(result.status).toBe(502);
    expect(result.body.details).toContain('aucune session de caisse principale');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.1.25:3001/api/sync/recevoir-de-secondaire/status',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });
});
