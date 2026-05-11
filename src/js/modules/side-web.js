// ==================== 侧边栏网页模块 ====================
// 侧边栏内嵌网页（类似 Edge 侧边栏）
(function() {
  'use strict';

  let sideWebview = null;
  let isOpen = false;
  let containerEl = null;

  function open(url) {
    ensureContainer();
    if (!sideWebview) {
      sideWebview = document.createElement('webview');
      sideWebview.className = 'side-webview';
      sideWebview.setAttribute('allowpopups', '');
      containerEl.querySelector('.sw-content').appendChild(sideWebview);

      // 拦截新窗口
      sideWebview.addEventListener('new-window', e => {
        e.preventDefault();
        window.FBrowser.tabs.createTab(e.url);
      });
    }

    if (url) {
      sideWebview.src = url;
    }

    containerEl.classList.add('open');
    isOpen = true;
  }

  function close() {
    ensureContainer();
    containerEl.classList.remove('open');
    isOpen = false;
  }

  function toggle(url) {
    if (isOpen) {
      close();
    } else {
      open(url);
    }
  }

  function navigate(url) {
    if (sideWebview) {
      sideWebview.src = url;
    }
  }

  function goBack() {
    if (sideWebview) sideWebview.goBack();
  }

  function goForward() {
    if (sideWebview) sideWebview.goForward();
  }

  function reload() {
    if (sideWebview) sideWebview.reload();
  }

  function isOpenState() {
    return isOpen;
  }

  function ensureContainer() {
    if (!containerEl) {
      containerEl = document.getElementById('sideWebContainer');
    }
    if (!containerEl) {
      containerEl = document.createElement('div');
      containerEl.id = 'sideWebContainer';
      containerEl.className = 'side-web-container';
      containerEl.innerHTML = `
        <div class="sw-toolbar">
          <button class="sw-btn sw-back" title="后退">
            <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,3 5,7 9,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="sw-btn sw-forward" title="前进">
            <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="5,3 9,7 5,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="sw-btn sw-reload" title="刷新">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 7a4 4 0 1 1-1-2.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><polyline points="10,2 10,5 7,5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
          <input class="sw-url" type="text" placeholder="输入网址...">
          <button class="sw-btn sw-go" title="前往">
            <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="3,7 11,7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="8,4 11,7 8,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="sw-btn sw-close" title="关闭">✕</button>
        </div>
        <div class="sw-content"></div>
      `;
      document.getElementById('main')?.appendChild(containerEl);

      // 绑定事件
      containerEl.querySelector('.sw-back').addEventListener('click', goBack);
      containerEl.querySelector('.sw-forward').addEventListener('click', goForward);
      containerEl.querySelector('.sw-reload').addEventListener('click', reload);
      containerEl.querySelector('.sw-close').addEventListener('click', close);
      containerEl.querySelector('.sw-go').addEventListener('click', () => {
        const url = containerEl.querySelector('.sw-url').value.trim();
        if (url) navigate(url);
      });
      containerEl.querySelector('.sw-url').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const url = e.target.value.trim();
          if (url) navigate(url);
        }
      });
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.sideWeb = { open, close, toggle, navigate, goBack, goForward, reload, isOpenState };
})();
