// ✅ Correction complète avec gestion propre des réductions et génération des tickets .txt
const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const session = require('../session');
const fs = require('fs');
const path = require('path');
const logSync = require('../logsync');
const { v4: uuidv4 } = require('uuid');
const genererTicketPdf = require('../utils/genererTicketPdf');

router.post('/', (req, res) => {
  const {
    id_ticket_original,
    uuid_ticket_original, // Non utilisé dans la correction actuelle, mais gardé pour info
    articles_origine,
    articles_correction,
    motif,
    uuid_session_caisse,
    reductionType,
    paiements = [] // Paiements du nouveau ticket corrigé
  } = req.body;
console.log(req.body);


  const now = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000);

  const user = session.getUser();
  if (!user) return res.status(401).json({ error: 'Aucun utilisateur connecté' });

  const utilisateur = user.nom;
  const id_vendeur = user.id;

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

  try {
    // --- PARTIE ANNULATION DU TICKET ORIGINAL ---

    // Récupérer le ticket original pour ses informations de paiement
    const ticketOriginalData = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE id_ticket = ?').get(id_ticket_original);
    if (!ticketOriginalData) {
      return res.status(400).json({ error: `Ticket original #${id_ticket_original} introuvable pour correction.` });
    }

    // Récupérer les paiements mixtes du ticket original
    const paiementsOriginauxMixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE id_ticket = ?').get(id_ticket_original);

    let pmAnnul = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    if (paiementsOriginauxMixte) {
      pmAnnul = {
        espece: paiementsOriginauxMixte.espece || 0,
        carte: paiementsOriginauxMixte.carte || 0,
        cheque: paiementsOriginauxMixte.cheque || 0,
        virement: paiementsOriginauxMixte.virement || 0
      };
    } else if (ticketOriginalData.moyen_paiement) { // Si pas de paiement mixte, utiliser le moyen_paiement simple
        const moyen = ticketOriginalData.moyen_paiement.toLowerCase();
        const prixTotalOriginal = ticketOriginalData.prix_total;
        if (moyen === 'espèces') pmAnnul.espece = prixTotalOriginal;
        if (moyen === 'carte') pmAnnul.carte = prixTotalOriginal;
        if (moyen === 'chèque') pmAnnul.cheque = prixTotalOriginal;
        if (moyen === 'virement') pmAnnul.virement = prixTotalOriginal;
    }


    let id_annul, id_corrige;
    const uuid_ticket_annul = uuidv4();
    const uuid_ticket_corrige = uuidv4();
    const simulateError = req.body.simulateError;
    const dbTransaction = sqlite.transaction(() => {
    const annul = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, correction_de, flag_correction, nom_vendeur, id_vendeur,
        nbr_objet, prix_total, moyen_paiement, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?,?)
    `).run(now, id_ticket_original, utilisateur, id_vendeur, articles_sans_reduction.length, totalAnnulation, ticketOriginalData.moyen_paiement || 'mixte', uuid_ticket_annul, uuid_session_caisse);
    id_annul = annul.lastInsertRowid;

    if (simulateError) throw new Error('Simulated error');

    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_annul,
      id_ticket: id_annul, // Correction: utilisez id_ticket pour le logSync
      nom_vendeur: utilisateur,
      id_vendeur,
      date_achat_dt: now,
      nbr_objet: articles_sans_reduction.length,
      moyen_paiement: ticketOriginalData.moyen_paiement || 'mixte', // Moyen de paiement original
      prix_total: totalAnnulation,
      // Les réductions du ticket d'annulation sont basées sur l'original s'il y en avait, sinon 0
      reducbene: ticketOriginalData.reducbene || 0,
      reducclient: ticketOriginalData.reducclient || 0,
      reducgrospanierclient: ticketOriginalData.reducgrospanierclient || 0,
      reducgrospanierbene: ticketOriginalData.reducgrospanierbene || 0,
      uuid_session_caisse
    });

    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        id_ticket, nom, prix, nbr, categorie,
        nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const art of articles_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(id_annul, art.nom, art.prix, -(art.nbr), art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
      logSync('objets_vendus', 'INSERT', {
        id_ticket: id_annul,
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

    // ✅ Insertion des paiements annulés dans paiement_mixte
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


    // --- PARTIE NOUVEAU TICKET CORRIGÉ ---

    const uuid_ticket_corrige = uuidv4();
    const correc = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, nom_vendeur, id_vendeur, nbr_objet, prix_total, moyen_paiement,
        reducbene, reducclient, reducgrospanierclient, reducGrosPanierBene, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
    `).run(now, utilisateur, id_vendeur, articles_correction_sans_reduction.length, prixTotal, 'mixte', // Toujours 'mixte' si la correction utilise plusieurs paiements
      reducBene, reducClient, reducGrosPanierClient, reducGrosPanierBene, uuid_ticket_corrige, uuid_session_caisse);
    id_corrige = correc.lastInsertRowid;

    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_corrige,
      id_ticket: id_corrige, // Correction: utilisez id_ticket pour le logSync
      nom_vendeur: utilisateur,
      id_vendeur,
      date_achat_dt: now,
      nbr_objet: articles_correction_sans_reduction.length,
      moyen_paiement: 'mixte', // Moyen de paiement du nouveau ticket
      prix_total: prixTotal,
      reducbene: reducBene,
      reducclient: reducClient,
      reducgrospanierclient: reducGrosPanierClient,
      reducgrospanierbene: reducGrosPanierBene,
      uuid_session_caisse
    });

    sqlite.prepare('UPDATE ticketdecaisse SET corrige_le_ticket = ? WHERE id_ticket = ?').run(id_ticket_original, id_corrige);

    let pmCorrige = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    const normalisation = {
      'espèce': 'espece', 'espèces': 'espece', 'carte': 'carte',
      'chèque': 'cheque', 'chéque': 'cheque', 'cheque': 'cheque', 'virement': 'virement'
    };

    for (const art of articles_correction_sans_reduction) {
      const uuid_objet = uuidv4();
      insertArticle.run(id_corrige, art.nom, art.prix, art.nbr, art.categorie, utilisateur, id_vendeur, now, timestamp, uuid_objet);
      logSync('objets_vendus', 'INSERT', {
        id_ticket: id_corrige,
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

    // 🔁 Toujours insérer un paiement mixte, même si un seul mode de paiement
    const pm = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    for (const p of paiements) {
      const champ = normalisation[p.moyen?.toLowerCase()] || null;
      if (champ && pm.hasOwnProperty(champ)) {
        pm[champ] += p.montant;
      }
    }
    pmCorrige = { ...pm };

    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id_corrige, pm.espece, pm.carte, pm.cheque, pm.virement, uuid_ticket_corrige);

    logSync('paiement_mixte', 'INSERT', {
      id_ticket: id_corrige,
      uuid_ticket: uuid_ticket_corrige,
      espece: pm.espece,
      carte: pm.carte,
      cheque: pm.cheque,
      virement: pm.virement
    });

    // ✅ Mise à jour du bilan
    const today = now.slice(0, 10);
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
        // Retirer les montants de l'original et ajouter ceux du corrigé
        ticketOriginalData.prix_total, // Utilisez le prix total original (positif)
        prixTotal, // Utilisez le prix total corrigé (positif)
        pmAnnul.espece, pmCorrige.espece, // Paiements en espèces (originaux positifs, corrigés positifs)
        pmAnnul.cheque, pmCorrige.cheque, // Paiements par chèque
        pmAnnul.carte, pmCorrige.carte,   // Paiements par carte
        pmAnnul.virement, pmCorrige.virement, // Paiements par virement
        today
      );
      // LogSync pour la soustraction du bilan
      logSync('bilan', 'UPDATE', {
        date: today,
        timestamp,
        prix_total: -ticketOriginalData.prix_total,
        prix_total_espece: -pmAnnul.espece,
        prix_total_cheque: -pmAnnul.cheque,
        prix_total_carte: -pmAnnul.carte,
        prix_total_virement: -pmAnnul.virement
      });

      // LogSync pour l'ajout au bilan
      logSync('bilan', 'UPDATE', {
        date: today,
        timestamp,
        prix_total: prixTotal,
        prix_total_espece: pmCorrige.espece,
        prix_total_cheque: pmCorrige.cheque,
        prix_total_carte: pmCorrige.carte,
        prix_total_virement: pmCorrige.virement
      });
    } else {
      sqlite.prepare(`
        INSERT INTO bilan (
          date, timestamp, nombre_vente, poids, prix_total,
          prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        today, timestamp, 1, 0,
        prixTotal - ticketOriginalData.prix_total, // Difference between corrected and original
        pmCorrige.espece - pmAnnul.espece,
        pmCorrige.cheque - pmAnnul.cheque,
        pmCorrige.carte - pmAnnul.carte,
        pmCorrige.virement - pmAnnul.virement
      );
      logSync('bilan', 'INSERT', {
        date: today,
        timestamp,
        nombre_vente: 1,
        poids: 0,
        prix_total: prixTotal - ticketOriginalData.prix_total,
        prix_total_espece: pmCorrige.espece - pmAnnul.espece,
        prix_total_cheque: pmCorrige.cheque - pmAnnul.cheque,
        prix_total_carte: pmCorrige.carte - pmAnnul.carte,
        prix_total_virement: pmCorrige.virement - pmAnnul.virement
      });
    }

    sqlite.prepare(`
    INSERT INTO journal_corrections (date_correction, id_ticket_original,id_ticket_annulation, id_ticket_correction, utilisateur , motif)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(now, id_ticket_original, id_annul, id_corrige, utilisateur, motif);


    logSync('journal_corrections', 'INSERT', {
      id_ticket_original,
      id_ticket_correction: id_corrige,
      id_ticket_annulation: id_annul,
      date_correction: now,
      utilisateur,
      motif
    });
  });
  dbTransaction();
  genererTicketPdf(uuid_ticket_annul);
  genererTicketPdf(uuid_ticket_corrige);
  res.json({ success: true, id_ticket_annulation: id_annul, id_ticket_correction: id_corrige });

  }
  catch (err) {
    // Gestion des erreurs lors de l'insertion de la correction
    console.error('Erreur lors de l\'insertion de la correction :', err);
    res.status(500).json({ error: 'Erreur lors de l\'insertion de la correction' });
  }

  // Notifie les clients via WebSocket que le bilan et les tickets ont été mis à jour
  const io = req.app.get('socketio');
  if (io) {
    io.emit('bilanUpdated');
    io.emit('ticketsmisajour');
  }
});

// Nouvelle route pour suppression via ticket d'annulation
router.post('/:id/supprimer', (req, res) => {
  const id = parseInt(req.params.id);
  const now = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000); // Définir timestamp ici

  // Récupère le ticket à annuler
  const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE id_ticket = ?').get(id);

  if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

  try {
    // Récupère les objets vendus liés au ticket
    const objets = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(id);

    // Calcule le montant d'annulation (toujours négatif)
    const totalAnnulation = -Math.abs(ticket.prix_total);
    let id_annul;
    const uuid_ticket_annul = require('uuid').v4();
    const dbTransaction = sqlite.transaction(() => {

    // Récupérer les paiements mixtes du ticket original à supprimer
    const paiementsOriginalMixte = sqlite.prepare('SELECT * FROM paiement_mixte WHERE id_ticket = ?').get(id);
    let pmAnnulSingleDelete = { espece: 0, carte: 0, cheque: 0, virement: 0 };

    if (paiementsOriginalMixte) {
      pmAnnulSingleDelete = {
        espece: paiementsOriginalMixte.espece || 0,
        carte: paiementsOriginalMixte.carte || 0,
        cheque: paiementsOriginalMixte.cheque || 0,
        virement: paiementsOriginalMixte.virement || 0
      };
    } else if (ticket.moyen_paiement) { // Si pas de paiement mixte, utiliser le moyen_paiement simple
        const moyen = ticket.moyen_paiement.toLowerCase();
        const prixTotalOriginal = ticket.prix_total;
        if (moyen === 'espèces') pmAnnulSingleDelete.espece = prixTotalOriginal;
        if (moyen === 'carte') pmAnnulSingleDelete.carte = prixTotalOriginal;
        if (moyen === 'chèque') pmAnnulSingleDelete.cheque = prixTotalOriginal;
        if (moyen === 'virement') pmAnnulSingleDelete.virement = prixTotalOriginal;
    }


    // Insère un ticket d'annulation dans la base
    const annul = sqlite.prepare(`
      INSERT INTO ticketdecaisse (
        date_achat_dt, correction_de, flag_correction, nom_vendeur, id_vendeur,
        nbr_objet, prix_total, moyen_paiement, uuid_ticket, uuid_session_caisse
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      now, ticket.id_ticket, ticket.nom_vendeur, ticket.id_vendeur,
      objets.length, totalAnnulation, ticket.moyen_paiement || 'mixte', uuid_ticket_annul, ticket.uuid_session_caisse // Utilise le uuid_session_caisse du ticket original
    );
    id_annul = annul.lastInsertRowid;

    // LogSync pour le ticket d'annulation
    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket: uuid_ticket_annul,
      id_ticket: id_annul,
      date_achat_dt: now,
      correction_de: ticket.id_ticket,
      flag_correction: 1,
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


    // Prépare l'insertion des articles annulés
    const insertArticle = sqlite.prepare(`
      INSERT INTO objets_vendus (
        id_ticket, nom, prix, nbr, categorie,
        nom_vendeur, id_vendeur, date_achat, timestamp, uuid_objet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const obj of objets) {
      const uuid_objet = require('uuid').v4();
      insertArticle.run(
        id_annul,
        obj.nom,
        obj.prix,
        -obj.nbr,
        obj.categorie,
        ticket.nom_vendeur,
        ticket.id_vendeur,
        now,
        timestamp,
        uuid_objet
      );
      // LogSync pour les objets annulés
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

    // ✅ Insertion des paiements annulés dans paiement_mixte pour la suppression simple
    sqlite.prepare(`
      INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id_annul,
      -pmAnnulSingleDelete.espece,
      -pmAnnulSingleDelete.carte,
      -pmAnnulSingleDelete.cheque,
      -pmAnnulSingleDelete.virement,
      uuid_ticket_annul
    );
    // LogSync pour paiement_mixte
    logSync('paiement_mixte', 'INSERT', {
      id_ticket: id_annul,
      uuid_ticket: uuid_ticket_annul,
      espece: -pmAnnulSingleDelete.espece,
      carte: -pmAnnulSingleDelete.carte,
      cheque: -pmAnnulSingleDelete.cheque,
      virement: -pmAnnulSingleDelete.virement
    });


    // Mise à jour bilan
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
        -pmAnnulSingleDelete.espece, // Utilise les montants négatifs pour annuler
        -pmAnnulSingleDelete.carte,
        -pmAnnulSingleDelete.cheque,
        -pmAnnulSingleDelete.virement,
        today
      );
      // LogSync pour la mise à jour du bilan
      logSync('bilan', 'UPDATE', {
        date: today,
        timestamp,
        prix_total: totalAnnulation,
        prix_total_espece: -pmAnnulSingleDelete.espece,
        prix_total_carte: -pmAnnulSingleDelete.carte,
        prix_total_cheque: -pmAnnulSingleDelete.cheque,
        prix_total_virement: -pmAnnulSingleDelete.virement
      });
    }

    // ✅ Journalisation de la suppression
    sqlite.prepare(`
      INSERT INTO journal_corrections (date_correction, id_ticket_original, id_ticket_annulation, id_ticket_correction, utilisateur, motif)
      VALUES (?, ?, ?, NULL, ?, 'Suppression demandée')
    `).run(now, ticket.id_ticket, id_annul, ticket.nom_vendeur);
    // LogSync pour journal_corrections
    logSync('journal_corrections', 'INSERT', {
      date_correction: now,
      id_ticket_original: ticket.id_ticket,
      id_ticket_annulation: id_annul,
      id_ticket_correction: null,
      utilisateur: ticket.nom_vendeur,
      motif: 'Suppression demandée'
    });

  });
    dbTransaction();
    genererTicketPdf(uuid_ticket_annul);
    const io = req.app.get('socketio');
    if (io) {
      io.emit('bilanUpdated');
      io.emit('ticketsmisajour');
    }

    return res.json({ success: true, id_annul });
  } catch (err) {
    console.error('Erreur suppression/annulation :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;