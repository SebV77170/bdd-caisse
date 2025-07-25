const express = require('express');
const router = express.Router();
const os = require('os');
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
  if (!findDevices) return res.json({ devices: [] });
  try {
    const devices = await findDevices();
    res.json({ devices });
  } catch (err) {
    console.error('Scan réseau échoué:', err);
    res.status(500).json({ devices: [], error: err.message });
  }
});

module.exports = router;
