console.log('✅ preload.js exécuté');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openPdf: (relativePath) => ipcRenderer.send('open-pdf', relativePath),
  ouvrirDevTools: () => ipcRenderer.send('devtools-open'),
  ensureInteractiveLight: () => ipcRenderer.invoke('ui/ensure-interactive-light'),
  ensureInteractiveRaise: () => ipcRenderer.invoke('ui/ensure-interactive-raise'),
  getVersionInfo: () => ipcRenderer.invoke('app/get-version-info'),
  checkForUpdates: () => ipcRenderer.invoke('app/check-for-updates'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app/update-status', listener);
    return () => ipcRenderer.removeListener('app/update-status', listener);
  }
});
