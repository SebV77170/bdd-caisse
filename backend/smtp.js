const path = require('path');
const nodemailer = require('nodemailer');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

let transporter;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Configuration SMTP manquante : ${name}`);
  }
  return value;
}

function getSmtpTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465,
      auth: {
        user: getRequiredEnv('SMTP_USER'),
        pass: getRequiredEnv('SMTP_PASS')
      }
    });
  }

  return transporter;
}

function getSmtpFrom() {
  return process.env.SMTP_FROM || getRequiredEnv('SMTP_USER');
}

module.exports = { getSmtpTransporter, getSmtpFrom };
