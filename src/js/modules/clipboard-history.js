// ==================== 剪贴板历史模块 ====================
// 记录复制内容，快速粘贴
(function() {
  'use strict';

  const MAX_HISTORY = 50;
  let history = JSON.parse(localStorage.getItem('f-clipboard-history') || '[]');
  let panelVisible = false;
  let panelEl = null;

  function getHistory() {
    return history;
  }

  function addItem(text) {
    if (!text || text.trim().length === 0) return;
    text = text.trim();
    // 去重
    history = history.filter(h => h.text !== text);
    history.unshift({ text, time: Date.now() });
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    saveHistory();
  }

  function removeItem(index) {
    history.splice(index, 1);
    saveHistory();
  }

  function clearHistory() {
    history = [];
    saveHistory();
  }

  function saveHistory() {
    localStorage.setItem('f-clipboard-history', JSON.stringify(history));
  }

  // 监听剪贴板变化（通过主进程）
  function startWatching() {
    window.electronAPI.onClipboardChanged?.((text) => {
      addItem(text);
    });
  }

  function togglePanel() {
    if (panelVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function showPanel() {
    ensurePanel();
    panelEl.classList.add('visible');
    panelVisible = true;
    renderPanel();
  }

  function hidePanel() {
    ensurePanel();
    panelEl.classList.remove('visible');
    panelVisible = false;
  }

  function ensurePanel() {
    if (!panelEl) {
      panelEl = document.getElementById('clipboardHistoryPanel');
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'clipboardHistoryPanel';
      panelEl.className = 'clipboard-history-panel';
      document.body.appendChild(panelEl);
    }
  }

  function renderPanel() {
    ensurePanel();
    if (history.length === 0) {
      panelEl.innerHTML = `
        <div class="ch-header">
          <span>剪贴板历史</span>
          <button class="ch-close" title="关闭">✕</button>
        </div>
        <div class="ch-empty">暂无记录</div>
      `;
    } else {
      panelEl.innerHTML = `
        <div class="ch-header">
          <span>剪贴板历史</span>
          <div class="ch-actions">
            <button class="ch-clear" title="清空">清空</button>
            <button class="ch-close" title="关闭">✕</button>
          </div>
        </div>
        <div class="ch-list">
          ${history.map((h, i) => `
            <div class="ch-item" data-index="${i}">
              <span class="ch-text">${window.FBrowser.data.escHtml(h.text.substring(0, 100))}</span>
              <span class="ch-time">${formatTime(h.time)}</span>
              <button class="ch-paste" data-index="${i}" title="粘贴">📋</button>
              <button class="ch-delete" data-index="${i}" title="删除">✕</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 绑定事件
    panelEl.querySelector('.ch-close')?.addEventListener('click', hidePanel);
    panelEl.querySelector('.ch-clear')?.addEventListener('click', () => {
      clearHistory();
      renderPanel();
    });

    panelEl.querySelectorAll('.ch-paste').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (history[idx]) {
          pasteToPage(history[idx].text);
        }
      });
    });

    panelEl.querySelectorAll('.ch-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        removeItem(idx);
        renderPanel();
      });
    });

    panelEl.querySelectorAll('.ch-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        if (history[idx]) {
          pasteToPage(history[idx].text);
        }
      });
    });
  }

  function pasteToPage(text) {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (wv) {
      wv.insertText(text).catch(() => {
        // 回退：设置剪贴板内容并执行粘贴命令
        navigator.clipboard.writeText(text).then(() => {
          wv.paste();
        }).catch(() => {});
      });
    }
    hidePanel();
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.clipboardHistory = {
    getHistory, addItem, removeItem, clearHistory,
    togglePanel, showPanel, hidePanel, startWatching,
  };
})();
