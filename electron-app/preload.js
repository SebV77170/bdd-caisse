const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openPdf: (relativePath) => ipcRenderer.send('open-pdf', relativePath)
});
