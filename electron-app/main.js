const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { session: electronSession } = require('electron');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');


let mainWindow;
let backendProcess;
let _ensuring = false;
let _lastEnsure = 0;


function ensureInteractiveLight() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (_ensuring) return;
  _ensuring = true;
  try {
    mainWindow.setIgnoreMouseEvents(false);
    // 👇 focus "silencieux" (pas de saut OS)
    if (!mainWindow.webContents.isFocused()) mainWindow.webContents.focus();
  } finally {
    _ensuring = false;
  }
}

function ensureInteractiveRaise() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const now = Date.now();
  if (now - _lastEnsure < 300 || _ensuring) return; // debounce anti-boucle
  _ensuring = true;
  try {
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setFocusable(true);
    if (!mainWindow.isFocused()) {
      mainWindow.focus();             // 👈 peut causer un petit sursaut
      mainWindow.webContents.focus();
    }
    // ⚠️ évite setAlwaysOnTop(true/false) ici pour ne pas flicker
  } finally {
    _lastEnsure = now;
    _ensuring = false;
  }
}

// IPC
ipcMain.handle('ui/ensure-interactive-light', () => { ensureInteractiveLight(); return true; });
ipcMain.handle('ui/ensure-interactive-raise', () => { ensureInteractiveRaise(); return true; });

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


   // Dans createWindow(), garde seulement des accroches calmes :
mainWindow.on('focus', () => ensureInteractiveLight());
mainWindow.on('show',  () => ensureInteractiveLight());
mainWindow.webContents.on('did-finish-load',      () => ensureInteractiveLight());
mainWindow.webContents.on('did-navigate',         () => ensureInteractiveLight());
mainWindow.webContents.on('did-navigate-in-page', () => ensureInteractiveLight());

  mainWindow.center();
  //mainWindow.webContents.openDevTools();

  const isDev = !app.isPackaged;

if (isDev) {
  const devServerURL = 'http://localhost:3000';
  const tryLoadDevServer = () => {
    http.get(devServerURL, () => {
      mainWindow.loadURL(devServerURL);
      //mainWindow.webContents.openDevTools();
    }).on('error', () => {
      console.log('⏳ Attente du dev server React...');
      setTimeout(tryLoadDevServer, 500);
    });
  };
  tryLoadDevServer();
} else {
  mainWindow.loadURL('http://localhost:3001'); // ✅ frontend servi par backend
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
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();

  // Accède aux cookies de la session Electron
  electronSession.defaultSession.cookies.get({ name: 'connect.sid' })
    .then((cookies) => {
      const sessionCookie = cookies[0]?.value;

      if (!sessionCookie) {
        console.warn('⚠️ Aucun cookie de session trouvé, fermeture directe');
        if (backendProcess) backendProcess.kill();
        return app.exit();
      }

      const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/session',
        method: 'DELETE',
        headers: {
          Cookie: `connect.sid=${sessionCookie}`
        }
      };

      const req = http.request(options, (res) => {
        console.log(`🧹 Session utilisateur supprimée (statut ${res.statusCode})`);
        if (backendProcess) backendProcess.kill();
        app.exit();
      });

      req.on('error', (err) => {
        console.error('❌ Échec suppression session utilisateur :', err.message);
        if (backendProcess) backendProcess.kill();
        app.exit();
      });

      req.end();
    })
    .catch((err) => {
      console.error('❌ Impossible de récupérer le cookie de session :', err.message);
      if (backendProcess) backendProcess.kill();
      app.exit();
    });
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

function waitForBackendReady(callback) {
  const maxRetries = 50;
  let retries = 0;

  const tryConnect = () => {
    http.get('http://localhost:3001', (res) => {
      console.log('✅ Backend prêt, on charge la fenêtre');
      callback();
    }).on('error', () => {
      if (retries >= maxRetries) {
        console.error('❌ Backend toujours pas prêt après plusieurs essais');
        return;
      }
      retries++;
      setTimeout(tryConnect, 300); // réessaye après 300ms
    });
  };

  tryConnect();
}


app.whenReady().then(() => {
  if (!isDev) {
    launchBackend();
    waitForBackendReady(() => {
      verifierSessionUtilisateur(); // optionnel mais logique ici
      console.log('✅ Le backend a répondu, ouverture de la fenêtre Electron');

      createWindow();               // seulement après que le backend est prêt
    });
  } else {
    createWindow();
  }
});
