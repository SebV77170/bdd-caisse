const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { sqlite, mysql } = require('../db');

router.post('/', async (req, res) => {
  try {
    const tables = [
      'bilan',
      'journal_corrections',
      'modifticketdecaisse',
      'objets_vendus',
      'paiement_mixte',
      'ticketdecaisse',
      'ticketdecaissetemp',
      'sync_log'
    ];

    const tablesMysql = [
      'bilan',
      'modifticketdecaisse',
      'objets_vendus',
      'paiement_mixte',
      'ticketdecaisse',
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
      await mysql.query('SELECT 1');
      // ⚙️ Suppression des données MySQL + reset auto-incrément
      for (const table of tablesMysql) {
        await mysql.query(`DELETE FROM ${table}`);
        await mysql.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
      }
      mysqlOk = true;
    } catch (errMysql) {
      console.error('Connexion MySQL échouée :', errMysql);
    }

    // 🧹 Suppression des fichiers de tickets
    const ticketDir = path.join(__dirname, '../../tickets');
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
