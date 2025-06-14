const { sqlite } = require('../db');

function getBilanReductionsSession(uuid_session_caisse) {
  return sqlite.prepare(`
    SELECT
      SUM(CASE WHEN t.reducclient = 1 THEN -ov.nbr ELSE 0 END) AS nb_reduc_client,
      SUM(CASE WHEN t.reducclient = 1 THEN -ov.nbr * ov.prix ELSE 0 END) AS montant_reduc_client,
      SUM(CASE WHEN t.reducbene = 1 THEN -ov.nbr ELSE 0 END) AS nb_reduc_bene,
      SUM(CASE WHEN t.reducbene = 1 THEN -ov.nbr * ov.prix ELSE 0 END) AS montant_reduc_bene,
      SUM(CASE WHEN t.reducgrospanierclient = 1 THEN -ov.nbr ELSE 0 END) AS nb_reduc_gros_panier_client,
      SUM(CASE WHEN t.reducgrospanierclient = 1 THEN -ov.nbr * ov.prix ELSE 0 END) AS montant_reduc_gros_panier_client,
      SUM(CASE WHEN t.reducgrospanierbene = 1 THEN -ov.nbr ELSE 0 END) AS nb_reduc_gros_panier_bene,
      SUM(CASE WHEN t.reducgrospanierbene = 1 THEN -ov.nbr * ov.prix ELSE 0 END) AS montant_reduc_gros_panier_bene
    FROM ticketdecaisse t
    JOIN objets_vendus ov ON t.id_ticket = ov.id_ticket
    WHERE t.uuid_session_caisse = ?
      AND ov.categorie = 'Réduction'
  `).get(uuid_session_caisse) || {
    nb_reduc_client: 0,
    montant_reduc_client: 0,
    nb_reduc_bene: 0,
    montant_reduc_bene: 0,
    nb_reduc_gros_panier_client: 0,
    montant_reduc_gros_panier_client: 0,
    nb_reduc_gros_panier_bene: 0,
    montant_reduc_gros_panier_bene: 0
  };
}

module.exports = getBilanReductionsSession;
