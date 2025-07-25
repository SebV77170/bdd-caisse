const express = require('express');
const router = express.Router();
const os = require('os');
const { exec } = require('child_process');
let findDevices;

try {
  findDevices = require('local-devices');
} catch {
  findDevices = null;
}

router.get('/local-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name]) {
      if (info.family === 'IPv4' && !info.internal) {
        return res.json({ ip: info.address });
      }
    }
  }
  res.json({ ip: null });
});

router.get('/scan', async (req, res) => {
  if (findDevices) {
    try {
      const devices = await findDevices();
      return res.json({ devices });
    } catch (err) {
      console.error('Scan réseau échoué:', err);
    }
  }

  exec('arp -a', (err, stdout) => {
    if (err || !stdout) {
      console.error('Commande arp échouée:', err);
      return res.json({ devices: [] });
    }
    const devices = [];
    stdout.split('\n').forEach(line => {
      const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
      const macMatch = line.match(/([0-9a-fA-F:]{17})/);
      if (ipMatch) {
        devices.push({ ip: ipMatch[1], mac: macMatch ? macMatch[1] : null });
      }
    });
    res.json({ devices });
  });
});

module.exports = router;
