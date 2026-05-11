(function() {
  'use strict';

  var pluginPageEl = null;
  var pluginList = [];

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function createPluginPage() {
    if (document.getElementById('pluginManagerPage')) return;

    var page = document.createElement('div');
    page.id = 'pluginManagerPage';
    page.className = 'view';
    page.innerHTML = ''
      + '<div class="pm-header">'
        + '<button class="pm-header-back" id="pmBackBtn"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 4L6 8l4 4"/></svg></button>'
        + '<div class="pm-header-title">插件管理</div>'
        + '<div class="pm-header-actions">'
          + '<div class="pm-locale-wrapper">'
            + '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a10 10 0 014 6 10 10 0 01-4 6 10 10 0 01-4-6 10 10 0 014-6z"/></svg>'
            + '<select class="pm-locale-select" id="pmLocaleSelect"></select>'
          + '</div>'
          + '<button class="pm-btn" id="pmCustomizerBtn"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>个性化</button>'
          + '<button class="pm-btn" id="pmOpenFolderBtn"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 4v9h12V6H8L6 4H2z"/></svg>打开目录</button>'
          + '<button class="pm-btn pm-btn-primary" id="pmRefreshBtn"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M13 8a5 5 0 11-2.5-4.3M13 2v3h-3"/></svg>刷新</button>'
        + '</div>'
      + '</div>'
      + '<div class="pm-content" id="pmContent"></div>';

    var contentArea = document.getElementById('contentArea');
    (contentArea || document.body).appendChild(page);
    pluginPageEl = page;

    document.getElementById('pmBackBtn').addEventListener('click', closePluginPage);
    document.getElementById('pmCustomizerBtn').addEventListener('click', function() {
      if (window.FBrowser.customizer) {
        window.FBrowser.customizer.open();
      } else {
        if (window.FBrowser && window.FBrowser.notify) {
          window.FBrowser.notify.warning('个性化插件未启用，请先启用"个性化浏览器"插件');
        }
      }
    });
    document.getElementById('pmOpenFolderBtn').addEventListener('click', function() {
      if (window.electronAPI && window.electronAPI.pluginOpenFolder) {
        window.electronAPI.pluginOpenFolder();
      }
    });
    document.getElementById('pmRefreshBtn').addEventListener('click', function() {
      loadPluginList();
    });

    updateLocaleSelect();
  }

  function updateLocaleSelect() {
    var select = document.getElementById('pmLocaleSelect');
    if (!select) return;

    var locales = window.DriftI18n ? window.DriftI18n.getAvailableLocales() : ['zh-CN'];
    var current = window.DriftI18n ? window.DriftI18n.getCurrentLocale() : 'zh-CN';

    select.innerHTML = '';
    var localeNames = {
      'zh-CN': '简体中文',
      'en': 'English',
      'zh-TW': '繁體中文',
      'ja': '日本語',
      'ko': '한국어',
      'de': 'Deutsch',
      'fr': 'Français',
      'es': 'Español'
    };

    for (var i = 0; i < locales.length; i++) {
      var opt = document.createElement('option');
      opt.value = locales[i];
      opt.textContent = localeNames[locales[i]] || locales[i];
      if (locales[i] === current) opt.selected = true;
      select.appendChild(opt);
    }

    select.onchange = function() {
      if (window.DriftI18n) {
        window.DriftI18n.setLocale(select.value);
      }
    };
  }

  async function loadPluginList() {
    if (!window.electronAPI || !window.electronAPI.pluginGetList) {
      var content = document.getElementById('pmContent');
      if (content) {
        content.innerHTML = '<div class="pm-empty"><div class="pm-empty-title">插件系统不可用</div><div class="pm-empty-desc">electronAPI.pluginGetList 未定义，请检查 preload.js 是否正确加载。</div></div>';
      }
      return;
    }

    try {
      var result = await window.electronAPI.pluginGetList();
      pluginList = result || [];
      console.log('[PluginManager] 获取到 ' + pluginList.length + ' 个插件');
    } catch (e) {
      console.error('[PluginManager] 获取插件列表失败:', e);
      pluginList = [];
      var content2 = document.getElementById('pmContent');
      if (content2) {
        content2.innerHTML = '<div class="pm-empty"><div class="pm-empty-title">加载失败</div><div class="pm-empty-desc">获取插件列表时出错: ' + escHtml(e.message || String(e)) + '</div></div>';
      }
      return;
    }
    renderPluginList();
  }

  function renderPluginList() {
    var content = document.getElementById('pmContent');
    if (!content) return;

    if (pluginList.length === 0) {
      content.innerHTML = ''
        + '<div class="pm-empty">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>'
          + '<div class="pm-empty-title">暂无插件</div>'
          + '<div class="pm-empty-desc">将插件文件夹放入 plugins 目录，然后点击刷新按钮加载。每个插件需要包含 drift-plugin.json 清单文件。</div>'
        + '</div>';
      return;
    }

    var html = '<div class="pm-list">';
    for (var i = 0; i < pluginList.length; i++) {
      var p = pluginList[i];
      var typeBadges = '';
      for (var j = 0; j < p.type.length; j++) {
        typeBadges += '<span class="pm-badge pm-badge-' + p.type[j] + '">' + escHtml(p.type[j]) + '</span>';
      }

      var iconHtml = '<span>' + escHtml((p.name || '?')[0].toUpperCase()) + '</span>';
      if (p.iconPath) {
        iconHtml = '<span>' + escHtml((p.name || '?')[0].toUpperCase()) + '</span>';
      }

      var errorHtml = '';
      if (p.error) {
        errorHtml = '<div class="pm-card-error">' + escHtml(p.error) + '</div>';
      }

      html += ''
        + '<div class="pm-card" data-plugin-id="' + escHtml(p.id) + '">'
          + '<div class="pm-card-icon">' + iconHtml + '</div>'
          + '<div class="pm-card-info">'
            + '<div class="pm-card-name">'
              + escHtml(p.name)
              + '<span class="pm-card-version">v' + escHtml(p.version) + '</span>'
            + '</div>'
            + '<div class="pm-card-desc">' + escHtml(p.description || '无描述') + '</div>'
            + '<div class="pm-card-meta">' + typeBadges + '</div>'
            + errorHtml
          + '</div>'
          + '<div class="pm-card-actions">'
            + '<label class="pm-toggle">'
              + '<input type="checkbox" class="pm-enable-toggle" data-plugin-id="' + escHtml(p.id) + '"' + (p.enabled ? ' checked' : '') + '>'
              + '<span class="pm-toggle-slider"></span>'
            + '</label>'
            + '<button class="pm-card-delete" data-plugin-id="' + escHtml(p.id) + '" title="删除插件"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.3"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.3"/></svg></button>'
          + '</div>'
        + '</div>';
    }
    html += '</div>';
    content.innerHTML = html;

    var toggles = content.querySelectorAll('.pm-enable-toggle');
    for (var t = 0; t < toggles.length; t++) {
      toggles[t].addEventListener('change', onTogglePlugin);
    }

    var deleteBtns = content.querySelectorAll('.pm-card-delete');
    for (var d = 0; d < deleteBtns.length; d++) {
      deleteBtns[d].addEventListener('click', onDeletePlugin);
    }
  }

  async function onTogglePlugin(e) {
    var pluginId = e.target.getAttribute('data-plugin-id');
    var enabled = e.target.checked;

    if (enabled) {
      if (window.electronAPI && window.electronAPI.pluginEnable) {
        var result = await window.electronAPI.pluginEnable(pluginId);
        if (!result.success) {
          e.target.checked = false;
          if (window.FBrowser && window.FBrowser.notify) {
            window.FBrowser.notify.error('启用插件失败: ' + (result.error || '未知错误'));
          }
        } else {
          if (window.FBrowser && window.FBrowser.notify) {
            window.FBrowser.notify.success('插件已启用: ' + pluginId);
          }
        }
      }
    } else {
      if (window.electronAPI && window.electronAPI.pluginDisable) {
        var result2 = await window.electronAPI.pluginDisable(pluginId);
        if (!result2.success) {
          e.target.checked = true;
          if (window.FBrowser && window.FBrowser.notify) {
            window.FBrowser.notify.error('禁用插件失败: ' + (result2.error || '未知错误'));
          }
        } else {
          if (window.FBrowser && window.FBrowser.notify) {
            window.FBrowser.notify.success('插件已禁用: ' + pluginId);
          }
        }
      }
    }
  }

  async function onDeletePlugin(e) {
    var btn = e.currentTarget;
    var pluginId = btn.getAttribute('data-plugin-id');
    var plugin = null;
    for (var i = 0; i < pluginList.length; i++) {
      if (pluginList[i].id === pluginId) { plugin = pluginList[i]; break; }
    }
    if (!plugin) return;

    if (!confirm('确定要删除插件 "' + plugin.name + '" 吗？此操作不可撤销。')) return;

    if (window.electronAPI && window.electronAPI.pluginDelete) {
      var result = await window.electronAPI.pluginDelete(pluginId);
      if (result.success) {
        if (window.FBrowser && window.FBrowser.notify) {
          window.FBrowser.notify.success('插件已删除: ' + plugin.name);
        }
        loadPluginList();
      } else {
        if (window.FBrowser && window.FBrowser.notify) {
          window.FBrowser.notify.error('删除失败: ' + (result.error || '未知错误'));
        }
      }
    }
  }

  function openPluginPage() {
    createPluginPage();
    pluginPageEl.classList.add('active');
    loadPluginList();
    updateLocaleSelect();
  }

  function closePluginPage() {
    if (pluginPageEl) {
      pluginPageEl.classList.remove('active');
    }
    if (window.FBrowser && window.FBrowser.tabs) {
      var existingTab = window.FBrowser.tabs.tabs.find(function(t) { return t.isPlugins; });
      if (existingTab) {
        window.FBrowser.tabs.closeTab(existingTab.id);
      }
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.pluginManager = {
    open: openPluginPage,
    close: closePluginPage,
    refresh: loadPluginList
  };
})();
