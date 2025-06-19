const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');

function genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse) {
  return new Promise((resolve, reject) => {
    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
    if (!ticket) return reject(new Error('Ticket introuvable'));

    const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(ticket.id_ticket);

    const dir = path.join(__dirname, '../../factures');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const pdfPath = path.join(dir, `Facture-${uuid_facture}.pdf`);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(18).text("Facture", { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Facture #${uuid_facture}`);
    doc.text(`Raison sociale : ${raison_sociale}`);
    doc.text(`Adresse : ${adresse}`);
    doc.moveDown();
    doc.text(`Ticket associé : ${uuid_ticket}`);
    doc.text(`Date : ${ticket.date_achat_dt}`);
    doc.text(`Vendeur : ${ticket.nom_vendeur}`);
    doc.moveDown().text('Articles :');
    articles.forEach(a => {
      doc.text(`- ${a.nom} x${a.nbr} : ${(a.prix * a.nbr / 100).toFixed(2)} €`);
    });
    doc.moveDown();
    doc.text(`Total : ${(ticket.prix_total / 100).toFixed(2)} €`);
    doc.end();
    doc.on('finish', () => resolve(pdfPath));
    doc.on('error', err => reject(err));
  });
}

module.exports = genererFacturePdf;
