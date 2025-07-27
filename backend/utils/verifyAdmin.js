const { sqlite } = require('../db');
const bcrypt = require('bcrypt');

function verifyAdmin(pseudo, password) {
  if (!pseudo || !password) {
    return { valid: false, error: 'Identifiants manquants' };
  }
  const user = sqlite
    .prepare('SELECT * FROM users WHERE pseudo = ? AND admin >= 2')
    .get(pseudo);
  if (!user) {
    return { valid: false, error: 'Responsable introuvable' };
  }
  const ok = bcrypt.compareSync(
    password.trim(),
    user.password.replace(/^\$2y\$/, '$2b$')
  );
  if (!ok) {
    return { valid: false, error: 'Mot de passe responsable invalide' };
  }
  return { valid: true, user };
}

module.exports = verifyAdmin;
