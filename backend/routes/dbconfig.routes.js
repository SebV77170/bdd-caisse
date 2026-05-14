const express = require('express');
const router = express.Router();
const { updateMysqlConfig, getMysqlPresets, getMysqlPool, getMysqlConfig } = require('../db');
router.get('/', (req, res) => {
  const conf = getMysqlConfig();
  res.json({
    host: conf.host,
    user: conf.user,
    password: '',
    database: conf.database,
    port: conf.port
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
  const { host, user, password, database, port } = req.body || {};
  if (!host || !user || !database) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  const nextConfig = { host, user, database, port };
  if (password) {
    nextConfig.password = password;
  }
  updateMysqlConfig(nextConfig);
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

router.get('/test', async (req, res) => {
  try {
    const pool = getMysqlPool(); // toujours dynamique
    const connection = await pool.getConnection();
    await connection.query('SELECT 1'); // ✅ test de vie
    connection.release();
    res.json({ success: true });
  } catch (err) {
    const conf = getMysqlConfig();
    console.error('Erreur de connexion MySQL :', err);
    res.status(500).json({
      success: false,
      error: 'Connexion échouée',
      code: err.code,
      host: conf.host,
      port: conf.port
    });
  }
});



module.exports = router;
