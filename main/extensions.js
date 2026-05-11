// ==================== 扩展管理模块 ====================
// 支持加载 Edge / Chrome 扩展（基于 Chromium，API 兼容）

const { session, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let loadedExtensions = {};

let newtabOverride = null;

let proxyState = { active: false, extId: null, extName: null, config: null };

// 扩展存储路径（F 浏览器自己的扩展目录）
function getExtensionsDir() {
  const userData = path.join(process.env.APPDATA || '', 'f-browser');
  const extDir = path.join(userData, 'extensions');
  if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
  return extDir;
}

// 扩展状态持久化文件
function getStateFile() {
  return path.join(getExtensionsDir(), 'extensions-state.json');
}

function loadState() {
  try {
    if (fs.existsSync(getStateFile())) {
      return JSON.parse(fs.readFileSync(getStateFile(), 'utf-8'));
    }
  } catch (e) { console.error('[Extensions] 读取状态失败:', e); }
  return {};
}

function saveState() {
  try {
    const state = {};
    for (const [id, ext] of Object.entries(loadedExtensions)) {
      state[id] = {
        name: ext.name, version: ext.version, path: ext.path,
        enabled: ext.enabled, origin: ext.origin,
        iconPath: ext.iconPath || null,
        popupPath: ext.popupPath || null,
        hasPopup: ext.hasPopup || false,
      };
    }
    fs.writeFileSync(getStateFile(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) { console.error('[Extensions] 保存状态失败:', e); }
}

// ---- 扫描 Edge 扩展目录 ----
function getEdgeExtensionsDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Extensions');
}

function getChromeExtensionsDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Extensions');
}

function getFBrowserExtensionsDir() {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  return path.join(appData, 'f-browser', 'extensions');
}

/**
 * 解析扩展图标路径，返回最佳可用图标的绝对路径
 */
function resolveIconPath(extPath, icons) {
  if (!icons) return null;
  // icons 可能是对象 {"16": "icon16.png", "48": "icon48.png", "128": "icon128.png"}
  // 或字符串 "icon.png"
  if (typeof icons === 'string') {
    const p = path.join(extPath, icons);
    return fs.existsSync(p) ? p : null;
  }
  // 优先选 48px，其次 32，再 128，再 16
  const preferSizes = ['48', '32', '128', '16', '64', '24'];
  for (const size of preferSizes) {
    if (icons[size]) {
      const p = path.join(extPath, icons[size]);
      if (fs.existsSync(p)) return p;
    }
  }
  // 尝试任意 key
  for (const [, relPath] of Object.entries(icons)) {
    if (typeof relPath === 'string') {
      const p = path.join(extPath, relPath);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * 解析扩展 popup 页面路径
 */
function resolvePopupPath(extPath, manifest) {
  // MV3: action.default_popup, MV2: browser_action.default_popup 或 popup
  const popupRel = manifest.action?.default_popup
    || manifest.browser_action?.default_popup
    || manifest.popup
    || null;
  if (!popupRel) return null;
  const p = path.join(extPath, popupRel);
  return fs.existsSync(p) ? p : null;
}

/**
 * 扫描浏览器扩展目录，返回可加载的扩展列表
 * @param {string} browserDir - 浏览器扩展目录路径
 * @returns {Array<{id, name, version, path, browser}>}
 */
function scanExtensionsDir(browserDir, browserName) {
  const results = [];
  if (!fs.existsSync(browserDir)) return results;

  try {
    const extIds = fs.readdirSync(browserDir).filter(id => {
      try { return fs.statSync(path.join(browserDir, id)).isDirectory(); } catch { return false; }
    });

    for (const extId of extIds) {
      const extPath = path.join(browserDir, extId);
      try {
        // 优先检查扁平结构：extId/manifest.json（f-browser 扩展目录格式）
        const flatManifest = path.join(extPath, 'manifest.json');
        if (fs.existsSync(flatManifest)) {
          const manifest = JSON.parse(fs.readFileSync(flatManifest, 'utf-8'));
          if (manifest.theme || manifest.dictionary) continue;

          const icons = manifest.icons || manifest.action?.default_icon || manifest.browser_action?.default_icon || null;
          results.push({
            id: extId,
            name: manifest.name || extId,
            version: manifest.version || '1.0',
            description: manifest.description || '',
            path: extPath,
            browser: browserName,
            manifestVersion: manifest.manifest_version,
            iconPath: resolveIconPath(extPath, icons),
            popupPath: resolvePopupPath(extPath, manifest),
            hasPopup: !!resolvePopupPath(extPath, manifest),
          });
          continue;
        }

        // 版本号子目录结构：extId/版本号/manifest.json（Chrome/Edge 格式）
        const versions = fs.readdirSync(extPath).filter(v => {
          try { return fs.statSync(path.join(extPath, v)).isDirectory(); } catch { return false; }
        });
        const latestVersion = versions.sort().pop();
        if (!latestVersion) continue;

        const versionPath = path.join(extPath, latestVersion);
        const manifestPath = path.join(versionPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.theme || manifest.dictionary) continue;

        const icons = manifest.icons || manifest.action?.default_icon || manifest.browser_action?.default_icon || null;

        results.push({
          id: extId,
          name: manifest.name || extId,
          version: manifest.version || latestVersion,
          description: manifest.description || '',
          path: versionPath,
          browser: browserName,
          manifestVersion: manifest.manifest_version,
          iconPath: resolveIconPath(versionPath, icons),
          popupPath: resolvePopupPath(versionPath, manifest),
          hasPopup: !!resolvePopupPath(versionPath, manifest),
        });
      } catch (e) {
        // 跳过无法解析的扩展
      }
    }
  } catch (e) {
    console.error(`[Extensions] 扫描 ${browserName} 扩展失败:`, e);
  }
  return results;
}

// ---- 加载扩展到 Electron session ----
async function loadExtension(extPath) {
  try {
    const ses = session.defaultSession;
    const ext = await ses.loadExtension(extPath);
    console.log(`[Extensions] 已加载: ${ext.name} v${ext.version}`);

    const manifestPath = path.join(extPath, 'manifest.json');
    let iconPath = null;
    let popupPath = null;
    let hasPopup = false;
    let newtabPath = null;
    let isVpn = false;
    let hasProxyPerm = false;
    
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const icons = manifest.icons || manifest.action?.default_icon || manifest.browser_action?.default_icon || null;
        iconPath = resolveIconPath(extPath, icons);
        popupPath = resolvePopupPath(extPath, manifest);
        hasPopup = !!popupPath;
        
        if (manifest.chrome_url_overrides?.newtab) {
          newtabPath = path.join(extPath, manifest.chrome_url_overrides.newtab);
          console.log(`[Extensions] 扩展 ${ext.name} 请求覆盖新标签页`);
        }

        const permissions = manifest.permissions || [];
        hasProxyPerm = permissions.includes('proxy');
        const hasWebRequest = permissions.includes('webRequest') || permissions.includes('webRequestAuthProvider');
        const nameLower = (manifest.name || '').toLowerCase();
        const descLower = (manifest.description || '').toLowerCase();
        isVpn = hasProxyPerm && (
          nameLower.includes('vpn') || nameLower.includes('proxy') || nameLower.includes('tunnel') ||
          descLower.includes('vpn') || descLower.includes('proxy') || descLower.includes('tunnel')
        );

        if (hasProxyPerm) {
          console.log(`[Extensions] 扩展 ${ext.name} 具有 proxy 权限${isVpn ? ' (VPN扩展)' : ''}`);
        }
      } catch (e) {}
    }

    return { ...ext, iconPath, popupPath, hasPopup, newtabPath, isVpn, hasProxyPerm };
  } catch (e) {
    console.error(`[Extensions] 加载失败 ${extPath}:`, e.message);
    return null;
  }
}

// ---- 卸载扩展 ----
function unloadExtension(extId) {
  try {
    const ext = loadedExtensions[extId];
    session.defaultSession.removeExtension(extId);
    if (ext) {
      ext.enabled = false;
      clearNewtabOverride(extId);
      if (ext.isVpn || ext.hasProxyPerm) {
        if (proxyState.extId === extId) {
          proxyState = { active: false, extId: null, extName: null, config: null };
          session.defaultSession.setProxy({ mode: 'direct' }).catch(() => {});
          console.log(`[Extensions] VPN扩展 ${ext.name} 已卸载，代理已重置为直连`);
        }
      }
    }
    saveState();
    return true;
  } catch (e) {
    console.error(`[Extensions] 卸载失败 ${extId}:`, e);
    return false;
  }
}

// ---- 彻底删除扩展（含本地文件）----
function deleteExtension(extId) {
  const ext = loadedExtensions[extId];
  if (!ext) return { error: '扩展不存在' };
  
  try {
    // 1. 从 session 卸载
    try {
      session.defaultSession.removeExtension(extId);
    } catch (e) {}
    
    // 2. 删除本地文件目录
    if (ext.path && fs.existsSync(ext.path)) {
      fs.rmSync(ext.path, { recursive: true, force: true });
      console.log(`[Extensions] 已删除扩展文件: ${ext.path}`);
    }
    
    // 3. 清除状态
    delete loadedExtensions[extId];
    clearNewtabOverride(extId);
    saveState();
    
    console.log(`[Extensions] 已彻底删除扩展: ${ext.name}`);
    return { success: true, name: ext.name };
  } catch (e) {
    console.error(`[Extensions] 删除扩展失败 ${extId}:`, e);
    return { error: '删除失败: ' + e.message };
  }
}

// ---- 打开扩展目录 ----
function openExtensionFolder(extId) {
  const ext = loadedExtensions[extId];
  if (!ext || !ext.path) {
    console.error(`[Extensions] 扩展不存在或路径无效: ${extId}`);
    return false;
  }
  
  if (!fs.existsSync(ext.path)) {
    console.error(`[Extensions] 扩展目录不存在: ${ext.path}`);
    return false;
  }
  
  shell.openPath(ext.path);
  console.log(`[Extensions] 已打开扩展目录: ${ext.path}`);
  return true;
}

// ---- 启动时自动加载已启用的扩展 ----
async function autoLoadExtensions() {
  const state = loadState();
  for (const [id, extState] of Object.entries(state)) {
    if (!extState.enabled) continue;
    if (!fs.existsSync(extState.path)) continue;
    try {
    const ext = await loadExtension(extState.path);
    if (ext) {
      loadedExtensions[id] = {
        name: ext.name,
        version: ext.version,
        description: ext.description || '',
        path: extState.path,
        enabled: true,
        origin: extState.origin || 'custom',
        iconPath: ext.iconPath || extState.iconPath || null,
        popupPath: ext.popupPath || extState.popupPath || null,
        hasPopup: ext.hasPopup || extState.hasPopup || false,
        isVpn: ext.isVpn || false,
        hasProxyPerm: ext.hasProxyPerm || false,
      };
      if (ext.isVpn) {
        proxyState = { active: true, extId: id, extName: ext.name, config: null };
      }
    }
    } catch (e) {
      console.error(`[Extensions] 自动加载失败 ${id}:`, e);
    }
  }

  // 自动扫描 f-browser 扩展目录
  try {
    const fBrowserDir = getFBrowserExtensionsDir();
    if (fs.existsSync(fBrowserDir)) {
      const scanned = scanExtensionsDir(fBrowserDir, 'F-Browser');
      for (const ext of scanned) {
        if (loadedExtensions[ext.id] && loadedExtensions[ext.id].enabled) continue;
        try {
          const loaded = await loadExtension(ext.path);
          if (loaded) {
            loadedExtensions[loaded.id] = {
              name: loaded.name,
              version: loaded.version,
              description: loaded.description || ext.description,
              path: ext.path,
              enabled: true,
              origin: 'F-Browser',
              iconPath: loaded.iconPath || ext.iconPath || null,
              popupPath: loaded.popupPath || ext.popupPath || null,
              hasPopup: loaded.hasPopup || ext.hasPopup || false,
              newtabPath: loaded.newtabPath || null,
              isVpn: loaded.isVpn || false,
              hasProxyPerm: loaded.hasProxyPerm || false,
            };
            if (loaded.newtabPath) {
              updateNewtabOverride(loaded.id, loaded.newtabPath);
            }
            if (loaded.isVpn) {
              proxyState = { active: true, extId: loaded.id, extName: loaded.name, config: null };
            }
            console.log(`[Extensions] 自动加载 F-Browser 扩展: ${loaded.name}`);
          }
        } catch (e) {
          console.error(`[Extensions] 加载 F-Browser 扩展失败 ${ext.id}:`, e.message);
        }
      }
    }
  } catch (e) {
    console.error('[Extensions] 扫描 F-Browser 扩展目录失败:', e);
  }

  saveState();
  console.log(`[Extensions] 自动加载完成，共 ${Object.keys(loadedExtensions).filter(k => loadedExtensions[k].enabled).length} 个扩展`);
}

// ---- 获取所有扩展状态 ----
function getExtensionsList() {
  return Object.entries(loadedExtensions).map(([id, ext]) => ({
    id,
    name: ext.name,
    version: ext.version,
    description: ext.description,
    enabled: ext.enabled,
    origin: ext.origin || 'custom',
    iconPath: ext.iconPath || null,
    iconDataUrl: ext.iconPath ? imageToDataUrl(ext.iconPath) : null,
    popupPath: ext.popupPath || null,
    hasPopup: ext.hasPopup || false,
    isVpn: ext.isVpn || false,
    hasProxyPerm: ext.hasProxyPerm || false,
  }));
}

// ---- 将图片文件转为 base64 Data URL ----
function imageToDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp' };
    const mime = mimeMap[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

// ---- 从浏览器导入扩展 ----
async function importFromBrowser(browserDir, browserName) {
  const scanned = scanExtensionsDir(browserDir, browserName);
  const results = [];

  for (const ext of scanned) {
    // 检查是否已加载
    if (loadedExtensions[ext.id] && loadedExtensions[ext.id].enabled) {
      results.push({ ...ext, status: 'already_loaded' });
      continue;
    }

    const loaded = await loadExtension(ext.path);
    if (loaded) {
      loadedExtensions[loaded.id] = {
        name: loaded.name,
        version: loaded.version,
        description: loaded.description || ext.description,
        path: ext.path,
        enabled: true,
        origin: browserName,
        iconPath: loaded.iconPath || ext.iconPath || null,
        popupPath: loaded.popupPath || ext.popupPath || null,
        hasPopup: loaded.hasPopup || ext.hasPopup || false,
        newtabPath: loaded.newtabPath || null,
        isVpn: loaded.isVpn || false,
        hasProxyPerm: loaded.hasProxyPerm || false,
      };
      
      if (loaded.newtabPath) {
        updateNewtabOverride(loaded.id, loaded.newtabPath);
      }
      if (loaded.isVpn) {
        proxyState = { active: true, extId: loaded.id, extName: loaded.name, config: null };
      }
      
      results.push({ ...ext, status: 'loaded' });
    } else {
      results.push({ ...ext, status: 'failed' });
    }
  }

  saveState();
  return results;
}

// ---- 从文件夹选择并加载扩展 ----
async function loadFromFolder() {
  const result = await dialog.showOpenDialog({
    title: '选择扩展文件夹',
    properties: ['openDirectory'],
    buttonLabel: '加载扩展',
  });

  if (result.canceled || !result.filePaths.length) return null;

  const extPath = result.filePaths[0];
  const manifestPath = path.join(extPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { error: '所选文件夹中没有 manifest.json，不是有效的扩展' };
  }

  const ext = await loadExtension(extPath);
  if (ext) {
    loadedExtensions[ext.id] = {
      name: ext.name,
      version: ext.version,
      description: ext.description || '',
      path: extPath,
      enabled: true,
      origin: 'custom',
      iconPath: ext.iconPath || null,
      popupPath: ext.popupPath || null,
      hasPopup: ext.hasPopup || false,
      newtabPath: ext.newtabPath || null,
      isVpn: ext.isVpn || false,
      hasProxyPerm: ext.hasProxyPerm || false,
    };
    
    if (ext.newtabPath) {
      updateNewtabOverride(ext.id, ext.newtabPath);
    }
    if (ext.isVpn) {
      proxyState = { active: true, extId: ext.id, extName: ext.name, config: null };
    }
    
    saveState();
    return { id: ext.id, name: ext.name, version: ext.version, status: 'loaded', iconPath: ext.iconPath };
  }
  return { error: '扩展加载失败，可能不兼容' };
}

// ---- 切换扩展启用/禁用 ----
async function toggleExtension(extId) {
  const ext = loadedExtensions[extId];
  if (!ext) return false;

  if (ext.enabled) {
    // 禁用
    unloadExtension(extId);
    ext.enabled = false;
  } else {
    // 重新启用
    if (!fs.existsSync(ext.path)) return false;
    const loaded = await loadExtension(ext.path);
    if (loaded) {
      ext.enabled = true;
      // 如果有新标签页覆盖，设置它
      if (ext.newtabPath) {
        updateNewtabOverride(extId, ext.newtabPath);
      }
    } else {
      return false;
    }
  }
  saveState();
  return true;
}

function getExtensionById(extId) {
  return loadedExtensions[extId] || null;
}

// ---- 新标签页覆盖管理 ----
function updateNewtabOverride(extId, newtabPath) {
  // 如果已有其他扩展覆盖，先清除
  if (newtabOverride && newtabOverride.extId !== extId) {
    console.log(`[Extensions] 新标签页覆盖已从 ${newtabOverride.extId} 切换到 ${extId}`);
  }
  
  newtabOverride = {
    extId,
    newtabUrl: `chrome-extension://${extId}/${path.basename(newtabPath)}`
  };
  console.log(`[Extensions] 新标签页将被扩展 ${extId} 覆盖: ${newtabOverride.newtabUrl}`);
}

function getNewtabOverride() {
  return newtabOverride;
}

function clearNewtabOverride(extId) {
  if (newtabOverride && newtabOverride.extId === extId) {
    newtabOverride = null;
    console.log(`[Extensions] 已清除扩展 ${extId} 的新标签页覆盖`);
    
    for (const [id, ext] of Object.entries(loadedExtensions)) {
      if (ext.enabled && ext.newtabPath && id !== extId) {
        updateNewtabOverride(id, ext.newtabPath);
        break;
      }
    }
  }
}

function getProxyState() {
  return { ...proxyState };
}

function initProxyListener(mainWindow) {
  try {
    const ses = session.defaultSession;

    const checkProxyState = async () => {
      try {
        // 确保窗口存在且未销毁
        if (!mainWindow || mainWindow.isDestroyed()) return;

        const proxyInfo = await ses.resolveProxy('https://www.google.com');
        const isProxy = proxyInfo && proxyInfo !== 'DIRECT';
        if (isProxy && !proxyState.active) {
          const vpnExts = Object.entries(loadedExtensions).filter(([, e]) => e.enabled && (e.isVpn || e.hasProxyPerm));
          if (vpnExts.length > 0) {
            const [extId, ext] = vpnExts[0];
            proxyState = { active: true, extId: extId, extName: ext.name, config: { proxyInfo } };
            console.log(`[Extensions] 检测到代理已激活: ${proxyInfo} (来自 ${ext.name})`);
          } else {
            proxyState = { active: true, extId: null, extName: null, config: { proxyInfo } };
            console.log(`[Extensions] 检测到代理已激活: ${proxyInfo}`);
          }
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
            mainWindow.webContents.send('proxy-state-changed', proxyState);
          }
        } else if (!isProxy && proxyState.active) {
          proxyState = { active: false, extId: null, extName: null, config: null };
          console.log('[Extensions] 代理已断开');
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
            mainWindow.webContents.send('proxy-state-changed', proxyState);
          }
        }
      } catch (e) {}
    };

    setInterval(checkProxyState, 5000);
    setTimeout(checkProxyState, 5000);

    console.log('[Extensions] 代理状态监听已初始化');
  } catch (e) {
    console.error('[Extensions] 代理状态监听初始化失败:', e.message);
  }
}

async function resolveProxy(url) {
  try {
    const proxyInfo = await session.defaultSession.resolveProxy(url || 'https://www.google.com');
    const isDirect = !proxyInfo || proxyInfo === 'DIRECT';
    return { proxyInfo, isDirect, vpnActive: proxyState.active, vpnExtName: proxyState.extName };
  } catch (e) {
    return { proxyInfo: 'DIRECT', isDirect: true, vpnActive: proxyState.active, vpnExtName: proxyState.extName };
  }
}

// ---- 从扩展商店安装 ----
const https = require('https');
const http = require('http');
const zlib = require('zlib');

/**
 * 从 URL 下载文件到 Buffer
 */
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const chunks = [];
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      }
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadToBuffer(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }
      
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('下载超时'));
    });
  });
}

/**
 * 解析 CRX 文件，提取 ZIP 数据
 * 支持 CRX2 和 CRX3 格式
 */
function parseCrx(crxBuffer) {
  // 检查魔数
  const magic = crxBuffer.slice(0, 4).toString('ascii');
  if (magic !== 'Cr24') {
    // 可能是纯 ZIP 文件
    if (crxBuffer[0] === 0x50 && crxBuffer[1] === 0x4B) {
      return crxBuffer;
    }
    throw new Error('无效的 CRX 文件格式');
  }
  
  const version = crxBuffer.readUInt32LE(4);
  let zipStart;
  
  if (version === 3) {
    // CRX3 格式
    const headerLength = crxBuffer.readUInt32LE(8);
    zipStart = 12 + headerLength;
  } else if (version === 2) {
    // CRX2 格式
    const publicKeyLength = crxBuffer.readUInt32LE(8);
    const signatureLength = crxBuffer.readUInt32LE(12);
    zipStart = 16 + publicKeyLength + signatureLength;
  } else {
    throw new Error(`不支持的 CRX 版本: ${version}`);
  }
  
  return crxBuffer.slice(zipStart);
}

/**
 * 解压 ZIP 到目录（使用系统命令，避免额外依赖）
 */
async function unzipToDir(zipBuffer, targetDir) {
  const { execSync } = require('child_process');
  const os = require('os');
  
  // 写入临时 ZIP 文件
  const tempZip = path.join(os.tmpdir(), `ext-${Date.now()}.zip`);
  fs.writeFileSync(tempZip, zipBuffer);
  
  try {
    // Windows 10+ 自带 tar 命令支持解压 zip
    if (process.platform === 'win32') {
      execSync(`tar -xf "${tempZip}" -C "${targetDir}"`, { 
        encoding: 'utf-8',
        windowsHide: true 
      });
    } else {
      // macOS / Linux
      execSync(`unzip -o "${tempZip}" -d "${targetDir}"`, { 
        encoding: 'utf-8' 
      });
    }
  } finally {
    // 清理临时文件
    try { fs.unlinkSync(tempZip); } catch (e) {}
  }
}

/**
 * 从扩展商店安装扩展
 * @param {string} input - 扩展商店 URL 或扩展 ID
 * @param {string} store - 'edge' 或 'chrome'
 */
async function installFromStore(input, store = 'edge') {
  let extId = input;
  
  // 如果是 URL，提取扩展 ID
  if (input.includes('/')) {
    // Edge: https://microsoftedge.microsoft.com/addons/detail/xxx/extensionId
    // Chrome: https://chrome.google.com/webstore/detail/xxx/extensionId
    const match = input.match(/([a-z]{32})/i);
    if (match) {
      extId = match[1];
    } else {
      // 尝试从 URL 路径提取
      const parts = input.split('/');
      extId = parts[parts.length - 1].split('?')[0];
    }
  }
  
  if (!extId || extId.length < 30) {
    return { error: '无效的扩展 ID 或 URL' };
  }
  
  // 构建下载 URL
  let downloadUrl;
  const chromeVersion = '120.0.0.0';
  
  if (store === 'edge') {
    downloadUrl = `https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect&x=id%3D${extId}%26installsource%3Dondemand%26uc%26prodversion%3D${chromeVersion}`;
  } else {
    // Chrome 扩展需要使用第三方下载服务或直接解析
    // 使用可靠的 CRX 下载 API
    downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${chromeVersion}&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
  }
  
  console.log(`[Extensions] 正在下载扩展: ${extId}`);
  
  try {
    // 下载 CRX 文件
    const crxBuffer = await downloadToBuffer(downloadUrl);
    console.log(`[Extensions] 下载完成，大小: ${crxBuffer.length} bytes`);
    
    // 解析 CRX 获取 ZIP 数据
    const zipBuffer = parseCrx(crxBuffer);
    
    // 创建扩展目录
    const extDir = path.join(getExtensionsDir(), extId);
    if (fs.existsSync(extDir)) {
      // 删除旧版本
      fs.rmSync(extDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extDir, { recursive: true });
    
    // 解压
    await unzipToDir(zipBuffer, extDir);
    
    // 验证 manifest.json
    const manifestPath = path.join(extDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      fs.rmSync(extDir, { recursive: true, force: true });
      return { error: '下载的文件不是有效的扩展（缺少 manifest.json）' };
    }
    
    // 加载扩展
    const ext = await loadExtension(extDir);
    if (ext) {
      // 读取 manifest 获取更多信息
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const icons = manifest.icons || manifest.action?.default_icon || manifest.browser_action?.default_icon || null;
      
      loadedExtensions[ext.id] = {
        name: ext.name,
        version: ext.version,
        description: ext.description || '',
        path: extDir,
        enabled: true,
        origin: store === 'edge' ? 'Edge Store' : 'Chrome Store',
        iconPath: resolveIconPath(extDir, icons),
        popupPath: resolvePopupPath(extDir, manifest),
        hasPopup: !!resolvePopupPath(extDir, manifest),
        newtabPath: ext.newtabPath || null,
        isVpn: ext.isVpn || false,
        hasProxyPerm: ext.hasProxyPerm || false,
      };
      
      if (ext.newtabPath) {
        updateNewtabOverride(ext.id, ext.newtabPath);
      }
      if (ext.isVpn) {
        proxyState = { active: true, extId: ext.id, extName: ext.name, config: null };
      }
      
      saveState();
      
      console.log(`[Extensions] 安装成功: ${ext.name} v${ext.version}`);
      return { 
        success: true, 
        id: ext.id, 
        name: ext.name, 
        version: ext.version,
        origin: loadedExtensions[ext.id].origin
      };
    } else {
      fs.rmSync(extDir, { recursive: true, force: true });
      return { error: '扩展加载失败，可能不兼容' };
    }
  } catch (e) {
    console.error(`[Extensions] 安装失败:`, e);
    return { error: '安装失败: ' + e.message };
  }
}

/**
 * 搜索扩展商店（简化版，返回热门扩展）
 */
async function searchStore(query, store = 'edge') {
  // 由于没有官方 API，这里返回一个提示
  // 用户需要手动输入扩展 URL 或 ID
  return {
    message: '请输入扩展商店链接或扩展 ID',
    hint: store === 'edge' 
      ? '例如: https://microsoftedge.microsoft.com/addons/detail/uBlock/odfafepnkmbhccpbejgmiehpchacaeak'
      : '例如: https://chrome.google.com/webstore/detail/uBlock-Origin/cjpalhdlnbpafiamejdnhcphjbkeiagm'
  };
}

module.exports = {
  autoLoadExtensions,
  getExtensionsList,
  getExtensionById,
  importFromBrowser,
  loadFromFolder,
  toggleExtension,
  unloadExtension,
  deleteExtension,
  openExtensionFolder,
  getEdgeExtensionsDir,
  getChromeExtensionsDir,
  getFBrowserExtensionsDir,
  scanExtensionsDir,
  installFromStore,
  searchStore,
  getNewtabOverride,
  getProxyState,
  initProxyListener,
  resolveProxy,
};
