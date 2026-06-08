const fs = require('fs');
const path = require('path');
const http = require('http');

const mockHomeDir = path.join(__dirname, '.tmp-webdav-home');
let mockCredentials;

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockHomeDir
}));

jest.mock('../webdavConfig', () => ({
  getActiveCredentials: () => mockCredentials
}));

const {
  uploadTicketsAndFactures
} = require('../webdavSync');

describe('Intégration WebDAV locale', () => {
  let server;
  let baseUrl;
  let requests;

  beforeEach(async () => {
    fs.rmSync(mockHomeDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(mockHomeDir, '.bdd-caisse', 'tickets', '2026', '06'), {
      recursive: true
    });
    fs.mkdirSync(path.join(mockHomeDir, '.bdd-caisse', 'factures'), {
      recursive: true
    });
    fs.writeFileSync(
      path.join(mockHomeDir, '.bdd-caisse', 'tickets', '2026', '06', 'ticket.pdf'),
      Buffer.from('%PDF-ticket-test')
    );
    fs.writeFileSync(
      path.join(mockHomeDir, '.bdd-caisse', 'factures', 'facture.pdf'),
      Buffer.from('%PDF-facture-test')
    );

    requests = [];
    server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        requests.push({
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks)
        });
        res.statusCode = req.method === 'MKCOL' ? 201 : 204;
        res.end();
      });
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/dav/`;
    mockCredentials = {
      url: baseUrl,
      username: 'webdav-user',
      password: 'webdav-pass',
      basePath: '/tickets'
    };
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(mockHomeDir, { recursive: true, force: true });
  });

  test('crée les dossiers puis transfère réellement tickets et factures', async () => {
    const result = await uploadTicketsAndFactures();

    expect(result).toEqual({
      tickets: { success: 1, failed: 0, total: 1 },
      factures: { success: 1, failed: 0, total: 1 }
    });

    const uploads = requests.filter(entry => entry.method === 'PUT');
    expect(uploads.map(entry => entry.url)).toEqual(expect.arrayContaining([
      '/dav/tickets/2026/06/ticket.pdf',
      '/dav/factures/facture.pdf'
    ]));
    expect(uploads.every(entry =>
      entry.authorization === `Basic ${Buffer.from('webdav-user:webdav-pass').toString('base64')}`
    )).toBe(true);
    expect(uploads.find(entry => entry.url.endsWith('ticket.pdf')).body.toString())
      .toBe('%PDF-ticket-test');
    expect(requests.some(entry =>
      entry.method === 'MKCOL' && entry.url === '/dav/tickets/2026/06'
    )).toBe(true);
  });
});
