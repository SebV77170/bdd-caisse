const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');

// Récupérer tous les boutons avec info de catégorie
router.get('/', (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT bv.id_bouton, bv.nom, bv.prix, bv.id_cat, bv.id_souscat,
             cat1.category AS categorie, cat2.category AS sous_categorie
      FROM boutons_ventes bv
      LEFT JOIN categories cat1 ON bv.id_cat = cat1.id
      LEFT JOIN categories cat2 ON bv.id_souscat = cat2.id
      ORDER BY bv.id_bouton
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Erreur SQLite :', err);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un bouton
router.post('/', (req, res) => {
  const { nom, prix, id_cat, id_souscat } = req.body || {};
  if (!nom || typeof prix !== 'number') {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  try {
    const info = sqlite.prepare(
      'INSERT INTO boutons_ventes (nom, prix, id_cat, id_souscat) VALUES (?, ?, ?, ?)'
    ).run(nom, prix, id_cat || null, id_souscat || null);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modifier un bouton
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nom, prix, id_cat, id_souscat } = req.body || {};
  if (!nom || typeof prix !== 'number') {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  try {
    sqlite.prepare(
      'UPDATE boutons_ventes SET nom = ?, prix = ?, id_cat = ?, id_souscat = ? WHERE id_bouton = ?'
    ).run(nom, prix, id_cat || null, id_souscat || null, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un bouton
router.delete('/:id', (req, res) => {
  try {
    sqlite.prepare('DELETE FROM boutons_ventes WHERE id_bouton = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
