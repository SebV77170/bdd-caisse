const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');

function formatMontant(cents) {
  return `${(cents / 100).toFixed(2)} €`;
}

function genererTicketCloturePdf(id_session) {
  return new Promise((resolve, reject) => {
    const session = sqlite.prepare('SELECT * FROM session_caisse WHERE id_session = ?').get(id_session);
    if (!session) return reject(new Error('Session de caisse introuvable'));

    const bilan = sqlite.prepare('SELECT * FROM bilan WHERE date = ?').get(session.date_fermeture);
    const pdfPath = path.join(__dirname, `../../tickets/Cloture-${id_session}.pdf`);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(pdfPath));

    // En-tête
    doc.fontSize(16).text("Clôture de caisse - Ressource'Brie", { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date de clôture : ${session.date_fermeture}`);
    doc.text(`Heure de clôture : ${session.heure_fermeture}`);
    doc.text(`Utilisateur : ${session.utilisateur_fermeture}`);
    doc.text(`Responsable : ${session.responsable_fermeture}`);
    doc.moveDown();

    // Fonds
    doc.fontSize(14).text("Résumé caisse", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Fond de caisse initial déclaré : ${formatMontant(session.fond_initial)}`);
    doc.fontSize(12).text(`Fond de caisse final : ${formatMontant(session.montant_reel ?? 0)}`);
    doc.moveDown();

    // Détail par moyen de paiement
    doc.fontSize(14).text("Par moyen de paiement", { underline: true });
    doc.moveDown(0.5);

    const details = [
      { label: 'Espèces', attendu: bilan?.prix_total_espece + session.fond_initial, reel: session.montant_reel },
      { label: 'Carte', attendu: bilan?.prix_total_carte, reel: session.montant_reel_carte },
      { label: 'Chèque', attendu: bilan?.prix_total_cheque, reel: session.montant_reel_cheque },
      { label: 'Virement', attendu: bilan?.prix_total_virement, reel: session.montant_reel_virement }
    ];

    details.forEach(d => {
      const ecart = (d.reel ?? 0) - (d.attendu ?? 0);
      doc.text(`${d.label} : Attendu ${formatMontant(d.attendu ?? 0)} | Réel ${formatMontant(d.reel ?? 0)} | Écart ${formatMontant(ecart)}`);
    });

    doc.moveDown();
    // Écart total
    doc.fontSize(12).text(`Écart total : ${formatMontant(session.ecart ?? 0)}`);

    // Commentaire éventuel
    if (session.commentaire) {
      doc.moveDown();
      doc.fontSize(14).text("Commentaire", { underline: true });
      doc.fontSize(12).text(session.commentaire);
    }

    // Signature
    doc.moveDown();
    doc.fontSize(12).text('Signature du responsable :', { align: 'right' });
    doc.moveDown();
    doc.text('_________________________', { align: 'right' });

    // Fin
    doc.end();

    doc.on('finish', () => resolve());
    doc.on('error', err => reject(err));
  });
}

module.exports = genererTicketCloturePdf;
