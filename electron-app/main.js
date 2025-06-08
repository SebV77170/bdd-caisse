const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true
    }
  });

  const indexPath = path.resolve(__dirname, 'build', 'index.html');



  console.log('📄 Tentative de chargement :', indexPath);

  if (fs.existsSync(indexPath)) {
    win.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);

  } else {
    console.error("❌ Le fichier index.html est introuvable !");
    win.loadURL("data:text/html,<h1>Erreur : index.html introuvable</h1>");
  }

  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);
