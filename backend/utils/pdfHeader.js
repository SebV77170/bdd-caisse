const fs = require('fs');
const path = require('path');

function getPdfLogoPath() {
  const candidates = [
    path.join(__dirname, '../../frontend/src/images/logo.png'),
    path.join(__dirname, '../assets/logo.png'),
  ];

  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, 'images', 'logo.png'));
  }

  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function drawPdfHeader(doc, { dateLabel, numberLabel, number }) {
  const logoPath = getPdfLogoPath();
  const rightColumnX = 260;
  const rightColumnWidth = 285;
  const numberText = `${numberLabel} : ${number}`;

  if (logoPath) {
    doc.image(logoPath, 50, 45, {
      fit: [100, 65],
      align: 'left',
      valign: 'top',
    });
  }

  doc.fontSize(10).fillColor('black');
  doc.text(dateLabel, rightColumnX, 50, {
    width: rightColumnWidth,
    align: 'right',
    lineBreak: false,
  });

  const numberWidth = doc.widthOfString(numberText);
  const numberFontSize = Math.max(8, Math.min(10, 10 * rightColumnWidth / numberWidth));
  doc.fontSize(numberFontSize).text(numberText, rightColumnX, 68, {
    width: rightColumnWidth,
    align: 'right',
    lineBreak: false,
  });

  doc.y = 130;
}

module.exports = { drawPdfHeader, getPdfLogoPath };
