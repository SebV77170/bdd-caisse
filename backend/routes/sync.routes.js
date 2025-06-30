const express = require('express');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');

router.post('/', async (req, res) => {
  const io = req.app.get('socketio');
  let pool ;
  if (io) io.emit('syncStart');
  let syncSuccess = true;
  try {
    // ✅ Vérification explicite de la connexion MySQL
    const pool = getMysqlPool();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1'); // test de connexion MySQL
    connection.release();
    
    const lignes = sqlite.prepare(`SELECT * FROM sync_log WHERE synced = 0`).all();

    for (const ligne of lignes) {
      const payload = JSON.parse(ligne.payload);
      const type = ligne.type;
      const operation = ligne.operation;

      if (!type || !payload || !operation) continue;

      if (type === 'ticketdecaisse') {
  if (operation === 'INSERT') {
    await pool.query(`
      INSERT INTO ticketdecaisse 
      (uuid_ticket, nom_vendeur, id_vendeur, date_achat_dt, nbr_objet, moyen_paiement, prix_total, lien, reducbene, reducclient, reducgrospanierclient, reducgrospanierbene)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.uuid_ticket,
        payload.nom_vendeur,
        payload.id_vendeur,
        payload.date_achat_dt,
        payload.nbr_objet,
        payload.moyen_paiement,
        payload.prix_total,
        payload.lien,
        payload.reducbene,
        payload.reducclient,
        payload.reducgrospanierclient,
        payload.reducgrospanierbene
      ]
    );
  } else if (operation === 'UPDATE') {
    await pool.query(`
      UPDATE ticketdecaisse SET
        nom_vendeur = ?,
        id_vendeur = ?,
        date_achat_dt = ?,
        nbr_objet = ?,
        moyen_paiement = ?,
        prix_total = ?,
        lien = ?,
        reducbene = ?,
        reducclient = ?,
        reducgrospanierclient = ?,
        reducgrospanierbene = ?
      WHERE uuid_ticket = ?`,
      [
        payload.nom_vendeur,
        payload.id_vendeur,
        payload.date_achat_dt,
        payload.nbr_objet,
        payload.moyen_paiement,
        payload.prix_total,
        payload.lien,
        payload.reducbene,
        payload.reducclient,
        payload.reducgrospanierclient,
        payload.reducgrospanierbene,
        payload.uuid_ticket
      ]
    );
  } else if (operation === 'DELETE') {
    await pool.query(`DELETE FROM ticketdecaisse WHERE uuid_ticket = ?`, [
      payload.uuid_ticket
    ]);
  }
}

      else if (type === 'objets_vendus') {
        if (operation === 'INSERT') {
          await pool.query(`
            INSERT INTO objets_vendus
            (uuid_ticket, uuid_objet, nom, nom_vendeur, id_vendeur, categorie, souscat, date_achat, timestamp, prix, nbr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.id_ticket,
              payload.uuid_objet,
              payload.nom,
              payload.nom_vendeur,
              payload.id_vendeur,
              payload.categorie,
              payload.souscat,
              payload.date_achat,
              payload.timestamp,
              payload.prix,
              payload.nbr
            ]
          );
        }
      }

      else if (type === 'paiement_mixte') {
        if (operation === 'INSERT') {
          await pool.query(`
            INSERT INTO paiement_mixte (id_ticket, espece, carte, cheque, virement, uuid_ticket)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              payload.id_ticket,
              payload.espece,
              payload.carte,
              payload.cheque,
              payload.virement,
              payload.uuid_ticket
            ]
          );
        }
      }

      else if (type === 'bilan') {
        if (operation === 'INSERT') {
          await pool.query(`
            INSERT INTO bilan
            (date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte, prix_total_virement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.date,
              payload.timestamp,
              payload.nombre_vente,
              payload.poids,
              payload.prix_total,
              payload.prix_total_espece,
              payload.prix_total_cheque,
              payload.prix_total_carte,
              payload.prix_total_virement
            ]
          );
        } else if (operation === 'UPDATE') {
            await pool.query(`
                UPDATE bilan SET 
                  timestamp = ?, 
                  nombre_vente = nombre_vente + ?, 
                  poids = poids + ?, 
                  prix_total = prix_total + ?, 
                  prix_total_espece = prix_total_espece + ?, 
                  prix_total_cheque = prix_total_cheque + ?, 
                  prix_total_carte = prix_total_carte + ?, 
                  prix_total_virement = prix_total_virement + ?
                WHERE date = ?`,
              [
                payload.timestamp,
                payload.nombre_vente,
                payload.poids,
                payload.prix_total,
                payload.prix_total_espece,
                payload.prix_total_cheque,
                payload.prix_total_carte,
                payload.prix_total_virement,
                payload.date
              ]);
              
        }
      }

      // ✅ Marquer comme synchronisé uniquement si pas d'erreur
      sqlite.prepare(`UPDATE sync_log SET synced = 1 WHERE id = ?`).run(ligne.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ ERREUR DURANT LA SYNC :', err);
    syncSuccess = false;

    // 🔁 renvoie malgré tout un JSON lisible par le frontend
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erreur de synchronisation côté serveur.' });
    }
  } finally {
    if (io) io.emit('syncEnd', { success: syncSuccess });
  }
});

module.exports = router;
