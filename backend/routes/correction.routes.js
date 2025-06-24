// routes/correction.routes.js
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const session = require('../session');
const fs = require('fs');
const path = require('path');
const logSync = require('../logsync');
const { v4: uuidv4 } = require('uuid');
const genererTicketPdf = require('../utils/genererTicketPdf');
const {genererFriendlyIds} = require('../utils/genererFriendlyIds');

router.post('/', (req, res) => {
  const user = session.getUser();
  if (!user) return res.status(401).json({ error: 'Aucun utilisateur connecté' });

  const {
    id_ticket_original,
    uuid_ticket_original,
    articles_origine,
    articles_correction,
    motif,
    uuid_session_caisse,
    reductionType,
    paiements = []
  } = req.body;

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const timestamp = Math.floor(Date.now() / 1000);
  const utilisateur = user.nom;
  const id_vendeur = user.id;

  const transaction = sqlite.transaction(() => {
    const articles_sans_reduction = [...articles_origine];
    let articles_correction_sans_reduction = articles_correction.filter(a => a.categorie !== 'Réduction');

    let reductionArticle = null;
    let reducBene = 0, reducClient = 0, reducGrosPanierClient = 0, reducGrosPanierBene = 0;

    if (reductionType === 'trueClient') {
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Fidélité Client', prix: -500, nbr: 1, categorie: 'Réduction' };
      reducClient = 1;
    } else if (reductionType === 'trueBene') {
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Fidélité Bénévole', prix: -1000, nbr: 1, categorie: 'Réduction' };
      reducBene = 1;
    } else if (reductionType === 'trueGrosPanierClient') {
      const montantAvantReduc = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
      const reducMontant = Math.round(montantAvantReduc * 0.1);
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Gros Panier Client (-10%)', prix: -reducMontant, nbr: 1, categorie: 'Réduction' };
      reducGrosPanierClient = 1;
    } else if (reductionType === 'trueGrosPanierBene') {
      const montantAvantReduc = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
      const reducMontant = Math.round(montantAvantReduc * 0.2);
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Gros Panier Bénévole (-20%)', prix: -reducMontant, nbr: 1, categorie: 'Réduction' };
      reducGrosPanierBene = 1;
    }

    if (reductionArticle) {
      articles_correction_sans_reduction.push(reductionArticle);
    }

    let prixTotal = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
    if (prixTotal < 0) prixTotal = 0;

    let totalAnnulation = articles_sans_reduction.reduce((sum, a) => sum + a.prix * (-(a.nbr)), 0);
    if (totalAnnulation > 0) totalAnnulation = 0;

    const ticketOriginalData = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket_original);
    if (!ticketOriginalData) {
      throw new Error(`Ticket original #${uuid_ticket_original} introuvable pour correction.`);
    }

    const paiementsOriginauxMixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE uuid_ticket = ?').get(uuid_ticket_original);

    let pmAnnul = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    if (paiementsOriginauxMixte) {
      pmAnnul = {
        espece: paiementsOriginauxMixte.espece || 0,
        carte: paiementsOriginauxMixte.carte || 0,
        cheque: paiementsOriginauxMixte.cheque || 0,
        virement: paiementsOriginauxMixte.virement || 0
      };
    } else if (ticketOriginalData.moyen_paiement) {
      const moyen = ticketOriginalData.moyen_paiement.toLowerCase();
      const prixTotalOriginal = ticketOriginalData.prix_total;
      if (moyen === 'espèces') pmAnnul.espece = prixTotalOriginal;
      if (moyen === 'carte') pmAnnul.carte = prixTotalOriginal;
      if (moyen === 'chèque') pmAnnul.cheque = prixTotalOriginal;
      if (moyen === 'virement') pmAnnul.virement = prixTotalOriginal;
    }

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        uuid_ticket, nom, prix, nbr, categorie,
        nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const uuid_ticket_annul = uuidv4();
    genererFriendlyIds(uuid_ticket_annul, 'annulation');

    const annul = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, annulation_de, flag_annulation, nom_vendeur, id_vendeur,
        nbr_objet, prix_total, moyen_paiement, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(now, uuid_ticket_original, utilisateur, id_vendeur, articles_sans_reduction.length, totalAnnulation, ticketOriginalData.moyen_paiement || 'mixte', uuid_ticket_annul, uuid_session_caisse);
    const id_annul = uuid_ticket_annul;

    for (const art of articles_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(id_annul, art.nom, art.prix, -(art.nbr), art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
    }

    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id_annul, -pmAnnul.espece, -pmAnnul.carte, -pmAnnul.cheque, -pmAnnul.virement, uuid_ticket_annul);

    let paiementType = 'mixte';
    if (paiements.length === 1) paiementType = paiements[0]?.moyen || null;
    if (paiements.length === 0) paiementType = null;

    const uuid_ticket_corrige = uuidv4();
    genererFriendlyIds(uuid_ticket_corrige, 'correction');

    const correc = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement,
        reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, flag_correction, corrige_le_ticket, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(now, utilisateur, id_vendeur, articles_correction_sans_reduction.length, prixTotal, paiementType,
      reducBene, reducClient, reducGrosPanierClient, reducGrosPanierBene, 1, uuid_ticket_original, uuid_ticket_corrige, uuid_session_caisse);
    const id_corrige = uuid_ticket_corrige;

    for (const art of articles_correction_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(id_corrige, art.nom, art.prix, art.nbr, art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
    }

    const pm = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    const normalisation = {
      'espèce': 'espece', 'espèces': 'espece', 'carte': 'carte',
      'chèque': 'cheque', 'chéque': 'cheque', 'cheque': 'cheque', 'virement': 'virement'
    };
    for (const p of paiements) {
      const champ = normalisation[p.moyen?.toLowerCase()] || null;
      if (champ && pm.hasOwnProperty(champ)) {
        pm[champ] += p.montant;
      }
    }

    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id_corrige, pm.espece, pm.carte, pm.cheque, pm.virement, uuid_ticket_corrige);

    const bilanExistant = sqlite.prepare('SELECT * FROM bilan WHERE date = ?').get(today);

    if (bilanExistant) {
      sqlite.prepare(`
        UPDATE bilan
        SET prix_total = prix_total - ? + ?,
            prix_total_espece = prix_total_espece - ? + ?,
            prix_total_cheque = prix_total_cheque - ? + ?,
            prix_total_carte = prix_total_carte - ? + ?,
            prix_total_virement = prix_total_virement - ? + ?
        WHERE date = ?
      `).run(
        ticketOriginalData.prix_total, prixTotal,
        pmAnnul.espece, pm.espece,
        pmAnnul.cheque, pm.cheque,
        pmAnnul.carte, pm.carte,
        pmAnnul.virement, pm.virement,
        today
      );
    } else {
      sqlite.prepare(`
        INSERT INTO bilan (
          date, timestamp, nombre_vente, poids, prix_total,
          prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        today, timestamp, 1, 0,
        prixTotal - ticketOriginalData.prix_total,
        pm.espece - pmAnnul.espece,
        pm.cheque - pmAnnul.cheque,
        pm.carte - pmAnnul.carte,
        pm.virement - pmAnnul.virement
      );
    }

    sqlite.prepare(`
      INSERT INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(now, uuid_ticket_original, id_annul, id_corrige, utilisateur, motif);

    return { id_annul, id_corrige, uuid_ticket_annul, uuid_ticket_corrige };
  });

  try {
    const { id_annul, id_corrige, uuid_ticket_annul, uuid_ticket_corrige } = transaction();

    genererTicketPdf(uuid_ticket_annul);
    genererTicketPdf(uuid_ticket_corrige);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('bilanUpdated');
      io.emit('ticketsmisajour');
    }

    res.json({ success: true, id_ticket_annulation: id_annul, id_ticket_correction: id_corrige });
  } catch (err) {
    console.error("Erreur lors de l'insertion de la correction :", err);
    res.status(500).json({ error: "Erreur lors de l'insertion de la correction" });
  }
});

router.post('/:uuid/supprimer', (req, res) => {
  const uuid = req.params.uuid;
  const now = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000);

  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid);
  if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

  const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(uuid);
  const totalAnnulation = -Math.abs(ticket.prix_total);
  const uuid_ticket_annul = uuidv4();
  genererFriendlyIds(uuid_ticket_annul, 'annulation');

  const paiementsOriginalMixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE uuid_ticket = ?').get(uuid);
  let pmAnnul = { espece: 0, carte: 0, cheque: 0, virement: 0 };

  if (paiementsOriginalMixte) {
    pmAnnul = {
      espece: paiementsOriginalMixte.espece || 0,
      carte: paiementsOriginalMixte.carte || 0,
      cheque: paiementsOriginalMixte.cheque || 0,
      virement: paiementsOriginalMixte.virement || 0
    };
  } else if (ticket.moyen_paiement) {
    const moyen = ticket.moyen_paiement.toLowerCase();
    const prix = ticket.prix_total;
    if (moyen === 'espèces') pmAnnul.espece = prix;
    if (moyen === 'carte') pmAnnul.carte = prix;
    if (moyen === 'chèque') pmAnnul.cheque = prix;
    if (moyen === 'virement') pmAnnul.virement = prix;
  }

  const transaction = sqlite.transaction(() => {
    const annul = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, annulation_de, flag_annulation, nom_vendeur, id_vendeur,
        nbr_objet, prix_total, moyen_paiement, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      now, ticket.uuid_ticket, ticket.nom_vendeur, ticket.id_vendeur,
      objets.length, totalAnnulation, ticket.moyen_paiement || 'mixte', uuid_ticket_annul, ticket.uuid_session_caisse
    );
    const id_annul = uuid_ticket_annul;

    genererTicketPdf(uuid_ticket_annul);

    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_annul,
      id_ticket: id_annul,
      date_achat_dt: now,
      annulation_de: ticket.id_ticket,
      flag_annulation: 1,
      nom_vendeur: ticket.nom_vendeur,
      id_vendeur: ticket.id_vendeur,
      nbr_objet: objets.length,
      prix_total: totalAnnulation,
      moyen_paiement: ticket.moyen_paiement || 'mixte',
      reducbene: ticket.reducbene || 0,
      reducclient: ticket.reducclient || 0,
      reducgrospanierclient: ticket.reducgrospanierclient || 0,
      reducgrospanierbene: ticket.reducgrospanierbene || 0,
      uuid_session_caisse: ticket.uuid_session_caisse
    });

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        uuid_ticket, nom, prix, nbr, categorie,
        nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const obj of objets) {
      const uuid_objet = uuidv4();
      insertArticle.run(
        id_annul, obj.nom, obj.prix, -obj.nbr, obj.categorie,
        ticket.nom_vendeur, ticket.id_vendeur, now, timestamp, uuid_objet
      );
      logSync('objets_vendus', 'INSERT', {
        id_ticket: id_annul,
        nom: obj.nom,
        prix: obj.prix,
        nbr: -obj.nbr,
        categorie: obj.categorie,
        nom_vendeur: ticket.nom_vendeur,
        id_vendeur: ticket.id_vendeur,
        date_achat: now,
        timestamp,
        uuid_objet
      });
    }

    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id_annul,
      -pmAnnul.espece,
      -pmAnnul.carte,
      -pmAnnul.cheque,
      -pmAnnul.virement,
      uuid_ticket_annul
    );
    logSync('paiement_mixte', 'INSERT', {
      id_ticket: id_annul,
      uuid_ticket: uuid_ticket_annul,
      espece: -pmAnnul.espece,
      carte: -pmAnnul.carte,
      cheque: -pmAnnul.cheque,
      virement: -pmAnnul.virement
    });

    const today = now.slice(0, 10);
    const bilan = sqlite.prepare('SELECT * FROM bilan WHERE date = ?').get(today);
    if (bilan) {
      sqlite.prepare(`
        UPDATE bilan SET
          prix_total = prix_total + ?,
          prix_total_espece = prix_total_espece + ?,
          prix_total_carte = prix_total_carte + ?,
          prix_total_cheque = prix_total_cheque + ?,
          prix_total_virement = prix_total_virement + ?
        WHERE date = ?
      `).run(
        totalAnnulation,
        -pmAnnul.espece,
        -pmAnnul.carte,
        -pmAnnul.cheque,
        -pmAnnul.virement,
        today
      );
      logSync('bilan', 'UPDATE', {
        date: today,
        timestamp,
        prix_total: totalAnnulation,
        prix_total_espece: -pmAnnul.espece,
        prix_total_carte: -pmAnnul.carte,
        prix_total_cheque: -pmAnnul.cheque,
        prix_total_virement: -pmAnnul.virement
      });
    }

    sqlite.prepare(`
      INSERT INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif)
      VALUES (?, ?, ?, NULL, ?, 'Suppression demandée')
    `).run(now, ticket.uuid_ticket, id_annul, ticket.nom_vendeur);
    logSync('journal_corrections', 'INSERT', {
      date_correction: now,
      uuid_ticket_original: ticket.uuid_ticket,
      uuid_ticket_annulation: id_annul,
      uuid_ticket_correction: null,
      utilisateur: ticket.nom_vendeur,
      motif: 'Suppression demandée'
    });

    return id_annul;
  });

  try {
    const id_annul = transaction();
    const io = req.app.get('socketio');
    if (io) {
      io.emit('bilanUpdated');
      io.emit('ticketsmisajour');
    }
    return res.json({ success: true, id_annul });
  } catch (err) {
    console.error('Erreur transaction suppression/annulation :', err);
    return res.status(500).json({ error: 'Erreur serveur lors de l’annulation du ticket.' });
  }
});

module.exports = router;
