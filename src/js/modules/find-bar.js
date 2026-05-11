// ==================== 页面内查找栏 ====================
(function() {
  'use strict';

  let findBarEl = document.getElementById('findBar');
  let findInputEl = document.getElementById('findInput');
  let findResultEl = document.getElementById('findResult');
  let zoomIndicatorEl = document.getElementById('zoomIndicator');
  let currentRequestId = 0;

  // ---- 打开查找栏 ----
  function open() {
    ensureElements();
    findBarEl.classList.add('visible');
    findInputEl.value = '';
    findResultEl.textContent = '';
    findInputEl.focus();
  }

  // ---- 关闭查找栏 ----
  function close() {
    ensureElements();
    findBarEl.classList.remove('visible');
    findInputEl.value = '';
    findResultEl.textContent = '';

    // 停止查找（检查 webview 是否准备好）
    try {
      const wv = window.FBrowser.tabs.getActiveWebview();
      if (wv && wv.getWebContentsId) {
        wv.stopFindInPage('clearSelection');
      }
    } catch (e) {}
  }

  // ---- 切换查找栏 ----
  function toggle() {
    ensureElements();
    if (findBarEl.classList.contains('visible')) {
      close();
    } else {
      open();
    }
  }

  // ---- 查找 ----
  function doFind(direction) {
    try {
      const wv = window.FBrowser.tabs.getActiveWebview();
      if (!wv || !wv.getWebContentsId) return;

      const text = findInputEl.value;
      if (!text) {
        findResultEl.textContent = '';
        wv.stopFindInPage('clearSelection');
        return;
      }

      currentRequestId++;
      if (direction === 'prev') {
        wv.findInPage(text, { forward: false, findNext: true, matchCase: false });
      } else {
        wv.findInPage(text, { forward: true, findNext: false, matchCase: false });
      }
    } catch (e) {}
  }

  // ---- 查找结果回调 ----
  function onFoundInPage(result) {
    if (!result) return;
    if (result.matches === undefined) return;
    if (result.activeMatchOrdinal && result.matches) {
      findResultEl.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
    } else if (result.finalUpdate && result.matches === 0) {
      findResultEl.textContent = '无结果';
    }
  }

  // ---- 缩放指示器 ----
  function updateZoomIndicator(level) {
    if (!zoomIndicatorEl) return;
    if (level === 0) {
      zoomIndicatorEl.classList.remove('visible');
      return;
    }
    zoomIndicatorEl.textContent = Math.round((1 + level * 0.2) * 100) + '%';
    zoomIndicatorEl.classList.add('visible');
    setTimeout(() => zoomIndicatorEl.classList.remove('visible'), 2000);
  }

  // ---- 确保 DOM 元素存在 ----
  function ensureElements() {
    if (!findBarEl) {
      findBarEl = document.getElementById('findBar');
      findInputEl = document.getElementById('findInput');
      findResultEl = document.getElementById('findResult');
      zoomIndicatorEl = document.getElementById('zoomIndicator');
      bindEvents();
    }
  }

  // ---- 绑定事件 ----
  function bindEvents() {
    if (!findInputEl) return;

    findInputEl.addEventListener('input', () => doFind('next'));

    findInputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doFind(e.shiftKey ? 'prev' : 'next');
      } else if (e.key === 'Escape') {
        close();
      }
    });

    const btnFindPrev = document.getElementById('btnFindPrev');
    if (btnFindPrev) btnFindPrev.addEventListener('click', () => doFind('prev'));

    const btnFindNext = document.getElementById('btnFindNext');
    if (btnFindNext) btnFindNext.addEventListener('click', () => doFind('next'));

    const btnFindClose = document.getElementById('btnFindClose');
    if (btnFindClose) btnFindClose.addEventListener('click', close);
  }

  // 首次绑定
  if (findBarEl) bindEvents();

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.findBar = { open, close, toggle, toggleFindBar: toggle, onFoundInPage, updateZoomIndicator };
})();
