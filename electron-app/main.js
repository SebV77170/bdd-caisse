const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const { session: electronSession } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');


let mainWindow;
let backendProcess;
let _ensuring = false;
let _lastEnsure = 0;

let updateBaseUrl = null;
let runtimeEnvLoaded = false;

function parseDotEnvValue(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) {
    const unquoted = trimmed.slice(1, -1);
    return quote === '"'
      ? unquoted.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : unquoted;
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = parseDotEnvValue(rawValue);
  }
}

function getRuntimeEnvFileCandidates() {
  return [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', 'backend', '.env'),
    path.resolve(__dirname, '.env'),
    path.join(process.resourcesPath || '', '.env'),
    path.join(process.resourcesPath || '', 'backend', '.env'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'backend', '.env')
  ];
}

function loadRuntimeEnv() {
  if (runtimeEnvLoaded) return;
  runtimeEnvLoaded = true;
  getRuntimeEnvFileCandidates().forEach(loadEnvFile);
}

function normalizeUrlPath(pathValue) {
  const normalized = String(pathValue || '').trim();
  if (!normalized) return '/releases';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function joinUrlPath(baseUrl, pathValue) {
  const url = new URL(baseUrl);
  const currentPath = url.pathname.replace(/\/+$/, '');
  const nextPath = normalizeUrlPath(pathValue).replace(/^\/+/, '');
  url.pathname = `${currentPath}/${nextPath}`.replace(/\/+/g, '/');
  return url.toString();
}

function loadWebdavEndpoints() {
  const raw = process.env.WEBDAV_ENDPOINTS || process.env.WEBDAV_CONFIG;
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function resolveUpdateBaseUrl() {
  if (updateBaseUrl) return updateBaseUrl;

  loadRuntimeEnv();

  if (process.env.BDD_CAISSE_UPDATE_URL) {
    updateBaseUrl = process.env.BDD_CAISSE_UPDATE_URL;
    return updateBaseUrl;
  }

  const endpoints = loadWebdavEndpoints();
  const profileName = process.env.BDD_CAISSE_RELEASE_WEBDAV_PROFILE
    || process.env.WEBDAV_PROFILE
    || (endpoints.prod ? 'prod' : Object.keys(endpoints)[0]);
  const profile = profileName ? endpoints[profileName] : null;

  if (!profile || typeof profile !== 'object' || !profile.url) return null;

  const releasePath = process.env.BDD_CAISSE_RELEASE_WEBDAV_PATH
    || process.env.BDD_CAISSE_UPDATE_PATH
    || profile.releasePath
    || profile.updatePath
    || '/releases';

  updateBaseUrl = profile.releaseUrl || profile.updateUrl || joinUrlPath(profile.url, releasePath);
  process.env.BDD_CAISSE_UPDATE_URL = updateBaseUrl;

  if (!process.env.BDD_CAISSE_WEBDAV_USER && !process.env.WEBDAV_USERNAME && profile.username) {
    process.env.BDD_CAISSE_WEBDAV_USER = profile.username;
  }
  if (!process.env.BDD_CAISSE_WEBDAV_PASSWORD && !process.env.WEBDAV_PASSWORD && profile.password) {
    process.env.BDD_CAISSE_WEBDAV_PASSWORD = profile.password;
  }

  console.log(`ℹ️ BDD_CAISSE_UPDATE_URL runtime dérivée du profil WEBDAV_ENDPOINTS "${profileName}" (${updateBaseUrl}).`);
  return updateBaseUrl;
}

function getPendingReleaseNotesPath() {
  return path.join(app.getPath('userData'), 'pending-release-notes.json');
}
let autoUpdaterConfigured = false;
let releaseNotesDialogShown = false;

function formatReleaseNotes(releaseNotes) {
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((note) => (typeof note === 'string' ? note : note?.note || note?.notes || ''))
      .filter(Boolean)
      .join('\n');
  }

  return typeof releaseNotes === 'string' ? releaseNotes.trim() : '';
}

function savePendingReleaseNotes(info) {
  const notes = formatReleaseNotes(info?.releaseNotes);
  if (!notes) return;

  try {
    fs.writeFileSync(getPendingReleaseNotesPath(), JSON.stringify({
      version: info.version,
      notes
    }, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Impossible de sauvegarder les notes de version :', error?.message || error);
  }
}

async function showPendingReleaseNotes() {
  const pendingReleaseNotesPath = getPendingReleaseNotesPath();
  if (releaseNotesDialogShown || !fs.existsSync(pendingReleaseNotesPath)) return;
  releaseNotesDialogShown = true;

  const raw = fs.readFileSync(pendingReleaseNotesPath, 'utf8');
  fs.unlinkSync(pendingReleaseNotesPath);

  const release = JSON.parse(raw);
  if (!release.notes) return;

  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Application mise à jour',
    message: `L'application a été mise à jour en version ${release.version || app.getVersion()}.`,
    detail: release.notes
  });
}

function sendUpdateStatus(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('app/update-status', payload);
}

function setupAutoUpdaterLogs() {
  autoUpdater.on('checking-for-update', () => {
    console.log('🔎 Vérification des mises à jour WebDAV...');
    sendUpdateStatus({ success: true, status: 'checking', message: 'Vérification de la mise à jour...' });
  });

  autoUpdater.on('update-available', (info) => {
    const version = info?.version || 'inconnue';
    console.log(`⬆️ Mise à jour disponible (${version})`);
    sendUpdateStatus({
      success: true,
      status: 'update-available',
      version,
      message: `Mise à jour ${version} trouvée. Téléchargement en cours...`
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`✅ Version locale à jour (${info?.version || app.getVersion()})`);
    sendUpdateStatus({
      success: true,
      status: 'up-to-date',
      version: info?.version || app.getVersion(),
      message: `Vous utilisez déjà la dernière version (${app.getVersion()}).`
    });
  });

  autoUpdater.on('error', (error) => {
    const message = error?.message || 'Erreur inconnue';
    console.error('❌ Erreur pendant la mise à jour automatique :', message);
    sendUpdateStatus({ success: false, status: 'error', message: `Erreur pendant la mise à jour automatique : ${message}` });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress?.percent || 0);
    console.log(`⬇️ Téléchargement mise à jour : ${percent}%`);
    sendUpdateStatus({
      success: true,
      status: 'download-progress',
      percent,
      message: `Téléchargement de la mise à jour : ${percent}%`
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`📦 Mise à jour ${info.version} téléchargée. Installation...`);
    sendUpdateStatus({
      success: true,
      status: 'downloaded',
      version: info.version,
      message: `Mise à jour ${info.version} téléchargée. Redémarrage en cours...`
    });
    savePendingReleaseNotes(info);
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

  const resolvedUpdateBaseUrl = resolveUpdateBaseUrl();

  if (!resolvedUpdateBaseUrl) {
    console.warn('⚠️ Mise à jour auto désactivée: définissez BDD_CAISSE_UPDATE_URL ou un profil WEBDAV_ENDPOINTS avec un dossier de release.');
    return false;
  }

  setupAutoUpdaterLogs();
  const requestHeaders = getWebdavAuthHeader();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.requestHeaders = requestHeaders;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: resolvedUpdateBaseUrl,
    requestHeaders
  });
  autoUpdaterConfigured = true;
  console.log(`🌐 Source de mise à jour configurée : ${resolvedUpdateBaseUrl}`);
  return true;
}


function getWebdavAuthHeader() {
  const username = process.env.BDD_CAISSE_WEBDAV_USER || process.env.WEBDAV_USERNAME;
  const password = process.env.BDD_CAISSE_WEBDAV_PASSWORD || process.env.WEBDAV_PASSWORD;

  if (!username && !password) return {};
  return { Authorization: `Basic ${Buffer.from(`${username || ''}:${password || ''}`).toString('base64')}` };
}

function getUpdateCheckTimeoutMs() {
  return Number(process.env.BDD_CAISSE_UPDATE_CHECK_TIMEOUT_MS || 45000);
}

function buildLatestYmlUrl(baseUrl) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('latest.yml', normalizedBase);
}

function parseLatestYmlVersion(latestYml) {
  const match = String(latestYml).match(/^version:\s*["']?([^\r\n"']+)/m);
  return match ? match[1].trim() : null;
}

function fetchLatestYml(baseUrl) {
  return new Promise((resolve, reject) => {
    const targetUrl = buildLatestYmlUrl(baseUrl);
    const client = targetUrl.protocol === 'https:' ? https : http;
    const request = client.request(targetUrl, {
      method: 'GET',
      headers: getWebdavAuthHeader()
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }

        reject(new Error(`latest.yml refusé (${response.statusCode}${response.statusMessage ? ` ${response.statusMessage}` : ''})${body ? `: ${body.slice(0, 500)}` : ''}`));
      });
    });

    request.setTimeout(getUpdateCheckTimeoutMs(), () => {
      request.destroy(new Error(`Aucune réponse de ${targetUrl.href} après ${Math.round(getUpdateCheckTimeoutMs() / 1000)} secondes.`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function preflightLatestYmlCheck() {
  const resolvedUpdateBaseUrl = resolveUpdateBaseUrl();
  if (!resolvedUpdateBaseUrl) return null;

  const latestYml = await fetchLatestYml(resolvedUpdateBaseUrl);
  const remoteVersion = parseLatestYmlVersion(latestYml);
  if (!remoteVersion) {
    return {
      success: false,
      status: 'invalid-latest-yml',
      message: 'latest.yml est accessible, mais le champ version est introuvable.'
    };
  }

  const localVersion = app.getVersion();
  console.log(`🧾 latest.yml WebDAV indique la version ${remoteVersion} (locale ${localVersion}).`);

  if (remoteVersion === localVersion) {
    return {
      success: true,
      status: 'up-to-date',
      version: remoteVersion,
      message: `Vous utilisez déjà la dernière version (${localVersion}).`
    };
  }

  return {
    success: true,
    status: 'update-available',
    version: remoteVersion,
    message: `Une mise à jour est disponible (version ${remoteVersion}).`
  };
}


async function askForUpdatePermission(version) {
  const message = version && version !== 'inconnue'
    ? `Une mise à jour de l'application est disponible (version ${version}). Voulez-vous vraiment mettre à jour l'application ?`
    : "Une mise à jour de l'application est disponible. Voulez-vous vraiment mettre à jour l'application ?";

  const result = await dialog.showMessageBox(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
    type: 'question',
    buttons: ['Oui, mettre à jour', 'Non, plus tard'],
    defaultId: 1,
    cancelId: 1,
    title: 'Confirmer la mise à jour',
    message,
    detail: "L'application téléchargera la mise à jour puis redémarrera pour l'installer."
  });

  return result.response === 0;
}

function startAutoUpdaterCheckInBackground(source) {
  sendUpdateStatus({ success: true, status: 'download-started', message: 'Téléchargement de la mise à jour en préparation...' });
  autoUpdater.checkForUpdates()
    .then((result) => {
      const version = result?.updateInfo?.version || 'inconnue';
      console.log(`🆚 Version locale ${app.getVersion()} / distante ${version} (${source})`);
    })
    .catch((error) => {
      const message = error?.message || 'Erreur inconnue';
      console.error('❌ Impossible de lancer le téléchargement de mise à jour :', message);
      sendUpdateStatus({ success: false, status: 'error', message: `Impossible de lancer le téléchargement : ${message}` });
    });
}

function waitForUpdateCheckResult(source) {
  const timeoutMs = getUpdateCheckTimeoutMs();

  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;

    const cleanup = () => {
      clearTimeout(timeout);
      autoUpdater.removeListener('update-available', onUpdateAvailable);
      autoUpdater.removeListener('update-not-available', onUpdateNotAvailable);
      autoUpdater.removeListener('error', onError);
    };

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    const onUpdateAvailable = (info) => {
      const version = info?.version || 'inconnue';
      finish({
        success: true,
        status: 'update-available',
        version,
        message: `Une mise à jour est disponible (version ${version}). Le téléchargement va démarrer automatiquement.`
      });
    };

    const onUpdateNotAvailable = (info) => {
      const version = info?.version || app.getVersion();
      finish({
        success: true,
        status: 'up-to-date',
        version,
        message: `Vous utilisez déjà la dernière version (${app.getVersion()}).`
      });
    };

    const onError = (error) => {
      finish({ success: false, message: error?.message || 'Erreur inconnue' });
    };

    timeout = setTimeout(() => {
      finish({
        success: false,
        status: 'timeout',
        message: `Aucune réponse du serveur de mise à jour après ${Math.round(timeoutMs / 1000)} secondes.`
      });
    }, timeoutMs);

    autoUpdater.once('update-available', onUpdateAvailable);
    autoUpdater.once('update-not-available', onUpdateNotAvailable);
    autoUpdater.once('error', onError);

    autoUpdater.checkForUpdates()
      .then((result) => {
        if (settled) return;
        const version = result?.updateInfo?.version || app.getVersion();
        console.log(`🆚 Version locale ${app.getVersion()} / distante ${version} (${source})`);
        finish({
          success: true,
          status: version === app.getVersion() ? 'up-to-date' : 'checked',
          version,
          message: version === app.getVersion()
            ? `Vous utilisez déjà la dernière version (${app.getVersion()}).`
            : `Vérification terminée (version distante: ${version}).`
        });
      })
      .catch(onError);
  });
}

async function checkForAppUpdate(source = 'startup') {
  if (!app.isPackaged) {
    console.log(`ℹ️ Mode développement: vérification de mise à jour ignorée (${source}).`);
    return { success: false, message: 'Mode développement' };
  }

  if (!configureAutoUpdater()) {
    return { success: false, message: 'BDD_CAISSE_UPDATE_URL manquante' };
  }

  try {
    const preflight = await preflightLatestYmlCheck();
    if (preflight?.status === 'up-to-date' || preflight?.success === false) return preflight;
    if (preflight?.status === 'update-available') {
      const accepted = await askForUpdatePermission(preflight.version);
      if (!accepted) {
        return {
          success: true,
          status: 'update-declined',
          version: preflight.version,
          message: 'Mise à jour annulée. Vous pourrez la relancer plus tard depuis les paramètres.'
        };
      }

      startAutoUpdaterCheckInBackground(source);
      return {
        ...preflight,
        message: `Mise à jour ${preflight.version || ''} acceptée. Téléchargement en cours...`.replace('  ', ' ')
      };
    }

    const result = await waitForUpdateCheckResult(source);
    if (result?.version) {
      console.log(`🆚 Version locale ${app.getVersion()} / distante ${result.version} (${source})`);
    }
    return result;
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
mainWindow.webContents.on('did-finish-load',      () => {
  ensureInteractiveLight();
  showPendingReleaseNotes().catch((error) => {
    console.error('❌ Impossible d’afficher les notes de version :', error?.message || error);
  });
});
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
  env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
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
