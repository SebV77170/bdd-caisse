const { sqlite } = require('../db');

// --- Utilitaire : remonter à la session principale si on reçoit une secondaire
function getPrincipalUuid(uuid_session_caisse) {
  const row = sqlite.prepare(`
    SELECT
      CASE
        WHEN IFNULL(uuid_caisse_principale_si_secondaire, '') <> ''
          THEN uuid_caisse_principale_si_secondaire  -- on est sur une secondaire
        ELSE id_session                               -- on est déjà sur la principale
      END AS principal_uuid
    FROM session_caisse
    WHERE id_session = ?
  `).get(uuid_session_caisse);

  return row?.principal_uuid || uuid_session_caisse;
}

// --- Utilitaire : CTE réutilisable pour englober la principale + toutes ses secondaires
function sessionsCte() {
  return `
    WITH sessions(uuid) AS (
      SELECT ?                                 -- principale
      UNION
      SELECT id_session
      FROM session_caisse
      WHERE uuid_caisse_principale_si_secondaire = ?  -- secondaires rattachées
    )
  `;
}

// --- Utilitaire : retrouve le dernier ticket de la chaîne de corrections
function getDernierTicketCorrection(idTicketDepart) {
  let currentId = idTicketDepart;
  let next;

  do {
    const row = sqlite.prepare(`
      SELECT uuid_ticket_correction
      FROM journal_corrections
      WHERE uuid_ticket_original = ?
    `).get(currentId);

    if (row && row.uuid_ticket_correction) {
      next = row.uuid_ticket_correction;
      currentId = next;
    } else {
      next = null;
    }
  } while (next);

  return currentId;
}

// --- Fonction principale : calcul des réductions de session (principale + secondaires)
function getBilanReductionsSession(uuid_session_caisse) {
  const principalUuid = getPrincipalUuid(uuid_session_caisse);

  // 1) Tous les tickets des sessions (principale + secondaires) qui ne sont pas annulés
  const allTickets = sqlite.prepare(`
    ${sessionsCte()}
    SELECT t.uuid_ticket
    FROM ticketdecaisse t
    WHERE t.uuid_session_caisse IN (SELECT uuid FROM sessions)
      AND (t.flag_annulation IS NULL OR t.flag_annulation = 0)
  `).all(principalUuid, principalUuid).map(r => r.uuid_ticket);

  // 2) Tickets initiaux (ayant été corrigés) pour les exclure des "finaux"
  const corrections = sqlite.prepare(`
    SELECT uuid_ticket_original
    FROM journal_corrections
  `).all();
  const ticketsCorriges = new Set(corrections.map(c => c.uuid_ticket_original));

  // 3) Conserver uniquement les tickets finaux (non remplacés par une correction ultérieure)
  const ticketsFinaux = allTickets
    .filter(uuid => !ticketsCorriges.has(uuid))
    .map(uuid => getDernierTicketCorrection(uuid));

  // 4) Accumulateur
  const total = {
    nb_reduc_client: 0,
    montant_reduc_client: 0,
    nb_reduc_bene: 0,
    montant_reduc_bene: 0,
    nb_reduc_gros_panier_client: 0,
    montant_reduc_gros_panier_client: 0,
    nb_reduc_gros_panier_bene: 0,
    montant_reduc_gros_panier_bene: 0,
  };

  // 5) Additionner les lignes "Réduction" des tickets finaux
  for (const uuidTicket of ticketsFinaux) {
    const ticket = sqlite.prepare(`
      SELECT reducclient, reducbene, reducgrospanierclient, reducgrospanierbene
      FROM ticketdecaisse
      WHERE uuid_ticket = ?
    `).get(uuidTicket);

    if (!ticket) continue;

    const objets = sqlite.prepare(`
      SELECT nbr, prix
      FROM objets_vendus
      WHERE uuid_ticket = ?
        AND categorie = 'Réduction'
    `).all(uuidTicket);

    for (const obj of objets) {
      const nombre = Math.abs(obj.nbr) || 0;                 // positif
      const montant = Math.abs((obj.nbr || 0) * (obj.prix || 0)); // positif

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
