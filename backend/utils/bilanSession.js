const {sqlite} = require('../db'); // ajuste le chemin selon ta structure

function getBilanSession(uuid_session_caisse) {
  return sqlite.prepare(`
    SELECT 
      SUM(CASE WHEN t.corrige_le_ticket IS NULL AND t.annulation_de IS NULL THEN 1 ELSE 0 END) AS nombre_ventes,
      SUM(p.espece) AS prix_total_espece,
      SUM(p.carte) AS prix_total_carte,
      SUM(p.cheque) AS prix_total_cheque,
      SUM(p.virement) AS prix_total_virement,
      SUM(p.espece + p.carte + p.cheque + p.virement) AS prix_total
    FROM ticketdecaisse t
    JOIN paiement_mixte p ON t.uuid_ticket = p.uuid_ticket
    WHERE t.uuid_session_caisse = ?
  `).get(uuid_session_caisse) || {
    nombre_ventes: 0,
    prix_total_espece: 0,
    prix_total_carte: 0,
    prix_total_cheque: 0,
    prix_total_virement: 0,
    prix_total: 0
  };
}

module.exports = getBilanSession;
