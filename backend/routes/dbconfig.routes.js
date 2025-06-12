const express = require('express');
const router = express.Router();
const { updateMysqlConfig, getMysqlPresets } = require('../db');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../dbConfig.json');

router.get('/', (req, res) => {
  let conf;
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      conf = {};
    }
  } else {
    conf = {};
  }
  res.json({
    host: conf.host || process.env.MYSQL_HOST || 'localhost',
    user: conf.user || process.env.MYSQL_USER || 'root',
    password: '',
    database: conf.database || process.env.MYSQL_DB || 'objets'
  });
});

router.get('/preset', (req, res) => {
  res.json({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: '',
    database: process.env.MYSQL_DB || 'objets'
  });
});

router.get('/presets', (req, res) => {
  const presets = getMysqlPresets().map(p => ({
    name: p.name,
    host: p.host,
    user: p.user,
    database: p.database
  }));
  res.json(presets);
});

router.post('/', (req, res) => {
  const { host, user, password, database } = req.body || {};
  if (!host || !user || !database) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  updateMysqlConfig({ host, user, password, database });
  res.json({ success: true });
});

router.post('/preset', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const preset = getMysqlPresets().find(p => p.name === name.toLowerCase());
  if (!preset) return res.status(404).json({ error: 'Preset introuvable' });
  updateMysqlConfig({
    host: preset.host,
    user: preset.user,
    password: preset.password,
    database: preset.database
  });
  res.json({ success: true });
});

module.exports = router;
