// ==================== 网页暗黑模式切换 ====================
// 强制网页使用暗色主题
(function() {
  'use strict';

  const DARK_CSS = `
    @namespace url(http://www.w3.org/1999/xhtml);
    html {
      filter: invert(90%) hue-rotate(180deg) !important;
    }
    img, video, picture, canvas, svg, iframe,
    [style*="background-image"],
    [style*="background: url"] {
      filter: invert(100%) hue-rotate(180deg) !important;
    }
  `;

  const darkModeTabs = new Set();

  function toggle() {
    const tab = window.FBrowser.tabs.getActiveTab();
    if (!tab || !tab.webview) return;

    const tabId = tab.id;
    const wv = tab.webview;

    if (darkModeTabs.has(tabId)) {
      disable(tabId, wv);
    } else {
      enable(tabId, wv);
    }
  }

  function enable(tabId, wv) {
    wv.insertCSS(DARK_CSS, 'fb-dark-mode').then(() => {
      darkModeTabs.add(tabId);
      updateButtonState(tabId, true);
    }).catch(e => {
      // 旧版 Electron 不支持 CSS origin，回退到无 origin
      wv.insertCSS(DARK_CSS).then(() => {
        darkModeTabs.add(tabId);
        updateButtonState(tabId, true);
      }).catch(() => {});
    });
  }

  function disable(tabId, wv) {
    // 移除注入的 CSS - 通过重新加载页面
    // Electron webview insertCSS 返回的 key 可用于 removeInsertedCSS
    wv.reload();
    darkModeTabs.delete(tabId);
    updateButtonState(tabId, false);
  }

  function isActive(tabId) {
    return darkModeTabs.has(tabId);
  }

  function updateButtonState(tabId, active) {
    const btn = document.getElementById('btnDarkMode');
    if (btn) {
      btn.classList.toggle('active', active);
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.darkModeWeb = { toggle, isActive };
})();
