const { app, shell, ipcMain } = require('electron');
const { createWindow, startMemoryMonitor, configureSession, getMainWindow } = require('./main/window-manager');
const { registerAllHandlers } = require('./main/ipc-handlers');
const { autoLoadExtensions, initProxyListener } = require('./main/extensions');
const { initSecurity } = require('./main/security');
const { initDownloads } = require('./main/downloads');
const { createTray, getTray } = require('./main/tray');
const { init: initDocForge } = require('./main/docforge');
const { handleAuthProtocol, registerAuthHandlers } = require('./main/auth-bridge');
const { startMonitor: startResourceMonitor } = require('./main/resource-monitor');
const { initUpdater } = require('./main/updater');
const { initPluginLoader, injectRendererPlugins } = require('./main/plugin-loader');
const { initCloudManager } = require('./main/cloud-manager');

// ==================== 单实例锁 ====================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ==================== 注册为默认浏览器协议 + 自定义协议 ====================
function registerAsBrowser() {
  const exePath = process.execPath;

  try {
    if (process.platform === 'win32') {
      app.setAsDefaultProtocolClient('http', exePath);
      app.setAsDefaultProtocolClient('https', exePath);
      app.setAsDefaultProtocolClient('mailto', exePath);
      app.setAsDefaultProtocolClient('tel', exePath);
    } else {
      app.setAsDefaultProtocolClient('http');
      app.setAsDefaultProtocolClient('https');
      app.setAsDefaultProtocolClient('mailto');
    }
  } catch (e) {
    console.error('[Protocol] 注册默认协议失败:', e.message);
  }

  // 注册 drift:// 自定义协议，让网站可以调起本地 Drift 浏览器
  try {
    const DRIFT_PROTOCOL = 'drift';
    if (process.platform === 'win32') {
      app.setAsDefaultProtocolClient(DRIFT_PROTOCOL, exePath);
    } else {
      app.setAsDefaultProtocolClient(DRIFT_PROTOCOL);
    }
    console.log(`[Protocol] drift:// 协议已注册`);
  } catch (e) {
    console.error('[Protocol] 注册 drift:// 协议失败:', e.message);
  }
}

// ==================== 处理 drift:// 协议调起 ====================
function handleDriftProtocol(url) {
  try {
    const parsed = new URL(url);
    const command = parsed.pathname.replace(/^\//, '') || 'open';
    const params = Object.fromEntries(parsed.searchParams);

    console.log(`[DriftProtocol] 收到协议调起: ${command}`, params);

    const win = getMainWindow();
    if (!win || win.isDestroyed()) return false;

    // 认证协议特殊处理
    if (command.startsWith('auth')) {
      return handleAuthProtocol(url, win);
    }

    switch (command) {
      case 'open':
      case '':
        // drift://open?url=https://example.com&tabId=123
        const openUrl = params.url;
        if (openUrl) {
          win.webContents.send('open-external-url', decodeURIComponent(openUrl));
        } else {
          win.show();
          win.focus();
        }
        break;
      case 'search':
        // drift://search?q=query
        if (params.q) {
          win.webContents.send('open-external-url', 'https://www.google.com/search?q=' + encodeURIComponent(params.q));
        }
        break;
      default:
        // 未知命令，尝试作为 URL 打开
        if (parsed.host) {
          win.webContents.send('open-external-url', url);
        } else {
          win.show();
          win.focus();
        }
    }
    return true;
  } catch (e) {
    console.error('[DriftProtocol] 解析协议失败:', e.message);
    return false;
  }
}

// ==================== 处理外部链接（作为默认浏览器被调起时）====================
let pendingUrl = null;

function handleIncomingUrl(url) {
  pendingUrl = url;

  // drift:// 协议特殊处理
  if (url && url.startsWith('drift://')) {
    return handleDriftProtocol(url);
  }

  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('open-external-url', url);
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleIncomingUrl(url);
});

app.on('second-instance', (event, argv, workingDir) => {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (/^https?:\/\//.test(arg) || /^mailto:/.test(arg) || /^tel:/.test(arg) || /^drift:\/\//.test(arg)) {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        handleIncomingUrl(arg);
      }
      break;
    }
  }
});

// ==================== 内存优化 + GPU 加速启动参数 ====================
// 渲染进程数量（视频站点需要独立进程，不宜过少）
app.commandLine.appendSwitch('max-renderer-processes', '8');

// GPU 硬件加速
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder,MediaFoundationVideoCapture');

// 后台标签节流
app.commandLine.appendSwitch('enable-background-throttling', 'true');

// 内存压力监控
app.commandLine.appendSwitch('enable-memory-pressure-signal', 'true');

// APG 超级优化启动参数
app.commandLine.appendSwitch('enable-low-res-tiling');
app.commandLine.appendSwitch('enable-low-end-device-mode');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-compositor-resources');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,ProcessSharingForCrossOriginIframes');
app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder,MediaFoundationVideoCapture,HeavyAdIntervention');

// 读取配置：硬件加速开关
try {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(process.env.APPDATA || '', 'f-browser', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.hardwareAcceleration === false) {
      app.disableHardwareAcceleration();
      console.log('[GPU] 硬件加速已禁用（用户配置）');
    }
  }
} catch (e) {}

app.whenReady().then(async () => {
  // 0. 注册为浏览器协议（必须在窗口创建前）
  registerAsBrowser();

  // 1. 初始化安全策略
  initSecurity();

  // 2. 初始化下载管理器
  initDownloads();

  // 3. 配置 Session 缓存
  configureSession();

  // 4. 创建窗口
  createWindow();

  // 4.1 初始化云盘管理器
  initCloudManager(getMainWindow());

  // 5. 注册 IPC 处理器
  registerAllHandlers();

  // 5.0 注册认证桥接 IPC
  registerAuthHandlers();

  // 5.1 初始化文档编辑器 (DocForge)
  initDocForge(app.getPath('userData'));

  // 5.2 处理命令行传入的 drift:// 协议 URL
  const argv = process.argv;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i].startsWith('drift://')) {
      handleDriftProtocol(argv[i]);
      break;
    }
  }

  // 6. 自动加载已启用的扩展
  await autoLoadExtensions();

  // 6.1 初始化代理状态监听（VPN扩展支持）
  initProxyListener(getMainWindow());

  // 6.2 初始化插件系统
  initPluginLoader();

  // 6.3 窗口加载完成后注入渲染进程插件
  var mainWin = getMainWindow();
  if (mainWin) {
    mainWin.webContents.on('did-finish-load', function() {
      injectRendererPlugins();
    });
  }

  // 7. 启动内存监控
  startMemoryMonitor();

  // 7.1 启动资源感知器
  startResourceMonitor();

  // 7.2 初始化更新检查
  initUpdater();

  // 8. 创建系统托盘
  createTray();
});

app.on('window-all-closed', () => {
  // 如果托盘存在，保持在托盘中运行
  // 否则退出应用
  const tray = getTray();
  if (!tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (require('electron').BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 处理托盘状态更新
ipcMain.on('update-tray-status', (event, enabled) => {
  const tray = getTray();
  if (enabled) {
    if (!tray) {
      createTray();
    }
  } else {
    if (tray) {
      tray.destroy();
    }
  }
});

// GPU 进程崩溃监控
app.on('gpu-process-crashed', (event, killed) => {
  console.error(`[GPU] GPU 进程崩溃 (killed=${killed})，将自动恢复`);
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error(`[GPU] 渲染进程异常: reason=${details.reason} exitCode=${details.exitCode}`);
});
