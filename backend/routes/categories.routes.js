const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');

// Retourne toutes les catégories
router.get('/', (req, res) => {
  try {
    const rows = sqlite.prepare('SELECT id, parent_id, category FROM categories').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
