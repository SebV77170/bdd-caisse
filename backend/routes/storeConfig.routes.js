const express = require('express');
const router = express.Router();
const { getConfig, updateConfig } = require('../storeConfig');

router.get('/', (req, res) => {
  res.json(getConfig());
});

router.post('/', (req, res) => {
  const { localName, registerNumber } = req.body || {};
  const num = parseInt(registerNumber, 10);
  if (!localName || !num || num <= 0) {
    return res.status(400).json({ error: 'Champs invalides' });
  }
  updateConfig(localName, num);
  res.json({ success: true });
});

module.exports = router;
