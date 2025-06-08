const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;

// Route structurée pour React : catégories > sous-catégories > boutons
router.get('/organises', (req, res) => {
  try {
    const query = `
      SELECT 
        bv.id_bouton,
        bv.nom,
        bv.prix,
        bv.id_cat,
        bv.id_souscat,
        cat1.category AS categorie,
        cat1.color AS color,
        cat2.category AS sous_categorie
      FROM boutons_ventes bv
      LEFT JOIN categories cat1 ON bv.id_cat = cat1.id
      LEFT JOIN categories cat2 ON bv.id_souscat = cat2.id
      ORDER BY cat1.category, cat2.category, bv.nom
    `;

    const stmt = sqlite.prepare(query);
    const results = stmt.all();

    const regroupement = {};
    results.forEach(b => {
      const categorie = b.categorie || 'Autre';
      const sousCategorie = b.sous_categorie || 'Sans sous-catégorie';

      if (!regroupement[categorie]) regroupement[categorie] = {};
      if (!regroupement[categorie][sousCategorie]) regroupement[categorie][sousCategorie] = [];

      regroupement[categorie][sousCategorie].push(b);
    });

    res.json(regroupement);

  } catch (err) {
    console.error("Erreur SQLite : ", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
