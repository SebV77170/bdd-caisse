// routes/recevoir-de-secondaire.js

const express = require('express');

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

  // État en mémoire (process principal)
  let pendingLogs = null;        // tableau de logs à traiter
  let validationResult = null;   // null | { success:true, ids } | { success:false, message }

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

    // reset de l’état
    pendingLogs = logs;
    validationResult = null;

    io.emit('demande-sync-secondaire', {
      type: 'DEMANDE_SYNC',
      message: 'La caisse secondaire veut vous envoyer ses données'
    });

    res.json({ message: 'Demande de synchronisation reçue. En attente de validation sur la caisse principale.' });
  });

  // === 2) La secondaire attend la décision EFFECTIVE (long-poll) ===
  router.post('/attente-validation', async (req, res) => {
    // si rien en attente
    if (!pendingLogs && !validationResult) {
      return res.status(400).json({ success: false, message: 'Aucune synchronisation en attente.' });
    }

    const maxMs = 25_000;     // durée max d’attente
    const interval = 500;     // pas de polling
    const start = Date.now();

    // boucle d’attente jusqu’à ce que validationResult soit fixé par /valider
    while (validationResult === null && (Date.now() - start) < maxMs) {
      await new Promise(r => setTimeout(r, interval));
    }

    if (validationResult === null) {
      // Toujours pas de décision : on signale "en attente"
      // 202 Accepted = traitement asynchrone en cours
      return res.status(202).json({
        success: false,
        pending: true,
        message: 'Toujours en attente de validation de la caisse principale.'
      });
    }

    // Décision prête : on la renvoie telle quelle
    return res.json(validationResult);
  });

  // === 3) Le caissier principal clique "valider" (ou refuse) ===
  router.post('/valider', (req, res) => {
    const { decision, uuid_session_caisse_principale } = req.body;
    if (!pendingLogs) {
      return res.status(400).json({ error: 'Aucune demande de synchronisation en attente' });
    }

    if (decision !== 'accepter') {
      // REFUS immédiat
      validationResult = { success: false, message: 'Synchronisation refusée par la caisse principale.' };
      pendingLogs = null;

      io.emit('demande-sync-secondaire', {
        type: 'REFUS_SYNC',
        message: 'La synchronisation a été refusée par la caisse principale.'
      });

      return res.json({ message: 'Synchronisation refusée par la caisse principale' });
    }

    // DECISION = ACCEPTER → on applique les logs en base
    const logs = pendingLogs;
    const db = sqlite;

    try {
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

        logs.forEach(log => {
          const { type, operation, payload } = log;
          const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

          if (!type || !operation || !data) throw new Error('Entrée sync_log incomplète');

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
                  montant_reel_virement = ?
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
      validationResult = { success: true, ids };
      pendingLogs = null;

      io.emit('demande-sync-secondaire', {
        type: 'SUCCES_SYNC',
        message: 'Les données ont bien été intégrées depuis la caisse secondaire.'
      });
      io.emit('bilanUpdated');
      return res.json({ success: true });

    } catch (err) {
      console.error('Erreur application des opérations sync_log :', err);
      validationResult = {
        success: false,
        message: 'Échec de la synchronisation pendant le traitement.'
      };
      pendingLogs = null;

      io.emit('demande-sync-secondaire', {
        type: 'ECHEC_SYNC',
        message: 'Échec de la synchronisation.'
      });

      return res.status(500).json({ error: 'Erreur lors de l’application des données', details: err.message });
    }
  });

  return router;
};
