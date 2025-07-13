console.log('✅ preload.js exécuté');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openPdf: (relativePath) => ipcRenderer.send('open-pdf', relativePath),
  ouvrirDevTools: () => ipcRenderer.send('devtools-open')
});
