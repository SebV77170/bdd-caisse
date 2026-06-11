const {
  normalizePrincipalHost,
  buildSubnetCandidates,
  inspectPrincipalCandidate
} = require('../utils/principalDiscovery');

const mockFetch = jest.requireMock('node-fetch');

jest.mock('node-fetch', () => jest.fn());

describe('Découverte de la caisse principale', () => {
  test.each([
    ['192.168.1.25', '192.168.1.25'],
    [' 192.168.1.25 ', '192.168.1.25'],
    ['http://192.168.1.25:3001/', '192.168.1.25'],
    ['https://caisse-principale.local/status', 'caisse-principale.local']
  ])('normalise %s en %s', (input, expected) => {
    expect(normalizePrincipalHost(input)).toBe(expected);
  });

  test('construit les candidats du sous-réseau local', () => {
    const candidates = buildSubnetCandidates(['192.168.10.42']);
    expect(candidates).toContain('192.168.10.1');
    expect(candidates).toContain('192.168.10.254');
    expect(candidates).not.toContain('192.168.10.42');
  });

  test('explique lorsqu’un poste principal répond sans session ouverte', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        role: 'caisse-principale',
        principalSessionOpen: false
      })
    });

    const result = await inspectPrincipalCandidate('192.168.1.25', 1000);

    expect(result.reachable).toBe(true);
    expect(result.isPrincipalOpen).toBe(false);
    expect(result.reason).toContain('aucune session principale');
  });
});
