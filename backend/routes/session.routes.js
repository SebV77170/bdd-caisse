// fichier: routes/auth.routes.js (ou celui où tu as collé ce code)

const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const bcrypt = require('bcrypt');
const session = require('../session');
const logSync = require('../logsync');

// util: renvoie 'YYYY-MM-DD' depuis un ISO
const toYMD = (iso) => {
  try {
    if (!iso) return null;
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

// ----------------------
// Connexion
// ----------------------
router.post('/', (req, res) => {
  const { pseudo, mot_de_passe } = req.body;

  if (!pseudo || !mot_de_passe) {
    return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
  }

  const user = sqlite.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  // compat bcrypt $2y$ -> $2b$
  const hashCorrige = user.password.replace(/^\$2y\$/, '$2b$');
  const motDePasseValide = bcrypt.compareSync(mot_de_passe.trim(), hashCorrige);

  if (!motDePasseValide) {
    return res.status(403).json({ error: 'Mot de passe invalide' });
  }

  // Enregistrement de l'utilisateur dans la session HTTP
  req.session.user = {
    nom: user.nom,
    prenom: user.prenom,
    pseudo: user.pseudo,
    uuid_user: user.uuid_user
  };

  req.session.save(() => {
    res.json({ success: true, user: req.session.user });
  });
});

// ----------------------
// Qui est connecté
// ----------------------
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  }

  res.json({ user: req.session.user });
});

// ----------------------
// Déconnexion
// ----------------------
router.delete('/', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ----------------------
// État caisse PRINCIPALE
// ----------------------
// Avant: SELECT ... WHERE date_fermeture IS NULL AND issecondaire = 0
// Maintenant: closed_at_utc IS NULL
router.get('/etat-caisse', (req, res) => {
  const s = sqlite.prepare(`
    SELECT *
    FROM session_caisse
    WHERE closed_at_utc IS NULL AND issecondaire = 0
    LIMIT 1
  `).get();

  if (s) {
    // rétro-compat: expose encore "date_ouverture"
    res.json({
      ouverte: true,
      id_session: s.id_session,
      opened_at_utc: s.opened_at_utc,
      date_ouverture: toYMD(s.opened_at_utc) // pour l’UI actuelle
    });
  } else {
    res.json({ ouverte: false });
  }
});

// ----------------------
// État caisse SECONDAIRE
// ----------------------
router.get('/etat-caisse-secondaire', (req, res) => {
  const s = sqlite.prepare(`
    SELECT *
    FROM session_caisse
    WHERE closed_at_utc IS NULL AND issecondaire = 1
    LIMIT 1
  `).get();

  if (s) {
    res.json({
      ouverte: true,
      id_session: s.id_session,
      opened_at_utc: s.opened_at_utc,
      date_ouverture: toYMD(s.opened_at_utc),     // compat front
      utilisateur_ouverture: s.utilisateur_ouverture
    });
  } else {
    res.json({ ouverte: false });
  }
});

// ----------------------
// Ajouter un caissier à la session OUVERTE (principale ou secondaire)
// ----------------------
// Avant: WHERE date_fermeture IS NULL
// Maintenant: WHERE closed_at_utc IS NULL
router.post('/ajouter-caissier', (req, res) => {
  const { nom } = req.body;
  if (!nom) {
    return res.status(400).json({ error: 'Nom manquant' });
  }

  const sessionCaisse = sqlite
    .prepare('SELECT id_session, caissiers FROM session_caisse WHERE closed_at_utc IS NULL')
    .get();

  if (!sessionCaisse) {
    return res.status(400).json({ error: 'Aucune session caisse ouverte' });
  }

  let caissiers = [];
  try {
    caissiers = sessionCaisse.caissiers ? JSON.parse(sessionCaisse.caissiers) : [];
  } catch {
    caissiers = [];
  }

  if (!caissiers.includes(nom)) {
    caissiers.push(nom);
    sqlite
      .prepare('UPDATE session_caisse SET caissiers = ? WHERE id_session = ?')
      .run(JSON.stringify(caissiers), sessionCaisse.id_session);

    logSync('session_caisse', 'UPDATE', {
      id_session: sessionCaisse.id_session,
      caissiers: JSON.stringify(caissiers)
    });
  }

  res.json({ success: true, caissiers });
});

module.exports = router;
