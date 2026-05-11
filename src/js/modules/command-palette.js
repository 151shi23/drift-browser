// ==================== 快捷命令面板模块 ====================
// Ctrl+Shift+P 打开命令面板（类似 VS Code）
(function() {
  'use strict';

  let panelEl = null;
  let inputEl = null;
  let resultListEl = null;
  let selectedIndex = 0;
  let commands = [];

  function getCommands() {
    return [
      // 标签页
      { id: 'new-tab', label: '新建标签页', shortcut: 'Ctrl+T', icon: '➕', action: () => window.FBrowser.tabs.createTab() },
      { id: 'close-tab', label: '关闭当前标签', shortcut: 'Ctrl+W', icon: '❌', action: () => window.FBrowser.tabs.closeTab(window.FBrowser.tabs.activeTabId) },
      { id: 'reopen-closed', label: '恢复关闭的标签', shortcut: 'Ctrl+Shift+T', icon: '🔄', action: () => window.FBrowser.tabEnhancements.reopenLastTab() },
      { id: 'duplicate-tab', label: '复制当前标签', icon: '📋', action: () => window.FBrowser.tabs.duplicateTab(window.FBrowser.tabs.activeTabId) },
      { id: 'next-tab', label: '下一个标签', shortcut: 'Ctrl+Tab', icon: '➡️', action: () => { const t=window.FBrowser.tabs.tabs,i=t.findIndex(x=>x.id===window.FBrowser.tabs.activeTabId);if(t.length>1)window.FBrowser.tabs.switchTab(t[(i+1)%t.length].id); }},
      { id: 'prev-tab', label: '上一个标签', shortcut: 'Ctrl+Shift+Tab', icon: '⬅️', action: () => { const t=window.FBrowser.tabs.tabs,i=t.findIndex(x=>x.id===window.FBrowser.tabs.activeTabId);if(t.length>1)window.FBrowser.tabs.switchTab(t[(i-1+t.length)%t.length].id); }},

      // 导航
      { id: 'go-back', label: '后退', shortcut: 'Alt+←', icon: '⬅', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv)wv.goBack(); }},
      { id: 'go-forward', label: '前进', shortcut: 'Alt+→', icon: '➡', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv)wv.goForward(); }},
      { id: 'reload', label: '刷新', shortcut: 'F5', icon: '🔄', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv)wv.reload(); }},
      { id: 'force-reload', label: '强制刷新', shortcut: 'Ctrl+Shift+R', icon: '🔃', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv)wv.reloadIgnoringCache(); }},
      { id: 'go-home', label: '主页', icon: '🏠', action: () => document.getElementById('btnHome')?.click() },

      // 页面工具
      { id: 'find', label: '页面内查找', shortcut: 'Ctrl+F', icon: '🔍', action: () => window.FBrowser.findBar.open() },
      { id: 'print', label: '打印', shortcut: 'Ctrl+P', icon: '🖨️', action: () => window.electronAPI.printPage() },
      { id: 'save-page', label: '另存为', shortcut: 'Ctrl+S', icon: '💾', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv&&wv.src)wv.downloadURL(wv.src); }},
      { id: 'view-source', label: '查看源代码', shortcut: 'Ctrl+U', icon: '📄', action: () => { const wv=window.FBrowser.tabs.getActiveWebview();if(wv)wv.executeJavaScript('document.documentElement.outerHTML').then(html=>{const b=new Blob([html],{type:'text/html'});window.FBrowser.tabs.createTab(URL.createObjectURL(b));}).catch(()=>{}); }},
      { id: 'fullscreen', label: '全屏', shortcut: 'F11', icon: '⛶', action: () => window.electronAPI.toggleFullscreen() },
      { id: 'devtools', label: '开发者工具', shortcut: 'F12', icon: '🛠', action: () => window.electronAPI.toggleDevTools() },

      // 缩放
      { id: 'zoom-in', label: '放大', shortcut: 'Ctrl++', icon: '🔍+', action: () => window.FBrowser.zoom.zoomIn() },
      { id: 'zoom-out', label: '缩小', shortcut: 'Ctrl+-', icon: '🔍-', action: () => window.FBrowser.zoom.zoomOut() },
      { id: 'zoom-reset', label: '重置缩放', shortcut: 'Ctrl+0', icon: '🔍0', action: () => window.FBrowser.zoom.zoomReset() },

      // 功能
      { id: 'reading-mode', label: '阅读模式', icon: '📖', action: () => window.FBrowser.readingMode.toggle() },
      { id: 'dark-mode-web', label: '网页暗黑模式', icon: '🌙', action: () => window.FBrowser.darkModeWeb.toggle() },
      { id: 'screenshot-visible', label: '截图 - 可见区域', icon: '📸', action: () => window.FBrowser.screenshot.captureVisible() },
      { id: 'screenshot-full', label: '截图 - 整个页面', icon: '📸', action: () => window.FBrowser.screenshot.captureFullPage() },
      { id: 'screenshot-area', label: '截图 - 选区', icon: '✂️', action: () => window.FBrowser.screenshot.captureArea() },
      { id: 'video-pip', label: '视频画中画', icon: '📌', action: () => window.FBrowser.videoPip.activatePiP() },
      { id: 'web-notes', label: '网页标注', icon: '✏️', action: () => window.FBrowser.webNotes.toggle() },
      { id: 'autofill', label: '自动填充', icon: '📝', action: () => { const d=window.FBrowser.autoFill.getData();if(d.profiles.length>0)window.FBrowser.autoFill.fillForm(d.profiles[0]); }},
      { id: 'ad-blocker', label: '广告拦截开关', icon: '🛡', action: () => { window.FBrowser.adBlocker.toggle(); }},
      { id: 'mouse-gestures', label: '鼠标手势开关', icon: '🖱', action: () => { window.FBrowser.mouseGestures.toggle(); }},
      { id: 'clipboard-history', label: '剪贴板历史', icon: '📋', action: () => window.FBrowser.clipboardHistory.togglePanel() },
      { id: 'password-autofill', label: '密码自动填充', icon: '🔑', action: () => { const tab=window.FBrowser.tabs.getActiveTab();if(tab)window.FBrowser.passwordManager.autoFill(tab.url); }},

      // 面板
      { id: 'sidebar', label: '侧边栏', icon: '📱', action: () => window.FBrowser.sidebar.toggleSidePanel() },
      { id: 'bookmarks', label: '书签管理', icon: '⭐', action: () => window.FBrowser.sidebar.openSidePanel('bookmarks') },
      { id: 'history', label: '历史记录', icon: '🕐', action: () => window.FBrowser.sidebar.openSidePanel('history') },
      { id: 'downloads', label: '下载管理', icon: '⬇️', action: () => window.electronAPI.downloadsOpenWindow() },
      { id: 'notifications', label: '通知', icon: '🔔', action: () => window.FBrowser.notificationManager.togglePanel() },
      { id: 'tab-groups', label: '标签分组', icon: '📁', action: () => window.FBrowser.tabGroups.togglePanel() },
      { id: 'rss', label: 'RSS 订阅', icon: '📡', action: () => window.FBrowser.rss.togglePanel() },
      { id: 'side-web', label: '侧边栏网页', icon: '🌐', action: () => window.FBrowser.sideWeb.toggle() },

      // 设置
      { id: 'settings', label: '设置', icon: '⚙️', action: () => window.FBrowser.settings.openSettings() },
      { id: 'bookmark-bar', label: '书签栏开关', icon: '📑', action: () => window.FBrowser.bookmarkBar.toggle() },
      { id: 'new-window', label: '新建窗口', shortcut: 'Ctrl+N', icon: '🪟', action: () => window.electronAPI.openWindow('') },
      { id: 'incognito', label: '无痕模式', icon: '🕵️', action: () => window.electronAPI.openIncognito?.() },
    ];
  }

  function open() {
    commands = getCommands();
    ensurePanel();
    inputEl.value = '';
    selectedIndex = 0;
    renderResults('');
    panelEl.classList.add('visible');
    setTimeout(() => inputEl?.focus(), 50);
  }

  function close() {
    ensurePanel();
    panelEl.classList.remove('visible');
  }

  function toggle() {
    if (panelEl && panelEl.classList.contains('visible')) {
      close();
    } else {
      open();
    }
  }

  function ensurePanel() {
    if (!panelEl) {
      panelEl = document.getElementById('commandPalette');
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'commandPalette';
      panelEl.className = 'command-palette';
      panelEl.innerHTML = `
        <div class="cp-backdrop"></div>
        <div class="cp-dialog">
          <input class="cp-input" type="text" placeholder="输入命令或搜索..." autocomplete="off">
          <div class="cp-results"></div>
        </div>
      `;
      document.body.appendChild(panelEl);

      inputEl = panelEl.querySelector('.cp-input');
      resultListEl = panelEl.querySelector('.cp-results');

      inputEl.addEventListener('input', () => {
        selectedIndex = 0;
        renderResults(inputEl.value.trim());
      });

      inputEl.addEventListener('keydown', e => {
        const items = resultListEl.querySelectorAll('.cp-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          updateSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateSelection(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items[selectedIndex]) items[selectedIndex].click();
        } else if (e.key === 'Escape') {
          close();
        }
      });

      panelEl.querySelector('.cp-backdrop').addEventListener('click', close);
    }
  }

  function renderResults(query) {
    if (!resultListEl) return;
    const q = query.toLowerCase();
    let filtered = commands;
    if (q) {
      filtered = commands.filter(c =>
        c.label.toLowerCase().includes(q) ||
        (c.shortcut || '').toLowerCase().includes(q) ||
        c.id.includes(q)
      );
    }

    resultListEl.innerHTML = filtered.map((c, i) => `
      <div class="cp-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
        <span class="cp-icon">${c.icon}</span>
        <span class="cp-label">${c.label}</span>
        ${c.shortcut ? `<span class="cp-shortcut">${c.shortcut}</span>` : ''}
      </div>
    `).join('');

    resultListEl.querySelectorAll('.cp-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        if (filtered[idx]) {
          close();
          filtered[idx].action();
        }
      });
      item.addEventListener('mouseenter', () => {
        selectedIndex = parseInt(item.dataset.index);
        updateSelection(resultListEl.querySelectorAll('.cp-item'));
      });
    });
  }

  function updateSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.commandPalette = { open, close, toggle };
})();
