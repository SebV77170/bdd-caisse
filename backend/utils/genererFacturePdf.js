const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const { getFriendlyIdFromUuid } = require('../utils/genererFriendlyIds');
const logSync = require('../logsync');
const { drawPdfHeader } = require('./pdfHeader');


function genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse) {
  return new Promise((resolve, reject) => {
    try {
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
      const friendlyId = getFriendlyIdFromUuid(uuid_ticket);
      if (!ticket) return reject(new Error('Ticket introuvable'));

      const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(ticket.uuid_ticket);

      // 📆 Création du répertoire par date
      const date = new Date(ticket.date_achat_dt);
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const baseDir = path.join(os.homedir(), '.bdd-caisse');
      const dir = path.join(baseDir, 'factures', yyyy, mm, dd);
      fs.mkdirSync(dir, { recursive: true });

      const pdfPath = path.join(dir, `Facture-${raison_sociale}-${friendlyId}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // --- HEADER ---
      drawPdfHeader(doc, {
        dateLabel: `Date de facturation : ${date.toLocaleDateString('fr-FR')}`,
        numberLabel: 'Facture n°',
        number: friendlyId,
      });

      // --- CLIENT ---
      doc.fontSize(12).text("Destinataire :", { underline: true });
      doc.fontSize(10).text(raison_sociale);
      doc.text(adresse);
      doc.moveDown();

      // --- TABLE HEADER ---
      doc.moveDown();
      const tableHeaderY = doc.y;
      const columns = {
        designation: { x: 50, width: 190 },
        quantite: { x: 250, width: 70 },
        prix: { x: 350, width: 70 },
        total: { x: 450, width: 100 },
      };

      doc.fontSize(12);
      doc.text('Désignation', columns.designation.x, tableHeaderY, {
        width: columns.designation.width,
        lineBreak: false,
      });
      doc.text('Quantité', columns.quantite.x, tableHeaderY, {
        width: columns.quantite.width,
        align: 'right',
        lineBreak: false,
      });
      doc.text('Prix (€)', columns.prix.x, tableHeaderY, {
        width: columns.prix.width,
        align: 'right',
        lineBreak: false,
      });
      doc.text('Total (€)', columns.total.x, tableHeaderY, {
        width: columns.total.width,
        align: 'right',
        lineBreak: false,
      });

      let tableY = tableHeaderY + 20;
      doc.moveTo(50, tableY).lineTo(550, tableY).stroke();

      // --- ARTICLES ---
      let totalHT = 0;
      tableY += 10;
      articles.forEach(a => {
        const prix = a.prix / 100;
        const total = a.nbr * prix;
        totalHT += total;

        const rowHeight = Math.max(
          16,
          doc.heightOfString(a.nom, { width: columns.designation.width })
        );

        doc.fontSize(10);
        doc.text(a.nom, columns.designation.x, tableY, {
          width: columns.designation.width,
        });
        doc.text(a.nbr.toString(), columns.quantite.x, tableY, {
          width: columns.quantite.width,
          align: 'right',
          lineBreak: false,
        });
        doc.text(prix.toFixed(2), columns.prix.x, tableY, {
          width: columns.prix.width,
          align: 'right',
          lineBreak: false,
        });
        doc.text(total.toFixed(2), columns.total.x, tableY, {
          width: columns.total.width,
          align: 'right',
          lineBreak: false,
        });

        tableY += rowHeight + 4;
      });

      // --- TOTAL ---
      doc.moveTo(50, tableY).lineTo(550, tableY).stroke();
      tableY += 10;
      doc.fontSize(10).text(`Total à régler : ${totalHT.toFixed(2)} €`, 350, tableY, {
        width: 200,
        align: 'right',
      });
      doc.y = tableY + 20;

      // --- TVA ---
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

      stream.on('finish', () => {
        // 📁 Chemin relatif à enregistrer
        const relativePath = path.relative(path.join(__dirname, '../../'), pdfPath).replace(/\\/g, '/');

      sqlite
            .prepare('INSERT INTO facture (uuid_facture, uuid_ticket, lien) VALUES (?, ?, ?)')
            .run(uuid_facture, uuid_ticket, relativePath);
      
          logSync('facture', 'INSERT', {
            uuid_facture : uuid_facture,
            uuid_ticket : uuid_ticket,
            lien : relativePath
          });  

        resolve({
          lien: relativePath,
          friendlyId
        });

      });

      stream.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = genererFacturePdf;
