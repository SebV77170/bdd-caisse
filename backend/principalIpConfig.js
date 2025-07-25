const fs = require('fs');
const path = require('path');
const os = require('os');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const configPath = path.join(baseDir, 'principalIp.json');
fs.mkdirSync(baseDir, { recursive: true });

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ip: data.ip || '192.168.0.101' };
    } catch {}
  }
  return { ip: '192.168.0.101' };
}

let { ip } = loadConfig();

function updateConfig(newIp) {
  if (typeof newIp === 'string') {
    ip = newIp;
    fs.writeFileSync(configPath, JSON.stringify({ ip }, null, 2));
  }
}

function getConfig() {
  return { ip };
}

module.exports = { getConfig, updateConfig };
