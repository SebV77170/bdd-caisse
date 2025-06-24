const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');

function genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse) {
  return new Promise((resolve, reject) => {
    try {
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
      if (!ticket) return reject(new Error('Ticket introuvable'));

      const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(ticket.id_ticket);
      const dir = path.join(__dirname, '../../factures');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      const pdfPath = path.join(dir, `Facture-${uuid_facture}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const logoPath = path.join(__dirname, '../../images/logo.png');

      // --- HEADER ---
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
      }
      doc.fontSize(10);
      doc.text(`Date de facturation : ${new Date(ticket.date_achat_dt).toLocaleDateString()}`, 400, 50);
      doc.text(`Facture n° : ${uuid_facture.slice(0, 8)}`, 400, 65);

      // --- CLIENT ---
      doc.moveDown(2);
      doc.fontSize(12).text("Destinataire :", { underline: true });
      doc.fontSize(10).text(`${raison_sociale}`);
      doc.text(`${adresse}`);
      doc.moveDown();

      // --- TABLE HEADER ---
      doc.moveDown().fontSize(12).text('Désignation', 50)
        .text('Quantité', 250)
        .text('Prix (€)', 350)
        .text('Total (€)', 450);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      // --- ARTICLES ---
      let totalHT = 0;
      doc.moveDown(0.5);
      articles.forEach(a => {
        const prix = a.prix / 100;
        const total = (a.nbr * prix);
        totalHT += total;

        doc.fontSize(10)
          .text(a.nom, 50)
          .text(a.nbr.toString(), 250)
          .text(prix.toFixed(2), 350)
          .text(total.toFixed(2), 450);
      });

      // --- TOTAL ---
      doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      doc.fontSize(10)
        .text(`Total à régler : ${totalHT.toFixed(2)} €`, { align: 'right' });

      // --- MENTION TVA FIABLE ---
      doc.moveDown();
      doc.fontSize(9)
        .fillColor('#555555')
        .text("TVA non applicable, article 293 B du CGI – Association loi 1901 non assujettie à la TVA.", 50, doc.y, {
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

module.exports = genererFacturePdf;
