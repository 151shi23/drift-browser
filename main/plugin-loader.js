const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

var pluginsDir = '';
var loadedPlugins = {};
var pluginState = {};
var messageHandlers = {};
var stateFilePath = '';

function getPluginsDir() {
  if (pluginsDir) return pluginsDir;
  var appPath = app.getAppPath();
  var isAsar = appPath.indexOf('.asar') !== -1;
  if (isAsar) {
    pluginsDir = path.join(path.dirname(appPath), 'app.asar.unpacked', 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      var fallback = path.join(path.dirname(appPath), 'plugins');
      if (fs.existsSync(fallback)) {
        pluginsDir = fallback;
      }
    }
  } else {
    pluginsDir = path.join(appPath, 'plugins');
  }
  console.log('[PluginLoader] 插件目录: ' + pluginsDir + ' (exists: ' + fs.existsSync(pluginsDir) + ')');
  return pluginsDir;
}

function getStateFilePath() {
  if (stateFilePath) return stateFilePath;
  var userData = path.join(process.env.APPDATA || '', 'f-browser');
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  stateFilePath = path.join(userData, 'plugins-state.json');
  return stateFilePath;
}

function loadState() {
  try {
    var sf = getStateFilePath();
    if (fs.existsSync(sf)) {
      pluginState = JSON.parse(fs.readFileSync(sf, 'utf-8'));
    }
  } catch (e) {
    console.error('[PluginLoader] 加载插件状态失败:', e.message);
    pluginState = {};
  }
}

function saveState() {
  try {
    var sf = getStateFilePath();
    fs.writeFileSync(sf, JSON.stringify(pluginState, null, 2), 'utf-8');
  } catch (e) {
    console.error('[PluginLoader] 保存插件状态失败:', e.message);
  }
}

function parseVersion(v) {
  var parts = (v || '0.0.0').replace(/^v/i, '').split('.');
  return {
    major: parseInt(parts[0]) || 0,
    minor: parseInt(parts[1]) || 0,
    patch: parseInt(parts[2]) || 0
  };
}

function isVersionCompatible(minVersion, currentVersion) {
  if (!minVersion) return true;
  var min = parseVersion(minVersion);
  var cur = parseVersion(currentVersion);
  if (cur.major !== min.major) return cur.major > min.major;
  if (cur.minor !== min.minor) return cur.minor > min.minor;
  return cur.patch >= min.patch;
}

function validateManifest(manifest, dirName) {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: '清单不是有效的 JSON 对象' };
  }
  if (!manifest.id) {
    return { valid: false, error: '缺少必需字段: id' };
  }
  if (!manifest.name) {
    return { valid: false, error: '缺少必需字段: name' };
  }
  if (!manifest.version) {
    return { valid: false, error: '缺少必需字段: version' };
  }
  if (!manifest.type || !Array.isArray(manifest.type) || manifest.type.length === 0) {
    return { valid: false, error: '缺少必需字段: type (数组)' };
  }
  var validTypes = ['i18n', 'ui', 'feature', 'system'];
  for (var i = 0; i < manifest.type.length; i++) {
    if (validTypes.indexOf(manifest.type[i]) === -1) {
      return { valid: false, error: '无效的插件类型: ' + manifest.type[i] };
    }
  }
  if (manifest.permissions) {
    if (!Array.isArray(manifest.permissions)) {
      return { valid: false, error: 'permissions 必须是数组' };
    }
    var validPerms = ['i18n', 'tabs', 'bookmarks', 'history', 'storage', 'network', 'notifications', 'clipboard', 'shell', 'menu', 'settings', 'theme', 'ui'];
    for (var j = 0; j < manifest.permissions.length; j++) {
      if (validPerms.indexOf(manifest.permissions[j]) === -1) {
        return { valid: false, error: '无效的权限: ' + manifest.permissions[j] };
      }
    }
  }
  return { valid: true };
}

function scanPlugins() {
  var dir = getPluginsDir();
  var results = [];

  if (!fs.existsSync(dir)) {
    console.warn('[PluginLoader] 插件目录不存在: ' + dir + '，正在创建...');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {
      console.error('[PluginLoader] 创建插件目录失败:', e.message);
    }
    return results;
  }

  var entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    console.error('[PluginLoader] 扫描插件目录失败:', e.message);
    return results;
  }

  console.log('[PluginLoader] 扫描到 ' + entries.length + ' 个目录项: ' + entries.join(', '));

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var pluginPath = path.join(dir, entry);

    try {
      if (!fs.statSync(pluginPath).isDirectory()) continue;

      var manifestPath = path.join(pluginPath, 'drift-plugin.json');
      if (!fs.existsSync(manifestPath)) continue;

      var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      var validation = validateManifest(manifest, entry);

      if (!validation.valid) {
        console.error('[PluginLoader] 插件 ' + entry + ' 清单无效:', validation.error);
        continue;
      }

      console.log('[PluginLoader] 发现插件: ' + manifest.id + ' v' + manifest.version + ' (' + manifest.type.join(',') + ')');

      var currentVersion = app.getVersion();
      if (manifest.minVersion && !isVersionCompatible(manifest.minVersion, currentVersion)) {
        console.warn('[PluginLoader] 插件 ' + manifest.id + ' 需要最低版本 ' + manifest.minVersion + '，当前 ' + currentVersion);
        continue;
      }

      var stateEntry = pluginState[manifest.id] || {};
      var isEnabled = stateEntry.enabled !== false;

      var iconPath = null;
      if (manifest.icon) {
        var ip = path.join(pluginPath, manifest.icon);
        if (fs.existsSync(ip)) iconPath = ip;
      }

      var rendererPath = null;
      if (manifest.renderer) {
        var rp = path.join(pluginPath, manifest.renderer);
        if (fs.existsSync(rp)) rendererPath = rp;
      }

      var mainPath = null;
      if (manifest.main) {
        var mp = path.join(pluginPath, manifest.main);
        if (fs.existsSync(mp)) mainPath = mp;
      }

      var i18nDir = null;
      if (manifest.i18n) {
        var idir = path.join(pluginPath, manifest.i18n);
        if (fs.existsSync(idir)) i18nDir = idir;
      }

      var injectPath = null;
      if (manifest.inject) {
        var injp = path.join(pluginPath, manifest.inject);
        if (fs.existsSync(injp)) injectPath = injp;
      }

      results.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        author: manifest.author || '',
        type: manifest.type,
        permissions: manifest.permissions || [],
        dirPath: pluginPath,
        mainPath: mainPath,
        rendererPath: rendererPath,
        i18nDir: i18nDir,
        injectPath: injectPath,
        iconPath: iconPath,
        enabled: isEnabled,
        dependencies: manifest.dependencies || [],
        loaded: false,
        error: null
      });
    } catch (e) {
      console.error('[PluginLoader] 解析插件 ' + entry + ' 失败:', e.message);
    }
  }

  return results;
}

function checkDependencies(plugin) {
  if (!plugin.dependencies || plugin.dependencies.length === 0) return true;
  var missing = [];
  for (var i = 0; i < plugin.dependencies.length; i++) {
    var depId = plugin.dependencies[i];
    if (!loadedPlugins[depId] || !loadedPlugins[depId].enabled) {
      missing.push(depId);
    }
  }
  if (missing.length > 0) {
    console.warn('[PluginLoader] 插件 ' + plugin.id + ' 缺少依赖: ' + missing.join(', '));
  }
  return missing.length === 0;
}

function createMainPluginAPI(plugin) {
  var pluginId = plugin.id;
  var storageDir = path.join(process.env.APPDATA || '', 'f-browser', 'plugin-data', pluginId);
  if (!fs.existsSync(storageDir)) {
    try { fs.mkdirSync(storageDir, { recursive: true }); } catch (e) {}
  }

  return {
    id: pluginId,
    ipc: {
      handle: function(channel, handler) {
        var fullChannel = 'plugin:' + pluginId + ':' + channel;
        ipcMain.handle(fullChannel, function(event, data) {
          return handler(event, data);
        });
      },
      send: function(targetPluginId, channel, data) {
        sendPluginMessage(pluginId, targetPluginId, channel, data);
      },
      on: function(channel, handler) {
        var fullChannel = 'plugin-message:' + pluginId + ':' + channel;
        ipcMain.on(fullChannel, function(event, data) {
          handler(event, data);
        });
      }
    },
    storage: {
      get: function(key) {
        var storageFile = path.join(storageDir, 'data.json');
        try {
          if (fs.existsSync(storageFile)) {
            var data = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
            return data[key] !== undefined ? data[key] : null;
          }
        } catch (e) {}
        return null;
      },
      set: function(key, value) {
        var storageFile = path.join(storageDir, 'data.json');
        var data = {};
        try {
          if (fs.existsSync(storageFile)) {
            data = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
          }
        } catch (e) {}
        data[key] = value;
        try {
          fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
          console.error('[PluginLoader] 插件 ' + pluginId + ' 存储写入失败:', e.message);
        }
      },
      remove: function(key) {
        var storageFile = path.join(storageDir, 'data.json');
        try {
          if (fs.existsSync(storageFile)) {
            var data = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
            delete data[key];
            fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), 'utf-8');
          }
        } catch (e) {}
      }
    },
    app: {
      getVersion: function() { return app.getVersion(); },
      getPath: function(name) { return app.getPath(name); },
      getLocale: function() { return app.getLocale(); }
    }
  };
}

function loadMainPlugin(plugin) {
  if (!plugin.mainPath) return true;

  try {
    var api = createMainPluginAPI(plugin);
    var pluginModule = require(plugin.mainPath);
    if (typeof pluginModule === 'function') {
      pluginModule(api);
    } else if (typeof pluginModule.init === 'function') {
      pluginModule.init(api);
    }
    console.log('[PluginLoader] 主进程插件已加载: ' + plugin.id);
    return true;
  } catch (e) {
    console.error('[PluginLoader] 主进程插件加载失败 ' + plugin.id + ':', e.message);
    plugin.error = e.message;
    return false;
  }
}

function getRendererPluginCode(plugin) {
  if (!plugin.rendererPath) return null;

  try {
    var code = fs.readFileSync(plugin.rendererPath, 'utf-8');

    var i18nData = {};
    if (plugin.i18nDir) {
      var files = fs.readdirSync(plugin.i18nDir);
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.endsWith('.json')) {
          var locale = file.replace('.json', '');
          try {
            i18nData[locale] = JSON.parse(fs.readFileSync(path.join(plugin.i18nDir, file), 'utf-8'));
          } catch (e) {}
        }
      }
    }

    var iconDataUrl = '';
    if (plugin.iconPath) {
      try {
        var iconData = fs.readFileSync(plugin.iconPath);
        var ext = path.extname(plugin.iconPath).replace('.', '');
        iconDataUrl = 'data:image/' + ext + ';base64,' + iconData.toString('base64');
      } catch (e) {}
    }

    var injectCode = '';
    if (plugin.injectPath) {
      try {
        injectCode = fs.readFileSync(plugin.injectPath, 'utf-8');
      } catch (e) {}
    }

    var wrapper = '(function() {'
      + 'var __pluginMeta = ' + JSON.stringify({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          type: plugin.type,
          permissions: plugin.permissions,
          i18n: i18nData,
          icon: iconDataUrl,
          injectCode: injectCode
        }) + ';'
      + 'try {'
      + code
      + '} catch(e) { console.error("[Plugin:' + plugin.id + ']", e); }'
      + '})();';

    return wrapper;
  } catch (e) {
    console.error('[PluginLoader] 读取渲染进程插件代码失败 ' + plugin.id + ':', e.message);
    return null;
  }
}

function injectRendererPlugins() {
  var mainWin = null;
  try {
    var wm = require('./window-manager');
    mainWin = wm.getMainWindow();
  } catch (e) { return; }

  if (!mainWin || mainWin.isDestroyed()) return;

  var pluginIds = Object.keys(loadedPlugins);
  for (var i = 0; i < pluginIds.length; i++) {
    var plugin = loadedPlugins[pluginIds[i]];
    if (!plugin.enabled || !plugin.rendererPath) continue;

    var code = getRendererPluginCode(plugin);
    if (code) {
      try {
        mainWin.webContents.executeJavaScript(code);
        plugin.loaded = true;
        console.log('[PluginLoader] 渲染进程插件已注入: ' + plugin.id);
      } catch (e) {
        console.error('[PluginLoader] 渲染进程插件注入失败 ' + plugin.id + ':', e.message);
        plugin.error = e.message;
      }
    }
  }
}

function sendPluginMessage(fromId, toId, channel, data) {
  var mainWin = null;
  try {
    var wm = require('./window-manager');
    mainWin = wm.getMainWindow();
  } catch (e) { return; }

  if (!mainWin || mainWin.isDestroyed()) return;

  mainWin.webContents.send('plugin-message', {
    from: fromId,
    to: toId,
    channel: channel || 'default',
    data: data
  });
}

function initPluginLoader() {
  loadState();

  var plugins = scanPlugins();

  for (var i = 0; i < plugins.length; i++) {
    var plugin = plugins[i];
    loadedPlugins[plugin.id] = plugin;

    if (!plugin.enabled) {
      console.log('[PluginLoader] 插件已禁用: ' + plugin.id);
      continue;
    }

    checkDependencies(plugin);

    if (plugin.mainPath) {
      loadMainPlugin(plugin);
    }

    plugin.loaded = true;
  }

  console.log('[PluginLoader] 已扫描 ' + plugins.length + ' 个插件，' +
    Object.keys(loadedPlugins).filter(function(id) { return loadedPlugins[id].enabled; }).length + ' 个已启用');
}

function getPluginList() {
  var list = [];
  var ids = Object.keys(loadedPlugins);
  for (var i = 0; i < ids.length; i++) {
    var p = loadedPlugins[ids[i]];
    list.push({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      type: p.type,
      permissions: p.permissions,
      enabled: p.enabled,
      loaded: p.loaded,
      error: p.error,
      hasMain: !!p.mainPath,
      hasRenderer: !!p.rendererPath,
      hasI18n: !!p.i18nDir,
      iconPath: p.iconPath
    });
  }
  return list;
}

function enablePlugin(pluginId) {
  var plugin = loadedPlugins[pluginId];
  if (!plugin) return { success: false, error: '插件不存在' };

  plugin.enabled = true;
  pluginState[pluginId] = pluginState[pluginId] || {};
  pluginState[pluginId].enabled = true;
  saveState();

  if (plugin.mainPath) {
    loadMainPlugin(plugin);
  }

  if (plugin.rendererPath) {
    var code = getRendererPluginCode(plugin);
    if (code) {
      var mainWin = null;
      try {
        var wm = require('./window-manager');
        mainWin = wm.getMainWindow();
      } catch (e) {}

      if (mainWin && !mainWin.isDestroyed()) {
        try {
          mainWin.webContents.executeJavaScript(code);
          plugin.loaded = true;
        } catch (e) {
          plugin.error = e.message;
        }
      }
    }
  }

  return { success: true };
}

function disablePlugin(pluginId) {
  var plugin = loadedPlugins[pluginId];
  if (!plugin) return { success: false, error: '插件不存在' };

  plugin.enabled = false;
  plugin.loaded = false;
  pluginState[pluginId] = pluginState[pluginId] || {};
  pluginState[pluginId].enabled = false;
  saveState();

  var mainWin = null;
  try {
    var wm = require('./window-manager');
    mainWin = wm.getMainWindow();
  } catch (e) {}

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('plugin-disabled', { id: pluginId });
  }

  return { success: true };
}

function deletePlugin(pluginId) {
  var plugin = loadedPlugins[pluginId];
  if (!plugin) return { success: false, error: '插件不存在' };

  try {
    var rimraf = function(dir) {
      if (fs.existsSync(dir)) {
        var entries = fs.readdirSync(dir);
        for (var i = 0; i < entries.length; i++) {
          var curPath = path.join(dir, entries[i]);
          if (fs.statSync(curPath).isDirectory()) {
            rimraf(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        }
        fs.rmdirSync(dir);
      }
    };
    rimraf(plugin.dirPath);
  } catch (e) {
    return { success: false, error: '删除插件文件失败: ' + e.message };
  }

  delete loadedPlugins[pluginId];
  delete pluginState[pluginId];
  saveState();

  return { success: true };
}

function getPluginStorage(pluginId, key) {
  var storageDir = path.join(process.env.APPDATA || '', 'f-browser', 'plugin-data', pluginId);
  var storageFile = path.join(storageDir, 'data.json');
  try {
    if (fs.existsSync(storageFile)) {
      var data = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
      return key ? (data[key] !== undefined ? data[key] : null) : data;
    }
  } catch (e) {}
  return null;
}

function setPluginStorage(pluginId, key, value) {
  var storageDir = path.join(process.env.APPDATA || '', 'f-browser', 'plugin-data', pluginId);
  if (!fs.existsSync(storageDir)) {
    try { fs.mkdirSync(storageDir, { recursive: true }); } catch (e) {}
  }
  var storageFile = path.join(storageDir, 'data.json');
  var data = {};
  try {
    if (fs.existsSync(storageFile)) {
      data = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
    }
  } catch (e) {}
  data[key] = value;
  try {
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getPluginI18nData(pluginId) {
  var plugin = loadedPlugins[pluginId];
  if (!plugin || !plugin.i18nDir) return {};

  var result = {};
  try {
    var files = fs.readdirSync(plugin.i18nDir);
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.endsWith('.json')) {
        var locale = file.replace('.json', '');
        result[locale] = JSON.parse(fs.readFileSync(path.join(plugin.i18nDir, file), 'utf-8'));
      }
    }
  } catch (e) {}
  return result;
}

module.exports = {
  initPluginLoader: initPluginLoader,
  injectRendererPlugins: injectRendererPlugins,
  getPluginList: getPluginList,
  enablePlugin: enablePlugin,
  disablePlugin: disablePlugin,
  deletePlugin: deletePlugin,
  getPluginStorage: getPluginStorage,
  setPluginStorage: setPluginStorage,
  getPluginI18nData: getPluginI18nData,
  sendPluginMessage: sendPluginMessage,
  getPluginsDir: getPluginsDir
};
