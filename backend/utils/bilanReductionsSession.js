const { sqlite } = require('../db');

// Fonction utilitaire : retrouve le dernier ticket de la chaîne de corrections
function getDernierTicketCorrection(db, idTicketDepart) {
  let currentId = idTicketDepart;
  let next;

  do {
    const row = db.prepare(`
      SELECT uuid_ticket_correction
      FROM journal_corrections
      WHERE uuid_ticket_original = ?
    `).get(currentId);

    if (row && row.id_ticket_correction) {
      next = row.id_ticket_correction;
      currentId = next;
    } else {
      next = null;
    }
  } while (next);

  return currentId;
}

// Fonction principale : calcul des réductions de session
function getBilanReductionsSession(uuid_session_caisse) {
  // 1. Tous les tickets de la session qui ne sont pas annulés
  const allTickets = sqlite.prepare(`
    SELECT uuid_ticket
    FROM ticketdecaisse
    WHERE uuid_session_caisse = ?
      AND (flag_annulation IS NULL OR flag_annulation = 0)
  `).all(uuid_session_caisse).map(row => row.uuid_ticket);

  // 2. Liste des tickets corrigés (tickets initiaux de la chaîne)
  const corrections = sqlite.prepare(`SELECT uuid_ticket_original FROM journal_corrections`).all();
  const ticketsCorriges = new Set(corrections.map(c => c.uuid_ticket_original));

  // 3. On garde uniquement les tickets "définitifs" (ceux qui ne sont pas corrigés par un autre)
  const ticketsFinaux = allTickets
    .filter(t => !ticketsCorriges.has(t)) // on ne garde pas les tickets d'origine
    .map(uuid => getDernierTicketCorrection(sqlite, uuid)); // on suit jusqu'au dernier ticket

  // 4. Initialisation du total
  const total = {
    nb_reduc_client: 0,
    montant_reduc_client: 0,
    nb_reduc_bene: 0,
    montant_reduc_bene: 0,
    nb_reduc_gros_panier_client: 0,
    montant_reduc_gros_panier_client: 0,
    nb_reduc_gros_panier_bene: 0,
    montant_reduc_gros_panier_bene: 0
  };

  // 5. Parcours des tickets finaux pour additionner les réductions
  for (const uuidTicket of ticketsFinaux) {
    const ticket = sqlite.prepare(`SELECT * FROM ticketdecaisse WHERE uuid_ticket = ?`).get(uuidTicket);

    const objets = sqlite.prepare(`
      SELECT * FROM objets_vendus
      WHERE uuid_ticket = ? AND categorie = 'Réduction'
    `).all(uuidTicket);

    for (const obj of objets) {
      const nombre = Math.abs(obj.nbr); // toujours positif
      const montant = Math.abs(obj.nbr * obj.prix); // toujours positif

      if (ticket.reducclient) {
        total.nb_reduc_client += nombre;
        total.montant_reduc_client += montant;
      } else if (ticket.reducbene) {
        total.nb_reduc_bene += nombre;
        total.montant_reduc_bene += montant;
      } else if (ticket.reducgrospanierclient) {
        total.nb_reduc_gros_panier_client += nombre;
        total.montant_reduc_gros_panier_client += montant;
      } else if (ticket.reducgrospanierbene) {
        total.nb_reduc_gros_panier_bene += nombre;
        total.montant_reduc_gros_panier_bene += montant;
      }
    }
  }

  return total;
}

module.exports = getBilanReductionsSession;
