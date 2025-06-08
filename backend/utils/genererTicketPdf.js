const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');

function genererTicketPdf(uuid_ticket) {
  return new Promise((resolve, reject) => {
    const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
    if (!ticket) return reject(new Error('Ticket introuvable'));

    const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE id_ticket = ?').all(ticket.id_ticket);

    const pdfPath = path.join(__dirname, `../../tickets/Ticket-${uuid_ticket}.pdf`);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(16).text("Ticket de caisse - Ressource'Brie", { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date : ${ticket.date_achat_dt}`);
    doc.text(`Vendeur : ${ticket.nom_vendeur}`);
    doc.text(`Paiement : ${ticket.moyen_paiement}`);
    doc.text(`Total : ${(ticket.prix_total / 100).toFixed(2)} €`);
    doc.moveDown().text('Articles :');

    articles.forEach(art => {
      doc.text(`- ${art.nom} x${art.nbr} : ${(art.prix * art.nbr / 100).toFixed(2)} €`);
    });

    doc.moveDown();
    doc.text('Merci de votre visite !', { align: 'center' });
    doc.end();
    doc.on('finish', () => resolve());
    doc.on('error', err => reject(err));
  });
}

module.exports = genererTicketPdf;
