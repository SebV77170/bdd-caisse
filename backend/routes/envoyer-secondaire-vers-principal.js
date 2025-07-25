const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const fetch = require('node-fetch'); // npm i node-fetch
const { getConfig } = require('../principalIpConfig');

router.post('/', async (req, res) => {
  try {
    const lignes = sqlite
      .prepare('SELECT * FROM sync_log WHERE senttoprincipal = 0 ORDER BY id')
      .all();

    if (!lignes.length) {
      return res.json({ success: true, message: 'Aucune donnée à envoyer.' });
    }

    // 1. Demande d’autorisation à la caisse principale
    const { ip } = getConfig();
    const baseUrl = `http://${ip}:3001`;
    const demande = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/demande`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: lignes })
    });

    const reponseDemande = await demande.json();
    if (!demande.ok) {
      return res.status(500).json({ success: false, message: 'Erreur pendant la demande.', erreur: reponseDemande.message });
    }

    // 2. Attente d’une réponse du /valider (idéalement websocket ou polling)
    // Ici on simplifie avec un delay de test (à remplacer par une vraie attente côté front)
    const attenteValidation = await fetch(`${baseUrl}/api/sync/recevoir-de-secondaire/attente-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const resultatValidation = await attenteValidation.json();

    if (!resultatValidation.success) {
      return res.status(400).json({ success: false, message: 'La caisse principale a refusé la synchronisation.' });
    }

    const idsValides = resultatValidation.ids || [];

    // 3. Marque les lignes comme envoyées
    const update = sqlite.prepare('UPDATE sync_log SET senttoprincipal = 1 WHERE id = ?');
    const transaction = sqlite.transaction((ids) => {
      for (const id of ids) update.run(id);
    });
    transaction(idsValides);

    res.json({ success: true, message: `${idsValides.length} lignes envoyées et validées.`, ids: idsValides });

  } catch (err) {
    console.error('Erreur envoi vers principale :', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.', erreur: err.message });
  }
});

module.exports = router;
