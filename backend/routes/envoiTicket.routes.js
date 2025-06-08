const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  host: 'smtp.ouvaton.coop',
  port: 587,
  secure: false, // STARTTLS => false ici (secure = false + tls.enabled = true)
  auth: {
    user: 'magasin@ressourcebrie.fr',
    pass: 'Magasin7#'
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false // à mettre à true en production si certifié valide
  },
  logger: true,
  debug: true
});

router.post('/:id_ticket/envoyer', (req, res) => {
  const { id_ticket } = req.params;
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide' });
  }

  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE id_ticket = ?').get(id_ticket);
  if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

  const pdfPath = path.join(__dirname, `../../tickets/Ticket-${ticket.uuid_ticket}.pdf`);
  if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: 'Fichier ticket manquant' });

  transporter.sendMail({
    from: '"Ressource\'Brie" <magasin@ressourcebrie.fr>',
    to: email,
    subject: "Votre ticket de caisse - Ressource'Brie",
    text: "Veuillez trouver ci-joint votre ticket de caisse en PDF.",
    attachments: [
      {
        filename: `Ticket-${ticket.uuid_ticket}.pdf`,
        path: pdfPath
      }
    ]
  }, (error, info) => {
    if (error) {
      console.error('Erreur envoi mail :', error);
      return res.status(500).json({ error: 'Erreur lors de l’envoi de l’e-mail' });
    }
    console.log(`Ticket PDF envoyé à ${email}`);
    res.json({ success: true });
  });
});

module.exports = router;
