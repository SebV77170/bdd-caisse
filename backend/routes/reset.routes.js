const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const router = express.Router();
const { sqlite, getMysqlPool } = require('../db');

router.post('/', async (req, res) => {
  const pool = getMysqlPool();
  try {
    const tables = [
      'bilan',
      'journal_corrections',
      'modifticketdecaisse',
      'objets_vendus',
      'paiement_mixte',
      'ticketdecaisse',
      'ticketdecaissetemp',
      'uuid_mapping',
      'vente',
      'sync_log'
    ];

    const tablesMysql = [
      'bilan',
      'modifticketdecaisse',
      'objets_vendus',
      'paiement_mixte',
      'ticketdecaisse',
      'uuid_mapping',
      'vente',
      'ticketdecaissetemp'
    ];

    // ⚙️ Suppression des données SQLite + reset auto-incrément
    sqlite.transaction(() => {
      for (const table of tables) {
        sqlite.prepare(`DELETE FROM ${table}`).run();
        sqlite.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
      }
    })();

    let mysqlOk = false;
    try {
      await pool.query('SELECT 1');
      // ⚙️ Suppression des données MySQL + reset auto-incrément
      for (const table of tablesMysql) {
        await pool.query(`DELETE FROM ${table}`);
        await pool.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
      }
      mysqlOk = true;
    } catch (errMysql) {
      console.error('Connexion MySQL échouée :', errMysql);
    }

    // 🧹 Suppression des fichiers de tickets
    const baseDir = path.join(os.homedir(), '.bdd-caisse');
    const ticketDir = path.join(baseDir, 'tickets');
    if (fs.existsSync(ticketDir)) {
      const fichiers = fs.readdirSync(ticketDir);
      fichiers.forEach(f => {
        if (f.endsWith('.txt')) {
          fs.unlinkSync(path.join(ticketDir, f));
        }
      });
    }

    const message = mysqlOk
      ? 'Base locale et distante + fichiers tickets réinitialisés.'
      : "Base locale réinitialisée et fichiers tickets supprimés. La base MySQL n'a pas été réinitialisée.";
    res.json({ success: true, message });
  } catch (err) {
    console.error('Erreur reset :', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
  }
});

module.exports = router;
