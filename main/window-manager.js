// ==================== 窗口管理 ====================

const { BrowserWindow, session } = require('electron');
const path = require('path');
const { saveWindowState, restoreWindowState } = require('./session-manager');

let mainWindow;

function createWindow() {
  // 恢复窗口状态
  const savedState = restoreWindowState();
  const width = savedState?.width || 1400;
  const height = savedState?.height || 900;
  const x = savedState?.x;
  const y = savedState?.y;
  const isMaximized = savedState?.isMaximized || false;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0c0c10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      preload: path.join(__dirname, '..', 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  });

  // 恢复最大化状态
  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // 生产环境不自动打开 DevTools
  // mainWindow.webContents.openDevTools();

  // 监听 webview 创建
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );

    // webview 右键菜单
    webContents.on('context-menu', (event, params) => {
      event.preventDefault();
      const { showContextMenu } = require('./context-menu');
      showContextMenu(params);
    });
  });

  // 窗口关闭前保存状态，根据托盘设置决定行为
  mainWindow.on('close', (e) => {
    const { app } = require('electron');
    const { getTray } = require('./tray');
    const tray = getTray();
    
    // 如果托盘存在且不是正在退出，隐藏到托盘
    if (tray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
    
    // 否则正常退出
    const bounds = mainWindow.getBounds();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 窗口焦点事件（用于性能模式）
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-blur');
    }
  });

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-focus');
    }
  });
}

function createIncognitoWindow(theme = 'dark') {
  const savedState = restoreWindowState();
  const width = savedState?.width || 1400;
  const height = savedState?.height || 900;
  const x = savedState?.x;
  const y = savedState?.y;

  const incognitoWindow = new BrowserWindow({
    width,
    height,
    x: x ? x + 30 : undefined,
    y: y ? y + 30 : undefined,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: theme === 'light' ? '#f5f5f7' : '#0c0c10',
    title: '无痕模式 - Drift 浏览器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      preload: path.join(__dirname, '..', 'preload.js'),
      partition: 'persist:incognito',
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  });

  incognitoWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'), {
    query: { incognito: 'true', theme: theme }
  });

  incognitoWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );

    webContents.on('context-menu', (event, params) => {
      event.preventDefault();
      const { showContextMenu } = require('./context-menu');
      showContextMenu(params);
    });
  });

  incognitoWindow.on('closed', () => {
    // 无痕窗口关闭时清除 session 数据
    const ses = session.fromPartition('persist:incognito');
    ses.clearStorageData().catch(() => {});
  });

  return incognitoWindow;
}

function getMainWindow() {
  return mainWindow;
}

let taskManagerWindow = null;
let performanceWindow = null;

function createTaskManagerWindow() {
  if (taskManagerWindow && !taskManagerWindow.isDestroyed()) {
    taskManagerWindow.focus();
    return taskManagerWindow;
  }

  taskManagerWindow = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 400,
    frame: true,
    title: '任务管理器 - Drift 浏览器',
    backgroundColor: '#0c0c10',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  });

  taskManagerWindow.loadFile(path.join(__dirname, '..', 'src', 'windows', 'task-manager.html'));
  taskManagerWindow.on('closed', () => { taskManagerWindow = null; });
  
  return taskManagerWindow;
}

function createPerformanceWindow() {
  if (performanceWindow && !performanceWindow.isDestroyed()) {
    performanceWindow.focus();
    return performanceWindow;
  }

  performanceWindow = new BrowserWindow({
    width: 500,
    height: 550,
    minWidth: 400,
    minHeight: 400,
    frame: true,
    title: '性能监视器 - Drift 浏览器',
    backgroundColor: '#0c0c10',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  });

  performanceWindow.loadFile(path.join(__dirname, '..', 'src', 'windows', 'performance.html'));
  performanceWindow.on('closed', () => { performanceWindow = null; });
  
  return performanceWindow;
}

// ==================== 小窗模式 ====================
let miniWindow = null;

function createMiniWindow(url) {
  if (miniWindow && !miniWindow.isDestroyed()) {
    // 如果小窗已存在，聚焦并更新URL
    miniWindow.focus();
    if (url) {
      miniWindow.webContents.send('mini-window-load-url', url);
    }
    return miniWindow;
  }

  miniWindow = new BrowserWindow({
    width: 400,
    height: 300,
    minWidth: 300,
    minHeight: 200,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  });

  miniWindow.loadFile(path.join(__dirname, '..', 'src', 'windows', 'mini-window.html'), {
    query: { url: url || '' }
  });

  miniWindow.on('closed', () => { 
    miniWindow = null;
    // 通知主窗口小窗已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-window-closed');
    }
  });

  return miniWindow;
}

function closeMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close();
    miniWindow = null;
  }
}

function getMiniWindow() {
  return miniWindow;
}

// ==================== 内存监控 ====================
const v8 = require('v8');

let memoryCheckInterval;

function startMemoryMonitor() {
  memoryCheckInterval = setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const usedMB = Math.round(heapStats.used_heap_size / 1024 / 1024);
    const limitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    const usagePercent = (usedMB / limitMB) * 100;
    
    console.log(`[Memory] 堆内存: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`);
    
    if (usagePercent > 80) {
      console.log('[Memory] 严重内存压力，触发强制释放');
      if (global.gc) global.gc();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory-critical', usedMB);
      }
    } else if (usagePercent > 60) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory-pressure', usedMB);
      }
    }

    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const sysPressure = 1 - (freeMem / totalMem);
    if (sysPressure > 0.85 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-memory-critical', {
        freeMemoryMB: Math.round(freeMem / 1024 / 1024),
        totalMemoryMB: Math.round(totalMem / 1024 / 1024),
        pressure: sysPressure
      });
    }
  }, 15000);
}

function stopMemoryMonitor() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
  }
}

// ==================== Session 缓存配置 ====================
function configureSession() {
  const ses = session.defaultSession;
  
  // 智能缓存清理（每60分钟，只清理过期数据，保留媒体缓存）
  setInterval(async () => {
    try {
      await ses.clearStorageData({
        storages: ['cache'],
        quotas: ['temporary']
      });
      console.log('[Memory] 过期缓存已清理（媒体缓存保留）');
    } catch (e) {
      console.error('[Memory] 缓存清理失败:', e);
    }
  }, 3600000);
  
  console.log('[Memory] Session 缓存配置完成');
}

module.exports = { 
  createWindow, 
  createIncognitoWindow, 
  getMainWindow,
  createTaskManagerWindow,
  createPerformanceWindow,
  createMiniWindow,
  closeMiniWindow,
  getMiniWindow,
  startMemoryMonitor,
  stopMemoryMonitor,
  configureSession
};
