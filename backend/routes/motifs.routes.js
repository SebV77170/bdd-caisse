const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');

// Récupérer tous les motifs
router.get('/', (req, res) => {
  try {
    const rows = sqlite.prepare('SELECT id, motif FROM motifs_correction ORDER BY id').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un motif
router.post('/', (req, res) => {
  const { motif } = req.body || {};
  if (!motif || !motif.trim()) {
    return res.status(400).json({ error: 'Motif manquant' });
  }
  try {
    const stmt = sqlite.prepare('INSERT INTO motifs_correction (motif) VALUES (?)');
    const info = stmt.run(motif.trim());
    res.json({ id: info.lastInsertRowid, motif: motif.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer des motifs
router.delete('/', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Ids manquants' });
  }
  const placeholders = ids.map(() => '?').join(',');
  try {
    const stmt = sqlite.prepare(`DELETE FROM motifs_correction WHERE id IN (${placeholders})`);
    stmt.run(...ids);
    res.json({ deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
