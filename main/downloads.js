// ==================== 下载管理模块 ====================
// 支持：下载前确认弹窗、IDM 集成、独立下载窗口

const { session, app, shell, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 下载队列 { id: DownloadItem }
const downloads = new Map();
// 下载历史记录（仅本次运行）
let downloadHistory = [];
// 默认下载路径
let downloadPath = app.getPath('downloads');
// 下载窗口引用
let downloadWindow = null;
// 已确认的下载计数器（用于跳过重新触发下载时的确认弹窗）
let confirmedDownloadCount = 0;
// 待设置的保存路径
let pendingSavePath = null;
// IDM 路径缓存
let idmPathCache = null;

/**
 * 格式化字节大小
 */
function formatBytes(bytes) {
  if (!bytes || bytes === -1) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

/**
 * 检测 IDM 安装路径
 */
function findIDM() {
  if (idmPathCache !== null) return idmPathCache;

  const possiblePaths = [
    'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe',
    'C:\\Program Files\\Internet Download Manager\\IDMan.exe',
  ];

  // 也从 LOCALAPPDATA 搜索
  const localAppData = process.env.LOCALAPPDATA || '';
  if (localAppData) {
    possiblePaths.unshift(path.join(localAppData, 'Programs', 'Internet Download Manager', 'IDMan.exe'));
  }

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        idmPathCache = p;
        return p;
      }
    } catch(e) {}
  }

  // 尝试从注册表搜索
  try {
    const { execSync } = require('child_process');
    const regKeys = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    ];
    for (const key of regKeys) {
      try {
        const result = execSync(`reg query "${key}" /s /f "Internet Download Manager" 2>nul`, { encoding: 'utf-8', timeout: 3000 });
        const match = result.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
        if (match) {
          const idmPath = path.join(match[1].trim(), 'IDMan.exe');
          if (fs.existsSync(idmPath)) {
            idmPathCache = idmPath;
            return idmPath;
          }
        }
        // 也检查 DisplayIcon
        const iconMatch = result.match(/DisplayIcon\s+REG_SZ\s+(.+IDMan\.exe)/i);
        if (iconMatch) {
          const idmPath = iconMatch[1].trim();
          if (fs.existsSync(idmPath)) {
            idmPathCache = idmPath;
            return idmPath;
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  idmPathCache = ''; // 标记为未找到（区别于 null 未搜索）
  return '';
}

/**
 * 使用 IDM 下载
 */
function downloadWithIDM(url, filename, saveDir) {
  const idmExe = findIDM();
  if (!idmExe) {
    console.error('[Downloads] IDM 未找到');
    return false;
  }

  const args = ['/d', url, '/p', saveDir];
  if (filename) args.push('/f', filename);

  try {
    execFile(idmExe, args, (err) => {
      if (err) console.error('[Downloads] IDM 启动失败:', err);
      else console.log('[Downloads] IDM 下载已添加:', filename || url);
    });
    return true;
  } catch(e) {
    console.error('[Downloads] IDM 调用异常:', e);
    return false;
  }
}

/**
 * 显示下载确认弹窗
 * @returns {Promise<'save'|'idm'|'cancel'>}
 */
async function showDownloadConfirm(filename, url, totalBytes) {
  const mainWin = require('./window-manager').getMainWindow();
  const idmExe = findIDM();

  const buttons = ['保存', '取消'];
  if (idmExe) buttons.splice(1, 0, '使用 IDM 下载');

  const result = await dialog.showMessageBox(mainWin, {
    type: 'question',
    title: '下载确认',
    icon: null,
    message: `是否下载此文件？`,
    detail: [
      `文件名: ${filename}`,
      `大小: ${formatBytes(totalBytes)}`,
      `来源: ${url.length > 80 ? url.substring(0, 80) + '...' : url}`,
      '',
      idmExe ? '提示: 可选择使用 IDM 下载以获得更快的速度' : '',
    ].filter(Boolean).join('\n'),
    buttons,
    defaultId: 0,
    cancelId: buttons.indexOf('取消'),
    noLink: true,
  });

  const choice = buttons[result.response];
  if (choice === '保存') return 'save';
  if (choice === '使用 IDM 下载') return 'idm';
  return 'cancel';
}

/**
 * 显示保存对话框
 * @returns {Promise<string|null>} 保存路径，取消则返回 null
 */
async function showSaveDialog(filename) {
  const mainWin = require('./window-manager').getMainWindow();
  const result = await dialog.showSaveDialog(mainWin, {
    title: '保存文件',
    defaultPath: path.join(downloadPath, filename),
    properties: ['showOverwriteConfirmation'],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

/**
 * 创建/显示下载管理窗口
 */
function createDownloadWindow() {
  if (downloadWindow && !downloadWindow.isDestroyed()) {
    downloadWindow.show();
    downloadWindow.focus();
    return downloadWindow;
  }

  const mainWin = require('./window-manager').getMainWindow();
  const parentBounds = mainWin ? mainWin.getBounds() : { x: 100, y: 100, width: 1200 };

  downloadWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 420,
    minHeight: 360,
    x: parentBounds.x + Math.round((parentBounds.width - 560) / 2),
    y: parentBounds.y + 100,
    frame: false,
    resizable: true,
    show: false,
    parent: mainWin || undefined,
    backgroundColor: '#0c0c10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '..', 'src', 'download-preload.js'),
    },
  });

  downloadWindow.loadFile(path.join(__dirname, '..', 'src', 'download.html'));

  downloadWindow.once('ready-to-show', () => {
    if (downloadWindow && !downloadWindow.isDestroyed()) {
      downloadWindow.show();
    }
  });

  downloadWindow.on('closed', () => { downloadWindow = null; });

  return downloadWindow;
}

/**
 * 获取下载窗口
 */
function getDownloadWindow() {
  return downloadWindow;
}

/**
 * 向下载窗口发送事件
 */
function sendToDownloadWindow(channel, data) {
  if (downloadWindow && !downloadWindow.isDestroyed()) {
    downloadWindow.webContents.send(channel, data);
  }
}

/**
 * 初始化下载管理器
 */
function initDownloads() {
  const ses = session.defaultSession;

  ses.on('will-download', (event, item, webContents) => {
    // 捕获下载项信息
    const url = item.getURL();
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();
    const mimeType = item.getMimeType();

    // 如果是已确认的下载（重新触发），直接保存
    if (confirmedDownloadCount > 0) {
      confirmedDownloadCount--;
      const savePath = pendingSavePath || path.join(downloadPath, filename);
      pendingSavePath = null;
      item.setSavePath(savePath);

      const id = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      const record = {
        id,
        filename,
        savePath,
        url,
        mimeType,
        totalBytes,
        receivedBytes: 0,
        state: 'progressing',
        startTime: Date.now(),
      };

      downloads.set(id, item);
      downloadHistory.push(record);

      // 通知渲染进程和下载窗口
      notifyDownloadStarted(record);

      // 进度更新（节流）
      let lastNotify = 0;
      let lastReceivedBytes = 0;
      let lastNotifyTime = Date.now();

      item.on('updated', (event, state) => {
        record.receivedBytes = item.getReceivedBytes();
        record.state = state;

        const now = Date.now();
        // 计算速度
        const elapsed = (now - lastNotifyTime) / 1000;
        const speed = elapsed > 0 ? (record.receivedBytes - lastReceivedBytes) / elapsed : 0;

        if (now - lastNotify >= 400 || state !== 'progressing') {
          lastNotify = now;
          lastReceivedBytes = record.receivedBytes;
          lastNotifyTime = now;

          const progressData = {
            id,
            receivedBytes: record.receivedBytes,
            totalBytes: record.totalBytes,
            state,
            speed: Math.round(speed),
          };

          // 通知主窗口
          const mainWin = require('./window-manager').getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('download-progress', progressData);
          }
          // 通知下载窗口
          sendToDownloadWindow('download-progress', progressData);
        }
      });

      // 下载完成/中断
      item.on('done', (event, state) => {
        record.state = state;
        downloads.delete(id);

        const doneData = state === 'completed'
          ? { id, filename, savePath, totalBytes: record.totalBytes, receivedBytes: record.receivedBytes }
          : { id, filename, state };

        const mainWin = require('./window-manager').getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          if (state === 'completed') {
            mainWin.webContents.send('download-completed', doneData);
          } else {
            mainWin.webContents.send('download-failed', doneData);
          }
        }
        sendToDownloadWindow(state === 'completed' ? 'download-completed' : 'download-failed', doneData);

        // 下载完成时自动显示下载窗口
        if (state === 'completed') {
          createDownloadWindow();
        }
      });

      return;
    }

    // ---- 新下载：先取消，弹出确认 ----
    event.preventDefault();

    (async () => {
      try {
        const choice = await showDownloadConfirm(filename, url, totalBytes);

        if (choice === 'save') {
          // 让用户选择保存位置
          const savePath = await showSaveDialog(filename);
          if (savePath) {
            // 重新触发下载
            confirmedDownloadCount++;
            pendingSavePath = savePath;
            // 使用 webContents.downloadURL 重新触发
            if (webContents && !webContents.isDestroyed()) {
              webContents.downloadURL(url);
            } else {
              // 如果原 webContents 已销毁，用主窗口的
              const mainWin = require('./window-manager').getMainWindow();
              if (mainWin && !mainWin.isDestroyed()) {
                mainWin.webContents.downloadURL(url);
              }
            }
          }
          // 用户取消了保存对话框 = 放弃下载
        } else if (choice === 'idm') {
          // 使用 IDM 下载
          downloadWithIDM(url, filename, downloadPath);
          // 自动显示下载窗口
          createDownloadWindow();
        }
        // cancel: 什么都不做
      } catch(e) {
        console.error('[Downloads] 下载确认流程异常:', e);
      }
    })();
  });
}

/**
 * 通知下载开始
 */
function notifyDownloadStarted(record) {
  const data = {
    id: record.id,
    filename: record.filename,
    savePath: record.savePath,
    totalBytes: record.totalBytes,
    url: record.url,
  };

  // 通知主窗口
  const mainWin = require('./window-manager').getMainWindow();
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('download-started', data);
  }

  // 通知下载窗口
  sendToDownloadWindow('download-started', data);

  // 自动显示下载窗口
  createDownloadWindow();
}

function getDownloadsList() {
  return downloadHistory.map(d => ({
    id: d.id,
    filename: d.filename,
    name: d.filename,
    savePath: d.savePath,
    url: d.url,
    totalBytes: d.totalBytes,
    receivedBytes: d.receivedBytes,
    state: d.state,
    startTime: d.startTime,
  }));
}

function cancelDownload(id) {
  const item = downloads.get(id);
  if (item) {
    item.cancel();
    const record = downloadHistory.find(d => d.id === id);
    if (record) record.state = 'cancelled';
    return true;
  }
  return false;
}

function pauseDownload(id) {
  const item = downloads.get(id);
  if (item && item.canResume()) {
    item.pause();
    const record = downloadHistory.find(d => d.id === id);
    if (record) record.state = 'interrupted';
    return true;
  }
  return false;
}

function resumeDownload(id) {
  const item = downloads.get(id);
  if (item && item.canResume()) {
    item.resume();
    const record = downloadHistory.find(d => d.id === id);
    if (record) record.state = 'progressing';
    return true;
  }
  return false;
}

function clearDownloadHistory() {
  // 只清除已完成的记录
  downloadHistory = downloadHistory.filter(d => d.state === 'progressing' || d.state === 'interrupted');
  return true;
}

function showInFolder(id) {
  const record = downloadHistory.find(d => d.id === id);
  if (record && record.savePath && fs.existsSync(record.savePath)) {
    shell.showItemInFolder(record.savePath);
    return true;
  }
  return false;
}

function openDownloadFolder() {
  if (fs.existsSync(downloadPath)) {
    shell.openPath(downloadPath);
    return true;
  }
  return false;
}

function setDownloadPath(dir) {
  if (fs.existsSync(dir)) {
    downloadPath = dir;
    return true;
  }
  return false;
}

function getDownloadPath() {
  return downloadPath;
}

async function openDownloadDialog() {
  const result = await dialog.showOpenDialog({
    title: '选择下载路径',
    properties: ['openDirectory'],
    defaultPath: downloadPath,
  });
  if (!result.canceled && result.filePaths.length > 0) {
    downloadPath = result.filePaths[0];
    return downloadPath;
  }
  return null;
}

module.exports = {
  initDownloads,
  getDownloadsList,
  cancelDownload,
  pauseDownload,
  resumeDownload,
  clearDownloadHistory,
  showInFolder,
  setDownloadPath,
  getDownloadPath,
  openDownloadDialog,
  openDownloadFolder,
  createDownloadWindow,
  getDownloadWindow,
  findIDM,
  downloadWithIDM,
};
