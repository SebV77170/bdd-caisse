const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const bcrypt = require('bcrypt');
const session = require('../session');
const logSync = require('../logsync');


// Connexion avec vérification du mot de passe
router.post('/', (req, res) => {
  const { pseudo, mot_de_passe } = req.body;

  if (!pseudo || !mot_de_passe) {
    return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
  }

  const user = sqlite.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

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



router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  }

  res.json({ user: req.session.user });
});


router.delete('/', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});


router.get('/etat-caisse', (req, res) => {
  const session = sqlite.prepare(`SELECT * FROM session_caisse WHERE date_fermeture IS NULL and issecondaire = 0`).get();
  
  if (session) {
    res.json({ ouverte: true, id_session: session.id_session, date_ouverture: session.date_ouverture });
  } else {
    res.json({ ouverte: false });
  }
});

router.get('/etat-caisse-secondaire', (req, res) => {
  const session = sqlite.prepare(`
    SELECT * FROM session_caisse 
    WHERE date_fermeture IS NULL AND issecondaire = 1
  `).get();

  if (session) {
    res.json({ 
      ouverte: true, 
      id_session: session.id_session, 
      date_ouverture: session.date_ouverture,
      utilisateur_ouverture: session.utilisateur_ouverture
    });
  } else {
    res.json({ ouverte: false });
  }
});

// Ajoute un caissier à la session caisse ouverte
router.post('/ajouter-caissier', (req, res) => {
  const { nom } = req.body;
  if (!nom) {
    return res.status(400).json({ error: 'Nom manquant' });
  }

  const sessionCaisse = sqlite
    .prepare('SELECT id_session, caissiers FROM session_caisse WHERE date_fermeture IS NULL')
    .get();

  if (!sessionCaisse) {
    return res.status(400).json({ error: 'Aucune session caisse ouverte' });
  }

  let caissiers = [];
  try {
    caissiers = sessionCaisse.caissiers ? JSON.parse(sessionCaisse.caissiers) : [];
  } catch (err) {
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
