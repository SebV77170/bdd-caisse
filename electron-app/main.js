const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1570,
    height: 1255,
    resizable: false,
    frame: false, // pas de barre système
    webPreferences: {
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  const devURL = 'http://localhost:3000';

  if (fs.existsSync(indexPath)) {
    win.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
  } else {
    win.loadURL(devURL);
  }

  // win.webContents.openDevTools(); // désactivé pour simulation visuelle propre
}

app.whenReady().then(createWindow);
