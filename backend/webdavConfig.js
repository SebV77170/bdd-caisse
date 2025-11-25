const fs = require('fs');
const path = require('path');
const os = require('os');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const configPath = path.join(baseDir, 'webdavSyncConfig.json');
fs.mkdirSync(baseDir, { recursive: true });

function loadEnvTargets() {
  const raw = process.env.WEBDAV_ENDPOINTS || process.env.WEBDAV_CONFIG;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const normalized = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const { url, username, password, basePath, label } = value;
      if (!url || !username || !password) continue;
      normalized[key] = {
        url,
        username,
        password,
        basePath: basePath || '/tickets',
        label: label || key
      };
    }
    return normalized;
  } catch {
    return {};
  }
}

function loadPersistedConfig(defaultMode) {
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        enabled: typeof data.enabled === 'boolean' ? data.enabled : false,
        interval: typeof data.interval === 'number' && data.interval > 0 ? data.interval : 60,
        mode: typeof data.mode === 'string' ? data.mode : defaultMode
      };
    } catch {}
  }
  return { enabled: false, interval: 60, mode: defaultMode };
}

const envTargets = loadEnvTargets();
let { enabled, interval, mode } = loadPersistedConfig(Object.keys(envTargets)[0] || null);

function persist() {
  fs.writeFileSync(
    configPath,
    JSON.stringify({ enabled, interval, mode }, null, 2)
  );
}

function getAvailableModes() {
  const targets = loadEnvTargets();
  return Object.entries(targets).map(([key, value]) => ({
    key,
    label: value.label || key,
    url: value.url,
    basePath: value.basePath || '/tickets'
  }));
}

function updateWebdavConfig(newInterval, newEnabled, newMode) {
  if (typeof newInterval === 'number' && newInterval > 0) interval = newInterval;
  if (typeof newEnabled === 'boolean') enabled = newEnabled;
  if (typeof newMode === 'string' && loadEnvTargets()[newMode]) mode = newMode;
  persist();
}

function getWebdavConfig() {
  const targets = loadEnvTargets();
  if (!mode || !targets[mode]) {
    mode = Object.keys(targets)[0] || null;
  }
  return {
    enabled,
    interval,
    mode,
    availableModes: getAvailableModes()
  };
}

function getActiveCredentials() {
  const targets = loadEnvTargets();
  if (!mode || !targets[mode]) return null;
  return targets[mode];
}

module.exports = {
  getWebdavConfig,
  updateWebdavConfig,
  getActiveCredentials,
  getAvailableModes
};
