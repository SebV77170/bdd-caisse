const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;

// GET /api/users — retourne la liste pour la page de login
router.get('/', (req, res) => {
  try {
    const users = sqlite.prepare('SELECT id, nom, pseudo FROM users').all();
    res.json(users);
  } catch (err) {
    console.error('Erreur chargement utilisateurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
