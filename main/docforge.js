const { ipcMain, dialog, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');

var docforgeState = {
  recentFiles: [],
  maxRecentFiles: 20,
  settings: {},
  offlineDocs: [],
  userDataPath: ''
};

function init(userDataPath) {
  docforgeState.userDataPath = userDataPath || app.getPath('userData');
  loadSettings();
  loadRecentFiles();
  registerHandlers();
}

function getStoragePath() {
  return path.join(docforgeState.userDataPath, 'docforge-data');
}

function ensureStorageDir() {
  var dir = getStoragePath();
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
  }
  return dir;
}

function loadSettings() {
  var file = path.join(getStoragePath(), 'settings.json');
  try { if (fs.existsSync(file)) docforgeState.settings = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch(e) { docforgeState.settings = {}; }
}

function saveSettings() {
  ensureStorageDir();
  var file = path.join(getStoragePath(), 'settings.json');
  try { fs.writeFileSync(file, JSON.stringify(docforgeState.settings, null, 2)); } catch(e) {}
}

function loadRecentFiles() {
  var file = path.join(getStoragePath(), 'recent-files.json');
  try { if (fs.existsSync(file)) docforgeState.recentFiles = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch(e) { docforgeState.recentFiles = []; }
}

function saveRecentFiles() {
  ensureStorageDir();
  var file = path.join(getStoragePath(), 'recent-files.json');
  try { fs.writeFileSync(file, JSON.stringify(docforgeState.recentFiles.slice(0, docforgeState.maxRecentFiles), null, 2)); } catch(e) {}
}

function addRecentFile(filePath) {
  if (!filePath) return;
  var stat = null;
  try { stat = fs.statSync(filePath); } catch(e) { return; }
  var ext = path.extname(filePath).toLowerCase().slice(1);
  var supportedFormats = ['docx', 'pdf', 'md', 'txt', 'html', 'xlsx', 'pptx'];
  if (supportedFormats.indexOf(ext) === -1) return;
  docforgeState.recentFiles = docforgeState.recentFiles.filter(function(f) { return f.path !== filePath; });
  docforgeState.recentFiles.unshift({
    path: filePath,
    name: path.basename(filePath),
    format: ext,
    lastOpened: Date.now(),
    size: stat.size
  });
  saveRecentFiles();
}

function readFileContent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  var stat = fs.statSync(filePath);
  if (stat.size > 50 * 1024 * 1024) return { error: '文件过大（超过50MB）' };
  var ext = path.extname(filePath).toLowerCase().slice(1);
  var content = fs.readFileSync(filePath);
  if (ext === 'pdf' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
    return { content: content.toString('base64'), format: ext, name: path.basename(filePath), size: stat.size };
  }
  return { content: content.toString('utf-8'), format: ext || 'txt', name: path.basename(filePath), size: stat.size };
}

function writeFileContent(filePath, content, format) {
  ensureStorageDir();
  if (format === 'base64') {
    fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
  } else {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  return true;
}

function registerHandlers() {

  ipcMain.handle('docforge:open-file', async function() {
    var result = await dialog.showOpenDialog({
      title: '打开文档',
      filters: [
        { name: '所有支持的文档', extensions: ['docx', 'pdf', 'md', 'txt', 'html', 'xlsx', 'pptx'] },
        { name: 'Word文档', extensions: ['docx'] },
        { name: 'PDF文档', extensions: ['pdf'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: '文本文件', extensions: ['txt'] },
        { name: 'HTML', extensions: ['html'] },
        { name: 'Excel表格', extensions: ['xlsx'] },
        { name: '演示文稿', extensions: ['pptx'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { success: false };
    var filePath = result.filePaths[0];
    var data = readFileContent(filePath);
    if (!data) return { success: false, error: '无法读取文件' };
    if (data.error) return { success: false, error: data.error };
    addRecentFile(filePath);
    return { success: true, path: filePath, name: data.name, format: data.format, content: data.content, size: data.size };
  });

  ipcMain.handle('docforge:open-file-path', async function(event, filePath) {
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: '文件不存在: ' + filePath };
    var data = readFileContent(filePath);
    if (!data) return { success: false, error: '无法读取文件' };
    if (data.error) return { success: false, error: data.error };
    addRecentFile(filePath);
    return { success: true, path: filePath, name: data.name, format: data.format, content: data.content, size: data.size };
  });

  ipcMain.handle('docforge:save-file', async function(event, opts) {
    var content = opts.content || '';
    var filename = opts.filename || '未命名文档';
    var format = opts.format || 'txt';
    var targetPath = opts.path;

    if (!targetPath) {
      var result = await dialog.showSaveDialog({
        title: '保存文档',
        defaultPath: filename,
        filters: [{ name: format.toUpperCase() + ' 文件', extensions: [format] }]
      });
      if (result.canceled) return { success: false, canceled: true };
      targetPath = result.filePath;
    }

    try {
      writeFileContent(targetPath, content, opts.encoding || 'utf-8');
      addRecentFile(targetPath);
      return { success: true, path: targetPath };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:save-file-as', async function(event, opts) {
    var content = opts.content || '';
    var filename = opts.filename || '未命名文档';
    var format = opts.format || 'txt';

    var result = await dialog.showSaveDialog({
      title: '另存为',
      defaultPath: filename,
      filters: [
        { name: 'Word文档', extensions: ['docx'] },
        { name: 'PDF文档', extensions: ['pdf'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'HTML', extensions: ['html'] },
        { name: '纯文本', extensions: ['txt'] }
      ]
    });
    if (result.canceled) return { success: false, canceled: true };

    try {
      writeFileContent(result.filePath, content, opts.encoding || 'utf-8');
      addRecentFile(result.filePath);
      return { success: true, path: result.filePath };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:read-file', async function(event, opts) {
    var filePath = opts.path;
    if (!filePath) return { success: false, error: '路径不能为空' };
    var data = readFileContent(filePath);
    if (!data) return { success: false, error: '无法读取文件' };
    if (data.error) return { success: false, error: data.error };
    return { success: true, ...data };
  });

  ipcMain.handle('docforge:get-recent-files', async function() {
    return { success: true, files: docforgeState.recentFiles };
  });

  ipcMain.handle('docforge:add-recent-file', async function(event, opts) {
    if (opts && opts.file) {
      addRecentFile(opts.file.path || opts.file);
    }
    return { success: true };
  });

  ipcMain.handle('docforge:clear-recent-files', async function() {
    docforgeState.recentFiles = [];
    saveRecentFiles();
    return { success: true };
  });

  ipcMain.handle('docforge:get-setting', async function(event, opts) {
    return docforgeState.settings[opts.key] ?? null;
  });

  ipcMain.handle('docforge:set-setting', async function(event, opts) {
    docforgeState.settings[opts.key] = opts.value;
    saveSettings();
  });

  ipcMain.handle('docforge:get-all-settings', async function() {
    return docforgeState.settings;
  });

  ipcMain.handle('docforge:delete-setting', async function(event, opts) {
    delete docforgeState.settings[opts.key];
    saveSettings();
  });

  ipcMain.handle('docforge:get-system-locale', async function() {
    return app.getLocale();
  });

  ipcMain.handle('docforge:get-system-theme', async function() {
    var theme = require('electron').nativeTheme ? (require('electron').nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : 'dark';
    return theme;
  });

  ipcMain.handle('docforge:show-notification', async function(event, opts) {
    var { Notification: Notif } = require('electron');
    if (Notif) {
      var n = new Notif({ title: opts.title || '', body: opts.body || '' });
      n.show();
    }
  });

  ipcMain.handle('docforge:open-external', async function(event, opts) {
    shell.openExternal(opts.url || '');
  });

  ipcMain.handle('docforge:get-app-version', async function() {
    return app.getVersion();
  });

  ipcMain.handle('docforge:is-electron', async function() {
    return true;
  });

  ipcMain.handle('docforge:get-platform', async function() {
    return process.platform;
  });

  ipcMain.handle('docforge:set-title', async function(event, opts) {
    var win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) win.setTitle(opts.title || '');
  });

  ipcMain.handle('docforge:toggle-fullscreen', async function(event) {
    var win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.handle('docforge:minimize', async function(event) {
    var win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle('docforge:maximize', async function(event) {
    var win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) win.unmaximize(); else win.maximize();
    }
  });

  ipcMain.handle('docforge:delete-file', async function(event, opts) {
    var filePath = opts.path;
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: '文件不存在' };
    try {
      fs.unlinkSync(filePath);
      docforgeState.recentFiles = docforgeState.recentFiles.filter(function(f) { return f.path !== filePath; });
      saveRecentFiles();
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:watch-file', async function(event, opts) {
    var filePath = opts.path;
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      var watcher = fs.watch(filePath, function(eventType) {
        var win = require('electron').BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('docforge:file-changed', { path: filePath, type: eventType });
      });
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:unwatch-file', async function(event, opts) {
    return { success: true };
  });

  var offlineDir = path.join(getStoragePath(), 'offline-docs');

  ipcMain.handle('docforge:save-offline-doc', async function(event, opts) {
    ensureStorageDir();
    var docsDir = offlineDir;
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    var docId = opts.id || Date.now().toString(36);
    var docFile = path.join(docsDir, docId + '.json');
    try {
      fs.writeFileSync(docFile, JSON.stringify({
        id: docId,
        name: opts.name || '未命名',
        content: opts.content || '',
        format: opts.format || 'txt',
        metadata: opts.metadata || {},
        lastModified: Date.now()
      }, null, 2));
      return { success: true, id: docId };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:get-offline-docs', async function() {
    ensureStorageDir();
    var docsDir = offlineDir;
    if (!fs.existsSync(docsDir)) return { success: true, docs: [] };
    var files = [];
    try {
      var entries = fs.readdirSync(docsDir);
      entries.forEach(function(entry) {
        if (entry.endsWith('.json')) {
          try {
            var data = JSON.parse(fs.readFileSync(path.join(docsDir, entry), 'utf-8'));
            files.push({ id: data.id, name: data.name, format: data.format, syncStatus: 'synced', lastModified: data.lastModified });
          } catch(e) {}
        }
      });
    } catch(e) {}
    return { success: true, docs: files };
  });

  ipcMain.handle('docforge:get-offline-doc', async function(event, opts) {
    var docFile = path.join(offlineDir, opts.id + '.json');
    if (!fs.existsSync(docFile)) return { success: null };
    try {
      var data = JSON.parse(fs.readFileSync(docFile, 'utf-8'));
      return { success: true, ...data };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('docforge:delete-offline-doc', async function(event, opts) {
    var docFile = path.join(offlineDir, opts.id + '.json');
    if (fs.existsSync(docFile)) {
      try { fs.unlinkSync(docFile); } catch(e) { return { success: false, error: e.message }; }
    }
    return { success: true };
  });

  ipcMain.handle('docforge:sync-status', async function() {
    return { success: true, online: navigator.onLine, pending: 0, synced: 0, totalDocs: 0, conflictCount: 0 };
  });

  // ---- Coze 协作 API ----
  var COZE_BASE = 'https://6f94575e-4186-4903-93b7-1e93e666cbf4.dev.coze.site';

  ipcMain.handle('docforge:coze-request', async function(event, opts) {
    var method = (opts.method || 'GET').toUpperCase();
    var path = opts.path || '/';
    var body = opts.body || null;
    var headers = opts.headers || {};

    var url = COZE_BASE + path;
    var requester = url.startsWith('https') ? require('https') : require('http');

    return new Promise(function(resolve) {
      try {
        var reqBody = body ? JSON.stringify(body) : null;
        var options = {
          hostname: new URL(url).hostname,
          port: new URL(url).port || (url.startsWith('https') ? 443 : 80),
          path: new URL(url).pathname + (new URL(url).search || ''),
          method: method,
          headers: Object.assign({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }, headers)
        };
        if (reqBody) options.headers['Content-Length'] = Buffer.byteLength(reqBody);

        var req = requester.request(options, function(res) {
          var data = '';
          res.on('data', function(chunk) { data += chunk; });
          res.on('end', function() {
            var result = null;
            try { result = JSON.parse(data); } catch(e) { result = { raw: data }; }
            resolve({ success: res.statusCode < 400, status: res.statusCode, data: result });
          });
        });

        req.on('error', function(e) { resolve({ success: false, error: e.message }); });
        req.setTimeout(15000, function() { req.destroy(); resolve({ success: false, error: '请求超时' }); });
        if (reqBody) req.write(reqBody);
        req.end();
      } catch(e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
}

module.exports = { init };
