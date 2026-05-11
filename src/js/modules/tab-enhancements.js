// ==================== 标签页增强功能 ====================
// 1. Ctrl+Shift+T 恢复关闭标签
// 2. 标签页拖拽排序
// 3. 标签页固定(Pin)和静音(Mute)
// 4. 标签页中键/双击关闭
// 5. Ctrl+1~9 快速切换标签
// 6. Favicon 显示
(function() {
  'use strict';

  // ===== 1. 恢复关闭标签 =====
  const MAX_RECENTLY_CLOSED = 20;
  let recentlyClosed = [];

  function pushClosedTab(tabData) {
    recentlyClosed.unshift(tabData);
    if (recentlyClosed.length > MAX_RECENTLY_CLOSED) {
      recentlyClosed = recentlyClosed.slice(0, MAX_RECENTLY_CLOSED);
    }
  }

  function reopenLastTab() {
    if (recentlyClosed.length === 0) return;
    const data = recentlyClosed.shift();
    if (data.url) {
      window.FBrowser.tabs.createTab(data.url);
    } else {
      window.FBrowser.tabs.createTab();
    }
  }

  function getRecentlyClosed() {
    return recentlyClosed;
  }

  // ===== 2. 标签页拖拽排序 =====
  let dragTabId = null;
  let dragIndicator = null;

  function initDragSort() {
    const tabStrip = document.getElementById('tabStrip');
    if (!tabStrip) return;

    tabStrip.addEventListener('dragstart', onDragStart);
    tabStrip.addEventListener('dragover', onDragOver);
    tabStrip.addEventListener('drop', onDrop);
    tabStrip.addEventListener('dragend', onDragEnd);
  }

  function onDragStart(e) {
    const tabEl = e.target.closest('.tab-item');
    if (!tabEl) return;
    dragTabId = parseInt(tabEl.dataset.id);
    tabEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragTabId);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const tabStrip = document.getElementById('tabStrip');
    const tabEl = e.target.closest('.tab-item');
    if (!tabEl || parseInt(tabEl.dataset.id) === dragTabId) return;

    // 显示拖拽指示器
    ensureDragIndicator();
    const rect = tabEl.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (e.clientX < midX) {
      tabStrip.insertBefore(dragIndicator, tabEl);
    } else {
      tabStrip.insertBefore(dragIndicator, tabEl.nextSibling);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const targetTabEl = e.target.closest('.tab-item');
    if (!targetTabEl || dragTabId === null) return;

    const targetId = parseInt(targetTabEl.dataset.id);
    if (targetId === dragTabId) return;

    // 重新排列 tabs 数组
    const tabs = window.FBrowser.tabs.tabs;
    const fromIdx = tabs.findIndex(t => t.id === dragTabId);
    const toIdx = tabs.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [movedTab] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, movedTab);

    // 重新排列 DOM
    const tabStrip = document.getElementById('tabStrip');
    const draggedEl = tabStrip.querySelector(`.tab-item[data-id="${dragTabId}"]`);
    const targetEl = tabStrip.querySelector(`.tab-item[data-id="${targetId}"]`);

    if (draggedEl && targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        tabStrip.insertBefore(draggedEl, targetEl);
      } else {
        tabStrip.insertBefore(draggedEl, targetEl.nextSibling);
      }
    }

    removeDragIndicator();
  }

  function onDragEnd(e) {
    dragTabId = null;
    const tabStrip = document.getElementById('tabStrip');
    tabStrip?.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    removeDragIndicator();
  }

  function ensureDragIndicator() {
    if (!dragIndicator) {
      dragIndicator = document.createElement('div');
      dragIndicator.className = 'tab-drag-indicator';
    }
  }

  function removeDragIndicator() {
    if (dragIndicator && dragIndicator.parentNode) {
      dragIndicator.parentNode.removeChild(dragIndicator);
    }
  }

  // ===== 3. 标签页固定(Pin)和静音(Mute) =====
  function pinTab(tabId) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.pinned = !tab.pinned;
    const tabEl = tab.element;
    if (tab.pinned) {
      tabEl.classList.add('pinned');
      tabEl.querySelector('.tab-title').textContent = '';
    } else {
      tabEl.classList.remove('pinned');
      if (tab.webview) {
        try {
          tabEl.querySelector('.tab-title').textContent = tab.webview.getTitle() || '加载中...';
        } catch(e) {
          tabEl.querySelector('.tab-title').textContent = '加载中...';
        }
      }
    }
    updateTabPinnedState(tabId);
  }

  function updateTabPinnedState(tabId) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const tabEl = tab.element;
    if (tab.pinned) {
      tabEl.classList.add('pinned');
    } else {
      tabEl.classList.remove('pinned');
    }
  }

  function muteTab(tabId) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.muted = !tab.muted;
    const tabEl = tab.element;
    if (tab.muted) {
      tabEl.classList.add('muted');
    } else {
      tabEl.classList.remove('muted');
    }

    // 通过 webview API 静音
    if (tab.webview) {
      try {
        const wcId = tab.webview.getWebContentsId();
        if (wcId) {
          window.electronAPI.setWebviewMuted?.(wcId, tab.muted);
        }
      } catch(e) {}
    }
  }

  function isTabPinned(tabId) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    return tab?.pinned || false;
  }

  function isTabMuted(tabId) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    return tab?.muted || false;
  }

  // ===== 4. 中键/双击关闭 =====
  function initTabMouseEvents() {
    const tabStrip = document.getElementById('tabStrip');
    if (!tabStrip) return;

    // 中键关闭
    tabStrip.addEventListener('auxclick', e => {
      if (e.button === 1) {
        const tabEl = e.target.closest('.tab-item');
        if (tabEl) {
          e.preventDefault();
          const tabId = parseInt(tabEl.dataset.id);
          // 固定标签不允许中键关闭
          if (!isTabPinned(tabId)) {
            window.FBrowser.tabs.closeTab(tabId);
          }
        }
      }
    });

    // 双击关闭（可配置：双击固定/取消固定）
    tabStrip.addEventListener('dblclick', e => {
      const tabEl = e.target.closest('.tab-item');
      if (tabEl && !e.target.closest('.tab-close')) {
        const tabId = parseInt(tabEl.dataset.id);
        if (isTabPinned(tabId)) {
          pinTab(tabId); // 双击固定标签取消固定
        } else {
          window.FBrowser.tabs.closeTab(tabId);
        }
      }
    });
  }

  // ===== 5. Favicon 显示 =====
  function setupFaviconCapture() {
    // 监听 webview 的 page-favicon-updated 事件
    // 在 tabs.js 的 bindWebviewEvents 中已经添加了相关逻辑
  }

  function updateTabFavicon(tabId, favicons) {
    const tabs = window.FBrowser.tabs.tabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (favicons && favicons.length > 0) {
      tab.favicon = favicons[0];
      const tabEl = tab.element;
      let faviconEl = tabEl.querySelector('.tab-favicon');
      if (!faviconEl) {
        faviconEl = document.createElement('img');
        faviconEl.className = 'tab-favicon';
        const titleEl = tabEl.querySelector('.tab-title');
        tabEl.insertBefore(faviconEl, titleEl);
      }
      faviconEl.src = favicons[0];
      faviconEl.onerror = () => { faviconEl.style.display = 'none'; };
      faviconEl.onload = () => { faviconEl.style.display = ''; };
    }
  }

  // ===== 6. Ctrl+1~9 快速切换标签 =====
  function switchToTabByIndex(index) {
    const tabs = window.FBrowser.tabs.tabs;
    if (index === 8) {
      // Ctrl+9 切换到最后一个标签
      if (tabs.length > 0) {
        window.FBrowser.tabs.switchTab(tabs[tabs.length - 1].id);
      }
    } else if (index < tabs.length) {
      window.FBrowser.tabs.switchTab(tabs[index].id);
    }
  }

  // ===== 初始化 =====
  function init() {
    initDragSort();
    initTabMouseEvents();
    setupFaviconCapture();

    // 给现有标签添加 draggable
    const tabStrip = document.getElementById('tabStrip');
    if (tabStrip) {
      tabStrip.querySelectorAll('.tab-item').forEach(el => {
        el.setAttribute('draggable', 'true');
      });
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.tabEnhancements = {
    pushClosedTab, reopenLastTab, getRecentlyClosed,
    pinTab, muteTab, isTabPinned, isTabMuted,
    updateTabFavicon, switchToTabByIndex,
    init,
  };
})();
