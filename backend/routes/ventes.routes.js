// ---------- ventes.routes.js ----------
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');

// Créer une nouvelle vente (retourne un id_temp_vente auto-incrémenté)
router.post('/', (req, res) => {
  try {
    // ✅ Vérifier qu'une session caisse est ouverte (schéma UTC)
    const session = sqlite.prepare(`
      SELECT * FROM session_caisse WHERE closed_at_utc IS NULL
    `).get();

    if (!session) {
      return res.status(403).json({ error: 'Aucune session caisse ouverte. Impossible de commencer une vente.' });
    }

    // Horodatage en UTC (même format que le reste de l’app : "YYYY-MM-DD HH:mm:ss")
    const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = sqlite
      .prepare('INSERT INTO vente (dateheure) VALUES (?)')
      .run(nowUtc);

    res.json({ id_temp_vente: result.lastInsertRowid });
  } catch (err) {
    console.error('❌ Erreur SQLite (POST /vente) :', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtenir toutes les ventes
router.get('/', (req, res) => {
  try {
    const rows = sqlite
      .prepare('SELECT id_temp_vente FROM vente ORDER BY id_temp_vente DESC')
      .all();
    res.json(rows);
  } catch (err) {
    console.error('❌ Erreur SQLite (GET /ventes) :', err);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une vente et ses articles
router.delete('/:id_temp_vente', (req, res) => {
  try {
    const id = req.params.id_temp_vente;
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id);
    sqlite.prepare('DELETE FROM vente WHERE id_temp_vente = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erreur SQLite (DELETE /ventes/:id) :', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
