const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const fetch = require('node-fetch'); // npm i node-fetch
const { getConfig } = require('../principalIpConfig');
const verifyAdmin = require('../utils/verifyAdmin');
const logSync = require('../logsync');
const genererTicketCloturePdf = require('../utils/genererTicketCloturePdf');
const { v4: uuidv4 } = require('uuid');
const getBilanSession = require('../utils/bilanSession');

// --- 0) Helper: fermer officiellement la caisse secondaire + log + ticket PDF
async function fermerCaisseSecondaireAvantEnvoi(req) {
  // Données attendues dans le body (mêmes champs que ta route de fermeture)
  const {
    commentaire,
    responsable_pseudo,
    mot_de_passe,
    uuid_session_caisse
  } = req.body || {};

  // 0.1 Utilisateur connecté
  const utilisateur = req.session.user;
  if (!utilisateur) {
    throw new Error('Aucun utilisateur connecté');
  }

  // 0.2 Session ouverte (doit être secondaire)
  const sessionCaisse = sqlite.prepare(`
    SELECT * FROM session_caisse WHERE date_fermeture IS NULL
  `).get();
  if (!sessionCaisse) {
    throw new Error('Aucune session caisse ouverte');
  }
  const typeSession = sessionCaisse.issecondaire === 0 ? 'principale' : 'secondaire';
  if (typeSession !== 'secondaire') {
    // On ferme ici seulement la secondaire, la principale se ferme via son flux
    throw new Error("Cette route ferme uniquement la caisse secondaire.");
  }

  // 0.3 Vérif responsable
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    throw new Error(error || 'Responsable invalide');
  }

  // 0.4 Bilan session (montants attendus) + écarts
  const now = new Date();
  const date_fermeture = now.toISOString().slice(0, 10);
  const heure_fermeture = now.toTimeString().slice(0, 5);

  // 0.5 MAJ session_caisse (fermeture)
  sqlite.prepare(`
    UPDATE session_caisse SET
      date_fermeture = ?,
      heure_fermeture = ?,
      utilisateur_fermeture = ?,
      responsable_fermeture = ?,
      montant_reel = 0,
      commentaire = ?,
      ecart = 0,
      montant_reel_carte = 0,
      montant_reel_cheque = 0,
      montant_reel_virement = 0 
    WHERE id_session = ?
  `).run(
    date_fermeture, heure_fermeture,
    utilisateur.nom, responsable.nom,
    commentaire ?? '',
    sessionCaisse.id_session
  );

  // 0.6 Log sync UPDATE session_caisse
  logSync('session_caisse', 'UPDATE', {
    id_session: sessionCaisse.id_session,
    date_fermeture,
    heure_fermeture,
    utilisateur_fermeture: utilisateur.nom,
    responsable_fermeture: responsable.nom,
    montant_reel: 0,
    commentaire: commentaire ?? '',
    ecart: 0,
    montant_reel_carte: 0,
    montant_reel_cheque: 0,
    montant_reel_virement: 0
  });

  return { typeSession, uuid_session_caisse };
}

// --- 1) Route: ferme la caisse secondaire PUIS envoie à la principale
// POST /api/sync/envoyer-secondaire-vers-principal
router.post('/', async (req, res) => {
  try {
    const { mode, window: wnd, responsable_pseudo, mot_de_passe, uuid_session_caisse } = req.body || {};
    const resendWindow = mode === 'resendWindow';

    if (resendWindow) {
      // vérif responsable (sécurité)
      const { valid, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
      if (!valid) {
        return res.status(403).json({ success: false, message: error || 'Responsable invalide.' });
      }
    } else {
      // mode normal: fermer la caisse secondaire AVANT d'envoyer (ta logique existante)
      await fermerCaisseSecondaireAvantEnvoi(req);
      const io = req.app.get('socketio');
      if (io) {
      io.emit('etatCaisseUpdated', {
        ouverte: false,
        type: typeSession
      });
    }
  }

    // === Sélection des logs à envoyer ===
    let lignes = [];
    if (resendWindow) {
      if (!wnd?.startISO || !wnd?.endISO) {
        return res.status(400).json({ success: false, message: 'Fenêtre temporelle manquante.' });
      }
      // ⚠️ Assure-toi que startISO/endISO sont bien au même fuseau que created_at (CURRENT_TIMESTAMP = UTC)
      lignes = sqlite.prepare(`
        SELECT * FROM sync_log
        WHERE senttoprincipal = 0
          AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY id
      `).all(wnd.startISO, wnd.endISO);

      if (!lignes.length) {
        return res.json({ success: true, message: 'Aucune donnée à envoyer dans cette fenêtre.' });
      }
    } else {
      lignes = sqlite.prepare(
        'SELECT * FROM sync_log WHERE senttoprincipal = 0 ORDER BY id'
      ).all();

      if (!lignes.length) {
        return res.json({ success: true, message: 'Aucune donnée à envoyer.' });
      }
    }

    // === Envoi à la principale ===
    const { ip } = getConfig();
    const baseUrl = `http://${ip}:3001`;

    const demande = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/demande`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: lignes })
    });
    const reponseDemande = await demande.json();
    if (!demande.ok) {
      return res.status(502).json({
        success: false,
        message: 'Caisse principale inaccessible ou refus de la demande.',
        erreur: reponseDemande?.message
      });
    }

    // Attente de validation (simplifiée)
    const attenteValidation = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/attente-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const resultatValidation = await attenteValidation.json();
    if (!resultatValidation.success) {
      return res.status(400).json({ success: false, message: 'Validation refusée par la principale.' });
    }

    const idsValides = resultatValidation.ids || [];

    // === Marquer comme envoyées ===
    const update = sqlite.prepare('UPDATE sync_log SET senttoprincipal = 1 WHERE id = ?');
    const tx = sqlite.transaction((ids) => { for (const id of ids) update.run(id); });
    tx(idsValides);

    res.json({ success: true, message: `${idsValides.length} lignes envoyées et validées.`, ids: idsValides });

  } catch (err) {
    console.error('Erreur envoi vers principale :', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.', erreur: err.message });
  }
});


module.exports = router;
