const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;

// Ajouter un article au ticket
router.post('/', (req, res) => {
  const { id_produit, quantite, id_temp_vente } = req.body;
  console.log('🎯 POST /api/ticket reçu');
console.log('🧾 Corps de requête :', req.body);

  try {
    const produit = sqlite.prepare(`
      SELECT bv.nom, cat1.category AS categorie, cat2.category AS souscat, bv.prix
      FROM boutons_ventes bv
      LEFT JOIN categories cat1 ON bv.id_cat = cat1.id
      LEFT JOIN categories cat2 ON bv.id_souscat = cat2.id
      WHERE bv.id_bouton = ?
    `).get(id_produit);

    if (!produit) return res.status(404).json({ error: 'Produit introuvable' });

    sqlite.prepare(`
      INSERT INTO ticketdecaissetemp (id_temp_vente, nom, categorie, souscat, prix, nbr, prixt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_temp_vente,
      produit.nom,
      produit.categorie,
      produit.souscat,
      produit.prix,
      quantite,
      produit.prix * quantite
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lire les articles d'un ticket
router.get('/:id_temp_vente', (req, res) => {
  try {
    const rows = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?').all(req.params.id_temp_vente);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un article
router.delete('/:id', (req, res) => {
  try {
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const id = req.params.id;
  const champsAutorisés = ['prix', 'nbr'];
  const modifications = req.body;

  const champs = Object.keys(modifications).filter(c => champsAutorisés.includes(c));

  if (champs.length === 0) {
    return res.status(400).json({ error: 'Aucun champ modifiable fourni' });
  }

  const dbUpdate = sqlite.transaction(() => {
    champs.forEach(champ => {
      const valeur = modifications[champ];
      sqlite.prepare(`UPDATE ticketdecaissetemp SET ${champ} = ? WHERE id = ?`).run(valeur, id);
    });

    // Recalcul du prixt
    sqlite.prepare(`UPDATE ticketdecaissetemp SET prixt = prix * nbr WHERE id = ?`).run(id);
  });

  try {
    dbUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;