// ==================== 导航 & URL 栏 ====================
(function() {
  'use strict';

  const urlBarEl = document.getElementById('urlBar');
  const urlLockEl = document.getElementById('urlLock');
  const homeSearchEl = document.getElementById('homeSearch');

  // URL 自动补全
  let autocompleteEl = document.getElementById('urlAutocomplete');
  let selectedSuggestion = -1;

  function hideAutocomplete() {
    if (autocompleteEl) {
      autocompleteEl.innerHTML = '';
      autocompleteEl.classList.remove('visible');
    }
    selectedSuggestion = -1;
  }

  function showAutocomplete(suggestions) {
    if (!autocompleteEl || !suggestions.length) { hideAutocomplete(); return; }
    selectedSuggestion = -1;
    autocompleteEl.innerHTML = suggestions.map((s, i) => `
      <div class="ac-item" data-index="${i}" data-url="${window.FBrowser.data.escHtml(s.url)}">
        <span class="ac-icon ${s.type}">${s.type === 'bookmark' ? '★' : '🕐'}</span>
        <span class="ac-text">${window.FBrowser.data.escHtml(s.title)}</span>
        <span class="ac-url">${window.FBrowser.data.escHtml(s.url)}</span>
      </div>
    `).join('');
    autocompleteEl.classList.add('visible');

    autocompleteEl.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        navigateTo(item.dataset.url);
        hideAutocomplete();
        urlBarEl.blur();
      });
    });
  }

  function navigateAutocomplete(direction) {
    const items = autocompleteEl?.querySelectorAll('.ac-item');
    if (!items || !items.length) return;
    if (selectedSuggestion >= 0) items[selectedSuggestion].classList.remove('selected');
    selectedSuggestion += direction;
    if (selectedSuggestion < 0) selectedSuggestion = items.length - 1;
    if (selectedSuggestion >= items.length) selectedSuggestion = 0;
    items[selectedSuggestion].classList.add('selected');
    urlBarEl.value = items[selectedSuggestion].dataset.url;
  }

  // ---- URL 栏更新 ----
  function updateUrlBar(url) {
    if (!urlBarEl) return;
    urlBarEl.value = url || '';
    if (url && url.startsWith('https://')) {
      urlLockEl.innerHTML = '<rect x="3" y="6" width="8" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 6V4a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    } else {
      urlLockEl.innerHTML = '<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1"/><line x1="10.2" y1="10.2" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
    }
    try { window.FBrowser.bookmarks.updateBookmarkBtn(); } catch(e) {}
  }

  // ---- 导航核心函数 ----
  function navigateTo(input) {
    if (!input) return;
    if (input === 'f://settings') { window.FBrowser.settings.openSettings(); return; }
    if (/^f:\/\/[a-z]/i.test(input) || /^drift:\/\/[a-z]/i.test(input)) {
      var internalUrl = input.replace(/^drift:\/\//i, 'f://');
      window.FBrowser.tabs.createTab(internalUrl);
      return;
    }
    const url = window.FBrowser.search.resolveUrl(input);
    if (!url) return;
    const tab = window.FBrowser.tabs.getActiveTab();
    if (!tab) return;

    const homePageEl = document.getElementById('homePage');
    const homePageCyberEl = document.getElementById('homePageCyber');
    const webviewHostEl = document.getElementById('webviewHost');
    const settingsPageEl = document.getElementById('settingsPage');

    tab.isSettings = false;
    if (settingsPageEl) settingsPageEl.classList.remove('active');

    if (tab.webview) {
      if (homePageEl) homePageEl.classList.remove('active');
      if (homePageCyberEl) homePageCyberEl.classList.remove('active');
      if (webviewHostEl) webviewHostEl.classList.add('active');
      tab.webview.classList.add('visible');
      tab.webview.src = url;
    } else {
      const wv = document.createElement('webview');
      wv.dataset.tabId = tab.id;
      wv.setAttribute('allowpopups', '');
      webviewHostEl.appendChild(wv);
      tab.webview = wv;
      tab.isHome = false;

      window.FBrowser.tabs.bindWebviewEvents(tab, wv);

      if (homePageEl) homePageEl.classList.remove('active');
      if (homePageCyberEl) homePageCyberEl.classList.remove('active');
      if (webviewHostEl) webviewHostEl.classList.add('active');
      wv.classList.add('visible');

      requestAnimationFrame(() => {
        wv.src = url;
        window.FBrowser.tabs.forceResizeWebview(wv);
      });
    }
    tab.url = url;
    updateUrlBar(url);
  }

  // ---- 事件绑定 ----
  if (urlBarEl) {
    // ====== 地址栏右键菜单（Edge 风格）======
    let urlBarMenu = null;

    urlBarEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      showUrlBarContextMenu(e.clientX, e.clientY);
    });

    function showUrlBarContextMenu(x, y) {
      dismissUrlBarMenu();
      const val = urlBarEl.value || '';
      const selStart = urlBarEl.selectionStart ?? 0;
      const selEnd = urlBarEl.selectionEnd ?? 0;
      const hasSelection = selEnd > selStart;
      const hasText = val.length > 0;

      // 检测剪贴板内容是否像 URL（用于区分"粘贴并转到"/"粘贴并搜索"）
      const clipboardText = '';  // 异步获取，先占位

      const items = [
        { id: 'undo',    label: '撤销(U)\tCtrl+Z',     enabled: true, action: () => document.execCommand('undo') },
        { id: 'redo',    label: '重做(R)\tCtrl+Y',     enabled: true, action: () => document.execCommand('redo') },
        { type: 'sep' },
        { id: 'cut',     label: '剪切(T)\tCtrl+X',      enabled: hasSelection, action: () => document.execCommand('cut') },
        { id: 'copy',    label: '复制(C)\tCtrl+C',      enabled: hasSelection, action: () => document.execCommand('copy') },
        {
          id: 'paste',
          label: '粘贴(P)\tCtrl+V',
          enabled: true,
          async action() {
            const text = await navigator.clipboard.readText().catch(() => '');
            if (!text) return;
            const start = urlBarEl.selectionStart;
            const end = urlBarEl.selectionEnd;
            urlBarEl.value = urlBarEl.value.substring(0, start) + text + urlBarEl.value.substring(end);
            urlBarEl.setSelectionRange(start + text.length, start + text.length);
            urlBarEl.dispatchEvent(new Event('input'));
            urlBarEl.focus();
          }
        },
        {
          id: 'paste-go',
          label: '粘贴并转到',
          enabled: true,
          async action() {
            const text = await navigator.clipboard.readText().catch(() => '');
            if (!text) return;
            urlBarEl.value = text.trim();
            urlBarEl.focus();
            navigateTo(urlBarEl.value.trim());
            hideAutocomplete();
            urlBarEl.blur();
          }
        },
        {
          id: 'paste-search',
          label: '粘贴并搜索',
          enabled: true,
          async action() {
            const text = await navigator.clipboard.readText().catch(() => '');
            if (!text) return;
            urlBarEl.value = text.trim();
            urlBarEl.focus();
            // 强制走搜索引擎
            try {
              const searchUrl = window.FBrowser.search.resolveUrl(text);
              navigateTo(searchUrl || text);
            } catch(ee) { navigateTo(text); }
            hideAutocomplete();
            urlBarEl.blur();
          }
        },
        { type: 'sep' },
        { id: 'select-all', label: '全选(A)\tCtrl+A',    enabled: hasText, action: () => urlBarEl.select() },
        { id: 'delete',    label: '删除\tDel',             enabled: hasSelection, action: () => {
          const s = urlBarEl.selectionStart, e2 = urlBarEl.selectionEnd;
          urlBarEl.value = urlBarEl.value.substring(0, s) + urlBarEl.value.substring(e2);
          urlBarEl.setSelectionRange(s, s);
          urlBarEl.dispatchEvent(new Event('input'));
        }},
        { type: 'sep' },
        // ====== 搜索引擎切换子菜单（Edge 特有）=====
        {
          id: 'search-with',
          label: '使用搜索引擎',
          submenu: [
            { id: 'se-baidu',  label: '百度',       action: () => switchSearchEngineAndGo('baidu') },
            { id: 'se-bing',   label: 'Bing',       action: () => switchSearchEngineAndGo('bing') },
            { id: 'se-google', label: 'Google',     action: () => switchSearchEngineAndGo('google') },
            { id: 'se-sogou',  label: '搜狗',       action: () => switchSearchEngineAndGo('sogou') },
          ],
        },
        { type: 'sep' },
        // ====== 填充/历史子菜单 ======
        {
          id: 'history',
          label: '输入历史',
          submenu: buildInputHistory(),
        },
        { type: 'sep' },
        { id: 'clear-url',  label: '清除地址栏',           enabled: hasText, action: () => {
          urlBarEl.value = '';
          urlBarEl.dispatchEvent(new Event('input'));
          urlBarEl.focus();
        }},
      ];

      renderUrlBarMenu(items, x, y);
    }

    function buildInputHistory() {
      // 从本地存储或数据模块获取最近的输入历史
      const history = [];
      try {
        const raw = localStorage.getItem('fb_url_history');
        if (raw) {
          const list = JSON.parse(raw).slice(0, 15);  // 最多显示 15 条
          list.forEach(item => {
            const url = item.url || item;
            const title = item.title || item.url || item;
            history.push({
              label: title,
              url: url,
              action: () => { urlBarEl.value = url; navigateTo(url); hideAutocomplete(); urlBarEl.blur(); }
            });
          });
        }
      } catch(e) {}
      if (history.length === 0) {
        history.push({ label: '(无历史记录)', enabled: false });
      }
      return history;
    }

    function switchSearchEngineAndGo(engine) {
      const query = urlBarEl.value.trim() || '';
      if (!query) return;
      // 根据引擎构造搜索 URL
      const engineUrls = {
        baidu:  'https://www.baidu.com/s?wd=',
        bing:   'https://cn.bing.com/search?q=',
        google: 'https://www.google.com/search?q=',
        sogou:  'https://www.sogou.com/web?query=',
      };
      const baseUrl = engineUrls[engine] || engineUrls.baidu;
      navigateTo(baseUrl + encodeURIComponent(query));
      hideAutocomplete();
      urlBarEl.blur();
    }

    function renderUrlBarMenu(items, x, y) {
      const frag = document.createDocumentFragment();
      const container = document.createElement('div');

      function buildItems(list, depth, parentEl) {
        const targetEl = parentEl || container;
        list.forEach((item, idx) => {
          if (item.type === 'sep') {
            const sep = document.createElement('div');
            sep.className = 'ubm-sep';
            targetEl.appendChild(sep);
            return;
          }

          const row = document.createElement('div');
          row.className = `ubm-item${!item.enabled && item.enabled !== undefined ? ' disabled' : ''}${item.submenu ? ' has-sub' : ''}`;
          row.dataset.id = item.id || idx;
          row.innerHTML = `<span class="ubm-label">${window.FBrowser.data.escHtml(item.label)}</span>`;

          if (item.enabled !== false && !item.submenu && item.action) {
            row.addEventListener('click', e => {
              e.stopPropagation();
              dismissUrlBarMenu();
              item.action();
              saveUrlHistory();  // 操作后保存到历史
            });
          }

          // 子菜单处理
          if (item.submenu) {
            let subMenu = null;
            row.addEventListener('mouseenter', e => {
              dismissSubmenus(container);
              subMenu = document.createElement('div');
              subMenu.className = 'ubm-sub';
              buildItems(item.submenu, depth + 1, subMenu);
              subMenu.style.top = row.offsetTop + 'px';
              subMenu.style.left = '100%';
              row.appendChild(subMenu);
            });
          }

          targetEl.appendChild(row);
        });
      }

      buildItems(items, 0);

      urlBarMenu = document.createElement('div');
      urlBarMenu.className = 'url-bar-menu';
      urlBarMenu.appendChild(container);

      // 边界检测：确保不超出视口
      const vw = window.innerWidth, vh = window.innerHeight;
      let posX = x, posY = y;
      requestAnimationFrame(() => {
        if (posX + urlBarMenu.offsetWidth > vw - 4) posX = vw - urlBarMenu.offsetWidth - 4;
        if (posY + urlBarMenu.offsetHeight > vh - 4) posY = vh - urlBarMenu.offsetHeight - 4;
        urlBarMenu.style.left = posX + 'px';
        urlBarMenu.style.top = posY + 'px';
      });

      urlBarMenu.style.left = posX + 'px';
      urlBarMenu.style.top = posY + 'px';

      document.body.appendChild(urlBarMenu);

      // 点击外部关闭
      setTimeout(() => {
        document.addEventListener('mousedown', _onDocMouseDown);
      }, 10);
    }

    function _onDocMouseDown(e) {
      if (urlBarMenu && (!e || !e.target || !urlBarMenu.contains(e.target))) {
        dismissUrlBarMenu();
      }
    }

    function dismissSubmenus(menuEl) {
      menuEl.querySelectorAll('.ubm-sub').forEach(el => el.remove());
    }

    function dismissUrlBarMenu() {
      if (urlBarMenu) {
        urlBarMenu.remove();
        urlBarMenu = null;
        document.removeEventListener('mousedown', _onDocMouseDown);
      }
    }

    // 保存输入历史
    function saveUrlHistory() {
      const val = urlBarEl.value?.trim();
      if (!val) return;
      try {
        let history = JSON.parse(localStorage.getItem('fb_url_history') || '[]');
        // 去重后插入头部
        history = history.filter(h => (h.url || h) !== val);
        history.unshift({ url: val, title: val.substring(0, 50) });
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem('fb_url_history', JSON.stringify(history));
      } catch(e) {}
    }

    // Enter 键时保存历史
    urlBarEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveUrlHistory();
    });

    // ====== 原有事件绑定继续 ======
    urlBarEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (selectedSuggestion >= 0) {
          const items = autocompleteEl?.querySelectorAll('.ac-item');
          if (items && items[selectedSuggestion]) {
            navigateTo(items[selectedSuggestion].dataset.url);
          }
        } else {
          const val = urlBarEl.value.trim();
          if (val === 'f://settings') { window.FBrowser.settings.openSettings(); }
          else if (/^f:\/\/[a-z]/i.test(val) || /^drift:\/\/[a-z]/i.test(val)) {
            var iUrl = val.replace(/^drift:\/\//i, 'f://');
            window.FBrowser.tabs.createTab(iUrl);
          }
          else { navigateTo(val); }
        }
        hideAutocomplete();
        urlBarEl.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateAutocomplete(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateAutocomplete(-1);
      } else if (e.key === 'Escape') {
        hideAutocomplete();
        urlBarEl.blur();
      }
    });
    urlBarEl.addEventListener('input', () => {
      const query = urlBarEl.value.trim();
      const suggestions = window.FBrowser.data.getUrlSuggestions(query);
      showAutocomplete(suggestions);
    });
    urlBarEl.addEventListener('focus', () => {
      urlBarEl.select();
      const query = urlBarEl.value.trim();
      const suggestions = window.FBrowser.data.getUrlSuggestions(query);
      showAutocomplete(suggestions);
    });
    urlBarEl.addEventListener('blur', () => {
      setTimeout(hideAutocomplete, 150);
    });
  }

  if (homeSearchEl) {
    homeSearchEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && homeSearchEl.value.trim()) {
        navigateTo(homeSearchEl.value.trim());
        homeSearchEl.value = '';
      }
    });
  }

  const btnBack = document.getElementById('btnBack');
  const btnForward = document.getElementById('btnForward');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnHome = document.getElementById('btnHome');
  const btnNewTab = document.getElementById('btnNewTab');

  if (btnBack) btnBack.addEventListener('click', () => {
    const wv = window.FBrowser.tabs.getActiveWebview(); if (wv) wv.goBack();
  });
  if (btnForward) btnForward.addEventListener('click', () => {
    const wv = window.FBrowser.tabs.getActiveWebview(); if (wv) wv.goForward();
  });
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    const wv = window.FBrowser.tabs.getActiveWebview(); if (wv) wv.reload();
  });
  if (btnHome) btnHome.addEventListener('click', () => {
    const tab = window.FBrowser.tabs.getActiveTab();
    if (!tab) return;
    if (tab.webview) tab.webview.classList.remove('visible');
    tab.isHome = true;
    tab.isSettings = false;
    tab.url = '';
    const titleEl = tab.element.querySelector('.tab-title');
    if (titleEl) titleEl.textContent = '新标签页';
    // 根据配置显示对应的主页风格
    const homeStyle = window.FBrowser?.config?.config?.homeStyle || 'classic';
    const homePageEl = document.getElementById('homePage');
    const homePageCyberEl = document.getElementById('homePageCyber');
    if (homeStyle === 'cyber' && homePageCyberEl) {
      homePageEl?.classList.remove('active');
      homePageCyberEl.classList.add('active');
    } else {
      homePageCyberEl?.classList.remove('active');
      homePageEl?.classList.add('active');
    }
    document.getElementById('settingsPage')?.classList.remove('active');
    document.getElementById('webviewHost')?.classList.remove('active');
    updateUrlBar('');
  });

  // 注册到 tabs 模块（解决循环依赖）
  window.FBrowser.tabs.setUpdateUrlBar(updateUrlBar);

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.navigation = { updateUrlBar, navigateTo };
})();
