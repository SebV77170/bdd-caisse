const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const verifyAdmin = require('../utils/verifyAdmin');
const session = require('../session');
const logSync = require('../logsync');
const genererTicketCloturePdf = require('../utils/genererTicketCloturePdf');
const { v4: uuidv4 } = require('uuid');
const getBilanSession = require('../utils/bilanSession');

function lancerDerniereSyncNonBloquante(req, { debug = false } = {}) {
  // Démarrer APRES l’envoi de la réponse
  req.res.on('finish', () => {
    (async () => {
      try {
        const io = req.app.get('socketio');
        const url = `http://localhost:3001/api/sync${debug ? '?debug=true' : ''}`;

        io && io.emit('syncStart', { source: 'fermeture_caisse', at: new Date().toISOString() });

        // NB: on n'attend pas cette promesse dans le flux principal de la route
        const resp = await fetch(url, { method: 'POST' });
        if (!resp.ok) {
          // 429 attendu si une sync est déjà en cours → on considère non bloquant
          const msg = `Sync HTTP ${resp.status}`;
          console.warn('[SYNC] Dernière sync non OK :', msg);
          io && io.emit('syncEnd', { source: 'fermeture_caisse', ok: false, status: resp.status, at: new Date().toISOString() });
          return;
        }

        io && io.emit('syncEnd', { source: 'fermeture_caisse', ok: true, at: new Date().toISOString() });
        console.log('✅ Dernière synchronisation effectuée');
      } catch (e) {
        console.error('❌ Dernière synchronisation échouée :', e);
        const io = req.app.get('socketio');
        io && io.emit('syncEnd', { source: 'fermeture_caisse', ok: false, error: e?.message || String(e), at: new Date().toISOString() });
        // on avale l’erreur -> ne bloque rien
      }
    })();
  });
}

// Route POST pour fermer la caisse (UTC)
router.post('/', (req, res) => {
  // Récupération des données envoyées par le frontend
  const {
    montant_reel,
    commentaire,
    responsable_pseudo,
    mot_de_passe,
    montant_reel_carte,
    montant_reel_cheque,
    montant_reel_virement,
    uuid_session_caisse
  } = req.body;

  // Vérifie qu'un utilisateur est connecté
  const utilisateur = req.session.user;
  if (!utilisateur) {
    return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  }

  // Récupère la session de caisse ouverte (schéma UTC)
  const sessionCaisse = sqlite.prepare(`
    SELECT * FROM session_caisse WHERE closed_at_utc IS NULL
  `).get();

  if (!sessionCaisse) {
    return res.status(400).json({ error: 'Aucune session caisse ouverte' });
  }

  const typeSession = sessionCaisse.issecondaire === 0 ? 'principale' : 'secondaire';

  // Vérifie que le responsable existe et a les droits nécessaires
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    return res.status(403).json({ error });
  }

  // Horodatage UTC pour la fermeture
  const closed_at_utc = new Date().toISOString();

  // Récupère le bilan de la session de caisse (en centimes)
  const ventesJour = getBilanSession(uuid_session_caisse);

  // Calcul des montants attendus et des écarts (tous en centimes)
  const fond_de_caisse      = sessionCaisse.fond_initial || 0;
  const attendu_espece      = ventesJour.prix_total_espece ?? 0;
  const attendu_carte       = ventesJour.prix_total_carte ?? 0;
  const attendu_cheque      = ventesJour.prix_total_cheque ?? 0;
  const attendu_virement    = ventesJour.prix_total_virement ?? 0;

  const _mr        = Number(montant_reel ?? 0);
  const _mrCarte   = Number(montant_reel_carte ?? 0);
  const _mrCheque  = Number(montant_reel_cheque ?? 0);
  const _mrVir     = Number(montant_reel_virement ?? 0);

  const ecart_espece   = _mr      - attendu_espece - fond_de_caisse;
  const ecart_carte    = _mrCarte - attendu_carte;
  const ecart_cheque   = _mrCheque - attendu_cheque;
  const ecart_virement = _mrVir    - attendu_virement;
  const ecart          = ecart_espece + ecart_carte + ecart_cheque + ecart_virement;

  // Mise à jour de la session caisse en base (fermeture UTC)
  sqlite.prepare(`
    UPDATE session_caisse
    SET 
      closed_at_utc = ?,
      utilisateur_fermeture = ?,
      responsable_fermeture = ?,
      montant_reel = ?,
      commentaire = ?,
      ecart = ?,
      montant_reel_carte = ?,
      montant_reel_cheque = ?,
      montant_reel_virement = ?
    WHERE id_session = ?
  `).run(
    closed_at_utc,
    utilisateur.nom,
    responsable.nom,
    _mr,
    commentaire ?? '',
    ecart,
    _mrCarte,
    _mrCheque,
    _mrVir,
    sessionCaisse.id_session
  );

  // Log de la modification de la session caisse (UTC)
  logSync('session_caisse', 'UPDATE', {
    id_session: sessionCaisse.id_session,
    closed_at_utc,
    utilisateur_fermeture: utilisateur.nom,
    responsable_fermeture: responsable.nom,
    montant_reel: _mr,
    commentaire: commentaire ?? '',
    ecart,
    montant_reel_carte: _mrCarte,
    montant_reel_cheque: _mrCheque,
    montant_reel_virement: _mrVir
  });

  // Création d'un ticket de clôture (ticket de caisse spécial)
  const vendeur = utilisateur.nom;
  const id_vendeur = utilisateur.uuid_user;
  const date_achat_dt = new Date().toISOString().slice(0, 19).replace('T', ' '); // conserve ton format
  const uuid_ticket = uuidv4();

  const result = sqlite.prepare(`
    INSERT INTO ticketdecaisse (
      uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
      nbr_objet, moyen_paiement, prix_total, lien,
      reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, cloture, uuid_session_caisse
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid_ticket, vendeur, id_vendeur, date_achat_dt,
    0, '---', ecart, '',
    0, 0, 0, 0, 1, uuid_session_caisse
  );

  const id_ticket = result.lastInsertRowid;

  // Log de la création du ticket de clôture
  logSync('ticketdecaisse', 'INSERT', {
    uuid_ticket,
    id_ticket,
    nom_vendeur: vendeur,
    id_vendeur,
    date_achat_dt,
    nbr_objet: 0,
    moyen_paiement: '---',
    prix_total: ecart,
    reducbene: 0,
    reducclient: 0,
    reducgrospanierclient: 0,
    reducgrospanierbene: 0,
    cloture: 1,
    uuid_session_caisse
  });

  // Génération du PDF de clôture (optionnel, async)
  genererTicketCloturePdf(sessionCaisse.id_session, uuid_ticket)
    .then(() => console.log('✅ PDF de clôture généré'))
    .catch(err => console.error('❌ Erreur PDF clôture :', err));

  // Notifie les clients via WebSocket que la caisse est fermée
  const io = req.app.get('socketio');
  if (io) {
    io.emit('etatCaisseUpdated', {
      ouverte: false,
      type: typeSession
    });
  }

  // 🔁 Lancer la dernière sync vers MySQL sans bloquer la fermeture
  lancerDerniereSyncNonBloquante(req, { debug: false });

  // Réponse au frontend
  res.json({ success: true });
});

// Route GET pour récupérer le fond initial de la session caisse ouverte (UTC)
router.get('/fond_initial', (req, res) => {
  try {
    const sessionCaisse = sqlite.prepare(`
      SELECT fond_initial FROM session_caisse 
      WHERE closed_at_utc IS NULL
    `).get();

    if (!sessionCaisse) {
      return res.status(404).json({ error: 'Aucune session caisse ouverte' });
    }

    res.json({ fond_initial: sessionCaisse.fond_initial });
  } catch (err) {
    console.error('❌ Erreur récupération fond_initial :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
