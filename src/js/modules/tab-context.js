// ==================== 标签页右键菜单 ====================
(function() {
  'use strict';

  let tabContextEl = document.getElementById('tabContextMenu');

  function ensureElement() {
    if (!tabContextEl) {
      tabContextEl = document.getElementById('tabContextMenu');
    }
  }

  function show(e, tabId) {
    ensureElement();
    if (!tabContextEl) return;

    const tab = window.FBrowser.tabs.tabs.find(t => t.id === tabId);
    if (!tab) return;

    let html = '';

    if (tab.url && !tab.isHome) {
      html += `<div class="ctx-item" data-action="reload">重新加载</div>`;
      html += `<div class="ctx-item" data-action="duplicate">复制标签页</div>`;
    }
    html += `<div class="ctx-item" data-action="close">关闭标签页</div>`;

    const allTabs = window.FBrowser.tabs.tabs;
    if (allTabs.length > 1) {
      html += `<div class="ctx-item" data-action="close-others">关闭其他标签页</div>`;
    }

    if (tab.url && !tab.isHome) {
      html += `<div class="ctx-sep"></div>`;
      html += `<div class="ctx-item" data-action="copy-url">复制网址</div>`;
      html += `<div class="ctx-item" data-action="bookmark">添加书签</div>`;
    }

    tabContextEl.innerHTML = html;
    tabContextEl.classList.add('visible');

    // 定位
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - tabContextEl.offsetHeight - 10);
    tabContextEl.style.left = x + 'px';
    tabContextEl.style.top = y + 'px';

    // 绑定点击
    tabContextEl.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        handleAction(action, tabId, tab);
        hide();
      });
    });
  }

  function hide() {
    ensureElement();
    if (tabContextEl) tabContextEl.classList.remove('visible');
  }

  function handleAction(action, tabId, tab) {
    switch (action) {
      case 'reload':
        if (tab.webview) tab.webview.reload();
        break;
      case 'duplicate':
        window.FBrowser.tabs.duplicateTab(tabId);
        break;
      case 'close':
        window.FBrowser.tabs.closeTab(tabId);
        break;
      case 'close-others':
        window.FBrowser.tabs.closeOtherTabs(tabId);
        break;
      case 'copy-url':
        navigator.clipboard.writeText(tab.url).catch(() => {});
        break;
      case 'bookmark':
        window.FBrowser.data.addBookmark(tab.url, tab.element.querySelector('.tab-title')?.textContent || tab.url);
        window.FBrowser.bookmarks.renderBookmarks();
        window.FBrowser.bookmarks.updateBookmarkBtn();
        break;
    }
  }

  // 点击其他地方关闭
  document.addEventListener('click', e => {
    if (tabContextEl && !e.target.closest('#tabContextMenu')) hide();
  });
  document.addEventListener('contextmenu', e => {
    if (tabContextEl && !e.target.closest('.tab-item')) hide();
  });

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.tabContext = { show, hide };
})();
