const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  host: 'smtp.ouvaton.coop',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: 'magasin@ressourcebrie.fr',
    pass: 'Magasin7#'
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  },
  logger: true,
  debug: true
});

router.post('/:uuid_ticket/envoyer', (req, res) => {
  const { uuid_ticket } = req.params;
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide' });
  }

  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
  if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

  if (!ticket.lien) return res.status(404).json({ error: 'Chemin du ticket PDF non renseigné dans la base' });

  // 🧩 Convertit le chemin relatif en chemin absolu
  const pdfPath = path.join(__dirname, '../../', ticket.lien);

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: 'Fichier PDF introuvable sur le disque' });
  }

  transporter.sendMail({
    from: '"Ressource\'Brie" <magasin@ressourcebrie.fr>',
    to: email,
    subject: "Votre ticket de caisse - Ressource'Brie",
    text: "Veuillez trouver ci-joint votre ticket de caisse en PDF.",
    attachments: [
      {
        filename: path.basename(pdfPath),
        path: pdfPath
      }
    ]
  }, (error, info) => {
    if (error) {
      console.error('Erreur envoi mail :', error);
      return res.status(500).json({ error: 'Erreur lors de l’envoi de l’e-mail' });
    }
    console.log(`✅ Ticket PDF envoyé à ${email}`);
    res.json({ success: true });
  });
});

module.exports = router;
