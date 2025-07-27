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

  // Vérifier qu'il n'existe pas déjà une session caisse ouverte
  const sessionExistante = sqlite.prepare(`
    SELECT * FROM session_caisse 
    WHERE date_fermeture IS NULL
  `).get();

  if (sessionExistante) {
    return res.status(400).json({ error: 'Une session caisse est déjà ouverte' });
  }

  // Vérifier mot de passe du responsable
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    return res.status(403).json({ error });
  }

  const now = new Date();
  const date_ouverture = now.toISOString().slice(0, 10);
  const heure_ouverture = now.toTimeString().slice(0, 5);

  const id_session = uuidv4();
  genererFriendlyIds(id_session, 'session');
  const caissiers = JSON.stringify([utilisateur.nom]);

    sqlite.prepare(`
  INSERT INTO session_caisse (
    id_session, date_ouverture, heure_ouverture,
    utilisateur_ouverture, responsable_ouverture,
    fond_initial, caissiers, issecondaire, poste
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  id_session,
  date_ouverture,
  heure_ouverture,
  utilisateur.nom,
  responsable.nom,
  fond_initial,
  caissiers,
  issecondaire,
  registerNumber
);



  logSync('session_caisse', 'INSERT', {
  id_session,
  date_ouverture,
  heure_ouverture,
  utilisateur_ouverture: utilisateur.nom,
  responsable_ouverture: responsable.nom,
  fond_initial,
  caissiers,
  issecondaire,
  poste: registerNumber
});


  /* const io = req.app.get('socketio');
if (io) {
  const typeSession = issecondaire === 0 ? 'principale' : 'secondaire';

  io.emit('etatCaisseUpdated', {
    ouverte: true,
    type: typeSession
  });
} */



   res.json({ success: true, id_session });
});

router.get('/journal', (req, res) => {
  try {
    const sessions = sqlite.prepare(`
      SELECT * FROM session_caisse
      ORDER BY date_ouverture DESC, heure_ouverture DESC
    `).all();
    res.json(sessions);
  } catch (err) {
    console.error('Erreur récupération journal caisse:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Nouveau endpoint pour récupérer les modifications de tickets liées à une session caisse
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
