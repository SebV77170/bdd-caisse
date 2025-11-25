const fs = require('fs');
const path = require('path');
const os = require('os');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const configPath = path.join(baseDir, 'ticketSyncConfig.json');

const defaultConfig = {
  enabled: true,
  interval: 30,
  host: '',
  port: 22,
  username: '',
  password: '',
  remoteBasePath: '/tickets'
};

function ensureBaseDir() {
  fs.mkdirSync(baseDir, { recursive: true });
}

function loadConfig() {
  ensureBaseDir();
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...raw };
    } catch (err) {
      console.error('Impossible de lire ticketSyncConfig.json, utilisation des valeurs par défaut.', err);
    }
  }
  return { ...defaultConfig };
}

let cachedConfig = loadConfig();

function getTicketSyncConfig() {
  return { ...cachedConfig };
}

function updateTicketSyncConfig(patch) {
  const next = { ...cachedConfig };

  if (patch) {
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;

    if (typeof patch.interval === 'number' && Number.isFinite(patch.interval) && patch.interval > 0) {
      next.interval = Math.round(patch.interval);
    }

    if (typeof patch.host === 'string') next.host = patch.host.trim();
    if (typeof patch.username === 'string') next.username = patch.username.trim();
    if (typeof patch.password === 'string') next.password = patch.password;
    if (typeof patch.remoteBasePath === 'string' && patch.remoteBasePath.trim() !== '') {
      next.remoteBasePath = patch.remoteBasePath.trim();
    }

    if (patch.port !== undefined) {
      const port = Number(patch.port);
      if (Number.isFinite(port) && port > 0) {
        next.port = Math.round(port);
      }
    }
  }

  cachedConfig = next;
  ensureBaseDir();
  fs.writeFileSync(configPath, JSON.stringify(cachedConfig, null, 2));
  return getTicketSyncConfig();
}

module.exports = {
  getTicketSyncConfig,
  updateTicketSyncConfig,
  configPath
};
