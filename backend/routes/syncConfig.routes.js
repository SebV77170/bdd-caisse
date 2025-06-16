const express = require('express');
const router = express.Router();
const { updateConfig, getConfig } = require('../syncScheduler');

router.get('/', (req, res) => {
  res.json(getConfig());
});

router.post('/', (req, res) => {
  const { interval, enabled } = req.body || {};
  const minutes = parseInt(interval, 10);
  if (!minutes || minutes <= 0) {
    return res.status(400).json({ error: 'Interval invalide' });
  }
  updateConfig(minutes, typeof enabled === 'boolean' ? enabled : undefined);
  res.json({ success: true });
});

module.exports = router;
