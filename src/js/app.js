// ==================== Drift 浏览器 - 渲染进程入口 ====================
// 使用 window.FBrowser 全局命名空间 + window.electronAPI 安全 IPC

// ---- DOM 工具函数（全局） ----
window.$ = s => document.querySelector(s);
window.$$ = s => document.querySelectorAll(s);

// ---- 全局错误捕获 ----
window.onerror = (msg, src, line, col, err) => {
  console.error('[Drift]', msg, src, line, col, err);
};
window.addEventListener('unhandledrejection', e => {
  console.error('[Drift] Unhandled Promise:', e.reason);
});

// ---- 窗口控制按钮 ----
const btnMin = $('#btnMinimize');
const btnMax = $('#btnMaximize');
const btnClose = $('#btnClose');
if (btnMin) btnMin.addEventListener('click', () => window.electronAPI.windowMinimize());
if (btnMax) btnMax.addEventListener('click', () => window.electronAPI.windowMaximize());
if (btnClose) btnClose.addEventListener('click', () => window.electronAPI.windowClose());

// ---- 无痕模式检测 ----
const urlParams = new URLSearchParams(window.location.search);
const isIncognito = urlParams.get('incognito') === 'true';
const urlTheme = urlParams.get('theme');
window.isIncognitoMode = isIncognito;

// 应用 URL 参数中的主题（无痕窗口）
if (urlTheme && (urlTheme === 'light' || urlTheme === 'dark')) {
  document.body.dataset.theme = urlTheme;
}

if (isIncognito) {
  // 添加无痕模式标识到标题栏
  const titlebar = document.getElementById('titlebar');
  if (titlebar) {
    titlebar.classList.add('incognito-mode');
    const incognitoBadge = document.createElement('div');
    incognitoBadge.className = 'incognito-badge';
    incognitoBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M8 15c1.5 2 6.5 2 8 0" stroke-linecap="round"/></svg><span>无痕模式</span>';
    titlebar.appendChild(incognitoBadge);
  }
  document.body.classList.add('incognito');
}

// ---- 三条杠菜单（Edge 风格完整版）----
const btnMenu = $('#btnMenu');
const menuDropdown = $('#menuDropdown');

/** 关闭菜单 */
function closeMainMenu() { 
  menuDropdown?.classList.remove('open');
  const submenu = document.getElementById('devToolsSubmenu');
  if (submenu) submenu.style.display = 'none';
}

if (btnMenu && menuDropdown) {
  btnMenu.addEventListener('click', e => {
    e.stopPropagation();
    // 打开前更新缩放百分比
    updateMenuZoomLabel();
    menuDropdown.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-wrapper')) closeMainMenu();
  });
}

/**
 * 绑定菜单项的统一辅助函数
 * @param {string} id - 按钮 ID
 * @param {function} handler - 点击回调
 */
function bindMenu(id, handler) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[Menu] 未找到元素:', id); return; }
  el.addEventListener('click', () => {
    closeMainMenu();
    try { handler(); } catch(err) { console.error('[Menu]', id, err); }
  });
}

// ====== 第一组：标签 / 窗口 ======
bindMenu('menuNewTab',   () => {
  window.FBrowser.tabs.createTab();
  window.FBrowser?.notify?.info('已新建标签页');
});
bindMenu('menuNewWindow', async () => {
  const wv = window.FBrowser.tabs.getActiveWebview();
  const url = wv?.src || '';
  window.FBrowser.tabs.createTab(url || undefined);
  window.FBrowser?.notify?.info('已新建窗口');
});
bindMenu('menuIncognito', () => {
  if (window.electronAPI.openIncognitoWindow) {
    window.electronAPI.openIncognitoWindow();
    window.FBrowser?.notify?.success('已打开无痕窗口');
  } else {
    const tabId = window.FBrowser.tabs.createTab();
    const tab = window.FBrowser.tabs.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isIncognito = true;
      tab.element.classList.add('incognito');
      const faviconEl = tab.element.querySelector('.tab-favicon');
      if (faviconEl) faviconEl.style.filter = 'hue-rotate(90deg)';
      tab.element.querySelector('.tab-title').textContent = '无痕窗口';
    }
    window.FBrowser?.notify?.success('已打开无痕标签页');
  }
});

// ====== 第二组：浏览数据 ======
bindMenu('menuDownloads', () => {
  if (window.electronAPI.downloadsOpenWindow) window.electronAPI.downloadsOpenWindow();
  window.FBrowser?.notify?.info('已打开下载管理');
});
bindMenu('menuHistory', () => {
  try { window.FBrowser.sidebar.openSidePanel?.('history'); }
  catch(e) { window.FBrowser.sidebar.toggleSidePanel(); }
  window.FBrowser?.notify?.info('已打开历史记录');
});
bindMenu('menuBookmarks', () => {
  try { window.FBrowser.sidebar.openSidePanel?.('bookmarks'); }
  catch(e) { window.FBrowser.sidebar.toggleSidePanel(); }
  window.FBrowser?.notify?.info('已打开书签管理');
});

// ====== 第三组：功能入口 ======
bindMenu('menuSidePanel',  () => {
  window.FBrowser.sidebar.toggleSidePanel();
  window.FBrowser?.notify?.info('已切换侧边栏');
});
bindMenu('menuExtensions', async () => {
  try {
    window.FBrowser.settings.openSettings();
    // 滚动到扩展管理区域
    setTimeout(() => {
      const extSection = document.querySelector('#extList')?.closest('.settings-section');
      if (extSection) extSection.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  } catch(e) { console.error('[Menu] Extensions:', e); }
});

// ====== 第四组：页面操作（缩放）=====
const menuZoomLabelEl = $('#menuZoomLabel');
const menuZoomInBtn  = $('#menuZoomInBtn');
const menuZoomOutBtn = $('#menuZoomOutBtn');

function updateMenuZoomLabel() {
  if (!menuZoomLabelEl) return;
  try {
    const level = window.FBrowser.zoom?.getLevel?.() ?? 0;
    const pct = Math.round((1 + level * 0.1) * 100);
    menuZoomLabelEl.textContent = pct + '%';
  } catch(e) { menuZoomLabelEl.textContent = '100%'; }
}

if (menuZoomInBtn) menuZoomInBtn.addEventListener('click', e => {
  e.stopPropagation();
  try { window.FBrowser.zoom.zoomIn?.(); updateMenuZoomLabel(); } catch(er) {}
});
if (menuZoomOutBtn) menuZoomOutBtn.addEventListener('click', e => {
  e.stopPropagation();
  try { window.FBrowser.zoom.zoomOut?.(); updateMenuZoomLabel(); } catch(er) {}
});
// 点击缩放行本身也关闭菜单
const zoomRow = $('#menuZoomRow');
if (zoomRow) zoomRow.addEventListener('click', e => e.stopPropagation());

bindMenu('menuZoomIn',     () => { try { window.FBrowser.zoom.zoomIn?.(); } catch(e) {} });
bindMenu('menuFullscreen', () => {
  if (window.electronAPI.toggleFullscreen) window.electronAPI.toggleFullscreen();
  window.FBrowser?.notify?.info('已切换全屏模式');
});
bindMenu('menuFind',       () => {
  try { window.FBrowser.findBar.toggle(); } catch(e) { console.error('[Menu] findBar', e); }
});
bindMenu('menuPrint',      () => { 
  if (window.electronAPI.printPage) window.electronAPI.printPage();
  window.FBrowser?.notify?.info('正在准备打印...');
});

// ====== 第五组：更多工具（二级菜单） ======
const menuDevToolsBtn = document.getElementById('menuDevToolsBtn');
const devToolsSubmenu = document.getElementById('devToolsSubmenu');

function showSubmenu() {
  if (!menuDevToolsBtn || !devToolsSubmenu) return;
  const btnRect = menuDevToolsBtn.getBoundingClientRect();
  const submenuWidth = 220; // 子菜单宽度
  
  // 判断右侧是否有足够空间
  const rightSpace = window.innerWidth - btnRect.right;
  let left, top;
  
  if (rightSpace >= submenuWidth + 10) {
    // 右侧有空间，显示在右侧
    left = btnRect.right + 4;
  } else {
    // 右侧空间不足，显示在左侧
    left = btnRect.left - submenuWidth - 4;
  }
  top = btnRect.top;
  
  devToolsSubmenu.style.left = left + 'px';
  devToolsSubmenu.style.top = top + 'px';
  devToolsSubmenu.style.display = 'block';
}

function hideSubmenu() {
  if (!devToolsSubmenu) return;
  devToolsSubmenu.style.display = 'none';
}

if (menuDevToolsBtn && devToolsSubmenu) {
  menuDevToolsBtn.addEventListener('mouseenter', showSubmenu);
  menuDevToolsBtn.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!devToolsSubmenu.matches(':hover')) hideSubmenu();
    }, 100);
  });
  devToolsSubmenu.addEventListener('mouseenter', showSubmenu);
  devToolsSubmenu.addEventListener('mouseleave', hideSubmenu);
}

bindMenu('menuTaskManager', () => {
  window.FBrowser.tabs.createTab('f://task-manager');
  window.FBrowser?.notify?.info('已打开任务管理器');
});
bindMenu('menuCastMedia', () => openCastPanel());
bindMenu('menuPerformance', () => {
  window.FBrowser.tabs.createTab('f://performance');
  window.FBrowser?.notify?.info('已打开性能监视器');
});
bindMenu('menuMiniWindow', () => {
  const wv = window.FBrowser.tabs.getActiveWebview();
  const url = wv?.getURL?.() || wv?.src || '';
  if (url && url !== 'about:blank') {
    window.electronAPI.openMiniWindow(url);
    window.FBrowser?.notify?.success('已打开小窗模式');
  } else {
    window.FBrowser?.notify?.warning('当前标签页没有可显示的内容');
  }
});
bindMenu('menuDevToolsPanel', () => {
  window.electronAPI.toggleDevTools?.();
  window.FBrowser?.notify?.info('已打开开发者工具');
});

// ====== 投屏面板 ======
const castPanel = document.getElementById('castPanel');
const closeCast = document.getElementById('closeCast');
const castSearching = document.getElementById('castSearching');
const castDevices = document.getElementById('castDevices');

if (closeCast) {
  closeCast.addEventListener('click', () => {
    castPanel.classList.remove('visible');
  });
}

function openCastPanel() {
  if (!castPanel) return;
  castPanel.classList.add('visible');
  if (castSearching) castSearching.style.display = 'flex';
  if (castDevices) castDevices.innerHTML = '';
  
  // 模拟搜索设备
  setTimeout(() => {
    if (castSearching) castSearching.style.display = 'none';
    if (!castDevices) return;
    
    // 模拟找到的设备
    const devices = [
      { name: '客厅电视', type: 'Chromecast' },
      { name: '卧室投影仪', type: 'Miracast' },
      { name: '会议室显示器', type: 'DLNA' }
    ];
    
    devices.forEach(device => {
      const el = document.createElement('div');
      el.className = 'cast-device';
      el.innerHTML = `
        <div class="cast-device-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <div class="cast-device-info">
          <div class="cast-device-name">${window.FBrowser?.data?.escHtml?.(device.name) || device.name}</div>
          <div class="cast-device-type">${device.type}</div>
        </div>
      `;
      el.addEventListener('click', () => {
        window.FBrowser?.notify?.info('正在连接到 ' + device.name + '...');
        if (castPanel) castPanel.classList.remove('visible');
      });
      castDevices.appendChild(el);
    });
  }, 1500);
}

// ====== 第六组：系统 ======
bindMenu('menuSettings', () => window.FBrowser.settings.openSettings());
bindMenu('menuPlugins', () => {
  window.FBrowser.tabs.createTab('f://plugins');
});
bindMenu('menuCustomizer', () => {
  if (window.FBrowser.customizer) {
    window.FBrowser.customizer.open();
  } else {
    window.FBrowser?.notify?.warning('个性化插件未启用，请在插件管理中启用');
  }
});
bindMenu('menuHelp', () => {
  window.FBrowser?.notify?.info('Drift 浏览器 v2.0 - 基于 Electron 构建');
});
bindMenu('menuExit', () => {
  if (window.electronAPI.windowClose) window.electronAPI.windowClose();
});

// ---- 垂直标签栏切换 ----
bindMenu('menuToggleTabBar', () => {
  const isVertical = document.body.classList.toggle('vertical-tabs');
  localStorage.setItem('f-vertical-tabs', isVertical);
  window.FBrowser?.notify?.success(isVertical ? '已切换到垂直标签栏' : '已切换到默认标签栏');
});

// 初始化垂直标签栏状态
if (localStorage.getItem('f-vertical-tabs') === 'true') {
  document.body.classList.add('vertical-tabs');
}

// ---- 分屏浏览 ----
bindMenu('menuSplitScreen', () => {
  if (window.FBrowser && window.FBrowser.splitScreen) {
    window.FBrowser.splitScreen.toggle();
  }
});

// ---- AI 对话 ----
bindMenu('menuAIChat', () => {
  if (window.FBrowser && window.FBrowser.aiChat) {
    window.FBrowser.aiChat.open();
  }
});

// ---- 文档编辑器 (DocForge) ----
bindMenu('menuDocforge', () => {
  if (window.FBrowser && window.FBrowser.tabs && window.FBrowser.docforge) {
    var existingTab = (window.FBrowser.tabs.tabs || []).find(function(t) { return t.isDocforge; });
    if (existingTab) {
      if (window.FBrowser.tabs.switchTab) window.FBrowser.tabs.switchTab(existingTab.id);
    } else {
      if (window.FBrowser.tabs.createTab) window.FBrowser.tabs.createTab('f://docforge');
    }
  }
});

// ---- 书签栏切换 ----
bindMenu('menuToggleBookmarkBar', () => {
  const bookmarkBar = document.getElementById('bookmarkBar');
  if (!bookmarkBar) return;
  
  const isVisible = bookmarkBar.classList.toggle('visible');
  localStorage.setItem('f-bookmark-bar', isVisible);
  window.FBrowser?.notify?.success(isVisible ? '已显示书签栏' : '已隐藏书签栏');
});

// 初始化书签栏状态
function initBookmarkBar() {
  const bookmarkBar = document.getElementById('bookmarkBar');
  const bookmarkBarContent = document.getElementById('bookmarkBarContent');
  if (!bookmarkBar || !bookmarkBarContent) return;

  // 恢复显示状态
  if (localStorage.getItem('f-bookmark-bar') === 'true') {
    bookmarkBar.classList.add('visible');
  }

  // 渲染书签
  renderBookmarkBar();

  // 监听书签变化
  if (window.FBrowser?.data?.onBookmarksChange) {
    window.FBrowser.data.onBookmarksChange(renderBookmarkBar);
  }
}

function renderBookmarkBar() {
  const bookmarkBarContent = document.getElementById('bookmarkBarContent');
  if (!bookmarkBarContent) return;

  const bookmarks = window.FBrowser?.data?.getBookmarks?.() || [];
  bookmarkBarContent.innerHTML = '';

  // 只显示前15个书签
  const displayBookmarks = bookmarks.slice(0, 15);

  displayBookmarks.forEach(bookmark => {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    const img = document.createElement('img');
    img.src = bookmark.favicon || '';
    img.alt = '';
    img.onerror = function() { this.style.display = 'none'; };
    const span = document.createElement('span');
    span.textContent = bookmark.title || bookmark.url;
    item.appendChild(img);
    item.appendChild(span);
    item.addEventListener('click', () => {
      if (bookmark.url) {
        window.FBrowser.tabs.createTab(bookmark.url);
      }
    });
    bookmarkBarContent.appendChild(item);
  });

  if (bookmarks.length === 0) {
    const emptySpan = document.createElement('span');
    emptySpan.style.cssText = 'color:var(--fg-2);font-size:12px;padding:4px 8px;';
    emptySpan.textContent = '暂无书签，按 Ctrl+D 添加';
    bookmarkBarContent.appendChild(emptySpan);
  }
}

// 延迟初始化书签栏
setTimeout(initBookmarkBar, 500);

// ---- webview 新窗口拦截（主进程回传 URL，在当前窗口创建标签页）----
if (window.electronAPI.onWebviewOpenWindow) {
  window.electronAPI.onWebviewOpenWindow((url) => {
    if (url) window.FBrowser.tabs.createTab(url);
  });
}

// ---- 外部链接打开（作为默认浏览器被调起时）----
if (window.electronAPI.onOpenExternalUrl) {
  window.electronAPI.onOpenExternalUrl((url) => {
    if (!url) return;
    // drift:// 协议由主进程已处理，不重复创建标签页
    if (url.startsWith('drift://')) return;
    window.FBrowser.tabs.createTab(url);
  });
}

// ---- 认证登录就绪（drift://auth 协议调起后）----
if (window.electronAPI.onAuthLoginReady) {
  window.electronAPI.onAuthLoginReady((data) => {
    if (!data || !data.url) return;
    console.log('[AuthBridge] 登录就绪，打开:', data.url);
    window.FBrowser.tabs.createTab(data.url);
  });
}

// ---- 小窗模式监听 ----
if (window.electronAPI.onMiniWindowClosed) {
  window.electronAPI.onMiniWindowClosed(() => {
    console.log('[Drift] 小窗已关闭');
  });
}
if (window.electronAPI.onOpenUrlInMini) {
  window.electronAPI.onOpenUrlInMini((url) => {
    // 从小窗点击的新链接在主窗口打开
    window.FBrowser.tabs.createTab(url);
  });
}

// ---- 右键菜单 IPC 回调（Edge 风格完整支持） ----
if (window.electronAPI.onContextMenuAction) {
  window.electronAPI.onContextMenuAction((msg) => {
    const act = msg?.action ?? msg;
    const dat = msg?.data ?? undefined;
    const extra = msg?.extra ?? undefined;
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    switch (act) {
      // ===== 导航操作 =====
      case 'go-back': wv.goBack(); break;
      case 'go-forward': wv.goForward(); break;
      case 'reload': wv.reload(); break;
      case 'force-reload': wv.reloadIgnoringCache(); break;

      // ===== 编辑操作（webview 内置）=====
      case 'copy': wv.copy(); break;
      case 'cut': wv.cut(); break;
      case 'paste': wv.paste(); break;
      case 'select-all': wv.selectAll(); break;
      case 'undo': wv.undo(); break;
      case 'redo': wv.redo(); break;
      // 粘贴纯文本：先粘贴到隐藏区域再以 text 方式插入
      case 'paste-plain':
        navigator.clipboard.readText().then(text => {
          if (text) wv.insertText(text);
        }).catch(() => wv.paste());
        break;

      // ===== 搜索选中文本（支持自定义搜索引擎）=====
      case 'search-text':
        const searchUrl = extra
          ? (extra + encodeURIComponent(dat))
          : dat;  // 无 extra 时用默认引擎（navigation 模块处理）
        if (searchUrl) window.FBrowser.navigation.navigateTo(searchUrl);
        break;

      // ===== 链接操作 =====
      case 'open-link':
        if (dat) window.FBrowser.tabs.createTab(dat);
        break;
      case 'open-link-new-window':
        // 在当前窗口新建标签页而不是独立窗口
        if (dat) window.FBrowser.tabs.createTab(dat);
        break;
      case 'save-link-as':
        if (dat) { wv.downloadURL(dat); }
        break;
      case 'bookmark-link':
        if (dat?.url) {
          try { window.FBrowser.bookmarks.addBookmark(dat.url, dat.title || ''); } catch(e) {}
        }
        break;

      // ===== 图片操作 =====
      case 'save-image':
        if (dat) { wv.downloadURL(dat); }
        break;
      case 'copy-image':
        // 复制图片到剪贴板（通过 fetch 转为 blob）
        fetch(dat).then(r => r.blob()).then(blob => {
          navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]).catch(() => {});
        }).catch(() => {});
        break;
      case 'open-image-new-window':
        if (dat) window.FBrowser.tabs.createTab(dat);
        break;

      // ===== 媒体操作（视频/音频）=====
      case 'media-mute':
        wv.executeJavaScript(`
          const el = document.querySelector('video,audio');
          if (el) { el.muted = !el.muted; }
        `).catch(()=>{});
        break;
      case 'media-show-controls':
        wv.executeJavaScript(`
          const el = document.querySelector('video,audio');
          if (el) { el.controls = true; }
        `).catch(()=>{});
        break;
      case 'media-fullscreen':
        wv.executeJavaScript(`
          const v = document.querySelector('video'); if(v) v.requestFullscreen?.();
        `).catch(()=>{});
        break;
      case 'media-pip':
        wv.executeJavaScript(`
          const v = document.querySelector('video'); if(v) v.requestPictureInPicture?.();
        `).catch(()=>{});
        break;
      case 'save-media':
        if (dat) { wv.downloadURL(dat); }
        break;

      // ===== 页面级操作 =====
      case 'save-page':
        // 使用 webContents 的 savePage 或 downloadURL
        if (wv.src) { wv.downloadURL(wv.src); }
        else { wv.getWebContents()?.savePage?.(Date.now() + '.html', 'HTMLComplete'); }
        break;
      case 'bookmark-page':
        // 收藏当前页面
        try {
          const url = wv.getURL ? wv.getURL() : wv.src;
          const title = document.querySelector('.tab-item.active .tab-title')?.textContent || url;
          if (url && url !== 'about:blank') {
            window.FBrowser.bookmarks.addBookmark(url, title);
            window.FBrowser?.notify?.success('已添加到书签');
          }
        } catch(e) { console.error('[ContextMenu] bookmark-page 失败:', e); }
        break;
      case 'print':
        if (window.electronAPI.printPage) window.electronAPI.printPage();
        break;
      case 'find':
        // 触发查找栏显示
        try { window.FBrowser.findBar.toggle(); } catch(e) { console.error('[ContextMenu] findBar.toggle 失败:', e); }
        break;

      // ===== 缩放操作 =====
      case 'zoom-in':
        try { window.FBrowser.zoom.zoomIn?.(); } catch(e) { /* zoom模块未加载 */ }
        break;
      case 'zoom-out':
        try { window.FBrowser.zoom.zoomOut?.(); } catch(e) {}
        break;
      case 'zoom-reset':
        try { window.FBrowser.zoom.zoomReset?.(); } catch(e) {}
        break;
      case 'fullscreen':
        if (window.electronAPI.toggleFullscreen) window.electronAPI.toggleFullscreen();
        break;

      // ===== 开发者工具 =====
      case 'view-source':
        wv.executeJavaScript('document.documentElement.outerHTML').then(html => {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.FBrowser.tabs.createTab(url);
        }).catch(() => {});
        break;
      case 'inspect':
        const ix = dat?.x ?? 0, iy = dat?.y ?? 0;
        try { wv.inspectElement(ix, iy); } catch(e2) {}
        break;

      // ===== AI 浮窗对话 =====
      case 'open-float-chat':
        if (window.FBrowser && window.FBrowser.floatChat) {
          window.FBrowser.floatChat.open(dat?.text || '', dat?.url || '', dat?.mode);
        }
        break;

      default:
        console.log('[ContextMenu] 未处理的 action:', act, dat);
    }
  });
}

// ---- 地址栏右键菜单已由 navigation.js 模块统一处理（Edge 风格完整版）----

// ---- 系统托盘动作处理 ----
if (window.electronAPI && window.electronAPI.onTrayAction) {
  window.electronAPI.onTrayAction(function(action, data) {
    switch (action) {
      case 'new-tab':
        if (window.FBrowser && window.FBrowser.tabs) {
          window.FBrowser.tabs.createTab();
        }
        break;
      case 'new-incognito':
        if (window.electronAPI && window.electronAPI.openIncognito) {
          window.electronAPI.openIncognito();
        }
        break;
      case 'split-screen':
        if (window.FBrowser && window.FBrowser.splitScreen) {
          window.FBrowser.splitScreen.open();
        }
        break;
      case 'toggle-vertical-tabs':
        document.body.classList.toggle('vertical-tabs', data);
        localStorage.setItem('f-vertical-tabs', data);
        break;
      case 'open-bookmarks':
        if (window.FBrowser && window.FBrowser.sidebar) {
          window.FBrowser.sidebar.openSidePanel('bookmarks');
        }
        break;
      case 'open-history':
        if (window.FBrowser && window.FBrowser.sidebar) {
          window.FBrowser.sidebar.openSidePanel('history');
        }
        break;
      case 'toggle-power-mode':
        if (window.FBrowser && window.FBrowser.powerMode) {
          if (data) {
            window.FBrowser.powerMode.enable();
          } else {
            window.FBrowser.powerMode.disable();
          }
        }
        break;
      case 'clear-cache':
        if (window.electronAPI && window.electronAPI.clearCache) {
          window.electronAPI.clearCache({ keepCookies: true }).then(function(result) {
            if (result.success) {
              window.FBrowser && window.FBrowser.notify && window.FBrowser.notify.success('缓存清理完成，已释放 ' + result.clearedMB + ' MB');
            } else {
              window.FBrowser && window.FBrowser.notify && window.FBrowser.notify.error('缓存清理失败');
            }
          });
        }
        break;
      case 'open-settings':
        if (window.FBrowser && window.FBrowser.tabs) {
          window.FBrowser.tabs.createTab('drift://settings');
        }
        break;
    }
  });
}

// ---- 会话恢复 ----
async function restoreSession() {
  try {
    const session = await window.electronAPI.sessionRestore();
    if (session && session.tabs && session.tabs.length > 0) {
      // 先关闭默认创建的空标签页
      const defaultTab = window.FBrowser.tabs.tabs[0];
      if (defaultTab && defaultTab.isHome) {
        window.FBrowser.tabs.closeTab(defaultTab.id);
      }
      // 恢复标签页
      for (const tabData of session.tabs) {
        if (tabData.url) {
          window.FBrowser.tabs.createTab(tabData.url);
        } else {
          window.FBrowser.tabs.createTab();
        }
      }
      return true;
    }
  } catch (e) {
    console.error('[Drift] 会话恢复失败:', e);
  }
  return false;
}

// ---- 窗口关闭前保存会话 ----
window.addEventListener('beforeunload', () => {
  try {
    const tabsData = window.FBrowser.tabs.getTabsData();
    window.electronAPI.sessionSave(tabsData);
  } catch (e) {
    console.error('[Drift] 保存会话失败:', e);
  }
});

// ---- 证书错误提示条 ----
const certErrorBar = document.getElementById('certErrorBar');
const certDetailEl = document.getElementById('certDetail');
let lastCertData = null;

if (window.electronAPI.onCertificateError) {
  window.electronAPI.onCertificateError(data => {
    lastCertData = data;
    if (certDetailEl) certDetailEl.textContent = data.error || '';
    if (certErrorBar) {
      certErrorBar.classList.add('visible');
      // 证书错误时需要给工具栏和内容区留出顶部空间
      const toolbar = document.getElementById('toolbar');
      if (toolbar) toolbar.style.marginTop = '44px';
    }
  });
}

const btnCertTrust = document.getElementById('btnCertTrust');
if (btnCertTrust) btnCertTrust.addEventListener('click', async () => {
  if (lastCertData && window.electronAPI.certificateTrust) {
    await window.electronAPI.certificateTrust(lastCertData.fingerprint, true);
    // 信任后重新加载页面
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (wv && lastCertData.url) wv.src = lastCertData.url;
    closeCertBar();
  }
});

const btnCertClose = document.getElementById('btnCertClose');
if (btnCertClose) btnCertClose.addEventListener('click', closeCertBar);

function closeCertBar() {
  if (certErrorBar) certErrorBar.classList.remove('visible');
  const toolbar = document.getElementById('toolbar');
  if (toolbar) toolbar.style.marginTop = '';
  lastCertData = null;
}

// ---- 全局快捷键: Ctrl+Shift+A 呼出 AI 浮窗 ----
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    var activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;
    if (document.querySelector('.welcome-tutorial.active')) return;
    e.preventDefault();
    if (window.FBrowser && window.FBrowser.floatChat) {
      window.FBrowser.floatChat.open('', '');
    }
  }
});

(async function init() {
  // 初始化更新检查（必须在启动时注册事件监听）
  if (window.FBrowser && window.FBrowser.updater && window.FBrowser.updater.init) {
    window.FBrowser.updater.init();
  }

  // 首次启动检查：显示欢迎页（每次启动都播放动画，仅首次显示教程）
  if (window.DriftWelcome) {
    window.DriftWelcome.init();
    return; // 欢迎页会处理后续初始化
  }

  // 尝试恢复会话，如果无可恢复会话则创建新标签页
  const restored = await restoreSession();
  if (!restored) {
    window.FBrowser.tabs.createTab();
  }
})();
