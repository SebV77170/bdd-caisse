const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
  mainWindow.webContents.openDevTools();

  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  const devURL = 'http://localhost:3000';

  if (fs.existsSync(indexPath)) {
    mainWindow.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
  } else {
    mainWindow.loadURL(devURL);
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
    stdio: 'inherit',
    shell: false // ✅ pas besoin de shell ici
  });

  backendProcess.on('close', (code) => {
    console.log(`🚪 Backend fermé avec le code ${code}`);
  });
}






// ✅ Arrêt propre du backend si l’app se ferme
app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
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
