const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');

const safe = (val) => (val === undefined || val === null ? 0 : val);

const doublons = [];

function formatDateToFR(isoDate) {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

async function compareChampsAvecMysql(table, uuidField, payload, pool) {
  const champsParTable = {
    ticketdecaisse: [
      'uuid_ticket', 'nom_vendeur', 'id_vendeur', 'date_achat_dt',
      'nbr_objet', 'moyen_paiement', 'prix_total', 'lien',
      'reducbene', 'reducclient', 'reducgrospanierclient', 'reducgrospanierbene'
    ],
    paiement_mixte: [
      'id_ticket', 'uuid_ticket', 'carte', 'espece', 'cheque', 'virement'
    ],
    session_caisse: [
      'uuid_session', 'timestamp_debut', 'id_ouverture', 'fond_ouverture',
      'id_fermeture', 'fond_fermeture', 'commentaire', 'caissiers'
    ]
  };

  const champs = champsParTable[table];
  if (!champs) return false;

  const champsSql = champs.join(', ');
  const [rows] = await pool.query(
    `SELECT ${champsSql} FROM ${table} WHERE ${uuidField} = ? LIMIT 1`,
    [payload[uuidField]]
  );
  if (rows.length === 0) return false;

  const ligneMysql = rows[0];

  for (const champ of champs) {
    const localVal = payload[champ];
    const remoteVal = ligneMysql[champ];

    const localStr = localVal === null || localVal === undefined ? '' : String(localVal);
    const remoteStr = remoteVal === null || remoteVal === undefined ? '' : String(remoteVal);

    if (localStr !== remoteStr) return false;
  }
  return true;
}

async function existsInMysql(table, uuidField, uuidValue, pool) {
  const [rows] = await pool.query(
    `SELECT 1 FROM ${table} WHERE ${uuidField} = ? LIMIT 1`,
    [uuidValue]
  );
  return rows.length > 0;
}

router.post('/', async (req, res) => {
  const io = req.app.get('socketio');
  const debugMode = req.query.debug === 'true';
  const debugLogs = [];

  if (io) io.emit('syncStart');
  let syncSuccess = true;

  try {
    const pool = getMysqlPool();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();

    const lignes = sqlite.prepare(`SELECT * FROM sync_log WHERE synced = 0`).all();

    for (const ligne of lignes) {
      try {
        const payload = JSON.parse(ligne.payload);
        const { type, operation } = ligne;
        if (!type || !payload || !operation) continue;

        if (debugMode) debugLogs.push(`🔄 Traitement ID ${ligne.id} - ${type} (${operation})`);

        // TICKET DE CAISSE
        if (type === 'ticketdecaisse') {
          if (operation === 'INSERT') {
            if (await existsInMysql('ticketdecaisse', 'uuid_ticket', payload.uuid_ticket, pool)) {
              const identique = await compareChampsAvecMysql('ticketdecaisse', 'uuid_ticket', payload, pool);
              if (identique) {
                sqlite.prepare('UPDATE sync_log SET synced = 1 WHERE id = ?').run(ligne.id);
                doublons.push({ type, uuid: payload.uuid_ticket });
                if (debugMode) debugLogs.push(`↪️ Doublon ticket ${payload.uuid_ticket} déjà présent`);
              }
              continue;
            }

            await pool.query(`INSERT INTO ticketdecaisse (uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, uuid_session_caisse, flag_correction, corrige_le_ticket, annulation_de, flag_annulation) VALUES (?,?,?,?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
              payload.uuid_ticket, payload.nom_vendeur, payload.id_vendeur, payload.date_achat_dt,
              payload.nbr_objet, payload.moyen_paiement, payload.prix_total, payload.lien,
              payload.reducbene, payload.reducclient, payload.reducgrospanierclient, payload.reducgrospanierbene, payload.uuid_session_caisse, payload.flag_correction || 0, payload.corrige_le_ticket || null, payload.annulation_de || null, payload.flag_annulation || 0 
            ]);
            if (debugMode) debugLogs.push(`✅ INSERT ticketdecaisse ${payload.uuid_ticket}`);
          } else if (operation === 'UPDATE') {
            await pool.query(`UPDATE ticketdecaisse SET nom_vendeur = ?, id_vendeur = ?, date_achat_dt = ?, nbr_objet = ?, moyen_paiement = ?, prix_total = ?, lien = ?, reducbene = ?, reducclient = ?, reducgrospanierclient = ?, reducgrospanierbene = ?, uuid_session_caisse = ? WHERE uuid_ticket = ?`, [
              payload.nom_vendeur, payload.id_vendeur, payload.date_achat_dt, payload.nbr_objet,
              payload.moyen_paiement, payload.prix_total, payload.lien,
              payload.reducbene, payload.reducclient, payload.reducgrospanierclient, payload.reducgrospanierbene,
              payload.uuid_ticket, payload.uuid_session_caisse
            ]);
            if (debugMode) debugLogs.push(`✅ UPDATE ticketdecaisse ${payload.uuid_ticket}`);
          } else if (operation === 'DELETE') {
            await pool.query(`DELETE FROM ticketdecaisse WHERE uuid_ticket = ?`, [payload.uuid_ticket]);
            if (debugMode) debugLogs.push(`🗑️ DELETE ticketdecaisse ${payload.uuid_ticket}`);
          }
        }

        else if (type === 'objets_vendus' && operation === 'INSERT') {
          await pool.query(`INSERT INTO objets_vendus (uuid_ticket, uuid_objet, nom, nom_vendeur, id_vendeur, categorie, souscat, date_achat, timestamp, prix, nbr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            payload.uuid_ticket, payload.uuid_objet, payload.nom, payload.nom_vendeur, payload.id_vendeur,
            payload.categorie, payload.souscat, payload.date_achat, payload.timestamp,
            payload.prix, payload.nbr
          ]);
          if (debugMode) debugLogs.push(`✅ INSERT objets_vendus ${payload.uuid_objet}`);
        }

        else if (type === 'paiement_mixte' && operation === 'INSERT') {
          await pool.query(`INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket) VALUES (?, ?, ?, ?, ?, ?)`, [
            payload.id_ticket, safe(payload.espece), safe(payload.carte),
            safe(payload.cheque), safe(payload.virement), payload.uuid_ticket
          ]);
          if (debugMode) debugLogs.push(`✅ INSERT paiement_mixte ${payload.uuid_ticket}`);
        }

        else if (type === 'bilan') {
          if (operation === 'INSERT') {
            await pool.query(
              `INSERT INTO bilan 
              (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                formatDateToFR(payload.date),
                safe(payload.timestamp), safe(payload.nombre_vente),
                safe(payload.poids), safe(payload.prix_total), safe(payload.prix_total_espece),
                safe(payload.prix_total_cheque), safe(payload.prix_total_carte),
                safe(payload.prix_total_virement)
              ]
            );
            if (debugMode) debugLogs.push(`✅ INSERT bilan ${formatDateToFR(payload.date)}`);
          } else if (operation === 'UPDATE') {
            await pool.query(
              `UPDATE bilan 
              SET timestamp = ?, 
                  nombre_vente = nombre_vente + ?, 
                  poids = poids + ?, 
                  prix_total = prix_total + ?, 
                  prix_total_espece = prix_total_espece + ?, 
                  prix_total_cheque = prix_total_cheque + ?, 
                  prix_total_carte = prix_total_carte + ?, 
                  prix_total_virement = prix_total_virement + ? 
              WHERE date = ?`,
              [
                safe(payload.timestamp), safe(payload.nombre_vente), safe(payload.poids),
                safe(payload.prix_total), safe(payload.espece),
                safe(payload.cheque), safe(payload.carte),
                safe(payload.virement),
                formatDateToFR(payload.date)
              ]
            );
            if (debugMode) debugLogs.push(`✅ UPDATE bilan ${payload.date}`);
          }
        }

        else if (type === 'facture' && operation === 'INSERT') {
          await pool.query(`INSERT INTO facture (uuid_facture, uuid_ticket, lien) VALUES (?, ?, ?)`, [
            payload.uuid_facture, payload.uuid_ticket, payload.lien || null
          ]);
        }

        else if (type === 'code_postal' && operation === 'INSERT') {
          await pool.query(`INSERT INTO code_postal (code, date) VALUES (?, ?)`, [
            payload.code, payload.date
          ]);
        }

        else if (type === 'journal_corrections' && operation === 'INSERT') {
          await pool.query(`INSERT INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif) VALUES (?, ?, ?, ?, ?, ?)`, [
            payload.date_correction, payload.uuid_ticket_original,
            payload.uuid_ticket_annulation, payload.uuid_ticket_correction || null,
            payload.utilisateur, payload.motif
          ]);
        }

        else if (type === 'session_caisse') {
          if (operation === 'INSERT') {
            await pool.query(`INSERT INTO session_caisse (id_session, date_ouverture, heure_ouverture, utilisateur_ouverture, responsable_ouverture, fond_initial, date_fermeture, heure_fermeture, utilisateur_fermeture, responsable_fermeture, montant_reel, commentaire, ecart, caissiers, montant_reel_carte, montant_reel_cheque, montant_reel_virement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
              payload.id_session, payload.date_ouverture, payload.heure_ouverture,
              payload.utilisateur_ouverture, payload.responsable_ouverture,
              safe(payload.fond_initial), payload.date_fermeture, payload.heure_fermeture,
              payload.utilisateur_fermeture, payload.responsable_fermeture,
              safe(payload.montant_reel), payload.commentaire, safe(payload.ecart),
              payload.caissiers, safe(payload.montant_reel_carte),
              safe(payload.montant_reel_cheque), safe(payload.montant_reel_virement)
            ]);
          } else if (operation === 'UPDATE') {
            await pool.query(`UPDATE session_caisse SET date_fermeture = ?, heure_fermeture = ?, utilisateur_fermeture = ?, responsable_fermeture = ?, montant_reel = ?, commentaire = ?, ecart = ?, montant_reel_carte = ?, montant_reel_cheque = ?, montant_reel_virement = ? WHERE id_session = ?`, [
              payload.date_fermeture, payload.heure_fermeture, payload.utilisateur_fermeture,
              payload.responsable_fermeture, safe(payload.montant_reel),
              payload.commentaire, safe(payload.ecart),
              safe(payload.montant_reel_carte), safe(payload.montant_reel_cheque),
              safe(payload.montant_reel_virement), payload.id_session
            ]);
          }
        }

        else if (type === 'uuid_mapping' && operation === 'INSERT') {
          await pool.query(`INSERT INTO uuid_mapping (uuid, id_friendly, type) VALUES (?, ?, ?)`, [
            payload.uuid, payload.id_friendly, payload.type
          ]);
        }

        else if (type === 'users' && operation === 'INSERT') {
          await pool.query(`INSERT INTO users (prenom, nom, pseudo, password, admin, mail, tel, uuid_user) VALUES (?, ?, ?, ?, ?, ?, ?,?)`, [
            payload.nom, payload.prenom, payload.pseudo, payload.password,
            payload.admin || 0, payload.mail || '', payload.tel || '', payload.uuid_user
          ]);
        }

        sqlite.prepare(`UPDATE sync_log SET synced = 1 WHERE id = ?`).run(ligne.id);
      } catch (err) {
        if (debugMode) debugLogs.push(`❌ Erreur ligne ID ${ligne.id} : ${err.message}`);
      }
    }

    const doublonsUniques = doublons.filter(
      (d, i, arr) => arr.findIndex(x => x.type === d.type && x.uuid === d.uuid) === i
    );

    const response = { success: true, doublons: doublonsUniques };
    if (debugMode) response.debug = debugLogs;
    res.json(response);

  } catch (err) {
    console.error('❌ ERREUR DURANT LA SYNC :', err);
    syncSuccess = false;
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erreur de synchronisation côté serveur.' });
    }
  } finally {
    if (io) io.emit('syncEnd', { success: syncSuccess });
  }
});

module.exports = router;
