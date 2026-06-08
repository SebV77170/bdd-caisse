describe('configuration SMTP', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'app-password',
      SMTP_FROM: 'billing@example.com'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('construit le transporteur depuis les variables d’environnement', () => {
    const createTransport = jest.fn(() => ({ sendMail: jest.fn() }));
    jest.doMock('nodemailer', () => ({ createTransport }));

    const { getSmtpTransporter, getSmtpFrom } = require('../smtp');

    expect(getSmtpTransporter()).toBeDefined();
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'sender@example.com',
        pass: 'app-password'
      }
    });
    expect(getSmtpFrom()).toBe('billing@example.com');
  });

  test('refuse de créer le transporteur sans identifiants', () => {
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    jest.doMock('nodemailer', () => ({ createTransport: jest.fn() }));

    const { getSmtpTransporter } = require('../smtp');

    expect(() => getSmtpTransporter()).toThrow('SMTP_USER');
  });
});
