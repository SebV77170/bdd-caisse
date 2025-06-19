const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1419,
    height: 1066,
    resizable: false,
    frame: false,
    webPreferences: {
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null); // supprime le menu système
  win.center(); // optionnel : centre la fenêtre

  const indexPath = path.resolve(__dirname, 'build', 'index.html');
  const devURL = 'http://localhost:3000';

  if (fs.existsSync(indexPath)) {
    win.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
  } else {
    win.loadURL(devURL);
  }

  // win.webContents.openDevTools(); // désactivé pour simulation propre
}

app.whenReady().then(createWindow);
