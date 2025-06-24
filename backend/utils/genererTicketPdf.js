const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const {getFriendlyIdFromUuid} = require('../utils/genererFriendlyIds');


function genererTicketPdf(uuid_ticket) {
  return new Promise((resolve, reject) => {
    try {
      const friendlyId = getFriendlyIdFromUuid(uuid_ticket);
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
      if (!ticket) return reject(new Error('Ticket introuvable'));

      const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(uuid_ticket);

      const dir = path.join(__dirname, '../../tickets');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      const pdfPath = path.join(dir, `Ticket-${friendlyId}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const logoPath = path.join(__dirname, '../../images/logo.png');

      // --- HEADER ---
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
      }
      doc.fontSize(10);
      doc.text(`Date : ${new Date(ticket.date_achat_dt).toLocaleDateString()}`, 400, 50);
      doc.text(`Ticket n° : ${friendlyId.slice(0, 8)}`, 400, 65);

      doc.moveDown(2);
      doc.fontSize(12).text("Ticket de caisse - Ressource'Brie", { align: 'center', underline: true });

      // --- INFOS VENDEUR ---
      doc.moveDown(1);
      doc.fontSize(10)
        .text(`Vendeur : ${ticket.nom_vendeur}`)
        .text(`Mode de paiement : ${ticket.moyen_paiement}`);

      // --- TABLE HEADER ALIGNÉ ---
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
        const total = (a.nbr * prix);
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
      doc.fillColor('black');

      // --- PIED DE PAGE ---
      doc.moveDown(3).fontSize(9);
      doc.text("Ressource’Brie", 50);
      doc.text("28 avenue Carnot");
      doc.text("77170 Brie-Comte-Robert");
      doc.text("SIRET : 912 217 197");
      doc.text("IBAN : FR76 1027 8061 5700 0205 9490 183");

      doc.end();

      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = genererTicketPdf;
