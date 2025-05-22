// ✅ Mise à jour avec UUID dans validerVente.routes.js
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');;
const fs = require('fs');
const path = require('path');
const session = require('../session');
const logSync = require('../logsync');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { id_temp_vente, reductionType, paiements } = req.body;

  if (!id_temp_vente || !paiements || !Array.isArray(paiements) || paiements.length === 0) {
    return res.status(400).json({ error: 'Informations manquantes ou invalide' });
  }

  const user = session.getUser();
  if (!user) return res.status(401).json({ error: 'Aucun utilisateur connecté' });

  try {
    const articles = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?').all(id_temp_vente);
    if (articles.length === 0) return res.status(400).json({ error: 'Aucun article dans le ticket' });

    const vendeur = user.nom;
    const id_vendeur = user.id;
    const date_achat = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const uuid_ticket = uuidv4();

    let prixTotal = articles.reduce((sum, item) => sum + item.prixt, 0);
    let reducBene = 0, reducClient = 0, reducGrosPanierClient = 0, reducGrosPanierBene = 0;
    let reductionValeurTheorique = 0;
    let reductionValeurReelle = 0;

    const mapReductions = {
      'trueClient': { label: 'Fidélité client', montant: 500 },
      'trueBene': { label: 'Fidélité bénévole', montant: 1000 },
      'trueGrosPanierClient': { label: 'Gros panier client', taux: 0.10 },
      'trueGrosPanierBene': { label: 'Gros panier bénévole', taux: 0.20 }
    };

    if (reductionType && mapReductions[reductionType]) {
      const reduc = mapReductions[reductionType];
      reductionValeurTheorique = reduc.montant || Math.round(prixTotal * reduc.taux);
      reductionValeurReelle = Math.min(prixTotal, reductionValeurTheorique);
      prixTotal -= reductionValeurReelle;
      if (reductionType === 'trueClient') reducClient = 1;
      else if (reductionType === 'trueBene') reducBene = 1;
      else if (reductionType === 'trueGrosPanierClient') reducGrosPanierClient = 1;
      else if (reductionType === 'trueGrosPanierBene') reducGrosPanierBene = 1;
    }

    const moyenGlobal = paiements.length > 1 ? 'mixte' : paiements[0].moyen;

    const result = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
        nbr_objet, moyen_paiement, prix_total, lien,
        reducbene, reducclient, reducgrospanierclient, reducgrospanierbene
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid_ticket, vendeur, id_vendeur, date_achat,
      articles.length, moyenGlobal, prixTotal, '',
      reducBene, reducClient, reducGrosPanierClient, reducGrosPanierBene
    );

    const id_ticket = result.lastInsertRowid;

    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket,
      id_ticket,
      nom_vendeur: vendeur,
      id_vendeur,
      date_achat_dt: date_achat,
      nbr_objet: articles.length,
      moyen_paiement: moyenGlobal,
      prix_total: prixTotal,
      reducbene: reducBene,
      reducclient: reducClient,
      reducgrospanierclient: reducGrosPanierClient,
      reducgrospanierbene: reducGrosPanierBene
    });

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        id_ticket, uuid_objet, nom, nom_vendeur, id_vendeur,
        categorie, souscat, date_achat, timestamp, prix, nbr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((items) => {
      for (const item of items) {
        const uuid_objet = uuidv4();
        insertArticle.run(
          id_ticket, uuid_objet, item.nom, vendeur, id_vendeur,
          item.categorie, item.souscat, date_achat, Math.floor(Date.now() / 1000),
          item.prix, item.nbr
        );
        logSync('objets_vendus', 'INSERT', {
          id_ticket,
          uuid_objet,
          nom: item.nom,
          nom_vendeur: vendeur,
          id_vendeur,
          categorie: item.categorie,
          souscat: item.souscat,
          date_achat,
          timestamp: Math.floor(Date.now() / 1000),
          prix: item.prix,
          nbr: item.nbr
        });
      }
    });
    insertMany(articles);

    if (reductionValeurReelle > 0) {
      const uuid_objet = uuidv4();
      insertArticle.run(
        id_ticket, uuid_objet, `Réduction ${mapReductions[reductionType].label}`, vendeur, id_vendeur,
        'Réduction', `${reductionType} (valeur théorique ${(reductionValeurTheorique / 100).toFixed(2)}€, réelle ${(reductionValeurReelle / 100).toFixed(2)}€)`,
        date_achat, Math.floor(Date.now() / 1000), reductionValeurReelle, -1
      );
      logSync('objets_vendus', 'INSERT', {
        id_ticket,
        uuid_objet,
        nom: 'Réduction',
        nom_vendeur: vendeur,
        id_vendeur,
        categorie: 'Réduction',
        souscat: `${reductionType} (valeur théorique ${(reductionValeurTheorique / 100).toFixed(2)}€, réelle ${(reductionValeurReelle / 100).toFixed(2)}€)`,
        date_achat,
        timestamp: Math.floor(Date.now() / 1000),
        prix: reductionValeurReelle,
        nbr: -1
      });
    }

    const pm = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    const normalisation = {
      'espèces': 'espece', 'espèce': 'espece', 'carte': 'carte',
      'chèque': 'cheque', 'chéque': 'cheque', 'cheque': 'cheque', 'virement': 'virement'
    };

    for (const p of paiements) {
      const champ = normalisation[p.moyen.toLowerCase()] || null;
      if (champ && pm.hasOwnProperty(champ)) pm[champ] += p.montant;
    }

    if (prixTotal > 0) {
      sqlite.prepare(`INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id_ticket, pm.espece, pm.carte, pm.cheque, pm.virement, uuid_ticket);

      logSync('paiement_mixte', 'INSERT', {
        id_ticket,
        uuid_ticket,
        espece: pm.espece,
        carte: pm.carte,
        cheque: pm.cheque,
        virement: pm.virement
      });
    }

    const ticketPath = path.join(__dirname, `../../tickets/Ticket-${uuid_ticket}.txt`);
    let contenu = `RESSOURCE'BRIE\nAssociation loi 1901\nTicket de caisse #${uuid_ticket}\nDate : ${date_achat}\nVendeur : ${vendeur}\n\n`;
    const lignesTicket = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(id_ticket);
    lignesTicket.forEach(a => {
      const ligne = a.nbr > 0
        ? `${a.nbr} x ${a.nom} (${a.categorie}) - ${(a.prix * a.nbr / 100).toFixed(2)}€\n`
        : `${a.nom} (${a.souscat}) : -${(a.prix / 100).toFixed(2)}€\n`;
      contenu += ligne;
    });
    contenu += `\nTOTAL : ${(prixTotal / 100).toFixed(2)}€\nPaiement : ${moyenGlobal}\n`;
    if (reductionValeurReelle > 0) {
      contenu += `Réduction appliquée : ${reductionType}\nValeur théorique : ${(reductionValeurTheorique / 100).toFixed(2)}€, réelle : ${(reductionValeurReelle / 100).toFixed(2)}€\n`;
    }
    contenu += `Merci de votre visite !\n`;
    fs.writeFileSync(ticketPath, contenu, 'utf8');

    sqlite.prepare('UPDATE ticketdecaisse SET lien = ? WHERE id_ticket = ?').run(`tickets/Ticket-${uuid_ticket}.txt`, id_ticket);
    sqlite.prepare('DELETE FROM vente WHERE id_temp_vente = ?').run(id_temp_vente);
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id_temp_vente);

    const today = date_achat.slice(0, 10);
    const poids = articles.reduce((s, a) => s + (a.poids || 0), 0);
    const bilanExistant = sqlite.prepare('SELECT * FROM bilan WHERE date = ?').get(today);

    const totalPaiement = pm.espece + pm.carte + pm.cheque + pm.virement;

    if (bilanExistant) {
      sqlite.prepare(`
        UPDATE bilan SET nombre_vente = nombre_vente + 1,
        poids = poids + ?, prix_total = prix_total + ?,
        prix_total_espece = prix_total_espece + ?,
        prix_total_cheque = prix_total_cheque + ?,
        prix_total_carte = prix_total_carte + ?,
        prix_total_virement = prix_total_virement + ? WHERE date = ?
      `).run(poids, prixTotal, prixTotal === 0 ? 0 : pm.espece, prixTotal === 0 ? 0 : pm.cheque, prixTotal === 0 ? 0 : pm.carte, prixTotal === 0 ? 0 : pm.virement, today);

      logSync('bilan', 'UPDATE', {
        date: today,
        timestamp: Math.floor(Date.now() / 1000),
        nombre_vente: 1,
        poids,
        prix_total: prixTotal,
        prix_total_espece: prixTotal === 0 ? 0 : pm.espece,
        prix_total_cheque: prixTotal === 0 ? 0 : pm.cheque,
        prix_total_carte: prixTotal === 0 ? 0 : pm.carte,
        prix_total_virement: prixTotal === 0 ? 0 : pm.virement
      });

    } else {
      sqlite.prepare(`
        INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(today, Math.floor(Date.now() / 1000), 1, poids, prixTotal, prixTotal === 0 ? 0 : pm.espece, prixTotal === 0 ? 0 : pm.cheque, prixTotal === 0 ? 0 : pm.carte, prixTotal === 0 ? 0 : pm.virement);

      logSync('bilan', 'INSERT', {
        date: today,
        timestamp: Math.floor(Date.now() / 1000),
        nombre_vente: 1,
        poids,
        prix_total: prixTotal,
        prix_total_espece: prixTotal === 0 ? 0 : pm.espece,
        prix_total_cheque: prixTotal === 0 ? 0 : pm.cheque,
        prix_total_carte: prixTotal === 0 ? 0 : pm.carte,
        prix_total_virement: prixTotal === 0 ? 0 : pm.virement
      });
    }

    res.json({ success: true, id_ticket, uuid_ticket });
  } catch (err) {
    console.error('Erreur validation :', err.message);
    res.status(500).json({ error: err.message });
  }

  const io = req.app.get('socketio');
  if (io) io.emit('bilanUpdated');
});

module.exports = router;

