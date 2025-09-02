// routes/validerVente.routes.js

const express = require('express');
const router = express.Router();
const { sqlite } = require('../db');
const fs = require('fs');
const path = require('path');
const session = require('../session');
const logSync = require('../logsync');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { genererFriendlyIds } = require('../utils/genererFriendlyIds');
const genererTicketPdf = require('../utils/genererTicketPdf');


// Configuration du transporteur d'emails (SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.ouvaton.coop',
  port: 587,
  secure: false,
  auth: {
    user: 'magasin@ressourcebrie.fr',
    pass: 'Magasin7#'
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  },
  logger: true,
  debug: true
});

// Fonction de normalisation des moyens de paiement
const normalizePaymentMethod = (moyen) => {
  const mapping = {
    carte: 'carte',
    cb: 'carte',
    'cb visa': 'carte',
    'cb_visa': 'carte',
    espece: 'espece',
    'espèce': 'espece',
    'especes': 'espece',
    cash: 'espece',
    cheque: 'cheque',
    chèque: 'cheque',
    virement: 'virement',
  };

  return mapping[moyen.toLowerCase()] || moyen.toLowerCase();
};



// Fonction pour insérer un ticket de caisse
function insertTicket({ uuid_ticket, vendeur, id_vendeur, date_achat, articles, moyenGlobal, prixTotal, reductions, uuid_session_caisse }) {
  return sqlite.prepare(`
    INSERT INTO ticketdecaisse (
      uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt,
      nbr_objet, moyen_paiement, prix_total, lien,
      reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, uuid_session_caisse
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid_ticket, vendeur, id_vendeur, date_achat,
    articles.length, moyenGlobal, prixTotal, '',
    reductions.reducBene, reductions.reducClient,
    reductions.reducGrosPanierClient, reductions.reducGrosPanierBene, uuid_session_caisse
  ).lastInsertRowid;
  
}

// Fonction pour insérer les articles vendus
function insertArticles(uuid_ticket, articles, vendeur, id_vendeur, date_achat) {
  const insert = sqlite.prepare(`
    INSERT INTO objets_vendus (
      uuid_ticket, uuid_objet, nom, nom_vendeur, id_vendeur,
      categorie, souscat, date_achat, timestamp, prix, nbr
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Math.floor(Date.now() / 1000);
  for (const item of articles) {
    const uuid_objet = uuidv4();
    insert.run(
      uuid_ticket, uuid_objet, item.nom, vendeur, id_vendeur,
      item.categorie, item.souscat, date_achat, now,
      item.prix, item.nbr
    );
    logSync('objets_vendus', 'INSERT', { uuid_ticket, uuid_objet, ...item, nom_vendeur: vendeur, id_vendeur, date_achat, timestamp: now });
  }
}

// Fonction pour appliquer une réduction selon le type
function applyReduction(type, prixTotal) {
  const map = {
    'trueClient': { label: 'Fidélité client', montant: 500, flags: { reducClient: 1 } },
    'trueBene': { label: 'Fidélité bénévole', montant: 1000, flags: { reducBene: 1 } },
    'trueGrosPanierClient': { label: 'Gros panier client', taux: 0.10, flags: { reducGrosPanierClient: 1 } },
    'trueGrosPanierBene': { label: 'Gros panier bénévole', taux: 0.20, flags: { reducGrosPanierBene: 1 } }
  };
  const reduc = map[type];
  if (!reduc) return { reduction: 0, label: '', flags: {} };

  const montant = reduc.montant || Math.round(prixTotal * reduc.taux);
  return {
    reduction: Math.min(prixTotal, montant),
    label: reduc.label,
    flags: reduc.flags
  };
}

// Fonction pour envoyer le ticket par email
function sendTicketEmail(to, pdfPath, uuid_ticket) {
  return transporter.sendMail({
    from: 'magasin@ressourcebrie.fr',
    to,
    subject: "Votre ticket de caisse - Ressource'Brie",
    text: "Veuillez trouver ci-joint votre ticket de caisse en PDF.",
    attachments: [
      {
        filename: `Ticket-${uuid_ticket}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf'
      }
    ]
  });
}

// === ROUTE PRINCIPALE POUR VALIDER UNE VENTE ===
router.post('/', async (req, res) => {
// const user = session.getUser();
const user = req.session.user;
  const { id_temp_vente, reductionType, paiements, uuid_session_caisse, email, code_postal } = req.body;

  // Vérification des données reçues
  if (
    !id_temp_vente ||
    !paiements ||
    !Array.isArray(paiements) ||
    paiements.length === 0 ||
    !user
  ) {
    return res.status(400).json({ error: 'Données manquantes ou utilisateur non connecté' });
  }

  let id_ticket;
  let uuid_ticket;

  // Transaction principale d'enregistrement de la vente
  const executeTransaction = sqlite.transaction(() => {
    // Récupération des articles de la vente temporaire
    const articles = sqlite.prepare('SELECT * FROM ticketdecaissetemp WHERE id_temp_vente = ?').all(id_temp_vente);
    if (articles.length === 0) throw new Error('Aucun article trouvé');

    uuid_ticket = uuidv4();
    genererFriendlyIds(uuid_ticket, 'vente');

    const date_achat = new Date().toISOString();
    const vendeur = user.nom;
    const id_vendeur = user.uuid_user;

    // Calcul du prix total
    let prixTotal = articles.reduce((sum, a) => sum + a.prixt, 0);

    // Application de la réduction éventuelle
    const reduc = applyReduction(reductionType, prixTotal);
    prixTotal -= reduc.reduction;

    // Drapeaux de réduction pour la base
    const reductions = {
      reducBene: reduc.flags.reducBene || 0,
      reducClient: reduc.flags.reducClient || 0,
      reducGrosPanierClient: reduc.flags.reducGrosPanierClient || 0,
      reducGrosPanierBene: reduc.flags.reducGrosPanierBene || 0
    };

    // Détermination du moyen de paiement global
    const moyenGlobal = paiements.length > 1 ? 'mixte' : normalizePaymentMethod(paiements[0].moyen);

    // Insertion du ticket de caisse
    id_ticket = insertTicket({
      uuid_ticket,
      vendeur,
      id_vendeur,
      date_achat,
      articles,
      moyenGlobal,
      prixTotal,
      reductions,
      uuid_session_caisse
    });
    logSync('ticketdecaisse', 'INSERT', {
      uuid_ticket,
      nom_vendeur: vendeur,
      id_vendeur,
      date_achat_dt: date_achat,
      nbr_objet: articles.length,
      moyen_paiement: moyenGlobal,
      prix_total: prixTotal,
      lien: '',
      reducbene: reductions.reducBene,
      reducclient: reductions.reducClient,
      reducgrospanierclient: reductions.reducGrosPanierClient,
      reducgrospanierbene: reductions.reducGrosPanierBene,
      uuid_session_caisse
    });


    // Insertion des articles vendus
    insertArticles(uuid_ticket, articles, vendeur, id_vendeur, date_achat);

    // Insertion de la ligne de réduction si besoin
    if (reduc.reduction > 0) {
      insertArticles(
        uuid_ticket,
        [{
          nom: `Réduction ${reduc.label}`,
          categorie: 'Réduction',
          souscat: reductionType,
          prix: reduc.reduction,
          nbr: -1
        }],
        vendeur,
        id_vendeur,
        date_achat
      );
    }

    // Gestion des paiements (mixte ou non)
    const pm = { espece: 0, carte: 0, cheque: 0, virement: 0 };
    paiements.forEach(p => {
      const key = normalizePaymentMethod(p.moyen); // maintenant "espece" ou "cheque" bien mappé
      if (key && pm.hasOwnProperty(key)) pm[key] += p.montant;
    });


    // Insertion dans la table paiement_mixte
    if (prixTotal > 0) {
      sqlite.prepare(`
        INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id_ticket, pm.espece, pm.carte, pm.cheque, pm.virement, uuid_ticket);
      logSync('paiement_mixte', 'INSERT', { id_ticket, uuid_ticket, ...pm });
    }


    // Suppression des données temporaires
    sqlite.prepare('DELETE FROM vente WHERE id_temp_vente = ?').run(id_temp_vente);
    sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id_temp_vente);

    // Mise à jour du bilan journalier
    const today = date_achat.slice(0, 10);
    const poids = articles.reduce((s, a) => s + (a.poids || 0), 0);
    const bilanExistant = sqlite.prepare('SELECT * FROM bilan WHERE date = ?').get(today);

    // Enregistrement du code postal si fourni
    if (code_postal && /^\d{4,5}$/.test(code_postal)) {
      sqlite.prepare(`INSERT INTO code_postal (code, date) VALUES (?, ?)`).run(code_postal, today);
      logSync('code_postal', 'INSERT', { code: code_postal, date: today, id_ticket });
    }

    const now = Math.floor(Date.now() / 1000);
    if (bilanExistant) {
      sqlite.prepare(`
        UPDATE bilan SET nombre_vente = nombre_vente + 1,
        poids = poids + ?, prix_total = prix_total + ?,
        prix_total_espece = prix_total_espece + ?,
        prix_total_cheque = prix_total_cheque + ?,
        prix_total_carte = prix_total_carte + ?,
        prix_total_virement = prix_total_virement + ? WHERE date = ?
      `).run(
        poids,
        prixTotal,
        prixTotal === 0 ? 0 : pm.espece,
        prixTotal === 0 ? 0 : pm.cheque,
        prixTotal === 0 ? 0 : pm.carte,
        prixTotal === 0 ? 0 : pm.virement,
        today
      );
      logSync('bilan', 'UPDATE', { date: today, timestamp: now, nombre_vente: 1, poids, prix_total: prixTotal, ...pm });
    } else {
      sqlite.prepare(`
        INSERT INTO bilan (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(today, now, 1, poids, prixTotal, pm.espece, pm.cheque, pm.carte, pm.virement);
      logSync('bilan', 'INSERT', { date: today, timestamp: now, nombre_vente: 1, poids, prix_total: prixTotal, ...pm });
    }
  });

    try {
    // 1. Exécuter la transaction synchrone
    executeTransaction(); // ⚠️ Cette fonction modifie uuid_ticket en closure

    // 2. Réponse immédiate au client (VENTE VALIDÉE)
    res.json({ success: true, id_ticket, uuid_ticket });

    // 3. Génération du PDF en tâche de fond (non bloquante)
    try {
      const pdfPath = await genererTicketPdf(uuid_ticket);

      // 4. Envoi du mail en tâche de fond si adresse valide
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await sendTicketEmail(email, pdfPath, uuid_ticket);
      }

    } catch (err) {
      console.error(`⚠️ Erreur génération ou envoi PDF pour ${uuid_ticket} :`, err);
    }

    // 5. Éventuelle notification socket
    const io = req.app.get('socketio');
    if (io) io.emit('bilanUpdated');

  } catch (e) {
    console.error('❌ Erreur validation vente :', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
