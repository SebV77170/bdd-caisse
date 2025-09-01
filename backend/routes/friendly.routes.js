const express = require('express');
const router = express.Router();
const { getFriendlyIdFromUuid } = require('../utils/genererFriendlyIds');

// 🔹 Récupère 1 seul friendly id
router.get('/:uuid', (req, res) => {
  try {
    const { uuid } = req.params;
    if (!uuid) return res.status(400).json({ error: 'UUID manquant' });

    const friendly = getFriendlyIdFromUuid(uuid);
    if (!friendly) {
      return res.status(404).json({ error: 'Aucun friendly id trouvé' });
    }

    return res.json({ uuid, friendly });
  } catch (e) {
    console.error('Erreur get friendly id:', e);
    return res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// 🔹 Récupère plusieurs friendly ids en une requête
router.post('/batch', (req, res) => {
  try {
    const { uuids } = req.body || {};
    if (!Array.isArray(uuids)) {
      return res.status(400).json({ error: 'Format attendu: { uuids: string[] }' });
    }

    const results = uuids.map((u) => ({
      uuid: u,
      friendly: getFriendlyIdFromUuid(u) || null,
    }));

    return res.json({ items: results });
  } catch (e) {
    console.error('Erreur batch friendly ids:', e);
    return res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

module.exports = router;
