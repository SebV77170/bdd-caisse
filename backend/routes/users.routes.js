const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const bcrypt = require('bcrypt');

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

// POST /api/users — création d'un nouvel utilisateur
router.post('/', (req, res) => {
  const { prenom, nom, pseudo, mot_de_passe, mail = '', tel = '' } = req.body;

  if (!prenom || !nom || !pseudo || !mot_de_passe) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const exist = sqlite.prepare('SELECT id FROM users WHERE pseudo = ?').get(pseudo);
  if (exist) {
    return res.status(409).json({ error: 'Pseudo déjà utilisé' });
  }

  const row = sqlite.prepare('SELECT MAX(id) as max FROM users').get();
  const id = (row?.max || 0) + 1;
  const hash = bcrypt.hashSync(mot_de_passe.trim(), 10);

  sqlite.prepare(
    'INSERT INTO users (id, prenom, nom, pseudo, password, admin, mail, tel) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, prenom, nom, pseudo, hash, 1, mail, tel);

  res.json({ success: true, id });
});

module.exports = router;
