const { sqlite } = require('../db');

/**
 * Retourne le bilan d'une session de caisse "principale", en cumulant :
 * - ses propres tickets
 * - les tickets de toutes les sessions marquées comme secondaires
 *   (session_caisse.uuid_caisse_principale_si_secondaire = uuid principale)
 *
 * @param {string} uuid_session_caisse - peut être l'uuid d'une principale OU d'une secondaire
 */
function getBilanSession(uuid_session_caisse) {
  // 1) Si on reçoit l'uuid d'une secondaire, remonter à la principale.
  const principalRow = sqlite.prepare(`
    SELECT
      CASE
        WHEN IFNULL(uuid_caisse_principale_si_secondaire, '') <> ''
          THEN uuid_caisse_principale_si_secondaire   -- on est sur une secondaire : renvoyer l'uuid de la principale
        ELSE id_session                               -- on est déjà sur la principale
      END AS principal_uuid
    FROM session_caisse
    WHERE id_session = ?
  `).get(uuid_session_caisse);

  const principalUuid = principalRow?.principal_uuid || uuid_session_caisse;

  // 2) Construire l'ensemble des sessions à inclure : la principale + toutes les secondaires qui y sont rattachées
  const result =
    sqlite.prepare(`
      WITH sessions(uuid) AS (
        SELECT id_session
        FROM session_caisse
        WHERE id_session = ?                         -- la principale

        UNION

        SELECT id_session
        FROM session_caisse
        WHERE uuid_caisse_principale_si_secondaire = ?  -- toutes les secondaires rattachées
      )
      SELECT
        SUM(CASE
              WHEN t.corrige_le_ticket IS NULL
               AND t.annulation_de   IS NULL
              THEN 1 ELSE 0
            END)                                    AS nombre_ventes,

        SUM(COALESCE(p.espece,   0))                AS prix_total_espece,
        SUM(COALESCE(p.carte,    0))                AS prix_total_carte,
        SUM(COALESCE(p.cheque,   0))                AS prix_total_cheque,
        SUM(COALESCE(p.virement, 0))                AS prix_total_virement,

        SUM(COALESCE(p.espece,0) + COALESCE(p.carte,0) + COALESCE(p.cheque,0) + COALESCE(p.virement,0))
                                                    AS prix_total
      FROM ticketdecaisse t
      LEFT JOIN paiement_mixte p
             ON p.uuid_ticket = t.uuid_ticket       -- LEFT JOIN pour tolérer l'absence temporaire de paiement_mixte
      WHERE t.uuid_session_caisse IN (SELECT uuid FROM sessions)
    `).get(principalUuid, principalUuid);

  // 3) Valeurs par défaut si aucun ticket
  return result || {
    nombre_ventes: 0,
    prix_total_espece: 0,
    prix_total_carte: 0,
    prix_total_cheque: 0,
    prix_total_virement: 0,
    prix_total: 0
  };
}

module.exports = getBilanSession;
