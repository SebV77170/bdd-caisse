const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

router.post('/', (req, res) => {
  const { id_temp_vente, reductionType, moyenPaiement } = req.body;

  if (!id_temp_vente || !moyenPaiement) {
    return res.status(400).json({ error: 'Informations manquantes' });
  }

  try {
    const articles = db.prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?').all(id_temp_vente);
    if (articles.length === 0) return res.status(400).json({ error: 'Aucun article dans le ticket' });

    const totalInitial = articles.reduce((sum, item) => sum + item.prixt, 0);
    let prixTotal = totalInitial;
    let reducBene = 0, reducClient = 0, reducGrosPanierClient = 0, reducGrosPanierBene = 0;

    if (reductionType === 'trueClient')      { prixTotal -= 500; reducClient = 1; }
    else if (reductionType === 'trueBene')   { prixTotal -= 1000; reducBene = 1; }
    else if (reductionType === 'trueGrosPanierClient') { prixTotal = Math.round(prixTotal * 0.9); reducGrosPanierClient = 1; }
    else if (reductionType === 'trueGrosPanierBene')   { prixTotal = Math.round(prixTotal * 0.8); reducGrosPanierBene = 1; }

    if (prixTotal < 0) prixTotal = 0;

    const vendeur = 'Inconnu';
    const id_vendeur = 1;
    const date_achat = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const insertVente = db.prepare(`
      INSERT INTO ticketdecaisse (nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertVente.run(vendeur, id_vendeur, date_achat, articles.length, moyenPaiement, prixTotal, '', reducBene, reducClient, reducGrosPanierClient, reducGrosPanierBene);
    const id_ticket = result.lastInsertRowid;

    const insertArticle = db.prepare(`
      INSERT INTO objets_vendus (id_ticket, nom, nom_vendeur, id_vendeur, categorie, souscat, date_achat, timestamp, prix, nbr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertArticle.run(id_ticket, item.nom, vendeur, id_vendeur, item.categorie, item.souscat, date_achat, Math.floor(Date.now() / 1000), item.prix, item.nbr);
      }
    });
    insertMany(articles);

    const ticketPath = path.join(__dirname, `../../tickets/Ticket${id_ticket}.txt`);
    let contenu = `RESSOURCE'BRIE\nAssociation loi 1901\nTicket de caisse #${id_ticket}\nDate : ${date_achat}\nVendeur : ${vendeur}\n\n`;
    articles.forEach(a => {
      contenu += `${a.nbr} x ${a.nom} (${a.categorie}) - ${(a.prix * a.nbr / 100).toFixed(2)}€\n`;
    });
    contenu += `\nTOTAL : ${(prixTotal / 100).toFixed(2)}€\nMoyen de paiement : ${moyenPaiement}\nMerci de votre visite !\n`;
    fs.writeFileSync(ticketPath, contenu, 'utf8');

    db.prepare('UPDATE ticketdecaisse SET lien = ? WHERE id_ticket = ?').run(`tickets/Ticket${id_ticket}.txt`, id_ticket);
    db.prepare('DELETE FROM vente WHERE id_temp_vente = ?').run(id_temp_vente);
    db.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id_temp_vente);

    // 🔁 Mise à jour ou insertion dans la table bilan
    const today = new Date().toISOString().slice(0, 10);
    const poids = articles.reduce((s, a) => s + (a.poids || 0), 0);
    const bilanExistant = db.prepare('SELECT * FROM bilan WHERE date = ?').get(today);

    const normalisation = {
      "espèces": "espece",
      "espèce": "espece",
      "espèce ": "espece",
      "chèque": "cheque",
      "carte": "carte",
      "virement": "virement",
      "espece": "espece",
      "cheque": "cheque"
    };

    const paiementNettoye = normalisation[moyenPaiement.toLowerCase()] || moyenPaiement.toLowerCase();
    const champPaiement = `prix_total_${paiementNettoye}`;

    if (bilanExistant) {
      db.prepare(`
        UPDATE bilan
        SET
          nombre_vente = nombre_vente + 1,
          poids = poids + ?,
          prix_total = prix_total + ?,
          ${champPaiement} = COALESCE(${champPaiement}, 0) + ?
        WHERE date = ?
      `).run(poids, prixTotal, prixTotal, today);
    } else {
      const champs = ["prix_total_espece", "prix_total_cheque", "prix_total_carte", "prix_total_virement"];
      const valeurs = champs.map(c => c === champPaiement ? prixTotal : 0);
      db.prepare(`
        INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, ${champs.join(", ")})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(today, Math.floor(Date.now() / 1000), 1, poids, prixTotal, ...valeurs);
    }

    res.json({ success: true, id_ticket });
  } catch (err) {
    console.error('Erreur validation :', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
