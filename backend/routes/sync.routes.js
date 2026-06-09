// fichier: routes/sync-vers-mysql.routes.js (ou équivalent)

const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');
const { randomUUID } = require('crypto');
const { validateSyncEntry } = require('../utils/syncValidation');

const safe = (val) => (val === undefined || val === null ? 0 : val);
const MYSQL_SYNC_TABLES = [
  'bdd_caisse_sync_operations',
  'ticketdecaisse',
  'objets_vendus',
  'paiement_mixte',
  'bilan',
  'facture',
  'code_postal',
  'journal_corrections',
  'session_caisse',
  'uuid_mapping'
];

function getSyncTablePrefix() {
  const prefix = process.env.BDD_CAISSE_SYNC_TABLE_PREFIX || '';
  if (!prefix) return '';
  if (process.env.BDD_CAISSE_ALLOW_ISOLATED_SYNC !== 'true') {
    throw new Error('Le préfixe de tables de synchronisation est réservé aux tests isolés.');
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(prefix)) {
    throw new Error('Préfixe de tables de synchronisation invalide.');
  }
  return prefix;
}

function namespaceSyncSql(sql) {
  const prefix = getSyncTablePrefix();
  if (!prefix) return sql;

  return MYSQL_SYNC_TABLES.reduce((rewritten, tableName) => {
    const pattern = new RegExp(`\\b${tableName}\\b`, 'g');
    return rewritten.replace(pattern, `\`${prefix}${tableName}\``);
  }, sql);
}

function namespaceMysqlConnection(connection) {
  if (!getSyncTablePrefix()) return connection;

  return new Proxy(connection, {
    get(target, property) {
      if (property === 'query' || property === 'execute') {
        return (sql, ...args) => target[property](namespaceSyncSql(sql), ...args);
      }
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

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
  const doublons = [];

  if (syncRunning) return res.status(429).json({success:false, error:'Sync already running'});
  syncRunning = true;

  if (io) io.emit('syncStart');
  let syncSuccess = true;
  const failedLines = [];
  const acceptedLines = [];

  try {
    const pool = getMysqlPool();
    const connection = namespaceMysqlConnection(await pool.getConnection());
    try {
      await connection.query('SELECT 1');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS bdd_caisse_sync_operations (
          operation_uuid VARCHAR(64) PRIMARY KEY,
          resource_type VARCHAR(64) NOT NULL,
          operation_type VARCHAR(16) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } finally {
      connection.release();
    }

    const lignes = sqlite.prepare(`SELECT * FROM sync_log WHERE synced = 0`).all();
    const invalidLines = [];
    for (const ligne of lignes) {
      try {
        validateSyncEntry(ligne.type, ligne.operation, JSON.parse(ligne.payload));
      } catch (error) {
        invalidLines.push({ id: ligne.id, type: ligne.type, error: error.message });
      }
    }
    if (invalidLines.length > 0) {
      syncSuccess = false;
      return res.status(422).json({
        success: false,
        accepted: [],
        failed: invalidLines,
        error: 'Lot de synchronisation invalide. Aucune ligne n’a été envoyée.'
      });
    }

    for (const ligne of lignes) {
      let remote = null;
      try {
        const payload = JSON.parse(ligne.payload);
        const { type, operation } = ligne;
        validateSyncEntry(type, operation, payload);
        const operationUuid = ligne.operation_uuid || randomUUID();
        if (!ligne.operation_uuid) {
          sqlite.prepare('UPDATE sync_log SET operation_uuid = ? WHERE id = ?')
            .run(operationUuid, ligne.id);
        }

        // Réservation atomique : on ne traite que si on a réussi à marquer "en cours"
        const reserved = sqlite
          .prepare('UPDATE sync_log SET synced = -1 WHERE id = ? AND synced = 0')
          .run(ligne.id).changes;
        if (reserved !== 1) {
          // ligne déjà prise par une autre exécution de la sync
          continue;
        }

        remote = namespaceMysqlConnection(await pool.getConnection());
        await remote.beginTransaction();
        const [receipt] = await remote.query(
          `INSERT IGNORE INTO bdd_caisse_sync_operations
             (operation_uuid, resource_type, operation_type)
           VALUES (?, ?, ?)`,
          [operationUuid, type, operation]
        );
        if (receipt.affectedRows === 0) {
          await remote.commit();
          sqlite.prepare('UPDATE sync_log SET synced = 1 WHERE id = ?').run(ligne.id);
          doublons.push({ type, uuid: operationUuid });
          acceptedLines.push(ligne.id);
          continue;
        }


        if (debugMode) debugLogs.push(`🔄 Traitement ID ${ligne.id} - ${type} (${operation})`);

        // -----------------------
        // TICKET DE CAISSE
        // -----------------------
        if (type === 'ticketdecaisse') {
          if (operation === 'INSERT') {
            if (await existsInMysql('ticketdecaisse', 'uuid_ticket', payload.uuid_ticket, remote)) {
              const identique = await compareChampsAvecMysql('ticketdecaisse', 'uuid_ticket', payload, remote);
              if (identique) {
                doublons.push({ type, uuid: payload.uuid_ticket });
                if (debugMode) debugLogs.push(`↪️ Doublon ticket ${payload.uuid_ticket} déjà présent`);
              } else {
                throw new Error(`Conflit distant pour le ticket ${payload.uuid_ticket}`);
              }
            } else {
            await remote.query(
              `INSERT INTO ticketdecaisse (uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, uuid_session_caisse, flag_correction, corrige_le_ticket, annulation_de, flag_annulation, cloture) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                payload.uuid_ticket, payload.nom_vendeur, payload.id_vendeur, payload.date_achat_dt,
                payload.nbr_objet, payload.moyen_paiement, payload.prix_total, payload.lien,
                payload.reducbene, payload.reducclient, payload.reducgrospanierclient, payload.reducgrospanierbene,
                payload.uuid_session_caisse, payload.flag_correction || 0, payload.corrige_le_ticket || null,
                payload.annulation_de || null, payload.flag_annulation || 0, payload.cloture || 0
              ]
            );
            }
            if (debugMode) debugLogs.push(`✅ INSERT ticketdecaisse ${payload.uuid_ticket}`);

          } else if (operation === 'UPDATE') {
            await remote.query(
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
            await remote.query(`DELETE FROM ticketdecaisse WHERE uuid_ticket = ?`, [payload.uuid_ticket]);
            if (debugMode) debugLogs.push(`🗑️ DELETE ticketdecaisse ${payload.uuid_ticket}`);
          } else {
            throw new Error(`Opération ticketdecaisse non supportée : ${operation}`);
          }
        }

        // -----------------------
        // OBJETS VENDUS
        // -----------------------
        else if (type === 'objets_vendus' && operation === 'INSERT') {
          await remote.query(
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
          await remote.query(
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

            // Le verrou et le cumul font partie de la transaction de l'opération.
            const [rows] = await remote.query(
              `SELECT 1 FROM bilan WHERE date = ? FOR UPDATE`,
              [dateKey]
            );

            if (rows.length === 0) {
              await remote.query(
                `INSERT INTO bilan (
                  date, timestamp, nombre_vente, poids, prix_total,
                  prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [dateKey, ts, nv, poids, total, espece, cheque, carte, virement]
              );
              if (debugMode) debugLogs.push(`✅ INSERT bilan ${dateKey}`);
            } else {
              await remote.query(
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

          } else if (operation === 'UPDATE') {
            // ✅ Ta logique existante conservée telle quelle
            await remote.query(
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
                safe(payload.timestamp),
                safe(payload.nombre_vente ?? payload.nv),
                safe(payload.poids),
                safe(payload.prix_total ?? payload.total),
                safe(payload.prix_total_espece ?? payload.espece),
                safe(payload.prix_total_cheque ?? payload.cheque),
                safe(payload.prix_total_carte ?? payload.carte),
                safe(payload.prix_total_virement ?? payload.virement),
                formatDateToFR(payload.date)
              ]
            );
            if (debugMode) debugLogs.push(`✅ UPDATE bilan ${payload.date}`);
          } else {
            throw new Error(`Opération bilan non supportée : ${operation}`);
          }
        }

        // -----------------------
        // FACTURE
        // -----------------------
        else if (type === 'facture' && operation === 'INSERT') {
          await remote.query(
            `INSERT INTO facture (uuid_facture, uuid_ticket, lien) VALUES (?, ?, ?)`,
            [payload.uuid_facture, payload.uuid_ticket, payload.lien || null]
          );
        }

        // -----------------------
        // CODE POSTAL
        // -----------------------
        else if (type === 'code_postal' && operation === 'INSERT') {
          await remote.query(
            `INSERT INTO code_postal (code, date) VALUES (?, ?)`,
            [payload.code, payload.date]
          );
        }

        // -----------------------
        // JOURNAL CORRECTIONS
        // -----------------------
        else if (type === 'journal_corrections' && operation === 'INSERT') {
          await remote.query(
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
            if (await existsInMysql('session_caisse', 'id_session', payload.id_session, remote)) {
              const identique = await compareChampsAvecMysql(
                'session_caisse', 'id_session',
                {
                  ...payload,
                  opened_at_utc,
                  closed_at_utc
                },
                remote
              );
              if (identique) {
                if (debugMode) debugLogs.push(`↪️ Doublon session_caisse ${payload.id_session} déjà présent`);
              } else {
                throw new Error(`Conflit distant pour la session ${payload.id_session}`);
              }
            } else {
            await remote.query(
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
            }
            if (debugMode) debugLogs.push(`✅ INSERT session_caisse ${payload.id_session}`);

          } else if (operation === 'UPDATE') {
            // mise à jour de clôture / montants / commentaire…
            await remote.query(
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
          } else {
            throw new Error(`Opération session_caisse non supportée : ${operation}`);
          }
        }

        // -----------------------
        // UUID MAPPING
        // -----------------------
        else if (type === 'uuid_mapping' && operation === 'INSERT') {
          await remote.query(
            `INSERT INTO uuid_mapping (uuid, id_friendly, type) VALUES (?, ?, ?)`,
            [payload.uuid, payload.id_friendly, payload.type]
          );
        } else {
          throw new Error(`Type non reconnu ou opération non supportée : ${type}/${operation}`);
        }

        // ✅ marquer la ligne comme synchronisée
        await remote.commit();
        sqlite.prepare(`UPDATE sync_log SET synced = 1 WHERE id = ?`).run(ligne.id);
        acceptedLines.push(ligne.id);

      } catch (err) {
        if (remote) {
          try {
            await remote.rollback();
          } catch {}
        }
        sqlite.prepare('UPDATE sync_log SET synced = 0 WHERE id = ? AND synced = -1').run(ligne.id);
        failedLines.push({ id: ligne.id, type: ligne.type, error: err.message });
        if (debugMode) debugLogs.push(`❌ Erreur ligne ID ${ligne.id} : ${err.message}`);
      } finally {
        if (remote) remote.release();
      }
    }

    const doublonsUniques = doublons.filter(
      (d, i, arr) => arr.findIndex(x => x.type === d.type && x.uuid === d.uuid) === i
    );

    syncSuccess = failedLines.length === 0;
    const response = {
      success: syncSuccess,
      accepted: acceptedLines,
      doublons: doublonsUniques,
      failed: failedLines
    };
    if (debugMode) response.debug = debugLogs;
    res.status(syncSuccess ? 200 : 500).json(response);

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
