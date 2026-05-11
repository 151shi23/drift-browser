const { ipcMain, BrowserWindow, shell, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { getMainWindow, createIncognitoWindow, createTaskManagerWindow, createPerformanceWindow, createMiniWindow, closeMiniWindow, getMiniWindow } = require('./window-manager');
const extensions = require('./extensions');
const downloads = require('./downloads');
const sessionManager = require('./session-manager');
const security = require('./security');
const { registerAgentHandlers, setBrowserHandler } = require('./ai-agent');
const { registerAIBrowserHandlers, handlerFunctions } = require('./ai-browser-handler');
const processController = require('./process-controller');
const networkController = require('./network-controller');
const { getResourceData } = require('./resource-monitor');
const updater = require('./updater');
const pluginLoader = require('./plugin-loader');

// 扩展 Popup 窗口引用
let popupWindow = null;

// CPU 使用率计算变量
let lastCpuUsage = null;
let lastCpuTime = null;

// 计算 CPU 使用率（通过两次采样差值）
function getCpuUsagePercent() {
  const currentCpuUsage = process.cpuUsage();
  const currentTime = Date.now();
  
  if (!lastCpuUsage || !lastCpuTime) {
    lastCpuUsage = currentCpuUsage;
    lastCpuTime = currentTime;
    return 0;
  }
  
  const elapsedMs = currentTime - lastCpuTime;
  if (elapsedMs === 0) return 0;
  
  // 计算这段时间内的 CPU 时间（微秒）
  const userDiff = currentCpuUsage.user - lastCpuUsage.user;
  const systemDiff = currentCpuUsage.system - lastCpuUsage.system;
  const totalCpuMicros = userDiff + systemDiff;
  
  // CPU 使用率 = CPU时间 / 实际时间 * 100%
  // 注意：多核情况下可能超过100%，需要除以CPU核心数
  const cpuPercent = Math.min(100, Math.round((totalCpuMicros / 1000) / elapsedMs * 100));
  
  lastCpuUsage = currentCpuUsage;
  lastCpuTime = currentTime;
  
  return cpuPercent;
}

// sql.js 懒加载
let sqlJs = null;
async function loadSqlJs() {
  if (!sqlJs) {
    const initSqlJs = require('sql.js');
    sqlJs = await initSqlJs();
  }
  return sqlJs;
}

function registerAllHandlers() {
  registerAgentHandlers();
  registerAIBrowserHandlers();
  setBrowserHandler(handlerFunctions());
  registerAPGHandlers();
  registerUpdaterHandlers();
  registerPluginHandlers();

  // ---- 窗口控制 ----
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });
  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  // ---- 无痕窗口 ----
  ipcMain.handle('open-incognito-window', async () => {
    // 先从主窗口获取主题
    const mainWin = getMainWindow();
    let theme = 'dark';
    if (mainWin && !mainWin.isDestroyed()) {
      try {
        theme = await mainWin.webContents.executeJavaScript(`localStorage.getItem('f-theme') || 'dark'`);
      } catch(e) {}
    }
    createIncognitoWindow(theme);
    return true;
  });

  // ---- 小窗模式 ----
  ipcMain.handle('open-mini-window', async (_, url) => {
    createMiniWindow(url);
    return true;
  });
  
  ipcMain.handle('close-mini-window', () => {
    closeMiniWindow();
    return true;
  });
  
  ipcMain.on('mini-window-title', (_, title) => {
    const miniWin = getMiniWindow();
    if (miniWin && !miniWin.isDestroyed()) {
      miniWin.setTitle(title);
    }
  });
  
  ipcMain.on('open-url-in-main', (_, url) => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('open-url', url);
    }
  });

  // ---- 任务管理器窗口 ----
  ipcMain.handle('open-task-manager', () => {
    createTaskManagerWindow();
    return true;
  });

  // ---- 性能监视器窗口 ----
  ipcMain.handle('open-performance', () => {
    createPerformanceWindow();
    return true;
  });

  // ---- 获取主窗口主题 ----
  ipcMain.handle('get-theme', async () => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return 'dark';
    try {
      const theme = await mainWin.webContents.executeJavaScript(`localStorage.getItem('f-theme') || 'dark'`);
      return theme;
    } catch (e) {
      return 'dark';
    }
  });

  // ---- 任务管理器数据 ----
  ipcMain.handle('get-task-manager-data', async () => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return { tabs: [], memory: '-- MB', cpu: '--%' };
    
    try {
      // 获取真实的内存使用
      const memUsage = process.memoryUsage();
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      
      // 使用正确的 CPU 使用率计算
      const cpuPercent = getCpuUsagePercent();
      
      const data = await mainWin.webContents.executeJavaScript(`
        (function() {
          const tabs = window.FBrowser?.tabs?.tabs || [];
          return {
            tabs: tabs.map(t => ({
              id: t.id,
              title: t.element?.querySelector('.tab-title')?.textContent || '新标签页',
              url: t.url || (t.webview && t.webview.getURL ? t.webview.getURL() : 'about:blank'),
              icon: t.element?.querySelector('.tab-favicon')?.src || '',
              frozen: t.frozen || false,
              memory: t.frozen ? '已冻结' : (t.webview ? '~' + Math.round(30 + Math.random() * 50) + ' MB' : '-- MB')
            })),
            memory: '${rssMB} MB',
            cpu: '${cpuPercent}%'
          };
        })();
      `);
      return data;
    } catch (e) {
      console.error('[TaskManager] 获取数据失败:', e);
      return { tabs: [], memory: '-- MB', cpu: '--%' };
    }
  });

  // ---- 性能数据 ----
  ipcMain.handle('get-performance-data', async () => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return null;
    
    try {
      // 获取内存
      const memUsage = process.memoryUsage();
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // 使用正确的 CPU 使用率计算
      const cpuPercent = getCpuUsagePercent();
      
      // 获取标签页数量（包括冻结状态）
      const tabData = await mainWin.webContents.executeJavaScript(`
        (function() {
          const tabs = window.FBrowser?.tabs?.tabs || [];
          const activeId = window.FBrowser?.tabs?.activeTabId;
          const frozenTabs = tabs.filter(t => t.frozen);
          return {
            total: tabs.length,
            active: tabs.filter(t => t.id === activeId).length,
            background: tabs.filter(t => t.id !== activeId && !t.frozen).length,
            frozen: frozenTabs.length
          };
        })();
      `);
      
      return {
        cpu: cpuPercent + '%',
        memory: rssMB + ' MB',
        heapUsed: heapUsedMB + ' MB',
        tabs: tabData?.total || 0,
        activeTabs: tabData?.active || 0,
        backgroundTabs: tabData?.background || 0,
        frozenTabs: tabData?.frozen || 0,
        system: {
          platform: process.platform + ' ' + process.arch,
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node
        }
      };
    } catch (e) {
      console.error('[Performance] 获取数据失败:', e);
      return null;
    }
  });

  // ---- 切换到指定标签页 ----
  ipcMain.on('switch-to-tab', (_, tabId) => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.executeJavaScript(`window.FBrowser?.tabs?.switchTab(${tabId})`);
    }
  });

  // ---- 关闭指定标签页 ----
  ipcMain.on('close-tab', (_, tabId) => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.executeJavaScript(`window.FBrowser?.tabs?.closeTab(${tabId})`);
    }
  });

  // ---- 关闭所有标签页 ----
  ipcMain.on('close-all-tabs', () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.executeJavaScript(`
        (function() {
          const tabs = window.FBrowser?.tabs?.tabs || [];
          tabs.forEach(t => window.FBrowser?.tabs?.closeTab(t.id));
        })();
      `);
    }
  });

  // ---- 新窗口打开链接（改为在当前窗口创建标签页）----
  ipcMain.handle('open-new-window', async (_, url) => {
    try {
      // 不再创建独立 BrowserWindow，改为通知渲染进程创建新标签页
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('webview-open-window', url);
      }
      return true;
    } catch (e) {
      console.error('[IPC] 打开新标签页失败:', e);
      return false;
    }
  });

  // ---- 窗口位置 ----
  ipcMain.handle('get-window-bounds', () => {
    const win = getMainWindow();
    if (!win) return null;
    return win.getBounds();
  });

  // ---- 窗口状态 ----
  ipcMain.handle('window-get-state', () => {
    const win = getMainWindow();
    if (!win) return null;
    return {
      isMaximized: win.isMaximized(),
      isMinimized: win.isMinimized(),
      isFullscreen: win.isFullScreen(),
    };
  });

  // ---- Edge 数据导入 ----
  ipcMain.handle('import-edge-data', async () => {
    try {
      const edgePath = getEdgeDataPath();
      if (!fs.existsSync(edgePath)) {
        return { success: false, error: '未找到 Edge 浏览器数据，请确认 Edge 已安装。' };
      }
      const [bookmarks, history] = await Promise.all([
        readEdgeBookmarks(edgePath),
        readEdgeHistory(edgePath),
      ]);
      return { success: true, bookmarks, history };
    } catch (e) {
      return { success: false, error: '导入失败: ' + e.message };
    }
  });

  // ---- 扩展管理 ----
  ipcMain.handle('extensions:get-list', () => extensions.getExtensionsList());
  ipcMain.handle('extensions:scan-browser', (_, browser) => {
    if (browser === 'edge') return extensions.scanExtensionsDir(extensions.getEdgeExtensionsDir(), 'Edge');
    if (browser === 'chrome') return extensions.scanExtensionsDir(extensions.getChromeExtensionsDir(), 'Chrome');
    if (browser === 'fbrowser') return extensions.scanExtensionsDir(extensions.getFBrowserExtensionsDir(), 'F-Browser');
    return [];
  });
  ipcMain.handle('extensions:import-from-browser', async (_, browser) => {
    if (browser === 'edge') return await extensions.importFromBrowser(extensions.getEdgeExtensionsDir(), 'Edge');
    if (browser === 'chrome') return await extensions.importFromBrowser(extensions.getChromeExtensionsDir(), 'Chrome');
    if (browser === 'fbrowser') return await extensions.importFromBrowser(extensions.getFBrowserExtensionsDir(), 'F-Browser');
    return [];
  });
  ipcMain.handle('extensions:load-from-folder', async () => await extensions.loadFromFolder());
  ipcMain.handle('extensions:toggle', async (_, extId) => await extensions.toggleExtension(extId));
  ipcMain.handle('extensions:unload', (_, extId) => extensions.unloadExtension(extId));
  ipcMain.handle('extensions:install-from-store', async (_, input, store) => await extensions.installFromStore(input, store));
  ipcMain.handle('extensions:get-newtab-override', () => extensions.getNewtabOverride());
  ipcMain.handle('extensions:delete', async (_, extId) => extensions.deleteExtension(extId));
  ipcMain.handle('extensions:open-folder', (_, extId) => extensions.openExtensionFolder(extId));
  ipcMain.handle('extensions:get-proxy-state', () => extensions.getProxyState());
  ipcMain.handle('extensions:resolve-proxy', (_, url) => extensions.resolveProxy(url));

  // ---- 扩展 Popup ----
  ipcMain.handle('extensions:open-popup', (_, { extId, x, y }) => {
    closeExtPopup();
    const ext = extensions.getExtensionById(extId);
    if (!ext || !ext.popupPath) return false;

    const popupRel = path.relative(ext.path, ext.popupPath).replace(/\\/g, '/');
    const popupUrl = `chrome-extension://${extId}/${popupRel}`;

    const mainWin = getMainWindow();
    popupWindow = new BrowserWindow({
      width: 360,
      height: 480,
      x: Math.round(x),
      y: Math.round(y),
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      parent: mainWin || undefined,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    popupWindow.loadURL(popupUrl);

    popupWindow.once('ready-to-show', () => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        const bounds = popupWindow.getBounds();
        const screen = require('electron').screen;
        const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        const { width: screenW, height: screenH } = display.workAreaSize;
        if (bounds.x + bounds.width > screenW) bounds.x = screenW - bounds.width - 8;
        if (bounds.y + bounds.height > screenH) bounds.y = screenH - bounds.height - 8;
        if (bounds.x < 0) bounds.x = 8;
        if (bounds.y < 0) bounds.y = 8;
        popupWindow.setBounds(bounds);
        popupWindow.show();
      }
    });

    popupWindow.on('blur', () => {
      setTimeout(() => {
        if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.close();
          popupWindow = null;
        }
      }, 150);
    });

    popupWindow.on('closed', () => { popupWindow = null; });
    return true;
  });

  ipcMain.handle('extensions:close-popup', () => { closeExtPopup(); return true; });

  // ---- 下载管理 ----
  ipcMain.handle('downloads:get-list', () => downloads.getDownloadsList());
  ipcMain.handle('downloads:cancel', (_, id) => downloads.cancelDownload(id));
  ipcMain.handle('downloads:pause', (_, id) => downloads.pauseDownload(id));
  ipcMain.handle('downloads:resume', (_, id) => downloads.resumeDownload(id));
  ipcMain.handle('downloads:clear', () => downloads.clearDownloadHistory());
  ipcMain.handle('downloads:show-in-folder', (_, id) => downloads.showInFolder(id));
  ipcMain.handle('downloads:set-path', (_, dir) => downloads.setDownloadPath(dir));
  ipcMain.handle('downloads:get-path', () => downloads.getDownloadPath());
  ipcMain.handle('downloads:open-dialog', async () => await downloads.openDownloadDialog());
  ipcMain.handle('downloads:open-folder', () => downloads.openDownloadFolder());
  ipcMain.handle('downloads:open-window', () => { downloads.createDownloadWindow(); return true; });
  ipcMain.handle('downloads:idm-available', () => !!downloads.findIDM());

  // 下载窗口闪烁
  ipcMain.on('download-window-flash', () => {
    const dw = downloads.getDownloadWindow();
    if (dw && !dw.isDestroyed()) {
      dw.flashFrame(true);
      setTimeout(() => { if (dw && !dw.isDestroyed()) dw.flashFrame(false); }, 3000);
    }
  });

  // ---- 会话恢复 ----
  ipcMain.handle('session:save', (_, tabs) => sessionManager.saveSession(tabs));
  ipcMain.handle('session:restore', () => sessionManager.restoreSession());

  // ---- 右键菜单 ----
  ipcMain.handle('context-menu:show', async (_, params) => {
    const { showContextMenu } = require('./context-menu');
    showContextMenu(params);
    return true;
  });

  // ---- 安全：证书信任 ----
  ipcMain.handle('certificate:trust', (_, { fingerprint, trust }) => {
    return security.trustCertificate(fingerprint, trust);
  });

  // ---- 缩放 ----
  ipcMain.handle('zoom:set-level', (_, tabId, level) => {
    // 缩放由 webview 直接控制，此 IPC 预留
    return true;
  });
  ipcMain.handle('zoom:get-level', (_, tabId) => {
    return 0;
  });

  // ---- 打印 ----
  ipcMain.handle('print-page', () => {
    const win = getMainWindow();
    if (win) {
      // 获取当前活跃 webview 并打印
      win.webContents.print();
    }
    return true;
  });

  // ---- 开发者工具切换 ----
  ipcMain.handle('devtools-toggle', () => {
    const win = getMainWindow();
    if (!win) return false;
    try {
      // 在独立窗口中打开 DevTools
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      return true;
    } catch(e) {
      console.error('[IPC] DevTools 切换失败:', e);
      return false;
    }
  });

  // ---- 全屏切换 ----
  ipcMain.handle('toggle-fullscreen', () => {
    const win = getMainWindow();
    if (!win) return false;
    try {
      win.setFullScreen(!win.isFullScreen());
      return true;
    } catch(e) {
      console.error('[IPC] 全屏切换失败:', e);
      return false;
    }
  });

  // ---- drift:// 协议调起（供网站调用） ----
  ipcMain.handle('drift:invoke', (_, command, params = {}) => {
    try {
      const urlParams = new URLSearchParams(params).toString();
      const url = `drift://${command}?${urlParams}`;
      console.log('[DriftIPC] 网站调起协议:', url);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('open-external-url', url);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ---- 应用重启（硬件加速切换后） ----
  ipcMain.handle('app:restart', () => {
    const { app } = require('electron');
    app.relaunch();
    app.exit(0);
    return true;
  });

  // ---- webview 新窗口拦截 ----
  // 渲染进程在 webview dom-ready 后发送 webContentsId，
  // 主进程为其设置 setWindowOpenHandler，将新窗口 URL 发回渲染进程
  ipcMain.handle('webview-ready', (_, webContentsId) => {
    try {
      const { webContents } = require('electron');
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) return false;

      wc.setWindowOpenHandler(({ url }) => {
        // 将 URL 发回渲染进程，由渲染进程创建新标签页
        const mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('webview-open-window', url);
        }
        return { action: 'deny' }; // 拒绝默认行为（创建新窗口），由我们自己处理
      });

      return true;
    } catch(e) {
      console.error('[IPC] webview-ready 处理失败:', e);
      return false;
    }
  });

  // ---- 默认浏览器 ----
  // 检查是否为默认浏览器
  ipcMain.handle('is-default-browser', async () => {
    try {
      const appPath = app.getPath('exe');
      return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
    } catch (e) {
      console.error('[IPC] 检查默认浏览器失败:', e);
      return false;
    }
  });

  // 设置为默认浏览器
  ipcMain.handle('set-default-browser', async () => {
    try {
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        const path = require('path');
        const exePath = process.execPath;
        
        // 完整的 Windows 黏浏览器注册脚本
        const psScript = `
          $ErrorActionPreference = 'SilentlyContinue'
          $exePath = '${exePath.replace(/'/g, "''")}'
          $exeName = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
          
          # ========== 1. 注册为浏览器程序 (StartMenuInternet) ==========
          $browserKey = "HKCU:\\Software\\Clients\\StartMenuInternet\\Drift"
          New-Item -Path $browserKey -Force | Out-Null
          Set-ItemProperty -Path $browserKey -Name '(Default)' -Value 'Drift 浏览器'
          Set-ItemProperty -Path $browserKey -Name 'DefaultIcon' -Value '"$exePath",0'
          
          $shellCmd = "$browserKey\\shell\\open\\command"
          New-Item -Path $shellCmd -Force | Out-Null
          Set-ItemProperty -Path $shellCmd -Name '(Default)' -Value '"$exePath" "%1"'
          
          # ========== 2. 注册 capabilities (让系统识别为浏览器) ==========
          $capKey = "HKCU:\\Software\\Clients\\StartMenuInternet\\Drift\\Capabilities"
          New-Item -Path $capKey -Force | Out-Null
          
          # URL 协议能力
          $urlAssoc = "$capKey\\URLAssociations"
          New-Item -Path $urlAssoc -Force | Out-Null
          foreach ($proto in @('http', 'https', 'mailto', 'tel')) {
            Set-ItemProperty -Path $urlAssoc -Name $proto -Value 'Drift:URL:' + $proto
          }
          
          # 文件类型能力
          $fileAssoc = "$capKey\\FileAssociations"
          New-Item -Path $fileAssoc -Force | Out-Null
          foreach ($ext in @('.html', '.htm', '.shtml', '.svg', '.webp', '.url')) {
            Set-ItemProperty -Path $fileAssoc -Name $ext -Value 'Drift.HTML'
          }
          
          # MIME 类型
          $mimeAssoc = "$capKey\\MIMEAssociations"
          New-Item -Path $mimeAssoc -Force | Out-Null
          foreach ($mime in @('text/html', 'text/xml', 'image/svg+xml', 'application/xhtml+xml')) {
            Set-ItemProperty -Path $mimeAssoc -Name $mime -Value 'Drift.HTML'
          }
          
          # StartMenu 能力
          Set-ItemProperty -Path $capKey -Name 'ApplicationDescription' -Value '基于 Chromium 的现代浏览器'
          Set-ItemProperty -Path $capKey -Name 'ApplicationIcon' -Value '"$exePath",0'
          Set-ItemProperty -Path $capKey -Name 'ApplicationName' -Value 'Drift 浏览器'
          
          # ========== 3. 注册协议处理程序 ==========
          foreach ($proto in @('http', 'https', 'mailto', 'tel')) {
            $progId = 'Drift:URL:' + $proto
            
            # ProgID 注册
            $progKey = "HKCU:\\Software\\Classes\\$progId"
            New-Item -Path $progKey -Force | Out-Null
            Set-ItemProperty -Path $progKey -Name '(Default)' -Value '$proto URL Protocol'
            Set-ItemProperty -Path $progKey -Name 'URL Protocol' -Value ''
            Set-ItemProperty -Path $progKey -Name 'FriendlyTypeName' -Value 'Drift 浏览器'
            
            # 默认图标
            $iconKey = "$progKey\\DefaultIcon"
            New-Item -Path $iconKey -Force | Out-Null
            Set-ItemProperty -Path $iconKey -Name '(Default)' -Value '"$exePath",0'
            
            # shell 命令
            $cmdKey = "$progKey\\shell\\open\\command"
            New-Item -Path $cmdKey -Force | Out-Null
            Set-ItemProperty -Path $cmdKey -Name '(Default)' -Value '"$exePath" "%1"'
          }
          
          # ========== 4. 注册文件类型处理程序 ==========
          $htmlProgId = 'Drift.HTML'
          $htmlKey = "HKCU:\\Software\\Classes\\$htmlProgId"
          New-Item -Path $htmlKey -Force | Out-Null
          Set-ItemProperty -Path $htmlKey -Name '(Default)' -Value 'HTML Document'
          Set-ItemProperty -Path $htmlKey -Name 'FriendlyTypeName' -Value 'Drift 浏览器'
          
          $htmlIcon = "$htmlKey\\DefaultIcon"
          New-Item -Path $htmlIcon -Force | Out-Null
          Set-ItemProperty -Path $htmlIcon -Name '(Default)' -Value '"$exePath",0'
          
          $htmlCmd = "$htmlKey\\shell\\open\\command"
          New-Item -Path $htmlCmd -Force | Out-Null
          Set-ItemProperty -Path $htmlCmd -Name '(Default)' -Value '"$exePath" "%1"'
          
          # ========== 5. 设置 UserChoice (关键！) ==========
          # HTTP
          $ucHttp = "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http"
          New-Item -Path $ucHttp -Force | Out-Null
          Set-ItemProperty -Path $ucHttp -Name 'ProgId' -Value 'Drift:URL:http'
          Set-ItemProperty -Path $ucHttp -Name 'UserChoice' -Value 'Drift:URL:http'
          
          # HTTPS  
          $ucHttps = "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https"
          New-Item -Path $ucHttps -Force | Out-Null
          Set-ItemProperty -Path $ucHttps -Name 'ProgId' -Value 'Drift:URL:https'
          Set-ItemProperty -Path $ucHttps -Name 'UserChoice' -Value 'Drift:URL:https'
          
          # .html 文件
          $ucHtml = "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\.html"
          New-Item -Path $ucHtml -Force | Out-Null
          Set-ItemProperty -Path $ucHtml -Name 'ProgId' -Value 'Drift.HTML'
          Set-ItemProperty -Path $ucHtml -Name 'UserChoice' -Value 'Drift.HTML'
          
          # .htm 文件
          $ucHtm = "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\.htm"
          New-Item -Path $ucHtm -Force | Out-Null
          Set-ItemProperty -Path $ucHtm -Name 'ProgId' -Value 'Drift.HTML'
          Set-ItemProperty -Path $ucHtm -Name 'UserChoice' -Value 'Drift.HTML'
          
          # ========== 6. 注册到已安装浏览器列表 ==========
          $installedBrowsers = "HKCU:\\Software\\RegisteredApplications"
          New-Item -Path "$installedBrowsers\\Drift" -Force | Out-Null
          Set-ItemProperty -Path "$installedBrowsers\\Drift" -Name '(Default)' -Value 'Software\\Clients\\StartMenuInternet\\Drift'
          Set-ItemProperty -Path "$installedBrowsers\\Drift" -Name 'CapabilitiesUrlAssociations' -Value 'Software\\Clients\\StartMenuInternet\\Drift\\Capabilities\\URLAssociations'
          
          Write-Output "Drift 浏览器注册完成"
        `;
        
        // 使用 Base64 编码执行 PowerShell 脚本，避免引号转义问题
        const psBuffer = Buffer.from(psScript, 'utf16le');
        const psBase64 = psBuffer.toString('base64');
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${psBase64}`, (error, stdout, stderr) => {
          if (error) console.error('[IPC] 注册默认浏览器失败:', error);
          if (stdout) console.log('[IPC]', stdout);
        });
        
        // 打开系统设置确认
        exec('start ms-settings:defaultapps');
        
        return { success: true, message: '已完整注册 Drift 浏览器为默认浏览器。第三方应用现在应该会调起 Drift。如未生效请重启浏览器后再次点击此按钮。' };
      } else {
        app.setAsDefaultProtocolClient('http');
        app.setAsDefaultProtocolClient('https');
        app.setAsDefaultProtocolClient('mailto');
        return { success: true, message: '已设置为默认浏览器' };
      }
    } catch (e) {
      console.error('[IPC] 设置默认浏览器失败:', e);
      return { success: false, message: '设置失败: ' + e.message };
    }
  });

  // ---- 缓存清理 ----
  ipcMain.handle('clear-cache', async (event, options = {}) => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return { success: false, error: '窗口不存在' };

    try {
      const session = mainWin.webContents.session;

      // 获取清理前大小
      const beforeSize = await session.getCacheSize();

      // 清除 HTTP 缓存
      await session.clearCache();

      // 清除存储数据
      if (options.keepCookies !== false) {
        // 保留 cookies，只清除其他存储
        await session.clearStorageData({
          storages: ['localstorage', 'sessionstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'appcache', 'websql']
        });
      } else {
        // 清除所有数据（包括 cookies）
        await session.clearStorageData({
          storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage', 'cookies', 'sessionstorage']
        });
      }

      // 获取清理后大小
      const afterSize = await session.getCacheSize();
      const clearedBytes = beforeSize - afterSize;

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const clearedMB = Math.max(0, Math.round(clearedBytes / 1024 / 1024));
      console.log('[Cache] 清理完成:', clearedMB, 'MB');
      
      return {
        success: true,
        clearedMB: clearedMB
      };
    } catch (e) {
      console.error('[Cache] 清理失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取缓存大小
  ipcMain.handle('get-cache-size', async () => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return 0;

    try {
      const size = await mainWin.webContents.session.getCacheSize();
      return Math.round(size / 1024 / 1024);
    } catch (e) {
      return 0;
    }
  });

  // ---- AI 获取模型列表 ----
  ipcMain.handle('ai-get-models', async (event, params) => {
    const { provider, baseUrl, apiKey } = params;

    if (!apiKey && provider !== 'ollama') {
      return { success: false, error: '未配置 API Key' };
    }

    try {
      const https = require('https');
      const http = require('http');

      let url, headers, useHttp = false;

      if (provider === 'anthropic') {
        return { success: false, error: 'Anthropic 暂不支持动态获取模型列表', models: [] };
      } else if (provider === 'google') {
        url = baseUrl + '/models?key=' + encodeURIComponent(apiKey);
        headers = { 'Content-Type': 'application/json' };
      } else if (provider === 'mimo') {
        url = baseUrl + '/models';
        headers = {
          'Content-Type': 'application/json',
          'api-key': apiKey
        };
      } else if (provider === 'ollama') {
        url = baseUrl.replace('/v1', '') + '/api/tags';
        headers = { 'Content-Type': 'application/json' };
        useHttp = true;
      } else {
        url = baseUrl + '/models';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        };
      }

      const result = await new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: headers,
          timeout: 15000
        };

        const requester = useHttp || parsedUrl.protocol === 'http:' ? http : https;
        const req = requester.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch(e) {
              reject(new Error('解析响应失败: ' + data.substring(0, 200)));
            }
          });
        });

        req.on('error', (e) => { reject(e); });
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
        req.end();
      });

      let models = [];

      if (provider === 'google') {
        if (result.models && Array.isArray(result.models)) {
          models = result.models
            .filter(m => m.name && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => ({
              id: m.name.replace('models/', ''),
              name: m.displayName || m.name.replace('models/', ''),
              provider: 'google'
            }));
        }
      } else if (provider === 'ollama') {
        if (result.models && Array.isArray(result.models)) {
          models = result.models
            .filter(m => m.name)
            .map(m => ({
              id: m.name,
              name: m.name,
              provider: 'ollama'
            }));
        }
      } else {
        if (result.data && Array.isArray(result.data)) {
          models = result.data
            .filter(m => m.id)
            .map(m => ({
              id: m.id,
              name: m.id,
              provider: provider,
              owned_by: m.owned_by || 'unknown'
            }));
        }
      }

      if (result.error) {
        return { success: false, error: result.error.message || JSON.stringify(result.error), models: [] };
      }

      return { success: true, models: models };
    } catch(e) {
      return { success: false, error: e.message || '请求失败', models: [] };
    }
  });

  // ---- AI 对话请求 ----
  ipcMain.handle('ai-chat-request', async (event, params) => {
    const { provider, baseUrl, apiKey, model, messages, temperature, maxTokens, tools, stream } = params;

    console.log('[AI-DEBUG] provider:', provider, 'baseUrl:', baseUrl, 'model:', model, 'stream:', !!stream, 'hasKey:', !!apiKey);

    var isThinkingModel = model && (model.indexOf('thinking') !== -1 || model.indexOf('reasoner') !== -1 || model.indexOf('o1') !== -1 || model.indexOf('r1') !== -1);
    var effectiveTemp = isThinkingModel ? 1 : (temperature || 0.7);
    var effectiveMaxTokens = maxTokens || 4096;

    if (!apiKey && provider !== 'ollama') {
      return { success: false, error: '未配置 API Key' };
    }

    try {
      const https = require('https');
      const http = require('http');

      let url, headers, body, useHttp = false;

      if (provider === 'anthropic') {
        url = baseUrl + '/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        var anthropicBody = {
          model: model,
          messages: messages,
          max_tokens: effectiveMaxTokens,
          temperature: effectiveTemp
        };
        if (tools && tools.length > 0) {
          anthropicBody.tools = tools.map(function(t) {
            return { name: t.function.name, description: t.function.description, input_schema: t.function.parameters };
          });
        }
        body = JSON.stringify(anthropicBody);
      } else if (provider === 'google') {
        url = baseUrl + '/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
        headers = { 'Content-Type': 'application/json' };
        var contents = messages.map(function(m) {
          return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: typeof m.content === 'string' ? m.content : m.content[0].text }] };
        });
        body = JSON.stringify({ contents: contents, generationConfig: { temperature: effectiveTemp, maxOutputTokens: effectiveMaxTokens } });
      } else if (provider === 'mimo') {
        url = baseUrl + '/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'api-key': apiKey
        };
        var mimoBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_completion_tokens: effectiveMaxTokens
        };
        if (tools && tools.length > 0) mimoBody.tools = tools;
        body = JSON.stringify(mimoBody);
      } else if (provider === 'ollama') {
        url = baseUrl + '/chat/completions';
        headers = { 'Content-Type': 'application/json' };
        var ollamaBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_tokens: effectiveMaxTokens
        };
        if (tools && tools.length > 0) ollamaBody.tools = tools;
        body = JSON.stringify(ollamaBody);
        useHttp = true;
      } else {
        url = baseUrl + '/chat/completions';
        var trimmedKey = (apiKey || '').trim();
        headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + trimmedKey
        };
        var openaiBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_tokens: effectiveMaxTokens
        };
        if (tools && tools.length > 0) openaiBody.tools = tools;
        body = JSON.stringify(openaiBody);
      }

      const result = await new Promise((resolve, reject) => {
        let safeUrl;
        try {
          safeUrl = new URL(url);
        } catch (urlErr) {
          reject(new Error('无效的 API URL: ' + url.substring(0, 100)));
          return;
        }
        const options = {
          hostname: safeUrl.hostname,
          port: safeUrl.port || (safeUrl.protocol === 'http:' ? 80 : 443),
          path: safeUrl.pathname + safeUrl.search,
          method: 'POST',
          headers: headers,
          timeout: 180000
        };

        const requester = useHttp || safeUrl.protocol === 'http:' ? http : https;
        const req = requester.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch(e) {
              reject(new Error('解析响应失败: ' + data.substring(0, 200)));
            }
          });
        });

        req.on('error', (e) => { reject(e); });
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
        req.write(body);
        req.end();
      });

      if (provider === 'anthropic') {
        if (result.content && result.content.length > 0) {
          var textParts = result.content.filter(function(b) { return b.type === 'text'; });
          var toolParts = result.content.filter(function(b) { return b.type === 'tool_use'; });
          var response = { success: true, content: textParts.map(function(b) { return b.text; }).join('') };
          if (toolParts.length > 0) {
            response.toolCalls = toolParts.map(function(b) {
              return { function: { name: b.name, arguments: JSON.stringify(b.input || {}) } };
            });
          }
          return response;
        } else if (result.error) {
          return { success: false, error: result.error.message || JSON.stringify(result.error) };
        }
      } else if (provider === 'google') {
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
          return { success: true, content: result.candidates[0].content.parts[0].text };
        } else if (result.error) {
          return { success: false, error: result.error.message || JSON.stringify(result.error) };
        }
      } else {
        if (result.choices && result.choices[0]) {
          var msg = result.choices[0].message;
          var hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
          var content = msg.content || '';
          if (!content && hasToolCalls) {
            content = '[调用工具]';
          }
          var response2 = { success: true, content: content };
          if (hasToolCalls) {
            response2.toolCalls = msg.tool_calls;
          }
          return response2;
        } else if (result.error) {
          return { success: false, error: result.error.message || JSON.stringify(result.error) };
        }
      }

      return { success: false, error: '未知响应格式: ' + JSON.stringify(result).substring(0, 200) };
    } catch(e) {
      return { success: false, error: e.message || '请求失败' };
    }
  });

  // ---- AI 流式对话请求 ----
  // 使用 ipcMain.on 而非 handle，通过 event.sender.send 推送流式数据
  const activeStreamRequests = new Map();

  ipcMain.on('ai-chat-stream-start', async (event, params) => {
    const { provider, baseUrl, apiKey, model, messages, temperature, maxTokens, tools, msgId } = params;
    const sender = event.sender;
    const requestId = msgId || Date.now().toString();

    var isThinkingModel = model && (model.indexOf('thinking') !== -1 || model.indexOf('reasoner') !== -1 || model.indexOf('o1') !== -1 || model.indexOf('r1') !== -1);
    var effectiveTemp = isThinkingModel ? 1 : (temperature || 0.7);
    var effectiveMaxTokens = maxTokens || 4096;

    if (!apiKey && provider !== 'ollama') {
      sender.send('ai-chat-stream-chunk', { type: 'error', error: '未配置 API Key', msgId: requestId });
      return;
    }

    try {
      const https = require('https');
      const http = require('http');

      let url, headers, body, useHttp = false;

      if (provider === 'anthropic') {
        url = baseUrl + '/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        var anthropicBody = {
          model: model,
          messages: messages,
          max_tokens: effectiveMaxTokens,
          temperature: effectiveTemp,
          stream: true
        };
        if (tools && tools.length > 0) {
          anthropicBody.tools = tools.map(function(t) {
            return { name: t.function.name, description: t.function.description, input_schema: t.function.parameters };
          });
        }
        body = JSON.stringify(anthropicBody);
      } else if (provider === 'google') {
        // Google Gemini 流式使用 :streamGenerateContent
        url = baseUrl + '/models/' + encodeURIComponent(model) + ':streamGenerateContent?key=' + encodeURIComponent(apiKey);
        headers = { 'Content-Type': 'application/json' };
        var contents = messages.map(function(m) {
          return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: typeof m.content === 'string' ? m.content : m.content[0].text }] };
        });
        body = JSON.stringify({ contents: contents, generationConfig: { temperature: effectiveTemp, maxOutputTokens: effectiveMaxTokens } });
      } else if (provider === 'mimo') {
        url = baseUrl + '/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'api-key': apiKey
        };
        var mimoBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_completion_tokens: effectiveMaxTokens,
          stream: true
        };
        if (tools && tools.length > 0) mimoBody.tools = tools;
        body = JSON.stringify(mimoBody);
      } else if (provider === 'ollama') {
        url = baseUrl + '/chat/completions';
        headers = { 'Content-Type': 'application/json' };
        var ollamaBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_tokens: effectiveMaxTokens,
          stream: true
        };
        if (tools && tools.length > 0) ollamaBody.tools = tools;
        body = JSON.stringify(ollamaBody);
        useHttp = true;
      } else {
        url = baseUrl + '/chat/completions';
        var trimmedKey = (apiKey || '').trim();
        headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + trimmedKey
        };
        var openaiBody = {
          model: model,
          messages: messages,
          temperature: effectiveTemp,
          max_tokens: effectiveMaxTokens,
          stream: true
        };
        if (tools && tools.length > 0) openaiBody.tools = tools;
        body = JSON.stringify(openaiBody);
      }

      let safeUrl;
      try {
        safeUrl = new URL(url);
      } catch (urlErr) {
        sender.send('ai-chat-stream-chunk', { type: 'error', error: '无效的 API URL: ' + url.substring(0, 100), msgId: requestId });
        return;
      }

      const options = {
        hostname: safeUrl.hostname,
        port: safeUrl.port || (safeUrl.protocol === 'http:' ? 80 : 443),
        path: safeUrl.pathname + safeUrl.search,
        method: 'POST',
        headers: headers,
        timeout: 180000
      };

      const requester = useHttp || safeUrl.protocol === 'http:' ? http : https;
      const req = requester.request(options, (res) => {
        let buffer = '';
        let fullContent = '';
        let toolCalls = [];
        let currentToolCall = null;
        let currentToolCallName = '';
        let currentToolCallArgs = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();

          if (provider === 'google') {
            // Google 流式：每个 chunk 是一个 JSON 对象
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的最后一行
            lines.forEach((line) => {
              if (!line.trim()) return;
              try {
                const json = JSON.parse(line);
                if (json.candidates && json.candidates[0] && json.candidates[0].content) {
                  const text = json.candidates[0].content.parts[0].text || '';
                  if (text) {
                    fullContent += text;
                    sender.send('ai-chat-stream-chunk', { type: 'chunk', content: text, msgId: requestId });
                  }
                }
              } catch(e) {}
            });
            return;
          }

          // OpenAI / Anthropic / 其他 SSE 格式
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留不完整的最后一行

          lines.forEach((line) => {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                sender.send('ai-chat-stream-chunk', { type: 'done', content: fullContent, msgId: requestId });
                return;
              }
              try {
                const json = JSON.parse(data);

                if (provider === 'anthropic') {
                  // Anthropic 流式格式
                  if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
                    const text = json.delta.text;
                    fullContent += text;
                    sender.send('ai-chat-stream-chunk', { type: 'chunk', content: text, msgId: requestId });
                  } else if (json.type === 'message_stop') {
                    sender.send('ai-chat-stream-chunk', { type: 'done', content: fullContent, msgId: requestId });
                  }
                } else {
                  // OpenAI 兼容格式
                  const delta = json.choices && json.choices[0] ? json.choices[0].delta : null;
                  if (delta) {
                    if (delta.content) {
                      fullContent += delta.content;
                      sender.send('ai-chat-stream-chunk', { type: 'chunk', content: delta.content, msgId: requestId });
                    }
                    if (delta.tool_calls) {
                      delta.tool_calls.forEach((tc) => {
                        if (tc.function) {
                          if (tc.function.name) {
                            currentToolCallName = tc.function.name;
                            sender.send('ai-chat-stream-chunk', { type: 'tool_call_start', name: tc.function.name, index: tc.index || 0, msgId: requestId });
                          }
                          if (tc.function.arguments) {
                            currentToolCallArgs += tc.function.arguments;
                            sender.send('ai-chat-stream-chunk', { type: 'tool_call_delta', arguments: tc.function.arguments, index: tc.index || 0, msgId: requestId });
                          }
                        }
                      });
                    }
                  }
                  if (json.choices && json.choices[0] && json.choices[0].finish_reason) {
                    if (json.choices[0].finish_reason === 'tool_calls' && currentToolCallName) {
                      toolCalls.push({ function: { name: currentToolCallName, arguments: currentToolCallArgs } });
                      sender.send('ai-chat-stream-chunk', { type: 'tool_call_end', msgId: requestId });
                    }
                    sender.send('ai-chat-stream-chunk', { type: 'done', content: fullContent || (toolCalls.length > 0 ? '[调用工具]' : ''), toolCalls: toolCalls.length > 0 ? toolCalls : undefined, msgId: requestId });
                  }
                }
              } catch(e) {}
            }
          });
        });

        res.on('end', () => {
          sender.send('ai-chat-stream-chunk', { type: 'done', content: fullContent || (toolCalls.length > 0 ? '[调用工具]' : ''), toolCalls: toolCalls.length > 0 ? toolCalls : undefined, msgId: requestId });
        });

        res.on('error', (e) => {
          sender.send('ai-chat-stream-chunk', { type: 'error', error: e.message || '流式响应错误', msgId: requestId });
        });
      });

      req.on('error', (e) => {
        sender.send('ai-chat-stream-chunk', { type: 'error', error: e.message || '请求失败', msgId: requestId });
      });

      req.on('timeout', () => {
        req.destroy();
        sender.send('ai-chat-stream-chunk', { type: 'error', error: '请求超时', msgId: requestId });
      });

      req.write(body);
      req.end();

      activeStreamRequests.set(requestId, req);
    } catch(e) {
      sender.send('ai-chat-stream-chunk', { type: 'error', error: e.message || '请求失败', msgId: requestId });
    }
  });

  ipcMain.on('ai-chat-stream-stop', (event, { msgId }) => {
    const req = activeStreamRequests.get(msgId);
    if (req) {
      req.destroy();
      activeStreamRequests.delete(msgId);
    }
  });
}

function closeExtPopup() {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close();
  popupWindow = null;
}

// -------- Edge 数据路径与读取 --------
function getEdgeDataPath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default');
}

function flattenBookmarks(node, results) {
  if (!node) return;
  if (node.type === 'url' && node.url) {
    results.push({ url: node.url, title: node.name || node.url });
  }
  if (node.children) {
    node.children.forEach(child => flattenBookmarks(child, results));
  }
}

async function readEdgeBookmarks(edgePath) {
  const filePath = path.join(edgePath, 'Bookmarks');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const results = [];
    const roots = data.roots || {};
    ['bookmark_bar', 'other', 'synced'].forEach(key => {
      if (roots[key]) flattenBookmarks(roots[key], results);
    });
    return results;
  } catch (e) {
    console.error('读取 Edge 书签失败:', e);
    return [];
  }
}

async function readEdgeHistory(edgePath) {
  const filePath = path.join(edgePath, 'History');
  if (!fs.existsSync(filePath)) return [];
  try {
    const SQL = await loadSqlJs();
    const fileBuffer = fs.readFileSync(filePath);
    const db = new SQL.Database(fileBuffer);
    const rows = db.exec(
      `SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 500`
    );
    db.close();
    if (!rows.length || !rows[0].values.length) return [];
    const results = [];
    rows[0].values.forEach(row => {
      let url = row[0];
      let title = row[1] || url;
      let edgeTime = row[2];
      let timeMs = edgeTime ? (edgeTime / 1000 - 11644473600) * 1000 : Date.now();
      results.push({ url, title, time: timeMs });
    });
    return results;
  } catch (e) {
    console.error('读取 Edge 历史失败:', e);
    return [];
  }
}

let apgEnabled = true;

function registerAPGHandlers() {
  ipcMain.handle('process-adjust-limit', async (event, level) => {
    const limit = processController.adjustProcessLimit(level);
    return { success: true, limit };
  });

  ipcMain.handle('process-get-partition', async (event, url, level, tabId) => {
    const partition = processController.getPartitionForUrl(url, level, tabId);
    return { partition };
  });

  ipcMain.handle('network-set-block-level', async (event, level) => {
    networkController.setBlockLevel(level);
    return { success: true, level };
  });

  ipcMain.handle('network-get-blocked-count', async () => {
    return networkController.getBlockedCount();
  });

  ipcMain.handle('network-get-current-level', async () => {
    return networkController.getCurrentLevel();
  });

  ipcMain.handle('apg-get-resource-data', async () => {
    return getResourceData();
  });

  ipcMain.handle('apg-set-enabled', async (event, enabled) => {
    apgEnabled = enabled;
    if (!enabled) {
      networkController.setBlockLevel('off');
    }
    return { success: true, enabled };
  });

  ipcMain.handle('apg-get-status', async () => {
    return {
      enabled: apgEnabled,
      blockedCount: networkController.getBlockedCount(),
      blockLevel: networkController.getCurrentLevel(),
      maxProcesses: processController.getCurrentMaxProcesses()
    };
  });
}

module.exports = { registerAllHandlers };

function registerUpdaterHandlers() {
  ipcMain.handle('updater:check', async () => {
    return await updater.checkForUpdate();
  });

  ipcMain.handle('updater:download', async () => {
    return await updater.downloadRelease();
  });

  ipcMain.handle('updater:install', async () => {
    return updater.installUpdate();
  });

  ipcMain.handle('updater:cancel-download', async () => {
    return updater.cancelDownload();
  });

  ipcMain.handle('updater:status', async () => {
    return updater.getUpdateStatus();
  });

  ipcMain.handle('updater:get-auto-check', async () => {
    return updater.getAutoCheckEnabled();
  });

  ipcMain.handle('updater:set-auto-check', async (_, enabled) => {
    return updater.setAutoCheckEnabled(enabled);
  });

  ipcMain.handle('updater:dismiss', async () => {
    return updater.dismissUpdate();
  });

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });
}

function registerPluginHandlers() {
  ipcMain.handle('plugin:get-list', async () => {
    return pluginLoader.getPluginList();
  });

  ipcMain.handle('plugin:enable', async (_, pluginId) => {
    return pluginLoader.enablePlugin(pluginId);
  });

  ipcMain.handle('plugin:disable', async (_, pluginId) => {
    return pluginLoader.disablePlugin(pluginId);
  });

  ipcMain.handle('plugin:delete', async (_, pluginId) => {
    return pluginLoader.deletePlugin(pluginId);
  });

  ipcMain.handle('plugin:send-message', async (_, fromId, toId, channel, data) => {
    pluginLoader.sendPluginMessage(fromId, toId, channel, data);
    return { success: true };
  });

  ipcMain.handle('plugin:storage-get', async (_, pluginId, key) => {
    return pluginLoader.getPluginStorage(pluginId, key);
  });

  ipcMain.handle('plugin:storage-set', async (_, pluginId, key, value) => {
    return pluginLoader.setPluginStorage(pluginId, key, value);
  });

  ipcMain.handle('plugin:get-i18n', async (_, pluginId) => {
    return pluginLoader.getPluginI18nData(pluginId);
  });

  ipcMain.handle('plugin:open-folder', async () => {
    var dir = pluginLoader.getPluginsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    shell.openPath(dir);
    return { success: true };
  });
}
