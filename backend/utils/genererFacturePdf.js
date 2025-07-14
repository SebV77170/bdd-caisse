const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFDocument = require('pdfkit');
const { sqlite } = require('../db');
const { getFriendlyIdFromUuid } = require('../utils/genererFriendlyIds');
const logSync = require('../logsync');


function genererFacturePdf(uuid_facture, uuid_ticket, raison_sociale, adresse) {
  return new Promise((resolve, reject) => {
    try {
      const ticket = sqlite.prepare('SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?').get(uuid_ticket);
      const friendlyId = getFriendlyIdFromUuid(uuid_ticket);
      if (!ticket) return reject(new Error('Ticket introuvable'));

      const articles = sqlite.prepare('SELECT * FROM objets_vendus WHERE uuid_ticket = ?').all(ticket.uuid_ticket);

      // 📆 Création du répertoire par date
      const date = new Date(ticket.date_achat_dt);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const baseDir = path.join(os.homedir(), '.bdd-caisse');
      const dir = path.join(baseDir, 'factures', yyyy, mm, dd);
      fs.mkdirSync(dir, { recursive: true });

      const pdfPath = path.join(dir, `Facture-${raison_sociale}-${friendlyId}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      let logoPath = path.join(__dirname, '../../images/logo.png');
      if (!fs.existsSync(logoPath) && process.resourcesPath) {
        const alt = path.join(process.resourcesPath, 'images', 'logo.png');
        if (fs.existsSync(alt)) logoPath = alt;
      }

      // --- HEADER ---
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
      }
      doc.fontSize(10);
      doc.text(`Date de facturation : ${date.toLocaleDateString()}`, 400, 50);
      doc.text(`Facture n° : ${friendlyId.slice(0, 8)}`, 400, 65);

      // --- CLIENT ---
      doc.moveDown(2);
      doc.fontSize(12).text("Destinataire :", { underline: true });
      doc.fontSize(10).text(raison_sociale);
      doc.text(adresse);
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
        const total = a.nbr * prix;
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
      doc.fontSize(10).text(`Total à régler : ${totalHT.toFixed(2)} €`, { align: 'right' });

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
