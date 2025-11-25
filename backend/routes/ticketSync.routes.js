const express = require('express');
const router = express.Router();
const {
  refreshTicketSyncConfig,
  getTicketSyncConfig,
  triggerTicketSync,
  getTicketSyncStatus
} = require('../ticketSyncScheduler');

router.get('/config', (req, res) => {
  res.json(getTicketSyncConfig());
});

router.post('/config', (req, res) => {
  try {
    const { interval, enabled, host, port, username, password, remoteBasePath } = req.body || {};
    const config = refreshTicketSyncConfig({ interval, enabled, host, port, username, password, remoteBasePath });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Erreur sauvegarde configuration' });
  }
});

router.post('/run', (req, res) => {
  const result = triggerTicketSync({ force: true, source: 'manual' });
  if (result.started) {
    return res.status(202).json({ success: true, started: true });
  }
  if (result.reason === 'running') {
    return res.status(409).json({ success: false, error: 'Synchronisation déjà en cours.' });
  }
  res.status(400).json({ success: false, error: result.reason || 'Impossible de démarrer la synchronisation.' });
});

router.get('/status', (req, res) => {
  res.json(getTicketSyncStatus());
});

module.exports = router;
