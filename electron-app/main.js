const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1419,
    height: 1066,
    resizable: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // ✅ ajout ici
    }
  });

  Menu.setApplicationMenu(null);
  win.center();
  win.webContents.openDevTools(); // ouvre les DevTools automatiquement

  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  const devURL = 'http://localhost:3000';

  if (fs.existsSync(indexPath)) {
    win.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
  } else {
    win.loadURL(devURL);
  }
}


// ✅ écoute de l'événement pour ouvrir le PDF
ipcMain.on('open-pdf', (event, relativePath) => {
  const fullPath = path.resolve(__dirname, '..', relativePath); // ← ../ pour remonter à la racine
  if (fs.existsSync(fullPath)) {
    shell.openPath(fullPath);
  } else {
    console.error('❌ Fichier PDF introuvable :', fullPath);
  }
});


app.whenReady().then(createWindow);
