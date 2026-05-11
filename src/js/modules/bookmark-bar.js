// ==================== 书签栏模块 ====================
// 工具栏下方显示常用书签，config.showBookmarkBar 已预留
(function() {
  'use strict';

  const { config, saveConfig } = window.FBrowser.config;

  let barEl = null;

  function ensureBar() {
    if (!barEl) {
      barEl = document.getElementById('bookmarkBar');
    }
    return barEl;
  }

  function render() {
    const bar = ensureBar();
    if (!bar) return;

    const bookmarks = window.FBrowser.data.getBookmarks();
    bar.innerHTML = '';

    if (!config.showBookmarkBar) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    if (bookmarks.length === 0) {
      bar.innerHTML = '<span class="bb-empty">暂无书签 — 点击地址栏 ★ 添加</span>';
      return;
    }

    bookmarks.forEach((b, i) => {
      const item = document.createElement('div');
      item.className = 'bb-item';
      item.title = b.title || b.url;
      item.innerHTML = `
        <img class="bb-favicon" src="" alt="" data-url="${window.FBrowser.data.escHtml(b.url)}">
        <span class="bb-title">${window.FBrowser.data.escHtml(b.title || b.url)}</span>
      `;
      item.addEventListener('click', () => {
        window.FBrowser.navigation.navigateTo(b.url);
      });
      // 右键可删除
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (confirm('删除书签 "' + (b.title || b.url) + '" ?')) {
          const bm = window.FBrowser.data.getBookmarks();
          bm.splice(i, 1);
          window.FBrowser.data.saveBookmarks();
          render();
          window.FBrowser.bookmarks.renderBookmarks();
          window.FBrowser.bookmarks.updateBookmarkBtn();
        }
      });
      bar.appendChild(item);
    });

    // 加载 favicon
    bar.querySelectorAll('.bb-favicon').forEach(img => {
      const url = img.dataset.url;
      loadFavicon(img, url);
    });
  }

  function loadFavicon(imgEl, pageUrl) {
    try {
      const u = new URL(pageUrl);
      imgEl.src = u.origin + '/favicon.ico';
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
      };
    } catch(e) {
      imgEl.style.display = 'none';
    }
  }

  function toggle() {
    config.showBookmarkBar = !config.showBookmarkBar;
    saveConfig();
    render();
  }

  function isVisible() {
    return config.showBookmarkBar;
  }

  // 初始化
  function init() {
    render();
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.bookmarkBar = { render, toggle, isVisible, init };
})();
