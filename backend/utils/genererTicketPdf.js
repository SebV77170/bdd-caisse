const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const { getFriendlyIdFromUuid } = require('../utils/genererFriendlyIds');
const { drawPdfHeader } = require('./pdfHeader');

function genererTicketPdf(uuid_ticket) {
  return new Promise((resolve, reject) => {
    try {
      const friendlyId = getFriendlyIdFromUuid(uuid_ticket);
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
      if (!ticket) return reject(new Error('Ticket introuvable'));

      const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(uuid_ticket);

      // --- Date et dossier par date ---
      const date = new Date(ticket.date_achat_dt);
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');

       const baseDir = path.join(os.homedir(), '.bdd-caisse');
      const dir = path.join(baseDir, 'tickets', yyyy, mm, dd);
      fs.mkdirSync(dir, { recursive: true }); // ✅ Crée tous les dossiers si besoin

      const pdfPath = path.join(dir, `Ticket-${friendlyId}.pdf`);

      // --- Création du PDF ---
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // --- HEADER ---
      drawPdfHeader(doc, {
        dateLabel: `Date : ${date.toLocaleDateString('fr-FR')}`,
        numberLabel: 'Ticket n°',
        number: friendlyId,
      });

      doc.fontSize(12).text("Ticket de caisse - Ressource'Brie", { align: 'center', underline: true });

      // --- INFOS VENDEUR ---
      doc.moveDown(1);
      doc.fontSize(10)
        .text(`Vendeur : ${ticket.nom_vendeur}`)
        .text(`Mode de paiement : ${ticket.moyen_paiement}`);

      // --- TABLE HEADER ---
      doc.moveDown(1);
      const startY = doc.y;
      doc.fontSize(11);
      doc.text('Désignation', 50, startY);
      doc.text('Quantité', 250, startY);
      doc.text('Prix (€)', 350, startY);
      doc.text('Total (€)', 450, startY);
      doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();

      // --- ARTICLES ---
      let totalHT = 0;
      let y = startY + 25;
      const colWidths = { nom: 180, qte: 60, prix: 60, total: 60 };

      articles.forEach(a => {
        const prix = a.prix / 100;
        const total = a.nbr * prix;
        totalHT += total;

        const rowHeight = doc.heightOfString(a.nom, { width: colWidths.nom }) + 6;

        doc.rect(50, y - 2, 500, rowHeight + 2).strokeColor('#ccc').stroke();
        doc.fontSize(10).fillColor('black');
        doc.text(a.nom, 50 + 2, y, { width: colWidths.nom });
        doc.text(a.nbr.toString(), 250 + 2, y, { width: colWidths.qte, align: 'right' });
        doc.text(prix.toFixed(2), 350 + 2, y, { width: colWidths.prix, align: 'right' });
        doc.text(total.toFixed(2), 450 + 2, y, { width: colWidths.total, align: 'right' });

        y += rowHeight + 2;
      });

      // --- TOTAL ---
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      doc.fontSize(10).text(`Total réglé : ${totalHT.toFixed(2)} €`, 450, y, { width: 100, align: 'right' });

      // --- MENTION TVA ---
      y += 30;
      doc.fontSize(9)
        .fillColor('#555555')
        .text("TVA non applicable, article 293 B du CGI – Association loi 1901 non assujettie à la TVA.", 50, y, {
          width: 500,
          align: 'left'
        });

      // --- PIED DE PAGE ---
      doc.fillColor('black');
      doc.moveDown(3).fontSize(9);
      doc.text("Ressource’Brie", 50);
      doc.text("28 avenue Carnot");
      doc.text("77170 Brie-Comte-Robert");
      doc.text("SIRET : 912 217 197");
      doc.text("IBAN : FR76 1027 8061 5700 0205 9490 183");

      doc.end();

      stream.on('finish', () => {
  // 🧠 On extrait un chemin relatif propre pour l'enregistrement
  const relativePath = path.relative(path.join(__dirname, '../../'), pdfPath).replace(/\\/g, '/');

  // 📦 Mise à jour du champ `lien` en base
  sqlite.prepare('UPDATE ticketdecaisse SET lien = ? WHERE uuid_ticket = ?')
    .run(relativePath, uuid_ticket);

  // 📝 Log optionnel
  try {
    const logSync = require('../logSync');
    logSync('ticketdecaisse', 'UPDATE', { uuid_ticket, lien: relativePath });
  } catch (e) {
    console.warn('logSync non disponible, pas de log enregistré.');
  }

  resolve(pdfPath);
});

      stream.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = genererTicketPdf;
