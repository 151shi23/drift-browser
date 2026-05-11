// ==================== 下载窗口专用 Preload ====================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- 下载管理 ----
  downloadsGetList: () => ipcRenderer.invoke('downloads:get-list'),
  downloadsCancel: (id) => ipcRenderer.invoke('downloads:cancel', id),
  downloadsPause: (id) => ipcRenderer.invoke('downloads:pause', id),
  downloadsResume: (id) => ipcRenderer.invoke('downloads:resume', id),
  downloadsClear: () => ipcRenderer.invoke('downloads:clear'),
  downloadsShowInFolder: (id) => ipcRenderer.invoke('downloads:show-in-folder', id),
  downloadsSetPath: (dir) => ipcRenderer.invoke('downloads:set-path', dir),
  downloadsGetPath: () => ipcRenderer.invoke('downloads:get-path'),
  downloadsOpenDialog: () => ipcRenderer.invoke('downloads:open-dialog'),
  downloadsOpenFolder: () => ipcRenderer.invoke('downloads:open-folder'),

  // 下载事件监听
  onDownloadStarted: (cb) => ipcRenderer.on('download-started', (_, data) => cb(data)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, data) => cb(data)),
  onDownloadCompleted: (cb) => ipcRenderer.on('download-completed', (_, data) => cb(data)),
  onDownloadFailed: (cb) => ipcRenderer.on('download-failed', (_, data) => cb(data)),

  // 下载窗口闪烁任务栏
  downloadWindowFlash: () => ipcRenderer.send('download-window-flash'),

  // 打开 URL（在主窗口新标签页）
  openWindow: (url) => ipcRenderer.invoke('open-new-window', url),
});
