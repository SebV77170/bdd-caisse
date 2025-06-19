const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const bcrypt = require('bcrypt');
const session = require('../session');
const logSync = require('../logSync');
const genererTicketCloturePdf = require('../utils/genererTicketCloturePdf');
const { v4: uuidv4 } = require('uuid');
const getBilanSession = require('../utils/bilanSession');

// Route POST pour fermer la caisse
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
  const utilisateur = session.getUser();
  if (!utilisateur) {
    return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  }

  // Récupère la session de caisse ouverte
  const sessionCaisse = sqlite.prepare(`
    SELECT * FROM session_caisse WHERE date_fermeture IS NULL
  `).get();
  if (!sessionCaisse) {
    return res.status(400).json({ error: 'Aucune session caisse ouverte' });
  }

  // Vérifie que le responsable existe et a les droits nécessaires
  const responsable = sqlite.prepare(`
    SELECT * FROM users WHERE pseudo = ? AND admin >= 2
  `).get(responsable_pseudo);
  if (!responsable) {
    return res.status(403).json({ error: 'Responsable introuvable' });
  }

  // Vérifie le mot de passe du responsable
  const motDePasseValide = bcrypt.compareSync(
    mot_de_passe.trim(),
    responsable.password.replace(/^\$2y\$/, '$2b$')
  );
  if (!motDePasseValide) {
    return res.status(403).json({ error: 'Mot de passe responsable invalide' });
  }

  // Préparation des données de fermeture
  const now = new Date();
  const date_fermeture = now.toISOString().slice(0, 10);
  const heure_fermeture = now.toTimeString().slice(0, 5);

  // Récupère le bilan de la session de caisse
  const ventesJour = getBilanSession(uuid_session_caisse);

  // Calcul des montants attendus et des écarts
  const fond_de_caisse = sessionCaisse.fond_initial * 100 || 0;
  const attendu_espece = ventesJour.prix_total_espece ?? 0;
  const attendu_carte = ventesJour.prix_total_carte ?? 0;
  const attendu_cheque = ventesJour.prix_total_cheque ?? 0;
  const attendu_virement = ventesJour.prix_total_virement ?? 0;
  const ecart_espece = montant_reel - attendu_espece - fond_de_caisse / 100;
  const ecart_carte = montant_reel_carte - attendu_carte;
  const ecart_cheque = montant_reel_cheque - attendu_cheque;
  const ecart_virement = montant_reel_virement - attendu_virement;
  const ecart = ecart_espece + ecart_carte + ecart_cheque + ecart_virement;

  console.log(attendu_carte, attendu_cheque, attendu_virement);

  // Mise à jour de la session caisse en base de données
  sqlite.prepare(`
    UPDATE session_caisse
    SET 
      date_fermeture = ?,
      heure_fermeture = ?,
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
    date_fermeture,
    heure_fermeture,
    utilisateur.nom,
    responsable.nom,
    montant_reel,
    commentaire,
    ecart,
    montant_reel_carte,
    montant_reel_cheque,
    montant_reel_virement,
    sessionCaisse.id_session
  );

  // Log de la modification de la session caisse
  logSync('session_caisse', 'UPDATE', {
    id_session: sessionCaisse.id_session,
    date_fermeture,
    heure_fermeture,
    utilisateur_fermeture: utilisateur.nom,
    responsable_fermeture: responsable.nom,
    montant_reel,
    commentaire,
    ecart,
    montant_reel_carte,
    montant_reel_cheque,
    montant_reel_virement
  });

  // Création d'un ticket de clôture (ticket de caisse spécial)
  const vendeur = utilisateur.nom;
  const id_vendeur = utilisateur.id;
  const date_achat = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const uuid_ticket = uuidv4();

  const result = sqlite.prepare(`
    INSERT INTO ticketdecaisse (
      uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
      nbr_objet, moyen_paiement, prix_total, lien,
      reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, cloture, uuid_session_caisse
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)
  `).run(
    uuid_ticket, vendeur, id_vendeur, date_achat,
    0, "---", ecart, '',
    0, 0, 0, 0, 1,uuid_session_caisse
  );

  const id_ticket = result.lastInsertRowid;

  // Log de la création du ticket de clôture
  logSync('ticketdecaisse', 'INSERT', {
    uuid_ticket,
    id_ticket,
    nom_vendeur: vendeur,
    id_vendeur,
    date_achat_dt: date_achat,
    nbr_objet: 0,
    moyen_paiement: "---",
    prix_total: ecart,
    reducbene: 0,
    reducclient: 0,
    reducgrospanierclient: 0,
    reducgrospanierbene: 0,
    cloture: 1
  });

  // Génération du PDF de clôture
  genererTicketCloturePdf(sessionCaisse.id_session)
    .then(() => console.log('✅ PDF de clôture généré'))
    .catch(err => console.error('❌ Erreur PDF clôture :', err));

  // Notifie les clients via WebSocket que la caisse est fermée
  const io = req.app.get('socketio');
  if (io) io.emit('etatCaisseUpdated', { ouverte: false });

  // Réponse au frontend
  res.json({ success: true });
});

// Route GET pour récupérer le fond initial de la session caisse ouverte
router.get('/fond_initial', (req, res) => {
  try {
    const sessionCaisse = sqlite.prepare(`
      SELECT fond_initial FROM session_caisse 
      WHERE date_fermeture IS NULL
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
