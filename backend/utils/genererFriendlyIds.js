const { sqlite } = require('../db');

function genererFriendlyIds(uuid, type = 'vente') {
  const prefixMap = {
    vente: 'T',
    correction: 'C',
    annulation: 'A'
  };

  const prefix = prefixMap[type] || 'X';

  // Création de la table si elle n’existe pas
  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS uuid_mapping (
      uuid TEXT PRIMARY KEY,
      id_friendly TEXT UNIQUE,
      type TEXT
    )
  `).run();

  // Vérifie si l’UUID existe déjà
  const exist = sqlite.prepare(`SELECT 1 FROM uuid_mapping WHERE uuid = ?`).get(uuid);
  if (exist) return; // Déjà enregistré

  // Cherche le plus haut identifiant friendly de ce type
  const row = sqlite.prepare(`
    SELECT id_friendly FROM uuid_mapping
    WHERE id_friendly LIKE ?
    ORDER BY id_friendly DESC
    LIMIT 1
  `).get(`${prefix}%`);

  let nextIdNum = 1;
  if (row && row.id_friendly) {
    nextIdNum = parseInt(row.id_friendly.replace(prefix, '')) + 1;
  }

  const idFriendly = `${prefix}${String(nextIdNum).padStart(5, '0')}`;

  // Insertion dans la table
  sqlite.prepare(`
    INSERT INTO uuid_mapping (uuid, id_friendly, type)
    VALUES (?, ?, ?)
  `).run(uuid, idFriendly, type);

  return idFriendly; // Utile si tu veux l'afficher ou le loguer
}


function getFriendlyIdFromUuid(uuid) {
  const row = sqlite.prepare(`
    SELECT id_friendly FROM uuid_mapping WHERE uuid = ?
  `).get(uuid);

  return row ? row.id_friendly : null;
}

module.exports = {genererFriendlyIds, getFriendlyIdFromUuid};