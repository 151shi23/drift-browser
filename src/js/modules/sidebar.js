// ==================== 侧边栏面板 ====================
(function() {
  'use strict';

  const sidePanelEl = document.getElementById('sidePanel');

  function toggleSidePanel() {
    sidePanelEl.classList.toggle('open');
    const wvHost = document.getElementById('webviewHost');
    if (wvHost) wvHost.classList.toggle('shifted', sidePanelEl.classList.contains('open'));
    if (sidePanelEl.classList.contains('open')) {
      window.FBrowser.bookmarks.renderBookmarks();
      window.FBrowser.history.onSidebarOpen();
    }
  }

  function closeSidePanel() {
    sidePanelEl.classList.remove('open');
    const wvHost = document.getElementById('webviewHost');
    if (wvHost) wvHost.classList.remove('shifted');
  }

  const btnSidePanel = document.getElementById('btnSidePanel');
  if (btnSidePanel) btnSidePanel.addEventListener('click', toggleSidePanel);

  // 关闭按钮
  const btnCloseSidePanel = document.getElementById('btnCloseSidePanel');
  if (btnCloseSidePanel) btnCloseSidePanel.addEventListener('click', closeSidePanel);

  // 侧边栏标签页切换
  document.querySelectorAll('.sp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.panel === 'settings') {
        sidePanelEl.classList.remove('open');
        window.FBrowser.settings.openSettings();
        return;
      }
      document.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sp-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const panelId = tab.dataset.panel.charAt(0).toUpperCase() + tab.dataset.panel.slice(1);
      document.getElementById(`panel${panelId}`).classList.add('active');
    });
  });

  /**
   * 打开侧边栏并切换到指定面板
   * @param {string} panel - 面板名称: 'bookmarks' | 'history' | 'settings'
   */
  function openSidePanel(panel) {
    if (!sidePanelEl.classList.contains('open')) {
      sidePanelEl.classList.add('open');
      const wvHost = document.getElementById('webviewHost');
      if (wvHost) wvHost.classList.add('shifted');
    }
    if (panel) {
      const tab = document.querySelector(`.sp-tab[data-panel="${panel}"]`);
      if (tab) tab.click();
    } else {
      // 默认刷新书签/历史数据
      try { window.FBrowser.bookmarks.renderBookmarks(); } catch(e) {}
      try { window.FBrowser.history.onSidebarOpen(); } catch(e) {}
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.sidebar = { toggleSidePanel, openSidePanel };
})();
