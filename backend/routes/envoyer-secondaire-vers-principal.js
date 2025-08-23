const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const fetch = require('node-fetch'); // npm i node-fetch
const { getConfig } = require('../principalIpConfig');
const verifyAdmin = require('../utils/verifyAdmin');
const logSync = require('../logsync');
// const genererTicketCloturePdf = require('../utils/genererTicketCloturePdf'); // si besoin
// const { v4: uuidv4 } = require('uuid');
// const getBilanSession = require('../utils/bilanSession');

// --- helper: ferme officiellement la caisse secondaire (UTC) + log UPDATE
function fermerCaisseSecondaireAvantEnvoiUTC(req) {
  const {
    commentaire,
    responsable_pseudo,
    mot_de_passe,
  } = req.body || {};

  const utilisateur = req.session.user;
  if (!utilisateur) {
    throw new Error('Aucun utilisateur connecté');
  }

  // session ouverte = closed_at_utc IS NULL
  const sessionCaisse = sqlite.prepare(`
    SELECT * FROM session_caisse WHERE closed_at_utc IS NULL
  `).get();
  if (!sessionCaisse) {
    throw new Error('Aucune session caisse ouverte');
  }

  if ((sessionCaisse.issecondaire | 0) !== 1) {
    throw new Error('Cette route ferme uniquement une caisse secondaire.');
  }

  // Vérif responsable
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    throw new Error(error || 'Responsable invalide');
  }

  // Fermeture en UTC
  const nowUtcIso = new Date().toISOString(); // ex: "2025-08-23T10:15:00.000Z"

  sqlite.prepare(`
    UPDATE session_caisse SET
      closed_at_utc = ?,
      utilisateur_fermeture = ?,
      responsable_fermeture = ?,
      montant_reel = COALESCE(montant_reel, 0),
      commentaire = COALESCE(?, commentaire),
      ecart = COALESCE(ecart, 0),
      montant_reel_carte = COALESCE(montant_reel_carte, 0),
      montant_reel_cheque = COALESCE(montant_reel_cheque, 0),
      montant_reel_virement = COALESCE(montant_reel_virement, 0)
    WHERE id_session = ?
  `).run(
    nowUtcIso,
    utilisateur.nom,
    responsable.nom,
    commentaire ?? '',
    sessionCaisse.id_session
  );

  // Log sync UPDATE session_caisse (UTC)
  logSync('session_caisse', 'UPDATE', {
    id_session: sessionCaisse.id_session,
    closed_at_utc: nowUtcIso,
    utilisateur_fermeture: utilisateur.nom,
    responsable_fermeture: responsable.nom,
    // Les montants sont laissés tels quels (déjà en base si tu as calculé avant),
    // sinon 0 par défaut :
    montant_reel: 0,
    commentaire: commentaire ?? '',
    ecart: 0,
    montant_reel_carte: 0,
    montant_reel_cheque: 0,
    montant_reel_virement: 0,
  });

  return { id_session: sessionCaisse.id_session };
}

// POST /api/sync/envoyer-secondaire-vers-principal
router.post('/', async (req, res) => {
  try {
    const {
      mode,
      window: wnd,
      responsable_pseudo,
      mot_de_passe,
    } = req.body || {};
    const resendWindow = mode === 'resendWindow';

    // 1) Fermer la secondaire si mode normal
    if (!resendWindow) {
      try {
        fermerCaisseSecondaireAvantEnvoiUTC(req);
      } catch (e) {
        // On échoue tôt si la fermeture est impossible
        return res.status(400).json({ success: false, message: e.message });
      }
    } else {
      // sécurité : vérifier les credentials en rattrapage
      const { valid, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
      if (!valid) {
        return res.status(403).json({ success: false, message: error || 'Responsable invalide.' });
      }
    }

    // 2) Sélection des logs à envoyer
    let lignes = [];
    if (resendWindow) {
      if (!wnd?.startISO || !wnd?.endISO) {
        return res.status(400).json({ success: false, message: 'Fenêtre temporelle manquante.' });
      }
      // created_at (UTC via CURRENT_TIMESTAMP)
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
      lignes = sqlite
        .prepare(`SELECT * FROM sync_log WHERE senttoprincipal = 0 ORDER BY id`)
        .all();
      if (!lignes.length) {
        return res.json({ success: true, message: 'Aucune donnée à envoyer.' });
      }
    }

    // 3) Demande à la principale
    const { ip } = getConfig();
    const baseUrl = `http://${ip}:3001`;

    const demande = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/demande`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: lignes }),
    });
    const reponseDemande = await demande.json();

    if (!demande.ok) {
      return res.status(502).json({
        success: false,
        message: 'Caisse principale inaccessible ou refus de la demande.',
        erreur: reponseDemande?.message,
      });
    }

    // 4) Attente validation (simplifiée)
    const attenteValidation = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/attente-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const resultatValidation = await attenteValidation.json();

    if (!resultatValidation.success) {
      return res.status(400).json({ success: false, message: 'Validation refusée par la principale.' });
    }

    const idsValides = resultatValidation.ids || [];

    // 5) Marquer comme envoyées
    const update = sqlite.prepare('UPDATE sync_log SET senttoprincipal = 1 WHERE id = ?');
    const tx = sqlite.transaction((ids) => {
      for (const id of ids) update.run(id);
    });
    tx(idsValides);

    // 6) Réponse OK
    res.json({ success: true, message: `${idsValides.length} lignes envoyées et validées.`, ids: idsValides });

  } catch (err) {
    console.error('Erreur envoi vers principale :', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.', erreur: err.message });
  }
});

module.exports = router;
