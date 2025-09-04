// routes/correction.routes.js
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const session = require('../session');
const fs = require('fs');
const path = require('path');
const verifyAdmin = require('../utils/verifyAdmin');
const logSync = require('../logsync');
const { v4: uuidv4 } = require('uuid');
const genererTicketPdf = require('../utils/genererTicketPdf');
const { genererFriendlyIds } = require('../utils/genererFriendlyIds');
const { log } = require('console');

// Route principale pour corriger un ticket de caisse
router.post('/', (req, res) => {
  // Récupère l'utilisateur courant depuis la session
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Aucun utilisateur connecté' });

  // Récupération des données de la requête
  const {
    id_ticket_original,
    uuid_ticket_original,
    articles_origine,
    articles_correction,
    motif,
    uuid_session_caisse,
    reductionType,
    responsable_pseudo,
    mot_de_passe,
    paiements = []
  } = req.body;

  // Vérifie que le responsable est un administrateur et que le mot de passe est valide
  const { valid, user: responsable, error } = verifyAdmin(responsable_pseudo, mot_de_passe);
  if (!valid) {
    return res.status(403).json({ error });
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const timestamp = Math.floor(Date.now() / 1000);
  const utilisateur = user.nom;
  const id_vendeur = user.uuid_user;

  // Transaction SQLite pour garantir la cohérence des modifications
  const transaction = sqlite.transaction(() => {
    // Préparation des articles sans réduction
    const articles_sans_reduction = [...articles_origine];
    let articles_correction_sans_reduction = articles_correction.filter(a => a.categorie !== 'Réduction');

    let reductionArticle = null;
    let reducbene = 0, reducclient = 0, reducgrospanierclient = 0, reducgrospanierbene = 0;

    // Gestion des différents types de réduction
    if (reductionType === 'trueClient') {
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Fidélité Client', prix: -500, nbr: 1, categorie: 'Réduction' };
      reducclient = 1;
    } else if (reductionType === 'trueBene') {
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Fidélité Bénévole', prix: -1000, nbr: 1, categorie: 'Réduction' };
      reducbene = 1;
    } else if (reductionType === 'trueGrosPanierClient') {
      const montantAvantReduc = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
      const reducMontant = Math.round(montantAvantReduc * 0.1);
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Gros Panier Client (-10%)', prix: -reducMontant, nbr: 1, categorie: 'Réduction' };
      reducgrospanierclient = 1;
    } else if (reductionType === 'trueGrosPanierBene') {
      const montantAvantReduc = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
      const reducMontant = Math.round(montantAvantReduc * 0.2);
      reductionArticle = { uuid_objet: uuidv4(), nom: 'Réduction Gros Panier Bénévole (-20%)', prix: -reducMontant, nbr: 1, categorie: 'Réduction' };
      reducgrospanierbene = 1;
    }

    // Ajoute l'article de réduction si nécessaire
    if (reductionArticle) {
      articles_correction_sans_reduction.push(reductionArticle);
    }

    // Calcule le prix total après correction
    let prixTotal = articles_correction_sans_reduction.reduce((sum, a) => sum + a.prix * a.nbr, 0);
    if (prixTotal < 0) prixTotal = 0;

    // Calcule le montant total à annuler
    let totalAnnulation = articles_sans_reduction.reduce((sum, a) => sum + a.prix * (-(a.nbr)), 0);
    if (totalAnnulation > 0) totalAnnulation = 0;

    // Récupère les données du ticket original
    const ticketOriginalData = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket_original);
    if (!ticketOriginalData) throw new Error(`Ticket original #${uuid_ticket_original} introuvable pour correction.`);

    // Récupère les paiements mixtes du ticket original
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
      // Si pas de paiement mixte, on répartit selon le moyen de paiement principal
      const moyen = ticketOriginalData.moyen_paiement.toLowerCase();
      const prixTotalOriginal = ticketOriginalData.prix_total;
      if (moyen === 'especes') pmAnnul.espece = prixTotalOriginal;
      if (moyen === 'carte') pmAnnul.carte = prixTotalOriginal;
      if (moyen === 'cheque') pmAnnul.cheque = prixTotalOriginal;
      if (moyen === 'virement') pmAnnul.virement = prixTotalOriginal;
    }

    // Prépare la requête d'insertion d'article vendu
    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        uuid_ticket, nom, prix, nbr, categorie,
        nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Génère un nouvel UUID pour le ticket d'annulation
    const uuid_ticket_annul = uuidv4();
    genererFriendlyIds(uuid_ticket_annul, 'annulation');

    // Insère le ticket d'annulation
    sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, annulation_de, flag_annulation, nom_vendeur, id_vendeur,
        nbr_objet, prix_total, moyen_paiement, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(now, uuid_ticket_original, utilisateur, id_vendeur, articles_sans_reduction.length, totalAnnulation, ticketOriginalData.moyen_paiement || 'mixte', uuid_ticket_annul, uuid_session_caisse);

    // Log la synchronisation de l'annulation
    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_annul,
      date_achat_dt: now,
      annulation_de: uuid_ticket_original,
      flag_annulation: 1,
      nom_vendeur: utilisateur,
      id_vendeur,
      nbr_objet: articles_sans_reduction.length,
      prix_total: totalAnnulation,
      moyen_paiement: ticketOriginalData.moyen_paiement || 'mixte',
      uuid_session_caisse
    });

    // Insère les articles annulés (quantité négative)
    for (const art of articles_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(uuid_ticket_annul, art.nom, art.prix, -(art.nbr), art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
      logSync('objets_vendus', 'INSERT', {
        uuid_ticket: uuid_ticket_annul,
        nom: art.nom,
        prix: art.prix,
        nbr: -(art.nbr),
        categorie: art.categorie,
        nom_vendeur: utilisateur,
        id_vendeur,
        date_achat: now,
        timestamp,
        uuid_objet
      });
    }

    // Insère le paiement mixte annulé (montants négatifs)
    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid_ticket_annul, -pmAnnul.espece, -pmAnnul.carte, -pmAnnul.cheque, -pmAnnul.virement, uuid_ticket_annul);

    logSync('paiement_mixte', 'INSERT', {
      id_ticket: uuid_ticket_annul,
      uuid_ticket: uuid_ticket_annul,
      espece: -pmAnnul.espece,
      carte: -pmAnnul.carte,
      cheque: -pmAnnul.cheque,
      virement: -pmAnnul.virement
    });

    // Détermine le type de paiement pour le ticket corrigé
    let paiementType = 'mixte';
    if (paiements.length === 1) paiementType = paiements[0]?.moyen || null;
    if (paiements.length === 0) paiementType = null;

    // Génère un nouvel UUID pour le ticket corrigé
    const uuid_ticket_corrige = uuidv4();
    genererFriendlyIds(uuid_ticket_corrige, 'correction');

    // Insère le ticket corrigé
    sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement,
        reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, flag_correction, corrige_le_ticket, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(now, utilisateur, id_vendeur, articles_correction_sans_reduction.length, prixTotal, paiementType,
      reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, 1, uuid_ticket_original, uuid_ticket_corrige, uuid_session_caisse);

    // Log la synchronisation du ticket corrigé
    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_corrige,
      date_achat_dt: now,
      nom_vendeur: utilisateur,
      id_vendeur,
      nbr_objet: articles_correction_sans_reduction.length,
      prix_total: prixTotal,
      moyen_paiement: paiementType,
      reducbene: reducbene,
      reducclient: reducclient,
      reducgrospanierclient: reducgrospanierclient,
      reducgrospanierbene: reducgrospanierbene,
      flag_correction: 1,
      corrige_le_ticket: uuid_ticket_original,
      uuid_session_caisse
    });

    // Insère les articles corrigés
    for (const art of articles_correction_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(uuid_ticket_corrige, art.nom, art.prix, art.nbr, art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
      logSync('objets_vendus', 'INSERT', {
        uuid_ticket: uuid_ticket_corrige,
        nom: art.nom,
        prix: art.prix,
        nbr: art.nbr,
        categorie: art.categorie,
        nom_vendeur: utilisateur,
        id_vendeur,
        date_achat: now,
        timestamp,
        uuid_objet
      });
    }

    // Gestion des paiements pour le ticket corrigé
    const pm = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    const normalisation = {
      'espece': 'espece', 'espèce': 'espece', 'especes': 'espece', 'espèces': 'espece', 'carte': 'carte',
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
    `).run(uuid_ticket_corrige, pm.espece, pm.carte, pm.cheque, pm.virement, uuid_ticket_corrige);

    logSync('paiement_mixte', 'INSERT', {
      id_ticket: uuid_ticket_corrige,
      uuid_ticket: uuid_ticket_corrige,
      espece: pm.espece,
      carte: pm.carte,
      cheque: pm.cheque,
      virement: pm.virement
    });

    // Mise à jour du bilan quotidien
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
      logSync('bilan', 'UPDATE', {
        date: today,
        prix_total: prixTotal - ticketOriginalData.prix_total,
        espece: pm.espece - pmAnnul.espece,
        cheque: pm.cheque - pmAnnul.cheque,
        carte: pm.carte - pmAnnul.carte,
        virement: pm.virement - pmAnnul.virement
      });
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
      logSync('bilan', 'INSERT', {
        date: today,
        timestamp,
        nombre_vente: 1,
        poids: 0,
        prix_total: prixTotal - ticketOriginalData.prix_total,
        espece: pm.espece - pmAnnul.espece,
        cheque: pm.cheque - pmAnnul.cheque,
        carte: pm.carte - pmAnnul.carte,
        virement: pm.virement - pmAnnul.virement
      });
    }

    // Journalise la correction
    sqlite.prepare(`
      INSERT INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(now, uuid_ticket_original, uuid_ticket_annul, uuid_ticket_corrige, utilisateur, motif);
    logSync('journal_corrections', 'INSERT', {
      date_correction: now,
      uuid_ticket_original,
      uuid_ticket_annulation: uuid_ticket_annul,
      uuid_ticket_correction: uuid_ticket_corrige,
      utilisateur,
      motif
    });

    return { id_annul: uuid_ticket_annul, id_corrige: uuid_ticket_corrige, uuid_ticket_annul, uuid_ticket_corrige };
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

// Route pour supprimer (annuler) un ticket de caisse
router.post('/:uuid/supprimer', (req, res) => {
  const uuid = req.params.uuid;
  const now = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000);

  // Récupère le ticket à annuler
  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid);
  if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

  // Récupère les articles vendus liés au ticket
  const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(uuid);
  const totalAnnulation = -Math.abs(ticket.prix_total);
  const uuid_ticket_annul = uuidv4();
  genererFriendlyIds(uuid_ticket_annul, 'annulation');

  // Récupère les paiements liés au ticket
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

  // Transaction SQLite pour l'annulation
  const transaction = sqlite.transaction(() => {
    // Insère le ticket d'annulation
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

    // Log la synchronisation de l'annulation
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

    // Prépare la requête d'insertion d'article annulé
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

    // Insère le paiement mixte annulé (montants négatifs)
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

    // Met à jour le bilan du jour
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

    // Journalise la correction (suppression)
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
