const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const cron = require('node-cron');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
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
    await axios.post(`http://localhost:${port}/api/sync/`);
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
  job = cron.schedule(`*/${interval} * * * *`, callSync);
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

module.exports = { startScheduler, updateConfig, getConfig };
