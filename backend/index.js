// backend/index.js
const http = require('http');
const app = require('./app');
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: '*' }
});

app.set('socketio', io);

server.listen(PORT, () => {
  console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
});
