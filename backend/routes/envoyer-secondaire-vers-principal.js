const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const fetch = require('node-fetch');
const { getConfig } = require('../principalIpConfig');
const verifyAdmin = require('../utils/verifyAdmin');
const logSync = require('../logSync');
const os = require('os');

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// --- helper: ferme officiellement la caisse secondaire (UTC) + log UPDATE
function fermerCaisseSecondaireAvantEnvoiUTC(req) {
  const { commentaire, responsable_pseudo, mot_de_passe } = req.body || {};

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

  // Fermeture UTC
  const nowUtcIso = new Date().toISOString();

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

  logSync('session_caisse', 'UPDATE', {
    id_session: sessionCaisse.id_session,
    closed_at_utc: nowUtcIso,
    utilisateur_fermeture: utilisateur.nom,
    responsable_fermeture: responsable.nom,
    montant_reel: 0,
    commentaire: commentaire ?? '',
    ecart: 0,
    montant_reel_carte: 0,
    montant_reel_cheque: 0,
    montant_reel_virement: 0,
  });

  return {
    id_session: sessionCaisse.id_session,
    opened_at_utc: sessionCaisse.opened_at_utc,
    closed_at_utc: nowUtcIso
  };
}

function recoveryPayload(closedSession, configuredIp) {
  if (!closedSession) return undefined;
  return {
    sessionId: closedSession.id_session,
    startISO: closedSession.opened_at_utc,
    endISO: closedSession.closed_at_utc,
    configuredIp
  };
}

// --- util: poll /attente-validation avec backoff
async function pollValidation(baseUrl, requestId, { totalMs = 30000, intervalMs = 1200, maxIntervalMs = 3000 }) {
  const deadline = Date.now() + totalMs;
  let wait = intervalMs;

  while (Date.now() < deadline) {
    const resp = await fetchWithTimeout(
      `${baseUrl}/api/sync/recevoir-de-secondaire/attente-validation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      },
      28000
    );

    // 200 => décision prête (success true/false)
    // 202 => toujours en attente
    const json = await resp.json().catch(() => ({}));

    if (resp.status === 200) {
      // résultat final
      return json;
    }

    // en attente -> on attend et on backoff un peu
    await new Promise(r => setTimeout(r, wait));
    wait = Math.min(Math.floor(wait * 1.35), maxIntervalMs);
  }

  // Timeout global
  return { success: false, pending: true, message: 'Timeout en attendant la validation de la caisse principale.' };
}

// POST /api/sync/envoyer-secondaire-vers-principal
router.post('/', async (req, res) => {
  let closedSession = null;
  let configuredIp = null;
  try {
    const { mode, window: wnd, responsable_pseudo, mot_de_passe } = req.body || {};
    const resendWindow = mode === 'resendWindow';

    // 1) Fermer la secondaire si mode normal
    if (!resendWindow) {
      try {
        closedSession = fermerCaisseSecondaireAvantEnvoiUTC(req);

        // 🔔 émettre l’état fermé immédiatement (même si la principale refuse ensuite)
        const io = req.app.get('socketio');
        if (io) io.emit('etatCaisseUpdated', { ouverte: false, type: 'secondaire' });
      } catch (e) {
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
      lignes = sqlite.prepare(`
        SELECT * FROM sync_log
        WHERE senttoprincipal = 0
          AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY id
      `).all(wnd.startISO, wnd.endISO);
      console.log(lignes);
      console.log('taille JSON logs =', new TextEncoder().encode(JSON.stringify(lignes)).length, 'bytes');


      if (!lignes.length) {
        return res.json({ success: true, message: 'Aucune donnée à envoyer dans cette fenêtre.' });
      }
    } else {
      lignes = sqlite.prepare(`SELECT * FROM sync_log WHERE senttoprincipal = 0 ORDER BY id`).all();
      if (!lignes.length) {
        return res.json({ success: true, message: 'Aucune donnée à envoyer.' });
      }
    }

    // 3) Demande à la principale
    const { ip } = getConfig();
    configuredIp = ip;
    const baseUrl = `http://${ip}:3001`;

    const demande = await fetchWithTimeout(
      `${baseUrl}/api/sync/recevoir-de-secondaire/demande`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: lignes,
          sourceId: process.env.CASH_REGISTER_ID || os.hostname()
        }),
      },
      5000
    );
    console.log('Envoi vers principale, status:', demande.status);
    const reponseDemande = await demande.json().catch(() => null);

    if (!demande.ok) {
      return res.status(502).json({
        success: false,
        code: 'PRINCIPAL_UNREACHABLE',
        message: 'Caisse principale inaccessible ou refus de la demande.',
        erreur: reponseDemande?.message,
        configuredIp,
        recovery: recoveryPayload(closedSession, configuredIp)
      });
    }

    const requestId = reponseDemande?.requestId;
    if (!requestId) {
      return res.status(502).json({
        success: false,
        code: 'INVALID_PRINCIPAL_RESPONSE',
        message: 'La caisse principale n’a pas retourné d’identifiant de synchronisation.',
        configuredIp,
        recovery: recoveryPayload(closedSession, configuredIp)
      });
    }

    // 4) VRAIE attente de validation via long-poll (poll côté secondaire)
    const result = await pollValidation(
      baseUrl,
      requestId,
      { totalMs: 35000, intervalMs: 1200, maxIntervalMs: 3000 }
    );

    if (!result || !result.success) {
      // refus, erreur, ou timeout
      const msg = result?.message || 'Validation refusée par la principale.';
      return res.status(result?.pending ? 504 : 400).json({
        success: false,
        code: result?.pending ? 'PRINCIPAL_TIMEOUT' : 'SYNC_REJECTED',
        message: msg,
        configuredIp,
        recovery: recoveryPayload(closedSession, configuredIp)
      });
    }

    const submittedIds = new Set(lignes.map(ligne => ligne.id));
    const idsValides = (result.ids || []).filter(id => submittedIds.has(id));

    // 5) Marquer comme envoyées en local
    const update = sqlite.prepare('UPDATE sync_log SET senttoprincipal = 1 WHERE id = ?');
    const tx = sqlite.transaction((ids) => { for (const id of ids) update.run(id); });
    tx(idsValides);

    // 6) Réponse OK au front
    res.json({ success: true, message: `${idsValides.length} lignes envoyées et validées.`, ids: idsValides });

  } catch (err) {
    console.error('Erreur envoi vers principale :', err);
    res.status(502).json({
      success: false,
      code: 'PRINCIPAL_UNREACHABLE',
      message: configuredIp
        ? `Impossible de joindre la caisse principale configurée à l'adresse ${configuredIp}.`
        : 'Impossible de joindre la caisse principale configurée.',
      erreur: err.message,
      configuredIp,
      recovery: recoveryPayload(closedSession, configuredIp)
    });
  }
});

module.exports = router;
