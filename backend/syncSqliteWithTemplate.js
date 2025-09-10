const Database = require('better-sqlite3');
const fs = require('fs');

/**
 * Compare la structure de la base SQLite courante avec celle du template
 * et ajoute les tables/colonnes manquantes. Les différences de type sont
 * simplement journalisées.
 *
 * @param {import('better-sqlite3').Database} db - Base SQLite actuelle
 * @param {string} templatePath - Chemin vers la base template
 */
function syncSqliteWithTemplate(db, templatePath) {
  if (!templatePath || !fs.existsSync(templatePath)) {
    console.warn('⚠️ Template SQLite introuvable pour la comparaison');
    return;
  }

  const templateDb = new Database(templatePath, { readonly: true });
  try {
    const tables = templateDb
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();

    for (const { name: table, sql } of tables) {
      const current = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);

      if (!current) {
        console.log(`🆕 Table manquante détectée, création de ${table}`);
        db.exec(sql);
        continue;
      }

      const templateCols = templateDb.prepare(`PRAGMA table_info(${table})`).all();
      const currentCols = db.prepare(`PRAGMA table_info(${table})`).all();
      const currentMap = new Map(currentCols.map(c => [c.name, (c.type || '').toUpperCase()]));

      for (const col of templateCols) {
        const type = (col.type || '').toUpperCase();
        if (!currentMap.has(col.name)) {
          console.log(`➕ Ajout de la colonne manquante ${col.name} dans ${table}`);
          db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`).run();
        } else if (currentMap.get(col.name) !== type) {
          console.warn(`⚠️ Type différent pour ${table}.${col.name} (actuel ${currentMap.get(col.name)}, template ${type})`);
        }
      }
    }
  } finally {
    templateDb.close();
  }
}

module.exports = { syncSqliteWithTemplate };
