// ---------- ventes.routes.js ----------
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;

// Créer une nouvelle vente (retourne un id_temp_vente auto-incrémenté)
router.post('/', (req, res) => {
  try {
    // ✅ Vérifier qu'une session caisse est ouverte
    const session = sqlite.prepare(`
      SELECT * FROM session_caisse WHERE date_fermeture IS NULL
    `).get();

    if (!session) {
      return res.status(403).json({ error: 'Aucune session caisse ouverte. Impossible de commencer une vente.' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = sqlite.prepare('INSERT INTO vente (dateheure) VALUES (?)').run(now);
   
    res.json({ id_temp_vente: result.lastInsertRowid });
  } catch (err) {
    console.error('❌ Erreur SQLite (POST /vente) :', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtenir toutes les ventes
router.get('/', (req, res) => {
  try {
    console.log('📥 Requête GET /api/ventes reçue');
    const rows = sqlite.prepare('SELECT id_temp_vente FROM vente ORDER BY id_temp_vente DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une vente et ses articles
router.delete('/:id_temp_vente', (req, res) => {
  try {
    const id = req.params.id_temp_vente;
    console.log('🗑 Suppression de la vente ID :', id);
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id);
    sqlite.prepare('DELETE FROM vente WHERE id_temp_vente = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
