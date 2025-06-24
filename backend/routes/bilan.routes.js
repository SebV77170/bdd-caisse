// ✅ Mise à jour de bilan.routes.js pour inclure les détails des paiements mixtes
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const getBilanSession = require('../utils/bilanSession');
const getBilanReductionsSession = require('../utils/bilanReductionsSession');
const { getFriendlyIdFromUuid } = require('../utils/genererFriendlyIds');


// Route GET : liste de tous les tickets avec indication de correction
router.get('/', (req, res) => {
  try {
    const tickets = sqlite.prepare(`
      SELECT
        t.*,
        um.id_friendly AS id_friendly,

        -- Si ce ticket est une annulation
        jc_annul.uuid_ticket_original AS annulation_de,
        um_annule.id_friendly AS id_friendly_annule,

        -- Si ce ticket est une correction
        jc_corr.uuid_ticket_original AS annulation_de,
        um_corrige.id_friendly AS id_friendly_corrige,

        -- Si ce ticket a été corrigé par un autre
        EXISTS (
          SELECT 1 FROM journal_corrections jc WHERE jc.uuid_ticket_original = t.uuid_ticket
        ) AS ticket_corrige,

        -- Si ce ticket est une correction d’un autre
        EXISTS (
          SELECT 1 FROM journal_corrections jc WHERE jc.uuid_ticket_correction = t.uuid_ticket
        ) AS est_correction

      FROM ticketdecaisse t

      -- Friendly ID du ticket principal
      LEFT JOIN uuid_mapping um ON um.uuid = t.uuid_ticket

      -- Annulation : ce ticket est une annulation d’un autre
      LEFT JOIN journal_corrections jc_annul ON jc_annul.uuid_ticket_annulation = t.uuid_ticket
      LEFT JOIN uuid_mapping um_annule ON um_annule.uuid = jc_annul.uuid_ticket_original

      -- Correction : ce ticket est une correction d’un autre
      LEFT JOIN journal_corrections jc_corr ON jc_corr.uuid_ticket_correction = t.uuid_ticket
      LEFT JOIN uuid_mapping um_corrige ON um_corrige.uuid = jc_corr.uuid_ticket_original

      ORDER BY t.id_ticket DESC
    `).all();

    res.json(tickets);
  } catch (err) {
    console.error('Erreur lecture tickets :', err);
    res.status(500).json({ error: err.message });
  }
});


// Route GET : détail des objets d'un ticket
router.get('/:id/objets', (req, res) => {
  const uuid = req.params.uuid;
  try {
    const lignes = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(id);
    res.json(lignes);
  } catch (err) {
    console.error('Erreur chargement objets_vendus :', err);
    res.status(500).json({ error: err.message });
  }
});

// Route GET : détail complet d'un ticket, y compris paiements mixtes
router.get('/:uuid/details', (req, res) => {
  const uuid = req.params.uuid;
  try {
    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(uuid);

    const paiementMixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE uuid_ticket = ?').get(uuid);

    res.json({ ticket, objets, paiementMixte });
  } catch (err) {
    console.error('Erreur détails ticket :', err);
    res.status(500).json({ error: err.message });
  }
});

// Route GET : bilan du jour (ventes et montants)
router.get('/jour', (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const bilan = sqlite.prepare('SELECT nombre_vente, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement FROM bilan WHERE date = ?').get(today);
  if (!bilan) return res.json({ nombre_vente: 0, prix_total: 0 });
  res.json(bilan);
});

// Route GET : bilan d'une session caisse spécifique
router.get('/bilan_session_caisse', (req, res) => {
  const uuid_session_caisse = req.query.uuid_session_caisse;

  if (!uuid_session_caisse) {
    return res.status(400).json({ error: 'uuid_session_caisse manquant' });
  }

  const bilan_session_caisse = getBilanSession(uuid_session_caisse);

  res.json(bilan_session_caisse);
});

// Route GET : récapitulatif des réductions pour une session caisse
router.get('/reductions_session_caisse', (req, res) => {
  const uuid_session_caisse = req.query.uuid_session_caisse;

  if (!uuid_session_caisse) {
    return res.status(400).json({ error: 'uuid_session_caisse manquant' });
  }

  const reducs = getBilanReductionsSession(uuid_session_caisse);

  res.json(reducs);
});

module.exports = router;
