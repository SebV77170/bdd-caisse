const fs = require('fs');

function loadReleaseInfo(filePath, fallbackVersion) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      version: String(parsed.version || fallbackVersion),
      notes: String(parsed.notes || '').trim() || 'Aucune note de version disponible.'
    };
  } catch {
    return {
      version: String(fallbackVersion),
      notes: 'Aucune note de version disponible.'
    };
  }
}

module.exports = { loadReleaseInfo };
