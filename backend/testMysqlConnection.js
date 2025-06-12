const mysql = require('mysql2/promise');

async function testConnection() {
  const config = {
    host: 'sql01.ouvaton.coop',   // 🔁 adapte ici si besoin
    user: '09007_ressourceb',
    password: 'LaRessourcerieDeBrie77170!',
    database: '09007_ressourceb',
    port: 3306, // Port standard, change si besoin
    connectTimeout: 5000
  };

  try {
    console.log(`Tentative de connexion à ${config.host}:${config.port}...`);
    const connection = await mysql.createConnection(config);
    console.log('✅ Connexion réussie !');
    await connection.end();
  } catch (err) {
    console.error('❌ Échec de connexion :', err.code);
    console.error(err.message);
  }
}

testConnection();
