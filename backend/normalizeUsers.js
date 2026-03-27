const mysql = require('mysql2/promise');

// ⚠️ adapte avec tes infos
const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'objets'
};

function normalizePseudo(pseudo) {
  return String(pseudo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

(async () => {
  try {
    const pool = await mysql.createPool(config);

    const [users] = await pool.query(
      'SELECT uuid_user, pseudo FROM users'
    );

    console.log(`🔍 ${users.length} utilisateurs trouvés`);

    for (const u of users) {
      const pseudoNormalise = normalizePseudo(u.pseudo);

      await pool.query(
        'UPDATE users SET pseudo_normalise = ? WHERE uuid_user = ?',
        [pseudoNormalise, u.uuid_user]
      );

      console.log(`✔ ${u.pseudo} → ${pseudoNormalise}`);
    }

    console.log('✅ Terminé');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err);
    process.exit(1);
  }
})();