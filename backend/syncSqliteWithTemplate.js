const Database = require('better-sqlite3');
const fs = require('fs');

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function assertDatabaseIntegrity(db, label) {
  const rows = db.prepare('PRAGMA quick_check').all();
  const errors = rows
    .map(row => Object.values(row)[0])
    .filter(result => result !== 'ok');
  if (errors.length > 0) {
    throw new Error(`${label} invalide : ${errors.join('; ')}`);
  }
}

function getPendingSchemaChanges(db, templatePath) {
  if (!templatePath || !fs.existsSync(templatePath)) {
    throw new Error(`Template SQLite introuvable : ${templatePath || '(chemin absent)'}`);
  }

  const templateDb = new Database(templatePath, { readonly: true });
  try {
    const changes = [];
    const tables = templateDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();

    for (const { name: table } of tables) {
      const current = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      if (!current) {
        changes.push({ type: 'table', table });
        continue;
      }

      const quotedTable = quoteIdentifier(table);
      const templateCols = templateDb.prepare(`PRAGMA table_info(${quotedTable})`).all();
      const currentNames = new Set(
        db.prepare(`PRAGMA table_info(${quotedTable})`).all().map(column => column.name)
      );
      for (const column of templateCols) {
        if (!currentNames.has(column.name)) {
          changes.push({ type: 'column', table, column: column.name });
        }
      }
    }
    return changes;
  } finally {
    templateDb.close();
  }
}

function syncSqliteWithTemplate(db, templatePath) {
  if (!templatePath || !fs.existsSync(templatePath)) {
    throw new Error(`Template SQLite introuvable : ${templatePath || '(chemin absent)'}`);
  }

  const templateDb = new Database(templatePath, { readonly: true });
  try {
    assertDatabaseIntegrity(db, 'Base SQLite utilisateur');
    assertDatabaseIntegrity(templateDb, 'Template SQLite');

    const tables = templateDb
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    const changes = [];

    const migrate = db.transaction(() => {
      for (const { name: table, sql } of tables) {
        const current = db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
          .get(table);

        if (!current) {
          console.log(`🆕 Table manquante détectée, création de ${table}`);
          db.exec(sql);
          changes.push({ type: 'table', table });
          continue;
        }

        const quotedTable = quoteIdentifier(table);
        const templateCols = templateDb.prepare(`PRAGMA table_info(${quotedTable})`).all();
        const currentCols = db.prepare(`PRAGMA table_info(${quotedTable})`).all();
        const currentMap = new Map(currentCols.map(c => [c.name, (c.type || '').toUpperCase()]));

        for (const col of templateCols) {
          const type = (col.type || '').toUpperCase();
          if (!currentMap.has(col.name)) {
            const requiredWithoutDefault = col.notnull && col.dflt_value == null;
            if (requiredWithoutDefault && currentCols.length > 0) {
              throw new Error(
                `Migration manuelle requise pour ${table}.${col.name} : ` +
                'colonne obligatoire sans valeur par défaut.'
              );
            }
            console.log(`➕ Ajout de la colonne manquante ${col.name} dans ${table}`);
            const definition = [
              quoteIdentifier(col.name),
              col.type,
              col.notnull ? 'NOT NULL' : '',
              col.dflt_value == null ? '' : `DEFAULT ${col.dflt_value}`
            ].filter(Boolean).join(' ');
            db.prepare(`ALTER TABLE ${quotedTable} ADD COLUMN ${definition}`).run();
            changes.push({ type: 'column', table, column: col.name });
          } else if (currentMap.get(col.name) !== type) {
            console.warn(`⚠️ Type différent pour ${table}.${col.name} (actuel ${currentMap.get(col.name)}, template ${type})`);
          }
        }
      }
    });

    migrate();
    assertDatabaseIntegrity(db, 'Base SQLite migrée');
    return { changed: changes.length > 0, changes };
  } finally {
    templateDb.close();
  }
}

module.exports = {
  syncSqliteWithTemplate,
  assertDatabaseIntegrity,
  getPendingSchemaChanges
};
