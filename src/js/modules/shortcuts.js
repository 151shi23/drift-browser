// ==================== 键盘快捷键 ====================
(function() {
  'use strict';

  const urlBarEl = document.getElementById('urlBar');

  document.addEventListener('keydown', e => {
    const tabs = window.FBrowser.tabs;

    // Ctrl+T 新标签页
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); tabs.createTab(); }
    // Ctrl+W 关闭标签页
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); tabs.closeTab(tabs.activeTabId); }
    // Ctrl+L 聚焦 URL 栏
    if (e.ctrlKey && e.key === 'l' && urlBarEl) { e.preventDefault(); urlBarEl.focus(); }
    // Alt+Left 后退
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); document.getElementById('btnBack')?.click(); }
    // Alt+Right 前进
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('btnForward')?.click(); }
    // F5 刷新
    if (e.key === 'F5') { e.preventDefault(); document.getElementById('btnRefresh')?.click(); }
    // Ctrl+Shift+R 强制刷新
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      const wv = tabs.getActiveWebview();
      if (wv) wv.reloadIgnoringCache();
    }
    // Ctrl+F 页面内查找
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      if (window.FBrowser.findBar) window.FBrowser.findBar.open();
    }
    // Escape 关闭查找栏
    if (e.key === 'Escape') {
      if (window.FBrowser.findBar) window.FBrowser.findBar.close();
    }
    // F12 DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      window.electronAPI.toggleDevTools?.();
    }
    // Ctrl+P 打印
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      window.electronAPI.printPage();
    }
    // Ctrl+Shift+P 命令面板
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      if (window.FBrowser?.commandPalette?.toggle) {
        window.FBrowser.commandPalette.toggle();
      }
    }
    // Ctrl++ 放大
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomCurrentTab(1);
    }
    // Ctrl+- 缩小
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      zoomCurrentTab(-1);
    }
    // Ctrl+0 重置缩放
    if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      zoomCurrentTab(0);
    }
    // Ctrl+Tab 切换标签页
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      const allTabs = tabs.tabs;
      if (allTabs.length <= 1) return;
      const curIdx = allTabs.findIndex(t => t.id === tabs.activeTabId);
      const nextIdx = e.shiftKey
        ? (curIdx - 1 + allTabs.length) % allTabs.length
        : (curIdx + 1) % allTabs.length;
      tabs.switchTab(allTabs[nextIdx].id);
    }
    // Ctrl+N 新窗口（发送到主进程）
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      // 暂不支持多窗口，改为新建标签页
      tabs.createTab();
    }
    // Ctrl+Shift+N 无痕窗口
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      const menuIncognito = document.getElementById('menuIncognito');
      if (menuIncognito) menuIncognito.click();
    }
    // Ctrl+Shift+B 切换书签栏
    if (e.ctrlKey && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      const bookmarkBar = document.getElementById('bookmarkBar');
      if (bookmarkBar) {
        const isVisible = bookmarkBar.classList.toggle('visible');
        localStorage.setItem('f-bookmark-bar', isVisible);
        window.FBrowser?.notify?.success(isVisible ? '已显示书签栏' : '已隐藏书签栏');
      }
    }
    // Ctrl+D 添加/取消书签
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      // 使用bookmarks模块的快速收藏功能
      if (window.FBrowser?.bookmarks?.quickBookmark) {
        window.FBrowser.bookmarks.quickBookmark();
      } else if (window.FBrowser?.bookmarks?.showBookmarkPanel) {
        window.FBrowser.bookmarks.showBookmarkPanel();
      }
    }
  });

  function zoomCurrentTab(direction) {
    const tab = window.FBrowser.tabs.getActiveTab();
    if (!tab || !tab.webview) return;
    if (direction === 0) {
      tab.zoomLevel = 0;
    } else {
      tab.zoomLevel = Math.max(-3, Math.min(3, (tab.zoomLevel || 0) + direction * 0.5));
    }
    tab.webview.setZoomLevel(tab.zoomLevel);
    // 更新缩放指示器
    if (window.FBrowser.findBar) {
      window.FBrowser.findBar.updateZoomIndicator(tab.zoomLevel);
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.shortcuts = { zoomCurrentTab };
})();
