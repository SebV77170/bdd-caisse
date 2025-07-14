
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const bcrypt = require('bcrypt');
const logSync = require('../logsync');

// GET /api/users — retourne la liste pour la page de login
router.get('/', (req, res) => {
  try {
    const users = sqlite.prepare('SELECT uuid_user, nom, pseudo FROM users').all();
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

  const exist = sqlite.prepare('SELECT uuid_user FROM users WHERE pseudo = ?').get(pseudo);
  if (exist) {
    return res.status(409).json({ error: 'Pseudo déjà utilisé' });
  }

  const uuid = require('uuid').v4();
  const hash = bcrypt.hashSync(mot_de_passe.trim(), 10);

  sqlite.prepare(
    'INSERT INTO users (prenom, nom, pseudo, password, admin, mail, tel, uuid_user) VALUES (?,?,?,?,?,?,?,?)'
  ).run(prenom, nom, pseudo, hash, 1, mail, tel, uuid);

  logSync('users', 'insert', {
    prenom: prenom,
    nom: nom,
    pseudo: pseudo,
    password: hash,
    admin: 1,
    mail: mail,
    tel: tel,
    uuid_user: uuid
  });

  res.json({ success: true });
});

module.exports = router;
