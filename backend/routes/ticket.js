const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;

// Récupérer le ticket en cours
router.get('/', (req, res) => {
  try {
    const rows = sqlite.prepare('SELECT * FROM ticketdecaissetemp').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un produit au ticket en cours
router.post('/', (req, res) => {
  const { id_produit, quantite = 1 } = req.body;
  try {
    const produit = sqlite.prepare(`
      SELECT b.nom, c1.category AS categorie, c2.category AS souscat, b.prix
      FROM boutons_ventes b
      LEFT JOIN categories c1 ON b.id_cat = c1.id
      LEFT JOIN categories c2 ON b.id_souscat = c2.id
      WHERE b.id_bouton = ?
    `).get(id_produit);

    if (!produit) return res.status(404).json({ error: 'Produit introuvable' });

    sqlite.prepare(`
      INSERT INTO ticketdecaissetemp (id_temp_vente, id_vendeur, nom_vendeur, nom, categorie, souscat, prix, nbr, prixt)
      VALUES (0, 0, 'inconnu', ?, ?, ?, ?, ?, ?)
    `).run(
      produit.nom,
      produit.categorie,
      produit.souscat,
      produit.prix,
      quantite,
      produit.prix * quantite
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un produit du ticket en cours
router.delete('/:id', (req, res) => {
  try {
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modifier un champ
router.put('/:id', (req, res) => {
  const { champ, valeur } = req.body;
  const id = req.params.id;
  if (!['nbr', 'prix'].includes(champ)) {
    return res.status(400).json({ error: 'Champ modifiable invalide.' });
  }

  try {
    sqlite.prepare(`UPDATE ticketdecaissetemp SET ${champ} = ? WHERE id = ?`).run(valeur, id);
    sqlite.prepare(`UPDATE ticketdecaissetemp SET prixt = prix * nbr WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;