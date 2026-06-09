jest.mock('../utils/genererFacturePdf', () => jest.fn().mockResolvedValue({
  lien: 'factures/test.pdf',
  friendlyId: 'F-001'
}));

const mockSendMail = jest.fn((message, callback) => {
  if (callback) callback(null, { accepted: [message.to] });
  return Promise.resolve({ accepted: [message.to] });
});

jest.mock('../smtp', () => ({
  getSmtpTransporter: jest.fn(() => ({
    sendMail: mockSendMail
  })),
  getSmtpFrom: jest.fn(() => 'billing@example.com')
}));

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { sqlite } = require('../db');
const genererFacturePdf = require('../utils/genererFacturePdf');
const { getSmtpTransporter } = require('../smtp');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
}

describe('Routes documents et emails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockImplementation((message, callback) => {
      if (callback) callback(null, { accepted: [message.to] });
      return Promise.resolve({ accepted: [message.to] });
    });
    initTables();
    sqlite.prepare('DELETE FROM ticketdecaisse').run();
    sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
        nbr_objet, moyen_paiement, prix_total, lien
      ) VALUES (?, 'Testeur', 'user-1', datetime('now'), 1, 'carte', 1000, ?)
    `).run('ticket-1', 'tickets/ticket-1.pdf');
  });

  test('valide les champs requis pour une facture', async () => {
    const missing = await request(app)
      .post('/api/facture/ticket-1')
      .send({ raison_sociale: 'Client' });
    expect(missing.status).toBe(400);

    const unknown = await request(app)
      .post('/api/facture/inconnu')
      .send({ raison_sociale: 'Client', adresse: 'Rue' });
    expect(unknown.status).toBe(404);
  });

  test('génère une facture sans envoyer de mail si aucun email n’est fourni', async () => {
    const res = await request(app)
      .post('/api/facture/ticket-1')
      .send({ raison_sociale: 'Client A', adresse: '1 rue Test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.uuid_facture).toBeDefined();
    expect(res.body.lien).toBe('factures/test.pdf');
    expect(genererFacturePdf).toHaveBeenCalledWith(
      expect.any(String),
      'ticket-1',
      'Client A',
      '1 rue Test'
    );
    expect(getSmtpTransporter).not.toHaveBeenCalled();
  });

  test('conserve la facture locale quand le serveur SMTP refuse le mail', async () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    mockSendMail.mockRejectedValueOnce(new Error('SMTP authentication failed'));

    const res = await request(app)
      .post('/api/facture/ticket-1')
      .send({
        raison_sociale: 'Client B',
        adresse: '2 rue Test',
        email: 'client@example.com'
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      success: true,
      lien: 'factures/test.pdf',
      emailSent: false,
      emailError: 'SMTP authentication failed'
    }));
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    existsSpy.mockRestore();
  });

  test('valide les erreurs d’envoi de ticket par email', async () => {
    expect((await request(app).post('/api/envoieticket/ticket-1/envoyer').send({ email: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/envoieticket/inconnu/envoyer').send({ email: 'client@example.com' })).status).toBe(404);

    sqlite.prepare("UPDATE ticketdecaisse SET lien = '' WHERE uuid_ticket = ?").run('ticket-1');
    const noPath = await request(app)
      .post('/api/envoieticket/ticket-1/envoyer')
      .send({ email: 'client@example.com' });
    expect(noPath.status).toBe(404);
  });
});
