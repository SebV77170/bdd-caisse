const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');

// -- helper: sécurise les types
const toIntOrNull = v => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const isNumber = v => typeof v === 'number' && Number.isFinite(v);

// -- helper: récupère le libellé de sous-catégorie
function getSousCategorieLabel(id_souscat) {
  if (!id_souscat) return null;
  const row = sqlite.prepare('SELECT category FROM categories WHERE id = ?').get(id_souscat);
  return row ? row.category : null;
}

/**
 * GET /api/boutons
 * renvoie la liste avec les libellés de catégories + sous-cat (via JOIN)
 */
router.get('/', (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT
        bv.id_bouton,
        bv.nom,
        bv.prix,
        bv.id_cat,
        bv.id_souscat,
        -- texte stocké pour affichage immédiat (si tu le gardes)
        bv.sous_categorie,
        cat1.category AS categorie,
        cat2.category AS sous_categorie_join
      FROM boutons_ventes bv
      LEFT JOIN categories cat1 ON bv.id_cat = cat1.id
      LEFT JOIN categories cat2 ON bv.id_souscat = cat2.id
      ORDER BY bv.id_bouton
    `).all();

    // on normalise un champ "sous_categorie_affichee"
    const out = rows.map(r => ({
      ...r,
      sous_categorie_affichee: r.sous_categorie || r.sous_categorie_join || null
    }));
    res.json(out);
  } catch (err) {
    console.error('Erreur SQLite GET /api/boutons :', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/boutons
 * body: { nom, prix (centimes), id_cat?, id_souscat?, sous_categorie? }
 */
router.post('/', (req, res) => {
  try {
    const { nom } = req.body || {};
    let { prix, id_cat, id_souscat, sous_categorie } = req.body || {};

    if (!nom) return res.status(400).json({ error: 'nom requis' });
    if (!isNumber(prix)) return res.status(400).json({ error: 'prix (centimes) requis (number)' });

    id_cat = toIntOrNull(id_cat);
    id_souscat = toIntOrNull(id_souscat);

    // si le front n’envoie pas sous_categorie mais envoie id_souscat,
    // on remplit automatiquement depuis categories
    if (!sous_categorie) {
      sous_categorie = getSousCategorieLabel(id_souscat);
    }

    const info = sqlite.prepare(`
      INSERT INTO boutons_ventes (nom, prix, id_cat, id_souscat, sous_categorie)
      VALUES (?, ?, ?, ?, ?)
    `).run(nom, prix, id_cat, id_souscat, sous_categorie);

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('Erreur SQLite POST /api/boutons :', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/boutons/:id
 * body: { nom, prix (centimes), id_cat?, id_souscat?, sous_categorie? }
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nom } = req.body || {};
    let { prix, id_cat, id_souscat, sous_categorie } = req.body || {};

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id invalide' });
    if (!nom) return res.status(400).json({ error: 'nom requis' });
    if (!isNumber(prix)) return res.status(400).json({ error: 'prix (centimes) requis (number)' });

    id_cat = toIntOrNull(id_cat);
    id_souscat = toIntOrNull(id_souscat);

    // si rien d’explicite, recalcule depuis la table categories
    if (sous_categorie === undefined || sous_categorie === null || sous_categorie === '') {
      sous_categorie = getSousCategorieLabel(id_souscat);
    }

    sqlite.prepare(`
      UPDATE boutons_ventes
         SET nom = ?, prix = ?, id_cat = ?, id_souscat = ?, sous_categorie = ?
       WHERE id_bouton = ?
    `).run(nom, prix, id_cat, id_souscat, sous_categorie, id);

    res.json({ success: true });
  } catch (err) {
    console.error('Erreur SQLite PUT /api/boutons/:id :', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/boutons/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id invalide' });

    sqlite.prepare('DELETE FROM boutons_ventes WHERE id_bouton = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur SQLite DELETE /api/boutons/:id :', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
