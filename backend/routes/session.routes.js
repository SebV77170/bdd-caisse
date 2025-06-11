const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;
const session = require('../session');


// Connexion par pseudo simple
router.post('/', (req, res) => {
  const { pseudo } = req.body;
  const user = sqlite.prepare('SELECT * FROM users WHERE pseudo = ?').get(pseudo);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  session.setUser({ id: user.id, nom: user.nom, prenom: user.prenom, pseudo: user.pseudo });
  res.json({ success: true, user: { id: user.id, nom: user.nom, prenom: user.prenom, pseudo: user.pseudo} });
});

router.get('/', (req, res) => {
  const user = session.getUser();
  if (!user) return res.status(401).json({ error: 'Aucun utilisateur connecté' });
  res.json({ user });
});

router.delete('/', (req, res) => {
  session.clearUser();
  res.json({ success: true });
});

router.get('/etat-caisse', (req, res) => {
  const session = sqlite.prepare(`SELECT * FROM session_caisse WHERE date_fermeture IS NULL`).get();
  if (session) {
    res.json({ ouverte: true, id_session: session.id_session, date_ouverture: session.date_ouverture });
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
  }

  res.json({ success: true, caissiers });
});


module.exports = router;
