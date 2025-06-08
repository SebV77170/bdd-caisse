const { sqlite } = require('./db'); // Adapté à ton système SQLite

/**
 * Enregistre une opération à synchroniser dans la table `sync_log`
 * @param {string} type - Le type de ressource (ex: 'ticketdecaisse', 'bilan', ...)
 * @param {string} operation - Le type d’opération ('INSERT', 'UPDATE', 'DELETE')
 * @param {object} data - Les données associées à l’opération (objet JS)
 */
function logSync(type, operation, data) {
  try {
    const payload = JSON.stringify(data);

    sqlite.prepare(`
      INSERT INTO sync_log (type, operation, payload)
      VALUES (?, ?, ?)
    `).run(type, operation, payload);

    console.log(`✅ Sync log enregistré : ${type} ${operation}`);
  } catch (err) {
    console.error(`❌ Erreur logSync [${type} - ${operation}] :`, err.message);
  }
}

module.exports = logSync;
