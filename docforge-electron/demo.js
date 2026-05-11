/**
 * DocForge Electron Plugin - Demo Host
 * 演示如何在你的 Electron 浏览器中集成 DocForge 插件
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 导入 DocForge 插件
const { DocForgePlugin } = require('./dist/main/index');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'DocForge - 文档编辑器',
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 加载 DocForge 渲染器
  mainWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 创建插件实例
  const docforge = new DocForgePlugin({
    userDataPath: app.getPath('userData'),
  });

  // 注册 IPC 处理器
  docforge.register(ipcMain);

  // 创建窗口
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
