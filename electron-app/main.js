const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');


let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1419,
    height: 1066,
    resizable: true,
    frame: true,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.center();
  //mainWindow.webContents.openDevTools();

  const isDev = !app.isPackaged;

if (isDev) {
  // ⚠️ S'assurer que le dev server est prêt avant de charger
  const devServerURL = 'http://localhost:3000';

  const tryLoadDevServer = () => {
    http.get(devServerURL, () => {
      mainWindow.loadURL(devServerURL);
      mainWindow.webContents.openDevTools(); // Facultatif
    }).on('error', () => {
      console.log('⏳ Attente du dev server React...');
      setTimeout(tryLoadDevServer, 500);
    });
  };

  tryLoadDevServer();
} else {
  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  mainWindow.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
}
}

// ✅ Lancement du backend
function launchBackend() {
  const isDev = !app.isPackaged;

  const backendPath = isDev
    ? path.join(__dirname, '../backend/index.js')
    : path.join(process.resourcesPath, 'backend', 'index.js');

  const command = isDev
    ? process.execPath
    : path.join(process.resourcesPath, 'node.exe');

  const args = isDev ? [backendPath] : [backendPath]; // ✅ ici aussi !

  console.log(`🚀 Lancement backend : ${command} ${args.join(' ')}`);

  backendProcess = spawn(command, args, {
  cwd: path.dirname(backendPath),
  env: { ...process.env, NODE_ENV: 'production' },
  detached: true,
  stdio: ['ignore', fs.openSync('backend-out.log', 'a'), fs.openSync('backend-err.log', 'a')],
  shell: false
});
  backendProcess.unref(); // ← permet au processus de continuer seul et silencieux


  backendProcess.on('close', (code) => {
    console.log(`🚪 Backend fermé avec le code ${code}`);
  });
}






// ✅ Arrêt propre du backend si l’app se ferme
app.on('before-quit', (event) => {
  event.preventDefault(); // 🔒 bloque la fermeture tant que tout n’est pas terminé

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/session',
    method: 'DELETE'
  };

  const req = http.request(options, res => {
    console.log(`🧹 Session utilisateur supprimée (statut ${res.statusCode})`);

    // 🛑 Une fois la session supprimée, on peut tuer le backend
    if (backendProcess) backendProcess.kill();

    // ✅ Puis on ferme Electron proprement
    app.quit();
  });

  req.on('error', (err) => {
    console.error('❌ Échec suppression session utilisateur :', err.message);
    
    if (backendProcess) backendProcess.kill();
    app.quit(); // on quitte même si l'appel échoue
  });

  req.end();
});


// 📂 Ouvre le PDF à la demande
ipcMain.on('open-pdf', (event, relativePath) => {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  if (fs.existsSync(fullPath)) {
    shell.openPath(fullPath);
  } else {
    console.error('❌ Fichier PDF introuvable :', fullPath);
  }
});

// 🔍 Ouvre DevTools depuis le renderer
ipcMain.on('devtools-open', () => {
  console.log('💡 Reçu : devtools-open');
  if (mainWindow) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
});

// 🚀 Lancement global
app.whenReady().then(() => {
  launchBackend();   // ✅ Démarre le backend
  createWindow();    // ✅ Puis ouvre la fenêtre
});
