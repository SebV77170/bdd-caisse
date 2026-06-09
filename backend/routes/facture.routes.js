const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const { v4: uuidv4 } = require('uuid');
const genererFacturePdf = require('../utils/genererFacturePdf');
const path = require('path');
const fs = require('fs');
const logSync = require('../logSync');
const { getSmtpTransporter, getSmtpFrom } = require('../smtp');

router.post('/:uuid_ticket', async (req, res) => {
  const { uuid_ticket } = req.params;
  const { raison_sociale, adresse, email } = req.body;

  if (!raison_sociale || !adresse) {
    return res.status(400).json({ success: false, error: 'Informations manquantes' });
  }

  try {
    const ticket = sqlite
      .prepare('SELECT id_ticket FROM ticketdecaisse WHERE uuid_ticket = ?')
      .get(uuid_ticket);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket non trouvé' });

    const uuid_facture = uuidv4();
    const { lien , friendlyId } = await genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse);
    if (!lien) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la génération de la facture PDF' });
    }

    let emailSent = false;
    let emailError = null;

    // Une panne SMTP ne doit pas invalider la facture deja creee localement.
    if (email) {
      const pdfPath = path.join(__dirname, '../../', lien);
      if (fs.existsSync(pdfPath)) {
        try {
          await getSmtpTransporter().sendMail({
            from: `"RessourceBrie" <${getSmtpFrom()}>`,
            to: email,
            subject: "Votre facture - Ressource'Brie",
            text: "Veuillez trouver ci-joint votre facture au format PDF. Merci de ne pas faire - répondre à ce mail - mais d'utiliser l'adresse contact@ressourcebrie.fr pour toute question.",
            attachments: [{ filename: `Facture-${raison_sociale}-${friendlyId}.pdf`, path: pdfPath }]
          });
          emailSent = true;
        } catch (error) {
          emailError = error.message;
          console.error('Facture creee localement, envoi SMTP echoue :', error);
        }
      } else {
        emailError = 'Le PDF local de la facture est introuvable';
      }
    }

    res.json({ success: true, uuid_facture, lien, emailSent, emailError });
  } catch (err) {
    console.error('Erreur création facture :', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
