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

  if (backendProcess) {
    console.log('⚠️ Backend déjà lancé, on ne relance pas');
    return;
  }
  const isDev = !app.isPackaged;

  const backendPath = isDev
    ? path.join(__dirname, '../backend/index.js')
    : path.join(process.resourcesPath, 'backend', 'index.js');

  const command = isDev
    ? 'node'
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
console.log(`🔁 PID backend lancé : ${backendProcess.pid}`);

  backendProcess.unref(); // ← permet au processus de continuer seul et silencieux


  backendProcess.on('close', (code) => {
    console.log(`🚪 Backend fermé avec le code ${code}`);
  });
}

function verifierSessionUtilisateur() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/session',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });

    res.on('end', () => {
      try {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log(`👤 Session utilisateur déjà ouverte : ${result.user.pseudo}`);
        } else {
          console.log('👥 Aucune session utilisateur active');
        }
      } catch (e) {
        console.error('❌ Erreur JSON /api/session :', e.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Impossible de vérifier session utilisateur :', err.message);
  });

  req.end();
}




let isQuitting = false;

app.on('before-quit', (event) => {
  // Évite de repasser dans cette logique plusieurs fois
  if (isQuitting) return;
  isQuitting = true;

  event.preventDefault(); // ⛔️ On bloque TEMPORAIREMENT la fermeture

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/session',
    method: 'DELETE'
  };

  const req = http.request(options, (res) => {
    console.log(`🧹 Session utilisateur supprimée (statut ${res.statusCode})`);

    // 🔪 On tue proprement le backend si encore actif
    if (backendProcess) backendProcess.kill();

    // ✅ Maintenant qu'on a fini : on relance la fermeture
    app.exit();
  });

  req.on('error', (err) => {
    console.error('❌ Échec suppression session utilisateur :', err.message);

    if (backendProcess) backendProcess.kill();
    app.exit(); // Même en cas d'erreur, on quitte
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
const isDev = !app.isPackaged;

app.whenReady().then(() => {
  if (!isDev) {
  launchBackend();   // ✅ Démarre le backend seulement en production
  }
  verifierSessionUtilisateur(); // ✅ Vérifie la session utilisateur
  createWindow();    // ✅ Puis ouvre la fenêtre
});
