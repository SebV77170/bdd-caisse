// routes/recevoir-de-secondaire.js

const express = require('express');
const { randomUUID } = require('crypto');
const { validateSyncEntry } = require('../utils/syncValidation');

function buildDynamicUpdate(table, data, keyField) {
  const fields = Object.keys(data).filter(key => key !== keyField && data[key] !== undefined);
  const sql = `UPDATE ${table} SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE ${keyField} = ?`;
  const values = [...fields.map(f => data[f]), data[keyField]];
  return { sql, values };
}

module.exports = function (io) {
  const router = express.Router();
  const { sqlite } = require('../db');

  const safe = (val) => (val === undefined || val === null ? 0 : val);

  // Plusieurs caisses peuvent demander une synchronisation en parallèle.
  const requests = new Map();
  const completedRequests = new Map();
  const openingRequests = new Map();

  function findRequest(requestId) {
    if (requestId) return requests.get(requestId) || completedRequests.get(requestId);
    if (requests.size === 1) return requests.values().next().value;
    return null;
  }

  function rememberCompletedRequest(syncRequest) {
    completedRequests.set(syncRequest.requestId, syncRequest);
    setTimeout(() => {
      completedRequests.delete(syncRequest.requestId);
    }, 5 * 60 * 1000).unref?.();
  }

  function buildBatchKey(sourceId, logs) {
    const operationUuids = logs
      .map(log => log.operation_uuid)
      .filter(Boolean)
      .sort();
    if (operationUuids.length !== logs.length || operationUuids.length === 0) {
      return null;
    }
    return `${sourceId}:${operationUuids.join(',')}`;
  }

  router.get('/status', (req, res) => {
    const principalSession = sqlite.prepare(`
      SELECT id_session
      FROM session_caisse
      WHERE closed_at_utc IS NULL
        AND COALESCE(issecondaire, 0) = 0
      LIMIT 1
    `).get();
    res.json({
      success: true,
      role: 'caisse-principale',
      service: 'synchronisation-secondaire',
      principalSessionOpen: !!principalSession,
      principalSessionId: principalSession?.id_session || null
    });
  });

  router.post('/ouverture/demande', (req, res) => {
    const principalSession = sqlite.prepare(`
      SELECT id_session
      FROM session_caisse
      WHERE closed_at_utc IS NULL
        AND COALESCE(issecondaire, 0) = 0
      LIMIT 1
    `).get();
    if (!principalSession) {
      return res.status(409).json({
        success: false,
        error: "Aucune session de caisse principale n'est ouverte sur ce poste."
      });
    }

    const requestId = randomUUID();
    const openingRequest = {
      requestId,
      sourceId: req.body.sourceId || 'poste-inconnu',
      sourceName: req.body.sourceName || 'Caisse secondaire',
      registerNumber: req.body.registerNumber ?? null,
      requestedBy: req.body.requestedBy || null,
      principalSessionId: principalSession.id_session,
      result: null,
      expiresAt: Date.now() + 35_000
    };
    openingRequests.set(requestId, openingRequest);
    io.emit('demande-ouverture-secondaire', {
      type: 'DEMANDE_OUVERTURE_SECONDAIRE',
      ...openingRequest,
      result: undefined,
      expiresAt: undefined
    });
    return res.json({ success: true, requestId });
  });

  router.post('/ouverture/repondre', (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, error: 'Utilisateur principal non connecté.' });
    }
    const openingRequest = openingRequests.get(req.body.requestId);
    if (!openingRequest || openingRequest.expiresAt <= Date.now()) {
      if (openingRequest) openingRequests.delete(req.body.requestId);
      return res.status(404).json({ success: false, error: 'Demande expirée ou introuvable.' });
    }

    const accepted = req.body.decision === 'accepter';
    openingRequest.result = accepted
      ? { success: true, decision: 'accepted' }
      : { success: false, decision: 'refused' };
    return res.json({ success: true });
  });

  router.post('/ouverture/attente', async (req, res) => {
    const openingRequest = openingRequests.get(req.body.requestId);
    if (!openingRequest) {
      return res.status(404).json({ success: false, error: 'Demande introuvable.' });
    }

    while (openingRequest.result === null && openingRequest.expiresAt > Date.now()) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    const result = openingRequest.result || {
      success: false,
      decision: 'timeout'
    };
    openingRequests.delete(openingRequest.requestId);
    return res.json(result);
  });

  // util: combine "YYYY-MM-DD" + "HH:mm[:ss]" en ISO UTC
  const combineUTC = (d, t) => {
    if (!d) return null;
    const time = (t || '00:00:00');
    const hhmmss = time.length === 5 ? `${time}:00` : time; // si "HH:mm" -> "HH:mm:00"
    return `${d}T${hhmmss}Z`;
  };

  // === 1) La secondaire demande l’autorisation d’envoyer ===
  router.post('/demande', (req, res) => {
    const logs = req.body.logs;
    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'Payload invalide : tableau attendu' });
    }

    const requestId = randomUUID();
    const sourceId = req.body.sourceId || 'caisse-secondaire-inconnue';
    const batchKey = buildBatchKey(sourceId, logs);
    if (batchKey) {
      const existingRequest = [...requests.values()]
        .find(request => request.batchKey === batchKey);
      if (existingRequest) {
        return res.json({
          requestId: existingRequest.requestId,
          duplicate: true,
          message: 'Cette demande est déjà en attente de validation.'
        });
      }
    }

    const syncRequest = {
      requestId,
      sourceId,
      batchKey,
      logs,
      validationResult: null
    };

    const operationUuids = logs
      .map(log => log.operation_uuid)
      .filter(Boolean);
    if (operationUuids.length === logs.length && operationUuids.length > 0) {
      const alreadyReceived = operationUuids.every(operationUuid => (
        sqlite.prepare(`
          SELECT 1
          FROM sync_received_operations
          WHERE operation_uuid = ?
          LIMIT 1
        `).get(operationUuid)
      ));
      if (alreadyReceived) {
        syncRequest.validationResult = {
          success: true,
          ids: logs.map(log => log.id),
          replayed: true
        };
        rememberCompletedRequest(syncRequest);
        return res.json({
          requestId,
          replayed: true,
          message: 'Lot déjà intégré sur la caisse principale.'
        });
      }
    }

    requests.set(requestId, syncRequest);

    io.emit('demande-sync-secondaire', {
      type: 'DEMANDE_SYNC',
      message: 'La caisse secondaire veut vous envoyer ses données',
      requestId,
      sourceId: syncRequest.sourceId
    });

    res.json({
      requestId,
      message: 'Demande de synchronisation reçue. En attente de validation sur la caisse principale.'
    });
  });

  // === 2) La secondaire attend la décision EFFECTIVE (long-poll) ===
  router.post('/attente-validation', async (req, res) => {
    const syncRequest = findRequest(req.body.requestId);
    if (!syncRequest) {
      return res.status(400).json({ success: false, message: 'Aucune synchronisation en attente.' });
    }

    const maxMs = 25_000;     // durée max d’attente
    const interval = 500;     // pas de polling
    const start = Date.now();

    // boucle d’attente jusqu’à ce que validationResult soit fixé par /valider
    while (syncRequest.validationResult === null && (Date.now() - start) < maxMs) {
      await new Promise(r => setTimeout(r, interval));
    }

    if (syncRequest.validationResult === null) {
      // Toujours pas de décision : on signale "en attente"
      // 202 Accepted = traitement asynchrone en cours
      return res.status(202).json({
        success: false,
        pending: true,
        message: 'Toujours en attente de validation de la caisse principale.'
      });
    }

    // Décision prête : on la renvoie telle quelle
    const result = syncRequest.validationResult;
    requests.delete(syncRequest.requestId);
    rememberCompletedRequest(syncRequest);
    return res.json(result);
  });

  // === 3) Le caissier principal clique "valider" (ou refuse) ===
  router.post('/valider', (req, res) => {
    const { decision, uuid_session_caisse_principale, requestId } = req.body;
    const syncRequest = findRequest(requestId);
    if (!syncRequest) {
      return res.status(400).json({ error: 'Aucune demande de synchronisation en attente' });
    }
    if (syncRequest.validationResult !== null) {
      return res.json({
        success: syncRequest.validationResult.success,
        alreadyProcessed: true,
        accepted: syncRequest.validationResult.ids || [],
        failed: []
      });
    }

    if (decision !== 'accepter') {
      // REFUS immédiat
      syncRequest.validationResult = {
        success: false,
        message: 'Synchronisation refusée par la caisse principale.'
      };

      io.emit('demande-sync-secondaire', {
        type: 'REFUS_SYNC',
        message: 'La synchronisation a été refusée par la caisse principale.'
      });

      return res.json({ message: 'Synchronisation refusée par la caisse principale' });
    }

    // DECISION = ACCEPTER → on applique les logs en base
    const logs = syncRequest.logs;
    const sourceId = syncRequest.sourceId;
    const db = sqlite;
    let validationComplete = false;

    try {
      const normalizedLogs = logs.map(log => {
        const data = typeof log.payload === 'string'
          ? JSON.parse(log.payload)
          : log.payload;
        validateSyncEntry(log.type, log.operation, data);
        return { ...log, data };
      });
      const incomingTicketUuids = new Set(
        normalizedLogs
          .filter(log => log.type === 'ticketdecaisse' && log.operation === 'INSERT')
          .map(log => log.data.uuid_ticket)
      );
      for (const log of normalizedLogs) {
        if (!['objets_vendus', 'paiement_mixte'].includes(log.type)) continue;
        const ticketExists = incomingTicketUuids.has(log.data.uuid_ticket)
          || db.prepare('SELECT 1 FROM ticketdecaisse WHERE uuid_ticket = ? LIMIT 1')
            .get(log.data.uuid_ticket);
        if (!ticketExists) {
          throw new Error(
            `Référence vers un ticket absent : ${log.data.uuid_ticket}`
          );
        }
      }
      validationComplete = true;

      db.transaction(() => {
        // normalisation des montants pour "bilan"
        const norm = (data) => ({
          nv: safe(data.nombre_vente ?? 0),
          poids: safe(data.poids ?? 0),
          total: safe(data.prix_total ?? 0),
          espece: safe(data.prix_total_espece ?? data.espece ?? 0),
          cheque: safe(data.prix_total_cheque ?? data.cheque ?? 0),
          carte:  safe(data.prix_total_carte  ?? data.carte  ?? 0),
          virement: safe(data.prix_total_virement ?? data.virement ?? 0),
        });

        // statements bilan
        const selectBilanByDate = db.prepare(`SELECT 1 FROM bilan WHERE date = ?`);
        const insertBilan = db.prepare(`
          INSERT INTO bilan (
            date, timestamp, nombre_vente, poids, prix_total,
            prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        // Update additif (timestamp écrasé comme en MySQL)
        const updateBilanAdd = db.prepare(`
          UPDATE bilan SET
            timestamp = ?,
            nombre_vente = COALESCE(nombre_vente, 0) + ?,
            poids        = COALESCE(poids, 0) + ?,
            prix_total   = COALESCE(prix_total, 0) + ?,
            prix_total_espece   = COALESCE(prix_total_espece, 0) + ?,
            prix_total_cheque   = COALESCE(prix_total_cheque, 0) + ?,
            prix_total_carte    = COALESCE(prix_total_carte, 0) + ?,
            prix_total_virement = COALESCE(prix_total_virement, 0) + ?
          WHERE date = ?
        `);

        normalizedLogs.forEach(log => {
          const { type, operation, data } = log;
          const operationUuid = log.operation_uuid || `${sourceId}:legacy:${log.id}`;
          const receipt = db.prepare(`
            INSERT OR IGNORE INTO sync_received_operations (operation_uuid, source_id)
            VALUES (?, ?)
          `).run(operationUuid, sourceId);
          if (receipt.changes === 0) return;

          if (type === 'ticketdecaisse') {
            if (operation === 'INSERT') {
              db.prepare(`INSERT OR IGNORE INTO ticketdecaisse (uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene, uuid_session_caisse, flag_correction, corrige_le_ticket, annulation_de, flag_annulation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).
                run(
                  data.uuid_ticket, data.nom_vendeur, data.id_vendeur, data.date_achat_dt,
                  data.nbr_objet, data.moyen_paiement, data.prix_total, data.lien,
                  data.reducbene, data.reducclient, data.reducgrospanierclient, data.reducgrospanierbene,
                  data.uuid_session_caisse, safe(data.flag_correction), data.corrige_le_ticket, data.annulation_de, safe(data.flag_annulation)
                );
            } else if (operation === 'UPDATE') {
              const { sql, values } = buildDynamicUpdate('ticketdecaisse', data, 'uuid_ticket');
              db.prepare(sql).run(values);
            } else if (operation === 'DELETE') {
              db.prepare(`DELETE FROM ticketdecaisse WHERE uuid_ticket = ?`).run(data.uuid_ticket);
            }

          } else if (type === 'objets_vendus' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO objets_vendus (uuid_ticket, uuid_objet, nom, nom_vendeur, id_vendeur, categorie, souscat, date_achat, timestamp, prix, nbr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).
              run(
                data.uuid_ticket, data.uuid_objet, data.nom, data.nom_vendeur, data.id_vendeur,
                data.categorie, data.souscat, data.date_achat, data.timestamp, data.prix, data.nbr
              );

          } else if (type === 'paiement_mixte' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket) VALUES (?, ?, ?, ?, ?, ?)`).
              run(data.id_ticket, safe(data.espece), safe(data.carte), safe(data.cheque), safe(data.virement), data.uuid_ticket);

          } else if (type === 'bilan') {
            const a = norm(data);
            if (operation === 'INSERT') {
              const exists = selectBilanByDate.get(data.date);
              if (exists) {
                updateBilanAdd.run(
                  safe(data.timestamp),
                  a.nv, a.poids, a.total, a.espece, a.cheque, a.carte, a.virement,
                  data.date
                );
              } else {
                insertBilan.run(
                  data.date, safe(data.timestamp),
                  a.nv, a.poids, a.total, a.espece, a.cheque, a.carte, a.virement
                );
              }
            } else if (operation === 'UPDATE') {
              updateBilanAdd.run(
                safe(data.timestamp),
                a.nv, a.poids, a.total, a.espece, a.cheque, a.carte, a.virement,
                data.date
              );
            }

          } else if (type === 'session_caisse') {
            // Nouveau schéma UTC, rétro-compatible
            if (operation === 'INSERT') {
              const opened_at_utc =
                data.opened_at_utc ||
                combineUTC(data.date_ouverture, data.heure_ouverture); // fallback ancien format

              db.prepare(`
                INSERT OR IGNORE INTO session_caisse (
                  id_session,
                  opened_at_utc,
                  utilisateur_ouverture, responsable_ouverture,
                  fond_initial, commentaire, ecart, caissiers,
                  montant_reel, montant_reel_carte, montant_reel_cheque, montant_reel_virement,
                  issecondaire, poste, uuid_caisse_principale_si_secondaire
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                data.id_session,
                opened_at_utc,
                data.utilisateur_ouverture, data.responsable_ouverture,
                safe(data.fond_initial), data.commentaire ?? null, safe(data.ecart), data.caissiers ?? null,
                safe(data.montant_reel), safe(data.montant_reel_carte), safe(data.montant_reel_cheque), safe(data.montant_reel_virement),
                safe(data.issecondaire), data.poste ?? null, uuid_session_caisse_principale
              );

            } else if (operation === 'UPDATE') {
              const closed_at_utc =
                data.closed_at_utc ||
                combineUTC(data.date_fermeture, data.heure_fermeture); // fallback ancien format

              db.prepare(`
                UPDATE session_caisse SET
                  closed_at_utc = COALESCE(?, closed_at_utc),
                  utilisateur_fermeture = ?,
                  responsable_fermeture = ?,
                  montant_reel = ?,
                  commentaire = ?,
                  ecart = ?,
                  montant_reel_carte = ?,
                  montant_reel_cheque = ?,
                  montant_reel_virement = ?,
                  uuid_caisse_principale_si_secondaire = ?
                WHERE id_session = ?
              `).run(
                closed_at_utc,
                data.utilisateur_fermeture ?? null,
                data.responsable_fermeture ?? null,
                safe(data.montant_reel),
                data.commentaire ?? null,
                safe(data.ecart),
                safe(data.montant_reel_carte),
                safe(data.montant_reel_cheque),
                safe(data.montant_reel_virement),
                uuid_session_caisse_principale,
                data.id_session
              );
            }

          } else if (type === 'journal_corrections' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO journal_corrections (date_correction, uuid_ticket_original, uuid_ticket_annulation, uuid_ticket_correction, utilisateur, motif) VALUES (?, ?, ?, ?, ?, ?)`).
              run(data.date_correction, data.uuid_ticket_original, data.uuid_ticket_annulation, data.uuid_ticket_correction, data.utilisateur, data.motif);

          } else if (type === 'facture' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO facture (uuid_facture, uuid_ticket, lien) VALUES (?, ?, ?)`).
              run(data.uuid_facture, data.uuid_ticket, data.lien);

          } else if (type === 'code_postal' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO code_postal (code, date) VALUES (?, ?)`).
              run(data.code, data.date);

          } else if (type === 'uuid_mapping' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO uuid_mapping (uuid, id_friendly, type) VALUES (?, ?, ?)`).
              run(data.uuid, data.id_friendly, data.type);

          } else if (type === 'users' && operation === 'INSERT') {
            db.prepare(`INSERT OR IGNORE INTO users (prenom, nom, pseudo, password, admin, mail, tel, uuid_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).
              run(data.prenom, data.nom, data.pseudo, data.password, safe(data.admin), data.mail, data.tel, data.uuid_user);

          } else {
            throw new Error(`Type non reconnu ou opération non supportée : ${type}/${operation}`);
          }
        });
      })();

      // Succès : on fixe le résultat pour /attente-validation et on notifie
      const ids = logs.map(log => log.id);
      syncRequest.validationResult = { success: true, ids };

      io.emit('demande-sync-secondaire', {
        type: 'SUCCES_SYNC',
        message: 'Les données ont bien été intégrées depuis la caisse secondaire.'
      });
      io.emit('bilanUpdated');
      return res.json({ success: true, accepted: ids, failed: [] });

    } catch (err) {
      console.error('Erreur application des opérations sync_log :', err);
      syncRequest.validationResult = {
        success: false,
        message: 'Échec de la synchronisation pendant le traitement.',
        details: err.message
      };

      io.emit('demande-sync-secondaire', {
        type: 'ECHEC_SYNC',
        message: 'Échec de la synchronisation.'
      });

      return res.status(validationComplete ? 500 : 422).json({
        success: false,
        accepted: [],
        failed: [{ error: err.message }],
        error: validationComplete
          ? 'Erreur lors de l’application des données'
          : 'Lot de synchronisation invalide',
        details: err.message
      });
    }
  });

  return router;
};
