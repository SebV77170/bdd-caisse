// backend/index.js
const http = require('http');
const app = require('./app');
const PORT = process.env.PORT || 3001;
const { startScheduler } = require('./syncScheduler');
const { startWebdavScheduler } = require('./webdavScheduler');

const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000', // 👈 ton frontend React
    credentials: true                // 👈 indispensable pour les cookies/session
  }
});


app.set('socketio', io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
  startScheduler(PORT, io);
  startWebdavScheduler();
});

/* // Émet une fausse synchronisation toutes les 15 secondes
setInterval(() => {
  console.log('🔄 Synchronisation automatique (fictive)');
  io.emit('syncStart');

  // Fausse fin de synchronisation après 3 secondes (succès aléatoire)
  setTimeout(() => {
    const success = Math.random() > 0.2; // 80% de réussite
    io.emit('syncEnd', { success }); // tu peux faire { success: true } ou false
    console.log(success ? '✅ Fin OK' : '❌ Fin avec erreur');
  }, 3000);
}, 15000); // toutes les 15 secondes */

