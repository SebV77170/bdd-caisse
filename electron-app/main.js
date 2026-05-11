const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const { session: electronSession } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');


let mainWindow;
let backendProcess;
let _ensuring = false;
let _lastEnsure = 0;

let autoUpdaterConfigured = false;

function getBackendDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '../backend');
}

function parseEnvContent(content) {
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return acc;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) return acc;

    const quote = value[0];
    const isQuoted = (quote === '"' || quote === "'") && value.endsWith(quote);
    if (isQuoted) {
      value = value.slice(1, -1);
    }

    if (quote === '"') {
      value = value.replace(/\\"/g, '"');
    }

    acc[key] = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    return acc;
  }, {});
}

function loadBackendEnv() {
  const envPath = path.join(getBackendDir(), '.env');
  if (!fs.existsSync(envPath)) return {};

  try {
    return parseEnvContent(fs.readFileSync(envPath, 'utf8'));
  } catch (error) {
    console.error('❌ Impossible de lire le fichier .env backend :', error?.message || error);
    return {};
  }
}

function loadWebdavEndpoints() {
  const backendEnv = loadBackendEnv();
  const raw = process.env.WEBDAV_ENDPOINTS || backendEnv.WEBDAV_ENDPOINTS || process.env.WEBDAV_CONFIG || backendEnv.WEBDAV_CONFIG;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    console.error('❌ WEBDAV_ENDPOINTS invalide pour la mise à jour :', error?.message || error);
    return {};
  }
}

function loadPersistedWebdavMode(endpoints) {
  const configPath = path.join(app.getPath('home'), '.bdd-caisse', 'webdavSyncConfig.json');
  if (!fs.existsSync(configPath)) return Object.keys(endpoints)[0] || null;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config?.mode && endpoints[config.mode]) return config.mode;
  } catch {}

  return Object.keys(endpoints)[0] || null;
}

function buildBasicAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${token}`;
}

function buildWebdavUpdateConfig() {
  const endpoints = loadWebdavEndpoints();
  const activeMode = loadPersistedWebdavMode(endpoints);
  const endpoint = activeMode ? endpoints[activeMode] : null;

  if (!endpoint?.url || !endpoint?.username || !endpoint?.password) {
    return null;
  }

  const updatePath = endpoint.updatePath || endpoint.releasePath || endpoint.releasesPath || '/releases';
  const normalizedBase = endpoint.url.endsWith('/') ? endpoint.url : `${endpoint.url}/`;
  const normalizedPath = String(updatePath).replace(/^\/+/, '').replace(/\/+$/, '');
  const updateUrl = new URL(`${normalizedPath}/`, normalizedBase).toString();

  return {
    url: updateUrl,
    mode: activeMode,
    requestHeaders: {
      Authorization: buildBasicAuthHeader(endpoint.username, endpoint.password)
    }
  };
}

function setupAutoUpdaterLogs() {
  autoUpdater.on('checking-for-update', () => {
    console.log('🔎 Vérification des mises à jour WebDAV...');
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`✅ Version locale à jour (${info?.version || app.getVersion()})`);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Erreur pendant la mise à jour automatique :', error?.message || error);
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress?.percent || 0);
    console.log(`⬇️ Téléchargement mise à jour : ${percent}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`📦 Mise à jour ${info.version} téléchargée. Installation...`);
    await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} a été téléchargée. L'application va redémarrer pour finaliser la mise à jour.`
    });

    setImmediate(() => autoUpdater.quitAndInstall());
  });
}

function configureAutoUpdater() {
  if (autoUpdaterConfigured) return true;

  const webdavUpdateConfig = buildWebdavUpdateConfig();
  if (!webdavUpdateConfig) {
    console.warn('⚠️ Mise à jour auto désactivée: aucun endpoint WEBDAV_ENDPOINTS exploitable trouvé dans backend/.env.');
    return false;
  }

  setupAutoUpdaterLogs();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: webdavUpdateConfig.url,
    requestHeaders: webdavUpdateConfig.requestHeaders
  });
  autoUpdaterConfigured = true;
  console.log(`🌐 Source de mise à jour WebDAV configurée (${webdavUpdateConfig.mode}) : ${webdavUpdateConfig.url}`);
  return true;
}

async function checkForAppUpdate(source = 'startup') {
  if (!app.isPackaged) {
    console.log(`ℹ️ Mode développement: vérification de mise à jour ignorée (${source}).`);
    return { success: false, message: 'Mode développement' };
  }

  if (!configureAutoUpdater()) {
    return { success: false, message: 'Aucun endpoint WEBDAV_ENDPOINTS exploitable pour les mises à jour' };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.updateInfo?.version) {
      console.log(`🆚 Version locale ${app.getVersion()} / distante ${result.updateInfo.version} (${source})`);
    }
    return { success: true, version: result?.updateInfo?.version || app.getVersion() };
  } catch (error) {
    console.error('❌ Impossible de vérifier les mises à jour distantes :', error?.message || error);
    return { success: false, message: error?.message || 'Erreur inconnue' };
  }
}


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
ipcMain.handle('app/check-for-updates', async () => {
  return checkForAppUpdate('manual');
});

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


app.whenReady().then(async () => {
  await checkForAppUpdate();

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
