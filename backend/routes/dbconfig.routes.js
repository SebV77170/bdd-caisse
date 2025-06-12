const express = require('express');
const router = express.Router();
const { updateMysqlConfig } = require('../db');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../dbConfig.json');

router.get('/', (req, res) => {
  if (fs.existsSync(configPath)) {
    const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(conf);
  } else {
    res.json({ host: 'localhost', user: 'root', password: '', database: 'objets' });
  }
});

router.post('/', (req, res) => {
  const { host, user, password, database } = req.body || {};
  if (!host || !user || !database) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  updateMysqlConfig({ host, user, password, database });
  res.json({ success: true });
});

module.exports = router;
