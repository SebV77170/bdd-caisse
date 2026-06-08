const fs = require('fs');
const path = require('path');

const mockPdfHomeDir = path.join(__dirname, '.tmp-pdf-home');

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => mockPdfHomeDir
}));

const { sqlite } = require('../db');
const genererFacturePdf = require('../utils/genererFacturePdf');

function initTables() {
  sqlite.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
}

describe('Intégration génération PDF', () => {
  beforeEach(() => {
    fs.rmSync(mockPdfHomeDir, { recursive: true, force: true });
    fs.mkdirSync(mockPdfHomeDir, { recursive: true });
    initTables();
    for (const table of [
      'facture',
      'objets_vendus',
      'ticketdecaisse',
      'uuid_mapping',
      'sync_log'
    ]) {
      sqlite.prepare(`DELETE FROM ${table}`).run();
    }

    sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
        nbr_objet, moyen_paiement, prix_total
      ) VALUES ('ticket-pdf', 'Alice', 'user-1', '2026-06-08T10:00:00.000Z',
        1, 'carte', 1590)
    `).run();
    sqlite.prepare(`
      INSERT INTO objets_vendus (
        uuid_ticket, nom_vendeur, id_vendeur, nom, categorie,
        date_achat, timestamp, prix, nbr, uuid_objet
      ) VALUES ('ticket-pdf', 'Alice', 'user-1', 'Livre test', 'Culture',
        '2026-06-08', 1780912800, 1590, 1, 'object-pdf')
    `).run();
    sqlite.prepare(`
      INSERT INTO uuid_mapping (uuid, id_friendly, type)
      VALUES ('ticket-pdf', 'T-0042', 'ticket')
    `).run();
  });

  afterEach(() => {
    fs.rmSync(mockPdfHomeDir, { recursive: true, force: true });
  });

  test('produit un PDF lisible et journalise la facture dans SQLite', async () => {
    const result = await genererFacturePdf(
      'invoice-pdf',
      'ticket-pdf',
      'Client Test',
      '1 rue du Test'
    );

    const absolutePath = path.resolve(__dirname, '../..', result.lien);
    const bytes = fs.readFileSync(absolutePath);

    expect(result.friendlyId).toBe('T-0042');
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(sqlite.prepare(
      'SELECT uuid_facture, uuid_ticket, lien FROM facture'
    ).get()).toEqual({
      uuid_facture: 'invoice-pdf',
      uuid_ticket: 'ticket-pdf',
      lien: result.lien
    });
    expect(sqlite.prepare(
      "SELECT type, operation FROM sync_log WHERE type = 'facture'"
    ).get()).toEqual({ type: 'facture', operation: 'INSERT' });
  });
});
