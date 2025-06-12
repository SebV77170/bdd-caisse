const express = require('express');
const router = express.Router();
const { compareSchemas, applySchemaChanges } = require('../compareSchemas');

router.get('/', async (req, res) => {
  try {
    const result = await compareSchemas();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error comparing schemas:', err);
    res.status(500).json({ success: false, error: 'Erreur comparaison' });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const { mysqlChanges = [], sqliteChanges = [] } = req.body || {};
    await applySchemaChanges(mysqlChanges, sqliteChanges);
    res.json({ success: true });
  } catch (err) {
    console.error('Error applying schema changes:', err);
    res.status(500).json({ success: false, error: 'Erreur application' });
  }
});

module.exports = router;
