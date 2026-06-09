const express = require('express');
const router = express.Router();
const { getConfig, updateConfig } = require('../principalIpConfig');
const fetch = require('node-fetch');

function normalizeIp(value) {
  return String(value || '').trim();
}

async function testPrincipalConnection(ip, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `http://${ip}:3001/api/sync/recevoir-de-secondaire/status`,
      { signal: controller.signal }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.role !== 'caisse-principale') {
      throw new Error("L'appareil contacté n'est pas reconnu comme caisse principale.");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', (req, res) => {
  res.json(getConfig());
});

router.post('/', (req, res) => {
  const ip = normalizeIp(req.body?.ip);
  if (!ip) return res.status(400).json({ error: 'IP manquante' });
  updateConfig(ip);
  res.json({ success: true });
});

router.post('/test', async (req, res) => {
  const ip = normalizeIp(req.body?.ip || getConfig().ip);
  if (!ip) return res.status(400).json({ success: false, error: 'IP manquante' });

  try {
    const remote = await testPrincipalConnection(ip);
    res.json({
      success: true,
      ip,
      message: `Caisse principale détectée à l'adresse ${ip}.`,
      remote
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      ip,
      error: `Impossible de joindre une caisse principale à l'adresse ${ip}.`,
      details: error.name === 'AbortError' ? 'Délai de connexion dépassé.' : error.message
    });
  }
});

router.post('/test-and-save', async (req, res) => {
  const ip = normalizeIp(req.body?.ip);
  if (!ip) return res.status(400).json({ success: false, error: 'IP manquante' });

  try {
    await testPrincipalConnection(ip);
    updateConfig(ip);
    res.json({
      success: true,
      ip,
      message: `Adresse ${ip} vérifiée et enregistrée.`
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      ip,
      error: `L'adresse ${ip} n'a pas été enregistrée car la caisse principale ne répond pas.`,
      details: error.name === 'AbortError' ? 'Délai de connexion dépassé.' : error.message
    });
  }
});

module.exports = router;
