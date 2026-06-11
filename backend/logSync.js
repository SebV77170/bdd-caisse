const { randomUUID } = require('crypto');
const { sqlite } = require('./db');

const PRINCIPAL_SYNC_LOG_CLEANUP = 'sync_log_senttoprincipal_principal_v1';

function getIsSecondary(explicitIsSecondary) {
  if (explicitIsSecondary !== undefined) {
    return explicitIsSecondary ? 1 : 0;
  }

  const openSession = sqlite.prepare(`
    SELECT issecondaire
    FROM session_caisse
    WHERE closed_at_utc IS NULL
    ORDER BY datetime(opened_at_utc) DESC
    LIMIT 1
  `).get();
  if (openSession) return openSession.issecondaire | 0;

  const latestSession = sqlite.prepare(`
    SELECT issecondaire
    FROM session_caisse
    ORDER BY datetime(opened_at_utc) DESC
    LIMIT 1
  `).get();
  return latestSession ? latestSession.issecondaire | 0 : null;
}

function cleanupHistoricalPrincipalLogs() {
  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const alreadyApplied = sqlite.prepare(
    'SELECT 1 FROM app_migrations WHERE name = ?'
  ).get(PRINCIPAL_SYNC_LOG_CLEANUP);
  if (alreadyApplied) return;

  sqlite.prepare(`
    UPDATE sync_log
    SET senttoprincipal = 1
    WHERE senttoprincipal = 0
  `).run();
  sqlite.prepare(
    'INSERT INTO app_migrations (name) VALUES (?)'
  ).run(PRINCIPAL_SYNC_LOG_CLEANUP);
}

/**
 * Store an operation in sync_log.
 * Unknown register roles remain pending to avoid losing secondary operations.
 */
function logSync(type, operation, data, { isSecondary } = {}) {
  try {
    const payload = JSON.stringify(data);
    const registerIsSecondary = getIsSecondary(isSecondary);
    const sentToPrincipal = registerIsSecondary === 0 ? 1 : 0;

    sqlite.transaction(() => {
      if (registerIsSecondary === 0) {
        cleanupHistoricalPrincipalLogs();
      }

      sqlite.prepare(`
        INSERT INTO sync_log (
          operation_uuid, type, operation, payload, senttoprincipal
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), type, operation, payload, sentToPrincipal);
    })();
  } catch (err) {
    console.error(`Erreur logSync [${type} - ${operation}] :`, err.message);
  }
}

module.exports = logSync;
