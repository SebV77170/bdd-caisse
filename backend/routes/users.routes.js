
const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool, getMysqlConfig } = require('../db');
const bcrypt = require('bcrypt');
const logSync = require('../logsync');

function normalizePseudo(pseudo) {
  return String(pseudo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sqliteTableHasColumn(tableName, columnName) {
  return sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function normalizeUserForCompare(user) {
  return {
    ...user,
    pseudo_normalise: user.pseudo_normalise || normalizePseudo(user.pseudo)
  };
}

function getUsersSelectSql() {
  return `
      SELECT
        uuid_user,
        prenom,
        nom,
        pseudo,
        password,
        admin,
        mail,
        tel
      FROM users
    `;
}

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

  const pseudoNormalise = normalizePseudo(pseudo);
  const hasPseudoNormalise = sqliteTableHasColumn('users', 'pseudo_normalise');
  const existingUsers = hasPseudoNormalise
    ? sqlite.prepare('SELECT pseudo, pseudo_normalise FROM users').all()
    : sqlite.prepare('SELECT pseudo FROM users').all();
  const exist = existingUsers
    .some((user) => normalizePseudo(user.pseudo_normalise || user.pseudo) === pseudoNormalise);
  if (exist) {
    return res.status(409).json({ error: 'Pseudo déjà utilisé' });
  }

  const uuid = require('uuid').v4();
  const hash = bcrypt.hashSync(mot_de_passe.trim(), 10);

  if (hasPseudoNormalise) {
    sqlite.prepare(
      'INSERT INTO users (prenom, nom, pseudo, pseudo_normalise, password, admin, mail, tel, uuid_user) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(prenom, nom, pseudo, pseudoNormalise, hash, 1, mail, tel, uuid);
  } else {
    sqlite.prepare(
      'INSERT INTO users (prenom, nom, pseudo, password, admin, mail, tel, uuid_user) VALUES (?,?,?,?,?,?,?,?)'
    ).run(prenom, nom, pseudo, hash, 1, mail, tel, uuid);
  }

  logSync('users', 'INSERT', {
    prenom: prenom,
    nom: nom,
    pseudo: pseudo,
    pseudo_normalise: pseudoNormalise,
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

    const [mysqlRows] = await pool.query(getUsersSelectSql());
    const sqliteRows = sqlite.prepare(getUsersSelectSql()).all();

    const mysqlUsers = mysqlRows.map(normalizeUserForCompare);
    const sqliteUsers = sqliteRows.map(normalizeUserForCompare);

    const localMap = new Map(sqliteUsers.map(u => [u.uuid_user, u]));
    const remoteMap = new Map(mysqlUsers.map(u => [u.uuid_user, u]));

    const missing = mysqlUsers.filter(u => !localMap.has(u.uuid_user));
    const extra = sqliteUsers.filter(u => !remoteMap.has(u.uuid_user));

    const fieldsToCompare = [
      'prenom',
      'nom',
      'pseudo',
      'pseudo_normalise',
      'password',
      'admin',
      'mail',
      'tel'
    ];

    const different = mysqlUsers.filter(u => {
      const lu = localMap.get(u.uuid_user);
      if (!lu) return false;

      return fieldsToCompare.some(
        f => String(u[f] ?? '') !== String(lu[f] ?? '')
      );
    });

    res.json({
      success: true,
      missing,
      extra,
      different
    });
  } catch (err) {
    const conf = getMysqlConfig();
    console.error('Erreur comparaison users:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Erreur comparaison users',
      code: err.code,
      host: conf.host,
      port: conf.port
    });
  }
});

// POST /api/users/sync — replace local table with remote data
router.post('/sync', async (req, res) => {
  try {
    const pool = getMysqlPool();

    const [mysqlRows] = await pool.query(getUsersSelectSql());
    const mysqlUsers = mysqlRows.map(normalizeUserForCompare);
    const hasPseudoNormalise = sqliteTableHasColumn('users', 'pseudo_normalise');

    const insert = hasPseudoNormalise
      ? sqlite.prepare(`
        INSERT OR REPLACE INTO users (
          uuid_user,
          prenom,
          nom,
          pseudo,
          pseudo_normalise,
          password,
          admin,
          mail,
          tel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      : sqlite.prepare(`
        INSERT OR REPLACE INTO users (
          uuid_user,
          prenom,
          nom,
          pseudo,
          password,
          admin,
          mail,
          tel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

    const replaceAll = sqlite.transaction(users => {
      sqlite.prepare('DELETE FROM users').run();

      for (const u of users) {
        const values = [
          u.uuid_user,
          u.prenom ?? '',
          u.nom ?? '',
          u.pseudo ?? ''
        ];

        if (hasPseudoNormalise) values.push(u.pseudo_normalise);

        values.push(
          u.password ?? '',
          u.admin ?? 0,
          u.mail ?? '',
          u.tel ?? ''
        );

        insert.run(...values);
      }
    });

    replaceAll(mysqlUsers);

    res.json({
      success: true,
      count: mysqlUsers.length
    });
  } catch (err) {
    const conf = getMysqlConfig();
    console.error('Erreur sync users:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Erreur mise à jour users',
      code: err.code,
      host: conf.host,
      port: conf.port
    });
  }
});

module.exports = router;
