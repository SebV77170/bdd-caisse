
const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');
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

  logSync('users', 'INSERT', {
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

// GET /api/users/compare — compare MySQL vs SQLite
router.get('/compare', async (req, res) => {
  try {
    const pool = getMysqlPool();
    const [mysqlUsers] = await pool.query(
      'SELECT uuid_user, prenom, nom, pseudo, password, admin, mail, tel FROM users'
    );
    const sqliteUsers = sqlite
      .prepare('SELECT uuid_user, prenom, nom, pseudo, password, admin, mail, tel FROM users')
      .all();
    const localMap = new Map(sqliteUsers.map(u => [u.uuid_user, u]));
    const remoteMap = new Map(mysqlUsers.map(u => [u.uuid_user, u]));

    const missing = mysqlUsers.filter(u => !localMap.has(u.uuid_user));
    const extra = sqliteUsers.filter(u => !remoteMap.has(u.uuid_user));
    const different = mysqlUsers.filter(u => {
      const lu = localMap.get(u.uuid_user);
      if (!lu) return false;
      return ['prenom', 'nom', 'pseudo', 'password', 'admin', 'mail', 'tel'].some(
        f => String(u[f] ?? '') !== String(lu[f] ?? '')
      );
    });

    res.json({ success: true, missing, extra, different });
  } catch (err) {
    console.error('Erreur comparaison users:', err);
    res.status(500).json({ success: false, error: 'Erreur comparaison users' });
  }
});

// POST /api/users/sync — replace local table with remote data
router.post('/sync', async (req, res) => {
  try {
    const pool = getMysqlPool();
    const [mysqlUsers] = await pool.query(
      'SELECT uuid_user, prenom, nom, pseudo, password, admin, mail, tel FROM users'
    );
    const insert = sqlite.prepare(
      'INSERT OR REPLACE INTO users (uuid_user, prenom, nom, pseudo, password, admin, mail, tel) VALUES (?,?,?,?,?,?,?,?)'
    );
    const replaceAll = sqlite.transaction(users => {
      sqlite.prepare('DELETE FROM users').run();
      for (const u of users) {
        insert.run(
          u.uuid_user,
          u.prenom,
          u.nom,
          u.pseudo,
          u.password,
          u.admin,
          u.mail || '',
          u.tel || ''
        );
      }
    });
    replaceAll(mysqlUsers);
    res.json({ success: true, count: mysqlUsers.length });
  } catch (err) {
    console.error('Erreur sync users:', err);
    res.status(500).json({ success: false, error: 'Erreur mise à jour users' });
  }
});

module.exports = router;
