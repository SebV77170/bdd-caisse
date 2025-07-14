const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const axios = require('axios');
const { getFriendlyIdFromUuid } = require('./genererFriendlyIds');


function formatMontant(cents) {
  return `${(cents / 100).toFixed(2)} €`;
}

async function genererTicketCloturePdf(id_session) {
  const session = sqlite.prepare('SELECT * FROM session_caisse WHERE id_session = ?').get(id_session);
  const friendlyId = getFriendlyIdFromUuid(id_session);
  if (!session) throw new Error('Session de caisse introuvable');

  // Récupération des montants attendus via la route HTTP
  const bilanResponse = await axios.get(
    `http://localhost:3001/api/bilan/bilan_session_caisse?uuid_session_caisse=${id_session}`
  );
  const bilan = bilanResponse.data;
  console.log('Bilan récupéré pour la session', id_session, bilan);

  // --- Création du chemin par date ---
  const date = new Date(session.date_fermeture);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const baseDir = path.join(os.homedir(), '.bdd-caisse');
  const dir = path.join(baseDir, `tickets/${yyyy}/${mm}/${dd}`);
  fs.mkdirSync(dir, { recursive: true });

  const pdfPath = path.join(dir, `Cloture-${friendlyId}.pdf`);

  // --- Création du PDF ---
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(16).text("Clôture de caisse - Ressource'Brie", { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Date de clôture : ${session.date_fermeture}`);
  doc.text(`Heure de clôture : ${session.heure_fermeture}`);
  doc.text(`Utilisateur : ${session.utilisateur_fermeture}`);
  doc.text(`Responsable : ${session.responsable_fermeture}`);
  doc.moveDown();

  doc.fontSize(14).text("Résumé caisse", { underline: true });
  doc.moveDown(0.5);
  doc.text(`Fond de caisse initial déclaré : ${formatMontant(session.fond_initial)}`);
  doc.text(`Fond de caisse final : ${formatMontant(session.montant_reel ?? 0)}`);
  doc.moveDown();

  doc.fontSize(14).text("Par moyen de paiement", { underline: true });
  doc.moveDown(0.5);

  const details = [
    {
      label: 'Espèces',
      attendu: bilan.prix_total_espece + session.fond_initial,
      reel: session.montant_reel
    },
    { label: 'Carte', attendu: bilan.prix_total_carte, reel: session.montant_reel_carte },
    { label: 'Chèque', attendu: bilan.prix_total_cheque, reel: session.montant_reel_cheque },
    { label: 'Virement', attendu: bilan.prix_total_virement, reel: session.montant_reel_virement }
  ];

  details.forEach(d => {
    const ecart = (d.reel ?? 0) - (d.attendu ?? 0);
    doc.text(`${d.label} : Attendu ${formatMontant(d.attendu ?? 0)} | Réel ${formatMontant(d.reel ?? 0)} | Écart ${formatMontant(ecart)}`);
  });

  doc.moveDown();
  doc.text(`Écart total : ${formatMontant(session.ecart ?? 0)}`);

  if (session.commentaire) {
    doc.moveDown();
    doc.fontSize(14).text("Commentaire", { underline: true });
    doc.fontSize(12).text(session.commentaire);
  }

  doc.moveDown();
  doc.text('Signature du responsable :', { align: 'right' });
  doc.moveDown();
  doc.text('_________________________', { align: 'right' });

  return new Promise((resolve, reject) => {
    doc.end();
    doc.on('finish', () => resolve(pdfPath)); // ✅ on renvoie le chemin du PDF
    doc.on('error', err => reject(err));
  });
}

module.exports = genererTicketCloturePdf;
