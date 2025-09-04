const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const axios = require('axios');
const { getFriendlyIdFromUuid } = require('./genererFriendlyIds');

function formatMontant(cents) {
  const v = Number(cents || 0);
  return `${(v / 100).toFixed(2)} €`;
}

// Utilitaires d'affichage local à partir d'un ISO UTC
function toLocalDateParts(utcIso, tz = 'Europe/Paris') {
  const d = utcIso ? new Date(utcIso) : new Date();
  const date = d.toLocaleDateString('fr-FR', { timeZone: tz });
  const time = d.toLocaleTimeString('fr-FR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { date, time, jsDate: d };
}

async function genererTicketCloturePdf(id_session, uuid_ticket) {
  // Session (schéma UTC)
  const session = sqlite.prepare('SELECT * FROM session_caisse WHERE id_session = ?').get(id_session);
  if (!session) throw new Error('Session de caisse introuvable');

  const friendlyId = getFriendlyIdFromUuid(id_session);

  // Bilan de la session (attendus en centimes)
  const bilanResponse = await axios.get(
    `http://localhost:3001/api/bilan/bilan_session_caisse?uuid_session_caisse=${id_session}`
  );
  const bilan = bilanResponse.data || {};

  // Date/heure de fermeture : on part de closed_at_utc
  // (si absent, on utilise maintenant pour éviter un crash en dev)
  const closedUtc = session.closed_at_utc || new Date().toISOString();

  // Affichage/structure fichiers en local (Europe/Paris)
  const { date: dateLocal, time: timeLocal, jsDate } = toLocalDateParts(closedUtc, 'Europe/Paris');

  // Dossiers YYYY/MM/DD (local)
  const yyyy = String(jsDate.getFullYear());
  const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
  const dd = String(jsDate.getDate()).padStart(2, '0');

  const baseDir = path.join(os.homedir(), '.bdd-caisse');
  const dir = path.join(baseDir, 'tickets', yyyy, mm, dd);
  fs.mkdirSync(dir, { recursive: true });

  const pdfPath = path.join(dir, `Cloture-${friendlyId}.pdf`);

  // Création du PDF
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // En-tête
  doc.fontSize(16).text("Clôture de caisse - Ressource'Brie", { align: 'center' });
  doc.moveDown();

  // Bloc infos fermeture
  doc.fontSize(12).text(`Date de clôture (local) : ${dateLocal}`);
  doc.text(`Heure de clôture (local) : ${timeLocal}`);
  doc.text(`Horodatage (UTC) : ${closedUtc}`);
  doc.text(`Utilisateur : ${session.utilisateur_fermeture || '—'}`);
  doc.text(`Responsable : ${session.responsable_fermeture || '—'}`);
  doc.moveDown();

  // Résumé caisse
  doc.fontSize(14).text('Résumé caisse', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Fond de caisse initial déclaré : ${formatMontant(session.fond_initial)}`);
  doc.text(`Fond de caisse final : ${formatMontant(session.montant_reel)}`);
  doc.moveDown();

  // Détails par moyen de paiement
  doc.fontSize(14).text('Par moyen de paiement', { underline: true });
  doc.moveDown(0.5);

  const details = [
    {
      label: 'Espèces',
      attendu: (bilan.prix_total_espece || 0) + (session.fond_initial || 0),
      reel: session.montant_reel
    },
    { label: 'Carte', attendu: bilan.prix_total_carte || 0, reel: session.montant_reel_carte },
    { label: 'Chèque', attendu: bilan.prix_total_cheque || 0, reel: session.montant_reel_cheque },
    { label: 'Virement', attendu: bilan.prix_total_virement || 0, reel: session.montant_reel_virement }
  ];

  details.forEach(d => {
    const ecart = (Number(d.reel || 0) - Number(d.attendu || 0));
    doc.text(
      `${d.label} : Attendu ${formatMontant(d.attendu)} | ` +
      `Réel ${formatMontant(d.reel)} | Écart ${formatMontant(ecart)}`
    );
  });

  doc.moveDown();
  doc.text(`Écart total : ${formatMontant(session.ecart)}`);

  if (session.commentaire) {
    doc.moveDown();
    doc.fontSize(14).text('Commentaire', { underline: true });
    doc.fontSize(12).text(session.commentaire);
  }

  doc.moveDown();
  doc.text('Signature du responsable :', { align: 'right' });
  doc.moveDown();
  doc.text('_________________________', { align: 'right' });

  // Finalisation + mise à jour du lien dans ticketdecaisse
  return new Promise((resolve, reject) => {
    doc.end();

    stream.on('finish', () => {
      // Chemin relatif (depuis la racine du projet)
      const relativePath = path
        .relative(path.join(__dirname, '../../'), pdfPath)
        .replace(/\\/g, '/');

      // Mise à jour du ticket de clôture
      sqlite
        .prepare('UPDATE ticketdecaisse SET lien = ? WHERE uuid_ticket = ?')
        .run(relativePath, uuid_ticket);

      // Log de sync pour propager le lien (optionnel)
      try {
        const logSync = require('../logsync');
        logSync('ticketdecaisse', 'UPDATE', { uuid_ticket, lien: relativePath });
      } catch {
        // silencieux si non dispo en contexte
      }

      resolve(pdfPath);
    });

    stream.on('error', reject);
  });
}

module.exports = genererTicketCloturePdf;
