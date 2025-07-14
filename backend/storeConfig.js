const fs = require('fs');
const path = require('path');
const os = require('os');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const configPath = path.join(baseDir, 'storeConfig.json');
fs.mkdirSync(baseDir, { recursive: true });

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        localName: data.localName || 'LOCAL',
        registerNumber: data.registerNumber || 1,
      };
    } catch {}
  }
  return { localName: 'LOCAL', registerNumber: 1 };
}

let { localName, registerNumber } = loadConfig();

function updateConfig(newName, newNumber) {
  if (typeof newName === 'string') localName = newName;
  if (typeof newNumber === 'number') registerNumber = newNumber;
  fs.writeFileSync(
    configPath,
    JSON.stringify({ localName, registerNumber }, null, 2)
  );
}

function getConfig() {
  return { localName, registerNumber };
}

module.exports = { getConfig, updateConfig };
