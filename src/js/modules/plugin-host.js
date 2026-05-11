(function() {
  'use strict';

  var registeredPlugins = {};
  var currentPluginId = null;
  var messageCallbacks = [];
  var localeChangeCallbacks = [];
  var pageLoadCallbacks = [];

  var VALID_PERMISSIONS = [
    'i18n', 'tabs', 'bookmarks', 'history', 'storage',
    'network', 'notifications', 'clipboard', 'shell',
    'menu', 'settings', 'theme', 'ui'
  ];

  var DriftI18n = {
    _translations: {},
    _currentLocale: 'zh-CN',
    _defaultLocale: 'zh-CN',

    register: function(locale, translations, pluginId) {
      if (!this._translations[locale]) {
        this._translations[locale] = {};
      }
      var keys = Object.keys(translations);
      for (var i = 0; i < keys.length; i++) {
        this._translations[locale][keys[i]] = translations[keys[i]];
      }
    },

    t: function(key, params) {
      var locale = this._currentLocale;
      var text = (this._translations[locale] && this._translations[locale][key]) || null;
      if (text === null) {
        text = (this._translations[this._defaultLocale] && this._translations[this._defaultLocale][key]) || null;
      }
      if (text === null) return key;

      if (params && typeof params === 'object') {
        var paramKeys = Object.keys(params);
        for (var i = 0; i < paramKeys.length; i++) {
          text = text.replace(new RegExp('\\{' + paramKeys[i] + '\\}', 'g'), params[paramKeys[i]]);
        }
      }
      return text;
    },

    getCurrentLocale: function() {
      return this._currentLocale;
    },

    setLocale: function(locale) {
      var oldLocale = this._currentLocale;
      this._currentLocale = locale;
      if (oldLocale !== locale) {
        this._applyDOMTranslations();
        for (var i = 0; i < localeChangeCallbacks.length; i++) {
          try { localeChangeCallbacks[i](locale, oldLocale); } catch (e) {}
        }
      }
    },

    onLocaleChange: function(callback) {
      localeChangeCallbacks.push(callback);
    },

    _settingsI18nMap: {
      '设置': 'Settings',
      '基础': 'Basic',
      '外观': 'Appearance',
      '搜索': 'Search',
      '主页': 'Homepage',
      '数据': 'Data',
      '导入': 'Import',
      '扩展': 'Extensions',
      '隐私与数据': 'Privacy & Data',
      '性能优化': 'Performance',
      '其他': 'Other',
      '系统': 'System',
      '关于': 'About',
      '选择浏览器主题模式': 'Choose browser theme mode',
      '主题': 'Theme',
      '默认搜索引擎': 'Default Search Engine',
      '地址栏和主页搜索使用的引擎': 'Engine used by address bar and homepage',
      '主页风格': 'Homepage Style',
      '主页效果': 'Homepage Effect',
      '选择主页的视觉风格': 'Choose homepage visual style',
      '主页快捷站点': 'Homepage Quick Sites',
      '数据导入': 'Data Import',
      '从 Edge 导入数据': 'Import from Edge',
      '导入 Edge 浏览器的书签和浏览历史记录': 'Import bookmarks and browsing history from Edge',
      '扩展管理': 'Extension Management',
      '从 Edge 导入扩展': 'Import Extensions from Edge',
      '加载 Edge 浏览器已安装的扩展（广告拦截、翻译等）': 'Load installed Edge extensions (ad blocker, translator, etc.)',
      '从 Chrome 导入扩展': 'Import Extensions from Chrome',
      '加载 Chrome 浏览器已安装的扩展': 'Load installed Chrome extensions',
      'F-Browser 扩展': 'F-Browser Extensions',
      '扫描并加载 %AppData%/f-browser/extensions 目录中的扩展': 'Scan and load extensions from %AppData%/f-browser/extensions',
      '从文件夹加载扩展': 'Load Extension from Folder',
      '选择本地解压后的扩展文件夹（需含 manifest.json）': 'Select a local unpacked extension folder (must contain manifest.json)',
      '从商店安装扩展': 'Install Extension from Store',
      '粘贴 Edge/Chrome 扩展商店链接或扩展 ID': 'Paste Edge/Chrome store link or extension ID',
      '下载路径': 'Download Path',
      '文件下载时保存的目录位置': 'Directory where downloaded files are saved',
      '清除浏览数据': 'Clear Browsing Data',
      '清除历史记录、书签和所有本地数据': 'Clear history, bookmarks and all local data',
      '仅清除历史记录': 'Clear History Only',
      '删除所有浏览历史': 'Delete all browsing history',
      '仅清除书签': 'Clear Bookmarks Only',
      '删除所有收藏的书签': 'Delete all saved bookmarks',
      '强力优化模式': 'Power Optimization Mode',
      '一键启用所有性能优化功能': 'Enable all performance optimizations at once',
      '自适应性能调控': 'Adaptive Performance Governance',
      '根据系统资源和使用习惯自动优化': 'Auto-optimize based on system resources and usage',
      '内存优化': 'Memory Optimization',
      '自动冻结后台标签': 'Auto-freeze Background Tabs',
      '后台标签页自动冻结以释放内存': 'Background tabs are auto-frozen to free memory',
      '冻结延迟': 'Freeze Delay',
      '标签页进入后台后多久冻结': 'How long before a background tab is frozen',
      '窗口失焦时冻结': 'Freeze on Window Blur',
      '浏览器失去焦点时冻结所有后台标签': 'Freeze all background tabs when browser loses focus',
      '内存警告阈值': 'Memory Warning Threshold',
      '内存使用超过阈值时自动清理': 'Auto-clean when memory exceeds threshold',
      'CPU 优化': 'CPU Optimization',
      '后台标签节流': 'Background Tab Throttling',
      '降低后台标签的 JavaScript 执行频率': 'Reduce JavaScript execution rate in background tabs',
      '动画帧率限制': 'Animation Frame Rate Limit',
      '后台标签动画限制为 30fps': 'Limit background tab animations to 30fps',
      '定时器节流': 'Timer Throttling',
      '后台标签定时器最小间隔 1 秒': 'Minimum 1-second interval for background tab timers',
      '媒体优化': 'Media Optimization',
      '硬件视频解码': 'Hardware Video Decoding',
      '使用 GPU 加速视频播放': 'Use GPU to accelerate video playback',
      '自动暂停后台视频': 'Auto-pause Background Videos',
      '标签页不可见时自动暂停视频': 'Auto-pause video when tab is not visible',
      '媒体标签页保护': 'Media Tab Protection',
      '播放中的标签页询问后再冻结': 'Ask before freezing tabs that are playing media',
      '缓存管理': 'Cache Management',
      '自动清理缓存': 'Auto-clear Cache',
      '定时清理浏览器缓存释放空间': 'Periodically clear browser cache to free space',
      '缓存大小限制': 'Cache Size Limit',
      '超过限制时自动清理旧缓存': 'Auto-clear old cache when limit is exceeded',
      '清理时保留登录状态': 'Keep Login State on Clear',
      '清理缓存时保留 Cookie 和登录信息': 'Keep cookies and login info when clearing cache',
      '立即清理': 'Clear Now',
      '手动清理所有缓存数据': 'Manually clear all cache data',
      '高级选项': 'Advanced Options',
      '显示优化通知': 'Show Optimization Notifications',
      '优化完成后显示释放的资源量': 'Show released resources after optimization',
      '默认浏览器': 'Default Browser',
      '启动时恢复会话': 'Restore Session on Startup',
      '重新打开上次关闭时的标签页': 'Reopen tabs from last session',
      '硬件加速': 'Hardware Acceleration',
      '使用 GPU 加速渲染（重启后生效）': 'Use GPU for rendering (restart required)',
      '系统托盘': 'System Tray',
      '关闭窗口后保持在系统托盘中运行': 'Keep running in system tray after window is closed',
      '开屏动画': 'Welcome Animation',
      '每次启动时显示欢迎动画': 'Show welcome animation on every startup',
      '重新体验教程': 'Replay Tutorial',
      '重新播放新手引导教程（完成后可跳过）': 'Replay the onboarding tutorial (skippable after completion)',
      'Drift 浏览器': 'Drift Browser',
      '基于 Electron + Chromium 内核构建': 'Built on Electron + Chromium engine',
      '检查更新': 'Check for Updates',
      '点击检查是否有新版本': 'Click to check for new versions',
      '启动时自动检查': 'Auto-check on Startup',
      '每次启动浏览器时自动检查新版本': 'Automatically check for new versions on startup',
      '深色': 'Dark',
      '浅色': 'Light',
      '经典': 'Classic',
      '仪表盘': 'Dashboard',
      '导入': 'Import',
      '扫描并导入': 'Scan & Import',
      '选择文件夹': 'Choose Folder',
      '安装': 'Install',
      '设为默认浏览器': 'Set as Default',
      '清除全部数据': 'Clear All Data',
      '清除': 'Clear',
      '重新体验': 'Replay',
      '清理': 'Clean',
      '添加': 'Add',
      '检查当前状态...': 'Checking status...',
      '版本': 'Version',
      '空闲': 'Idle',
      '内存': 'Memory',
      '标签': 'Tabs',
      '冻结': 'Frozen'
    },

    _applyDOMTranslations: function() {
      var elements = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var key = el.getAttribute('data-i18n');
        var translated = this.t(key);
        if (translated !== key) {
          var tabIdx = el.textContent.indexOf('\t');
          if (tabIdx !== -1) {
            el.textContent = translated + el.textContent.substring(tabIdx);
          } else {
            el.textContent = translated;
          }
        }
      }
      var placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
      for (var j = 0; j < placeholderElements.length; j++) {
        var pel = placeholderElements[j];
        var pkey = pel.getAttribute('data-i18n-placeholder');
        var ptranslated = this.t(pkey);
        if (ptranslated !== pkey) {
          pel.placeholder = ptranslated;
        }
      }
      var titleElements = document.querySelectorAll('[data-i18n-title]');
      for (var k = 0; k < titleElements.length; k++) {
        var tel = titleElements[k];
        var tkey = tel.getAttribute('data-i18n-title');
        var ttranslated = this.t(tkey);
        if (ttranslated !== tkey) {
          tel.title = ttranslated;
        }
      }

      if (this._currentLocale !== this._defaultLocale) {
        var settingsSelectors = ['.settings-row-label', '.settings-row-desc', '.settings-section-title', '.settings-card-title', '.settings-nav-label', '.settings-btn', '.settings-about-name', '.settings-about-desc'];
        for (var s = 0; s < settingsSelectors.length; s++) {
          var settingsElements = document.querySelectorAll(settingsSelectors[s]);
          for (var m = 0; m < settingsElements.length; m++) {
            var sel = settingsElements[m];
            var text = sel.textContent.trim();
            if (this._settingsI18nMap[text]) {
              sel.textContent = this._settingsI18nMap[text];
            }
          }
        }
        var inlineTexts = document.querySelectorAll('#settingsPage span, #settingsPage div');
        for (var it = 0; it < inlineTexts.length; it++) {
          var itEl = inlineTexts[it];
          if (itEl.children.length === 0) {
            var itText = itEl.textContent.trim();
            if (this._settingsI18nMap[itText]) {
              itEl.textContent = this._settingsI18nMap[itText];
            }
          }
        }
      }
    },

    getAvailableLocales: function() {
      var locales = [this._defaultLocale];
      var keys = Object.keys(this._translations);
      for (var i = 0; i < keys.length; i++) {
        if (locales.indexOf(keys[i]) === -1) {
          locales.push(keys[i]);
        }
      }
      return locales;
    }
  };

  function hasPermission(pluginId, permission) {
    var plugin = registeredPlugins[pluginId];
    if (!plugin) return false;
    if (!plugin.permissions) return false;
    return plugin.permissions.indexOf(permission) !== -1;
  }

  function requirePermission(pluginId, permission, apiName) {
    if (!hasPermission(pluginId, permission)) {
      console.warn('[PluginSDK] 插件 ' + pluginId + ' 缺少 ' + permission + ' 权限，无法使用 ' + apiName);
      return false;
    }
    return true;
  }

  function createPluginSDK(pluginId, permissions) {
    var sdk = {
      getPluginId: function() { return pluginId; },

      getPluginInfo: function() {
        var p = registeredPlugins[pluginId];
        return p ? { id: p.id, name: p.name, version: p.version, type: p.type, permissions: p.permissions } : null;
      },

      i18n: {
        register: function(locale, translations) {
          DriftI18n.register(locale, translations, pluginId);
        },
        t: function(key, params) {
          return DriftI18n.t(key, params);
        },
        getCurrentLocale: function() {
          return DriftI18n.getCurrentLocale();
        },
        setLocale: function(locale) {
          DriftI18n.setLocale(locale);
        },
        onLocaleChange: function(callback) {
          DriftI18n.onLocaleChange(callback);
        },
        getAvailableLocales: function() {
          return DriftI18n.getAvailableLocales();
        }
      },

      tabs: {
        create: function(url) {
          if (!requirePermission(pluginId, 'tabs', 'tabs.create')) return null;
          if (window.FBrowser && window.FBrowser.tabs) {
            return window.FBrowser.tabs.createTab(url);
          }
          return null;
        },
        close: function(tabId) {
          if (!requirePermission(pluginId, 'tabs', 'tabs.close')) return;
          if (window.FBrowser && window.FBrowser.tabs) {
            window.FBrowser.tabs.closeTab(tabId);
          }
        },
        list: function() {
          if (!requirePermission(pluginId, 'tabs', 'tabs.list')) return [];
          if (window.FBrowser && window.FBrowser.tabs) {
            return window.FBrowser.tabs.tabs || [];
          }
          return [];
        },
        getActive: function() {
          if (!requirePermission(pluginId, 'tabs', 'tabs.getActive')) return null;
          if (window.FBrowser && window.FBrowser.tabs) {
            return window.FBrowser.tabs.getActiveTab();
          }
          return null;
        },
        onCreated: function(callback) {
          if (!requirePermission(pluginId, 'tabs', 'tabs.onCreated')) return;
        },
        onRemoved: function(callback) {
          if (!requirePermission(pluginId, 'tabs', 'tabs.onRemoved')) return;
        }
      },

      bookmarks: {
        add: function(url, title) {
          if (!requirePermission(pluginId, 'bookmarks', 'bookmarks.add')) return;
          if (window.FBrowser && window.FBrowser.bookmarks) {
            window.FBrowser.bookmarks.addBookmark(url, title);
          }
        },
        remove: function(index) {
          if (!requirePermission(pluginId, 'bookmarks', 'bookmarks.remove')) return;
        },
        list: function() {
          if (!requirePermission(pluginId, 'bookmarks', 'bookmarks.list')) return [];
          if (window.FBrowser && window.FBrowser.data) {
            return window.FBrowser.data.getBookmarks();
          }
          return [];
        }
      },

      storage: {
        get: function(key) {
          if (!requirePermission(pluginId, 'storage', 'storage.get')) return Promise.resolve(null);
          if (window.electronAPI && window.electronAPI.pluginStorageGet) {
            return window.electronAPI.pluginStorageGet(pluginId, key);
          }
          return Promise.resolve(null);
        },
        set: function(key, value) {
          if (!requirePermission(pluginId, 'storage', 'storage.set')) return Promise.resolve({ success: false });
          if (window.electronAPI && window.electronAPI.pluginStorageSet) {
            return window.electronAPI.pluginStorageSet(pluginId, key, value);
          }
          return Promise.resolve({ success: false });
        },
        remove: function(key) {
          if (!requirePermission(pluginId, 'storage', 'storage.remove')) return Promise.resolve({ success: false });
          if (window.electronAPI && window.electronAPI.pluginStorageSet) {
            return window.electronAPI.pluginStorageSet(pluginId, key, null);
          }
          return Promise.resolve({ success: false });
        }
      },

      notifications: {
        info: function(msg) {
          if (!requirePermission(pluginId, 'notifications', 'notifications.info')) return;
          if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify.info(msg);
        },
        success: function(msg) {
          if (!requirePermission(pluginId, 'notifications', 'notifications.success')) return;
          if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify.success(msg);
        },
        warning: function(msg) {
          if (!requirePermission(pluginId, 'notifications', 'notifications.warning')) return;
          if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify.warning(msg);
        },
        error: function(msg) {
          if (!requirePermission(pluginId, 'notifications', 'notifications.error')) return;
          if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify.error(msg);
        }
      },

      messaging: {
        send: function(targetPluginId, data) {
          if (window.electronAPI && window.electronAPI.pluginSendMessage) {
            window.electronAPI.pluginSendMessage(pluginId, targetPluginId, 'default', data);
          }
        },
        onMessage: function(callback) {
          messageCallbacks.push({ pluginId: pluginId, callback: callback });
        },
        broadcast: function(data) {
          if (window.electronAPI && window.electronAPI.pluginSendMessage) {
            window.electronAPI.pluginSendMessage(pluginId, '*', 'broadcast', data);
          }
        }
      },

      ui: {
        registerToolbarButton: function(config) {
          if (!requirePermission(pluginId, 'ui', 'ui.registerToolbarButton')) return;
          if (window.FBrowser && window.FBrowser.pluginHost) {
            window.FBrowser.pluginHost._registerToolbarButton(pluginId, config);
          }
        },
        registerSidePanel: function(config) {
          if (!requirePermission(pluginId, 'ui', 'ui.registerSidePanel')) return;
        },
        registerContextMenu: function(items) {
          if (!requirePermission(pluginId, 'ui', 'ui.registerContextMenu')) return;
        }
      },

      theme: {
        getCurrent: function() {
          return document.body.dataset.theme || 'dark';
        },
        onChange: function(callback) {
          var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              if (mutations[i].attributeName === 'data-theme') {
                try { callback(document.body.dataset.theme); } catch (e) {}
              }
            }
          });
          observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        }
      },

      clipboard: {
        readText: function() {
          if (!requirePermission(pluginId, 'clipboard', 'clipboard.readText')) return Promise.resolve('');
          return navigator.clipboard.readText();
        },
        writeText: function(text) {
          if (!requirePermission(pluginId, 'clipboard', 'clipboard.writeText')) return Promise.resolve();
          return navigator.clipboard.writeText(text);
        }
      },

      shell: {
        openExternal: function(url) {
          if (!requirePermission(pluginId, 'shell', 'shell.openExternal')) return;
          if (window.electronAPI && window.electronAPI.driftInvoke) {
            window.open(url, '_blank');
          }
        }
      },

      webview: {
        onPageLoad: function(callback) {
          if (!requirePermission(pluginId, 'tabs', 'webview.onPageLoad')) return;
          pageLoadCallbacks.push({ pluginId: pluginId, callback: callback });
        },
        injectScript: function(tabId, code) {
          if (!requirePermission(pluginId, 'tabs', 'webview.injectScript')) return;
          if (window.FBrowser && window.FBrowser.tabs) {
            var tabs = window.FBrowser.tabs.tabs || [];
            for (var i = 0; i < tabs.length; i++) {
              if (tabs[i].id === tabId && tabs[i].webview) {
                try { tabs[i].webview.executeJavaScript(code); } catch (e) {}
                break;
              }
            }
          }
        }
      }
    };

    return sdk;
  }

  function registerPlugin(meta) {
    var pluginId = meta.id;
    registeredPlugins[pluginId] = {
      id: pluginId,
      name: meta.name,
      version: meta.version,
      type: meta.type,
      permissions: meta.permissions || [],
      i18n: meta.i18n || {},
      icon: meta.icon || ''
    };

    if (meta.i18n) {
      var locales = Object.keys(meta.i18n);
      for (var i = 0; i < locales.length; i++) {
        DriftI18n.register(locales[i], meta.i18n[locales[i]], pluginId);
      }
    }

    return createPluginSDK(pluginId, meta.permissions || []);
  }

  function init() {
    if (!window.electronAPI) return;

    if (window.electronAPI.onPluginMessage) {
      window.electronAPI.onPluginMessage(function(msg) {
        for (var i = 0; i < messageCallbacks.length; i++) {
          var entry = messageCallbacks[i];
          if (msg.to === entry.pluginId || msg.to === '*') {
            try {
              entry.callback({
                from: msg.from,
                channel: msg.channel,
                data: msg.data
              });
            } catch (e) {
              console.error('[PluginHost] 消息回调错误:', e);
            }
          }
        }
      });
    }

    if (window.electronAPI.onPluginDisabled) {
      window.electronAPI.onPluginDisabled(function(data) {
        var pluginId = data.id;
        if (registeredPlugins[pluginId]) {
          delete registeredPlugins[pluginId];
        }
        messageCallbacks = messageCallbacks.filter(function(entry) {
          return entry.pluginId !== pluginId;
        });
      });
    }
  }

  window.DriftPluginSDK = {
    register: registerPlugin,
    createSDK: createPluginSDK,
    hasPermission: hasPermission
  };

  window.DriftI18n = DriftI18n;

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.pluginHost = {
    init: init,
    registerPlugin: registerPlugin,
    getRegisteredPlugins: function() { return registeredPlugins; },
    _toolbarButtons: [],
    _registerToolbarButton: function(pluginId, config) {
      this._toolbarButtons.push({ pluginId: pluginId, config: config });
    },
    onPageLoad: function(url, webview) {
      for (var i = 0; i < pageLoadCallbacks.length; i++) {
        try {
          pageLoadCallbacks[i].callback(url, webview);
        } catch (e) {
          console.error('[PluginHost] onPageLoad callback error:', e);
        }
      }
    }
  };

  init();
})();
