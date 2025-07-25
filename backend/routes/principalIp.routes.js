const express = require('express');
const router = express.Router();
const { getConfig, updateConfig } = require('../principalIpConfig');

router.get('/', (req, res) => {
  res.json(getConfig());
});

router.post('/', (req, res) => {
  const { ip } = req.body || {};
  if (!ip) return res.status(400).json({ error: 'IP manquante' });
  updateConfig(ip);
  res.json({ success: true });
});

module.exports = router;
