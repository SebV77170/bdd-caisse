const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const cron = require('node-cron');

const baseDir = process.env.BDD_CAISSE_DATA_DIR
  || path.join(os.homedir(), '.bdd-caisse');
const configPath = path.join(baseDir, 'syncConfig.json');
fs.mkdirSync(baseDir, { recursive: true });

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const interval =
        typeof data.interval === 'number' && data.interval > 0 ? data.interval : 60;
      const enabled = typeof data.enabled === 'boolean' ? data.enabled : true;
      return { interval, enabled };
    } catch {}
  }
  return { interval: 60, enabled: true };
}

let { interval, enabled } = loadConfig();
let job = null;
let port = 3001;
let io = null;
let isSyncCalling = false;

async function callSync() {
  try {
    if (isSyncCalling) return;
    isSyncCalling = true;
    const targetUrl = process.env.SYNC_SCHEDULER_URL
      || `http://localhost:${port}/api/sync/`;
    await axios.post(targetUrl);
    console.log('✅ Synchronisation périodique exécutée');
  } catch (err) {
    console.error('Erreur de synchronisation périodique:', err.message);
  } finally {
    isSyncCalling = false;
  }
}

function scheduleJob() {
  if (job) job.stop();
  if (!enabled) return;
  const cronExpression = process.env.SYNC_SCHEDULER_CRON
    || `*/${interval} * * * *`;
  job = cron.schedule(cronExpression, callSync);
}

function startScheduler(p, ioInstance) {
  port = p || port;
  io = ioInstance || io;
  scheduleJob();
}

function updateConfig(newInterval, newEnabled) {
  if (newInterval && newInterval > 0) interval = newInterval;
  if (typeof newEnabled === 'boolean') enabled = newEnabled;
  fs.writeFileSync(configPath, JSON.stringify({ interval, enabled }, null, 2));
  scheduleJob();
}

function getConfig() {
  return { interval, enabled };
}

function stopScheduler() {
  if (job) {
    job.stop();
    job = null;
  }
  isSyncCalling = false;
}

module.exports = {
  startScheduler,
  stopScheduler,
  updateConfig,
  getConfig,
  callSync
};
