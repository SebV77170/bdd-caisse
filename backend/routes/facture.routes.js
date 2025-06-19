const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const { v4: uuidv4 } = require('uuid');
const genererFacturePdf = require('../utils/genererFacturePdf');

router.post('/:uuid_ticket', async (req, res) => {
  const { uuid_ticket } = req.params;
  const { raison_sociale, adresse } = req.body;

  if (!raison_sociale || !adresse) {
    return res.status(400).json({ error: 'Informations manquantes' });
  }

  try {
    const ticket = sqlite
      .prepare('SELECT id_ticket FROM ticketdecaisse WHERE uuid_ticket = ?')
      .get(uuid_ticket);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    const uuid_facture = uuidv4();
    await genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse);
    const lien = `factures/Facture-${uuid_facture}.pdf`;

    sqlite
      .prepare(
        'INSERT INTO facture (uuid_facture, uuid_ticket, raison_sociale, adresse, lien) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuid_facture, uuid_ticket, raison_sociale, adresse, lien);

    res.json({ success: true, uuid_facture, lien });
  } catch (err) {
    console.error('Erreur création facture :', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
