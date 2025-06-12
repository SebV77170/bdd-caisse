const express = require('express');
const router = express.Router();
const compareSchemas = require('../compareSchemas');

router.get('/', async (req, res) => {
  try {
    const result = await compareSchemas();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error comparing schemas:', err);
    res.status(500).json({ success: false, error: 'Erreur comparaison' });
  }
});

module.exports = router;
