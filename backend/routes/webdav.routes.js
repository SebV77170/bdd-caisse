const express = require('express');
const router = express.Router();
const {
  updateWebdavSchedulerConfig,
  getWebdavSchedulerConfig,
  runSync,
  getWebdavState
} = require('../webdavScheduler');
const { getAvailableModes } = require('../webdavConfig');

router.get('/config', (req, res) => {
  res.json(getWebdavSchedulerConfig());
});

router.post('/config', (req, res) => {
  const { interval, enabled, mode } = req.body || {};
  const parsedInterval = Number(interval);
  if (!parsedInterval || parsedInterval <= 0) {
    return res.status(400).json({ error: 'Interval invalide' });
  }
  const modes = getAvailableModes();
  if (mode && !modes.find(m => m.key === mode)) {
    return res.status(400).json({ error: 'Mode WebDAV inconnu' });
  }
  updateWebdavSchedulerConfig({ interval: parsedInterval, enabled: typeof enabled === 'boolean' ? enabled : undefined, mode });
  res.json({ success: true });
});

router.post('/sync', async (req, res) => {
  try {
    const result = await runSync();
    res.json({ success: true, count: result ? result.count : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erreur lors de la synchronisation WebDAV' });
  }
});

router.get('/state', (req, res) => {
  res.json(getWebdavState() || {});
});

module.exports = router;
