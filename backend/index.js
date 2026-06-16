// backend/index.js
const http = require('http');
const app = require('./app');
const PORT = process.env.PORT || 3001;
const { startScheduler } = require('./syncScheduler');
const { startWebdavScheduler } = require('./webdavScheduler');
const { corsOrigin } = require('./allowedOrigins');

const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

app.set('socketio', io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur backend lance sur http://localhost:${PORT}`);
  startScheduler(PORT, io);
  startWebdavScheduler();
});

/* // Emet une fausse synchronisation toutes les 15 secondes
setInterval(() => {
  console.log('Synchronisation automatique (fictive)');
  io.emit('syncStart');

  setTimeout(() => {
    const success = Math.random() > 0.2;
    io.emit('syncEnd', { success });
    console.log(success ? 'Fin OK' : 'Fin avec erreur');
  }, 3000);
}, 15000);
*/
