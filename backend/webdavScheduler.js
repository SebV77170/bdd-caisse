const fs = require('fs');
const path = require('path');
const os = require('os');
const cron = require('node-cron');
const { uploadTicketsAndFactures } = require('./webdavSync');
const { getWebdavConfig, updateWebdavConfig, getActiveCredentials } = require('./webdavConfig');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const statePath = path.join(baseDir, 'webdavSyncState.json');
fs.mkdirSync(baseDir, { recursive: true });

let job = null;
let isRunning = false;

function saveState(payload) {
  try {
    fs.writeFileSync(statePath, JSON.stringify(payload, null, 2));
  } catch {
    // ignore write errors
  }
}

async function runSync() {
  if (isRunning) return null;
  isRunning = true;
  const start = new Date();
  try {
    const details = await uploadTicketsAndFactures();
    const ticketCount = details?.tickets || {};
    const invoiceCount = details?.factures || {};
    const count = (ticketCount.success || 0) + (invoiceCount.success || 0);
    const failed = (ticketCount.failed || 0) + (invoiceCount.failed || 0);
    if (failed > 0) {
      const error = new Error(`${failed} fichier(s) WebDAV non transfere(s)`);
      error.details = details;
      throw error;
    }
    const end = new Date();
    saveState({ lastRun: start.toISOString(), lastDurationMs: end - start, lastResult: 'success', lastCount: count });
    return { success: true, count, details };
  } catch (error) {
    saveState({ lastRun: start.toISOString(), lastResult: 'error', error: error.message });
    throw error;
  } finally {
    isRunning = false;
  }
}

function scheduleJob() {
  const { enabled, interval } = getWebdavConfig();
  if (job) job.stop();
  if (!enabled) return;
  if (!getActiveCredentials()) return;
  job = cron.schedule(`*/${interval} * * * *`, () => {
    runSync().catch(() => {});
  });
}

function startWebdavScheduler() {
  scheduleJob();
}

function updateWebdavSchedulerConfig({ interval, enabled, mode }) {
  updateWebdavConfig(interval, enabled, mode);
  scheduleJob();
}

function getWebdavSchedulerConfig() {
  return getWebdavConfig();
}

function getWebdavState() {
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  startWebdavScheduler,
  updateWebdavSchedulerConfig,
  getWebdavSchedulerConfig,
  runSync,
  getWebdavState
};
