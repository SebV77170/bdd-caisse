// fichier: routes/ouvertureCaisse.routes.js

const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const { v4: uuidv4 } = require('uuid');
const verifyAdmin = require('../utils/verifyAdmin');
const logSync = require('../logsync');
const { genererFriendlyIds } = require('../utils/genererFriendlyIds');
const { getConfig } = require('../storeConfig');

router.post('/ouverture', (req, res) => {
  const { fond_initial, responsable_pseudo, mot_de_passe, secondaire } = req.body;
  const issecondaire = secondaire === true ? 1 : 0;
  const utilisateur = req.session.user;
  const { registerNumber } = getConfig();

  if (!utilisateur) {
    return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  }

  // 1) Vérifier qu'il n'existe pas déjà une session ouverte (fermée = closed_at_utc NON renseigné)
  const sessionExistante = sqlite.prepare(`
    SELECT 1 FROM session_caisse
    WHERE closed_at_utc IS NULL
    LIMIT 1
  `).get();

  if (sessionExistante) {
    return res.status(400).json({ error: 'Une session caisse est déjà ouverte' });
  }

  // 2) Vérifier mot de passe du responsable
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    return res.status(403).json({ error });
  }

  // 3) Préparer l’insert (UTC + données)
  const nowUtcIso = new Date().toISOString(); // opened_at_utc
  const id_session = uuidv4();
  genererFriendlyIds(id_session, 'session');

  const caissiers = JSON.stringify([utilisateur.nom]);
  const fondInitialCents = Number.isFinite(+fond_initial) ? +fond_initial : 0;

  // 4) Insertion
  sqlite.prepare(`
    INSERT INTO session_caisse (
      id_session,
      opened_at_utc,
      utilisateur_ouverture, responsable_ouverture,
      fond_initial, caissiers, issecondaire, poste
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id_session,
    nowUtcIso,
    utilisateur.nom, responsable.nom,
    fondInitialCents, caissiers, issecondaire, registerNumber
  );

  // 5) Log de sync
  logSync('session_caisse', 'INSERT', {
    id_session,
    opened_at_utc: nowUtcIso,
    utilisateur_ouverture: utilisateur.nom,
    responsable_ouverture: responsable.nom,
    fond_initial: fondInitialCents,
    caissiers,
    issecondaire,
    poste: registerNumber
  });

  // 6) Réponse
  res.json({ success: true, id_session });
});

// Journal : tri décroissant par opened_at_utc (UTC), puis closed_at_utc
router.get('/journal', (req, res) => {
  try {
    const sessions = sqlite.prepare(`
      SELECT *
      FROM session_caisse
      ORDER BY opened_at_utc DESC, closed_at_utc DESC
    `).all();
    res.json(sessions);
  } catch (err) {
    console.error('Erreur récupération journal caisse:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifications liées à une session (inchangé : basé sur uuid_session_caisse des tickets)
router.get('/modifications', (req, res) => {
  const sessionId = req.query.uuid_session_caisse;
  if (!sessionId) {
    return res.status(400).json({ error: 'uuid_session_caisse manquant' });
  }

  try {
    const modifs = sqlite.prepare(
      `SELECT jc.*, 
              orig.uuid_ticket  AS uuid_ticket_original,
              annul.uuid_ticket AS uuid_ticket_annulation,
              corr.uuid_ticket  AS uuid_ticket_correction
         FROM journal_corrections jc
    LEFT JOIN ticketdecaisse orig  ON orig.uuid_ticket  = jc.uuid_ticket_original
    LEFT JOIN ticketdecaisse annul ON annul.uuid_ticket = jc.uuid_ticket_annulation
    LEFT JOIN ticketdecaisse corr  ON corr.uuid_ticket  = jc.uuid_ticket_correction
        WHERE orig.uuid_session_caisse  = ?
           OR annul.uuid_session_caisse = ?
           OR corr.uuid_session_caisse  = ?
        ORDER BY jc.date_correction DESC`
    ).all(sessionId, sessionId, sessionId);

    res.json(modifs);
  } catch (err) {
    console.error('Erreur récupération modifications:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
