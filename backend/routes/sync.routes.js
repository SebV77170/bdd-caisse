// fichier: routes/sync-vers-mysql.routes.js (ou équivalent)

const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');

const safe = (val) => (val === undefined || val === null ? 0 : val);

const doublons = [];

// --- helpers
function formatDateToFR(isoDate) {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Combine "YYYY-MM-DD" + "HH:mm[:ss]" en ISO UTC ("YYYY-MM-DDTHH:mm:ssZ")
function combineUTC(d, t) {
  if (!d) return null;
  const time = (t || '00:00:00');
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return `${d}T${hhmmss}Z`;
}

function toEpochSec(v) {
  if (v == null || v === '') return null;
  // Essaye ISO direct
  const d1 = Date.parse(v);
  if (!Number.isNaN(d1)) return Math.floor(d1 / 1000);
  // Essaye Date de MySQL/driver (ex: objet Date JS)
  if (v instanceof Date && !Number.isNaN(v.getTime())) return Math.floor(v.getTime() / 1000);
  // Essaye new Date(string locale)
  const d2 = new Date(v);
  if (!Number.isNaN(d2.getTime())) return Math.floor(d2.getTime() / 1000);
  return null;
}

function normScalar(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  return String(val).trim();
}

async function compareChampsAvecMysql(table, uuidField, payload, pool) {
  const champsParTable = {
    ticketdecaisse: [
      'uuid_ticket','nom_vendeur','id_vendeur','date_achat_dt',
      'nbr_objet','moyen_paiement','prix_total','lien',
      'reducbene','reducclient','reducgrospanierclient','reducgrospanierbene',
      'uuid_session_caisse','flag_correction','corrige_le_ticket','annulation_de','flag_annulation'
    ],
    paiement_mixte: ['id_ticket','uuid_ticket','espece','carte','cheque','virement'],
    session_caisse: [
      'id_session','opened_at_utc','closed_at_utc','utilisateur_ouverture','responsable_ouverture',
      'utilisateur_fermeture','responsable_fermeture','fond_initial','montant_reel','commentaire',
      'ecart','caissiers','montant_reel_carte','montant_reel_cheque','montant_reel_virement','issecondaire','poste'
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

  const remote = rows[0];

  for (const champ of champs) {
    const lv = payload[champ];
    const rv = remote[champ];

    // 1) Dates : comparer à la seconde près
    if (champ === 'date_achat_dt' || champ.endsWith('_at_utc')) {
      const ls = toEpochSec(lv);
      const rs = toEpochSec(rv);
      if (ls !== rs) return false;
      continue;
    }

    // 2) lien : tolère '' (local) vs valeur (remote)
    if (champ === 'lien') {
      const l = (lv ?? '').trim();
      const r = (rv ?? '').trim();
      // On considère "pas de lien local" == "OK" si remote a déjà un chemin
      if (l === '' && r !== '') continue;
      if (l !== r) return false;
      continue;
    }

    // 3) Numériques : '300' vs 300
    if ([
      'prix_total','nbr_objet','reducbene','reducclient','reducgrospanierclient','reducgrospanierbene',
      'fond_initial','montant_reel','ecart','montant_reel_carte','montant_reel_cheque','montant_reel_virement',
      'espece','carte','cheque','virement','flag_correction','flag_annulation','issecondaire'
    ].includes(champ)) {
      const ln = lv == null || lv === '' ? 0 : Number(lv);
      const rn = rv == null || rv === '' ? 0 : Number(rv);
      if ((Number.isNaN(ln) ? '' : ln) !== (Number.isNaN(rn) ? '' : rn)) return false;
      continue;
    }

    // 4) Chaînes : trim/normalise
    if (normScalar(lv) !== normScalar(rv)) return false;
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

let syncRunning = false;

router.post('/', async (req, res) => {
  const io = req.app.get('socketio');
  const debugMode = req.query.debug === 'true';
  const debugLogs = [];

  if (syncRunning) return res.status(429).json({success:false, error:'Sync already running'});
  syncRunning = true;

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

        // Réservation atomique : on ne traite que si on a réussi à marquer "en cours"
        const reserved = sqlite
          .prepare('UPDATE sync_log SET synced = -1 WHERE id = ? AND synced = 0')
          .run(ligne.id).changes;
        if (reserved !== 1) {
          // ligne déjà prise par une autre exécution de la sync
          continue;
        }


        if (debugMode) debugLogs.push(`🔄 Traitement ID ${ligne.id} - ${type} (${operation})`);

        // -----------------------
        // TICKET DE CAISSE
        // -----------------------
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

            await pool.query(
              `INSERT INTO ticketdecaisse (uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, uuid_session_caisse, flag_correction, corrige_le_ticket, annulation_de, flag_annulation) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                payload.uuid_ticket, payload.nom_vendeur, payload.id_vendeur, payload.date_achat_dt,
                payload.nbr_objet, payload.moyen_paiement, payload.prix_total, payload.lien,
                payload.reducbene, payload.reducclient, payload.reducgrospanierclient, payload.reducgrospanierbene,
                payload.uuid_session_caisse, payload.flag_correction || 0, payload.corrige_le_ticket || null,
                payload.annulation_de || null, payload.flag_annulation || 0
              ]
            );
            if (debugMode) debugLogs.push(`✅ INSERT ticketdecaisse ${payload.uuid_ticket}`);

          } else if (operation === 'UPDATE') {
            await pool.query(
              `UPDATE ticketdecaisse
              SET
                nom_vendeur           = COALESCE(?, nom_vendeur),
                id_vendeur            = COALESCE(?, id_vendeur),
                date_achat_dt         = COALESCE(?, date_achat_dt),
                nbr_objet             = COALESCE(?, nbr_objet),
                moyen_paiement        = COALESCE(?, moyen_paiement),
                prix_total            = COALESCE(?, prix_total),
                lien                  = COALESCE(?, lien),
                reducbene             = COALESCE(?, reducbene),
                reducclient           = COALESCE(?, reducclient),
                reducgrospanierclient = COALESCE(?, reducgrospanierclient),
                reducgrospanierbene   = COALESCE(?, reducgrospanierbene),
                uuid_session_caisse   = COALESCE(?, uuid_session_caisse)
              WHERE uuid_ticket = ?`,
              [
                payload.nom_vendeur ?? null,
                payload.id_vendeur ?? null,
                payload.date_achat_dt ?? null,
                payload.nbr_objet ?? null,
                payload.moyen_paiement ?? null,
                payload.prix_total ?? null,
                payload.lien ?? null,
                payload.reducbene ?? null,
                payload.reducclient ?? null,
                payload.reducgrospanierclient ?? null,
                payload.reducgrospanierbene ?? null,
                payload.uuid_session_caisse ?? null,
                payload.uuid_ticket
              ]
            );
          

            if (debugMode) debugLogs.push(`✅ UPDATE ticketdecaisse ${payload.uuid_ticket}`);

          } else if (operation === 'DELETE') {
            await pool.query(`DELETE FROM ticketdecaisse WHERE uuid_ticket = ?`, [payload.uuid_ticket]);
            if (debugMode) debugLogs.push(`🗑️ DELETE ticketdecaisse ${payload.uuid_ticket}`);
          }
        }

        // -----------------------
        // OBJETS VENDUS
        // -----------------------
        else if (type === 'objets_vendus' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO objets_vendus (uuid_ticket, uuid_objet, nom, nom_vendeur, id_vendeur, categorie, souscat, date_achat, timestamp, prix, nbr) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.uuid_ticket, payload.uuid_objet, payload.nom, payload.nom_vendeur, payload.id_vendeur,
              payload.categorie, payload.souscat, payload.date_achat, payload.timestamp,
              payload.prix, payload.nbr
            ]
          );
          if (debugMode) debugLogs.push(`✅ INSERT objets_vendus ${payload.uuid_objet}`);
        }

        // -----------------------
        // PAIEMENT MIXTE
        // -----------------------
        else if (type === 'paiement_mixte' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              payload.id_ticket, safe(payload.espece), safe(payload.carte),
              safe(payload.cheque), safe(payload.virement), payload.uuid_ticket
            ]
          );
          if (debugMode) debugLogs.push(`✅ INSERT paiement_mixte ${payload.uuid_ticket}`);
        }
        // -----------------------
        // BILAN
        // -----------------------
        else if (type === 'bilan') {
          if (operation === 'INSERT') {
            const dateKey = formatDateToFR(payload.date);

            // Harmonisation pour supporter tes deux conventions de payload
            const nv       = safe(payload.nombre_vente ?? payload.nv);
            const poids    = safe(payload.poids);
            const total    = safe(payload.prix_total ?? payload.total);
            const espece   = safe(payload.prix_total_espece ?? payload.espece);
            const cheque   = safe(payload.prix_total_cheque ?? payload.cheque);
            const carte    = safe(payload.prix_total_carte  ?? payload.carte);
            const virement = safe(payload.prix_total_virement ?? payload.virement);
            const ts       = safe(payload.timestamp);

            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();

              // Verrouille la ligne de ce jour si elle existe (évite les courses)
              const [rows] = await conn.query(
                `SELECT 1 FROM bilan WHERE date = ? FOR UPDATE`,
                [dateKey]
              );

              if (rows.length === 0) {
                // Pas de ligne -> INSERT
                await conn.query(
                  `INSERT INTO bilan (
                    date, timestamp, nombre_vente, poids, prix_total,
                    prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [dateKey, ts, nv, poids, total, espece, cheque, carte, virement]
                );
                if (debugMode) debugLogs.push(`✅ INSERT bilan ${dateKey}`);
              } else {
                // Ligne existante -> cumul (on rejoue l'activité)
                await conn.query(
                  `UPDATE bilan SET
                    timestamp           = ?,
                    nombre_vente        = COALESCE(nombre_vente, 0)       + COALESCE(?, 0),
                    poids               = COALESCE(poids, 0)              + COALESCE(?, 0),
                    prix_total          = COALESCE(prix_total, 0)         + COALESCE(?, 0),
                    prix_total_espece   = COALESCE(prix_total_espece, 0)  + COALESCE(?, 0),
                    prix_total_cheque   = COALESCE(prix_total_cheque, 0)  + COALESCE(?, 0),
                    prix_total_carte    = COALESCE(prix_total_carte, 0)   + COALESCE(?, 0),
                    prix_total_virement = COALESCE(prix_total_virement, 0)+ COALESCE(?, 0)
                  WHERE date = ?`,
                  [ts, nv, poids, total, espece, cheque, carte, virement, dateKey]
                );
                if (debugMode) debugLogs.push(`✅ UPDATE (from INSERT) bilan ${dateKey}`);
              }

              await conn.commit();
            } catch (e) {
              await conn.rollback();
              throw e;
            } finally {
              conn.release();
            }

          } else if (operation === 'UPDATE') {
            // ✅ Ta logique existante conservée telle quelle
            await pool.query(
              `UPDATE bilan SET
                    timestamp           = ?,
                    nombre_vente        = COALESCE(nombre_vente, 0)       + COALESCE(?, 0),
                    poids               = COALESCE(poids, 0)              + COALESCE(?, 0),
                    prix_total          = COALESCE(prix_total, 0)         + COALESCE(?, 0),
                    prix_total_espece   = COALESCE(prix_total_espece, 0)  + COALESCE(?, 0),
                    prix_total_cheque   = COALESCE(prix_total_cheque, 0)  + COALESCE(?, 0),
                    prix_total_carte    = COALESCE(prix_total_carte, 0)   + COALESCE(?, 0),
                    prix_total_virement = COALESCE(prix_total_virement, 0)+ COALESCE(?, 0)
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

        // -----------------------
        // FACTURE
        // -----------------------
        else if (type === 'facture' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO facture (uuid_facture, uuid_ticket, lien) VALUES (?, ?, ?)`,
            [payload.uuid_facture, payload.uuid_ticket, payload.lien || null]
          );
        }

        // -----------------------
        // CODE POSTAL
        // -----------------------
        else if (type === 'code_postal' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO code_postal (code, date) VALUES (?, ?)`,
            [payload.code, payload.date]
          );
        }

        // -----------------------
        // JOURNAL CORRECTIONS
        // -----------------------
        else if (type === 'journal_corrections' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              payload.date_correction, payload.uuid_ticket_original,
              payload.uuid_ticket_annulation, payload.uuid_ticket_correction || null,
              payload.utilisateur, payload.motif
            ]
          );
        }

        // -----------------------
        // SESSION CAISSE (UTC)
        // -----------------------
        else if (type === 'session_caisse') {
          // Prépare UTC depuis payload (rétro-compat)
          const opened_at_utc =
            payload.opened_at_utc ||
            combineUTC(payload.date_ouverture, payload.heure_ouverture);

          const closed_at_utc =
            payload.closed_at_utc ||
            combineUTC(payload.date_fermeture, payload.heure_fermeture);

          if (operation === 'INSERT') {
            // Si l’ID existe déjà et que tout est identique -> marquer synced & sauter
            if (await existsInMysql('session_caisse', 'id_session', payload.id_session, pool)) {
              const identique = await compareChampsAvecMysql(
                'session_caisse', 'id_session',
                {
                  ...payload,
                  opened_at_utc,
                  closed_at_utc
                },
                pool
              );
              if (identique) {
                sqlite.prepare('UPDATE sync_log SET synced = 1 WHERE id = ?').run(ligne.id);
                if (debugMode) debugLogs.push(`↪️ Doublon session_caisse ${payload.id_session} déjà présent`);
                continue;
              }
            }

            await pool.query(
              `INSERT INTO session_caisse (
                 id_session,
                 opened_at_utc, closed_at_utc,
                 utilisateur_ouverture, responsable_ouverture,
                 utilisateur_fermeture, responsable_fermeture,
                 fond_initial, montant_reel,
                 commentaire, ecart, caissiers,
                 montant_reel_carte, montant_reel_cheque, montant_reel_virement,
                 issecondaire, poste
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

              [
                payload.id_session,
                opened_at_utc, closed_at_utc || null,
                payload.utilisateur_ouverture || null, payload.responsable_ouverture || null,
                payload.utilisateur_fermeture || null, payload.responsable_fermeture || null,
                safe(payload.fond_initial), safe(payload.montant_reel),
                payload.commentaire || null, safe(payload.ecart), payload.caissiers || null,
                safe(payload.montant_reel_carte), safe(payload.montant_reel_cheque), safe(payload.montant_reel_virement),
                safe(payload.issecondaire), payload.poste || null
              ]
            );
            if (debugMode) debugLogs.push(`✅ INSERT session_caisse ${payload.id_session}`);

          } else if (operation === 'UPDATE') {
            // mise à jour de clôture / montants / commentaire…
            await pool.query(
              `UPDATE session_caisse
               SET closed_at_utc = COALESCE(?, closed_at_utc),
                   utilisateur_fermeture = ?,
                   responsable_fermeture = ?,
                   montant_reel = ?,
                   commentaire = ?,
                   ecart = ?,
                   montant_reel_carte = ?,
                   montant_reel_cheque = ?,
                   montant_reel_virement = ?
               WHERE id_session = ?`,
              [
                closed_at_utc || null,
                payload.utilisateur_fermeture || null,
                payload.responsable_fermeture || null,
                safe(payload.montant_reel),
                payload.commentaire || null,
                safe(payload.ecart),
                safe(payload.montant_reel_carte),
                safe(payload.montant_reel_cheque),
                safe(payload.montant_reel_virement),
                payload.id_session
              ]
            );
            if (debugMode) debugLogs.push(`✅ UPDATE session_caisse ${payload.id_session}`);
          }
        }

        // -----------------------
        // UUID MAPPING
        // -----------------------
        else if (type === 'uuid_mapping' && operation === 'INSERT') {
          await pool.query(
            `INSERT INTO uuid_mapping (uuid, id_friendly, type) VALUES (?, ?, ?)`,
            [payload.uuid, payload.id_friendly, payload.type]
          );
        }

        // ✅ marquer la ligne comme synchronisée
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
    syncRunning = false;
    if (io) io.emit('syncEnd', { success: syncSuccess });
  }
});

module.exports = router;
