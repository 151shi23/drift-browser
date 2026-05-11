// ==================== 历史记录模块 ====================
(function() {
  'use strict';

  const historyListEl = document.getElementById('historyList');
  const historySearchEl = document.getElementById('historySearch');

  function renderHistory(filter) {
    const history = filter
      ? window.FBrowser.data.searchHistory(filter)
      : window.FBrowser.data.getHistory();

    if (!historyListEl) return;
    historyListEl.innerHTML = '';
    if (history.length === 0) {
      historyListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--fg-2);font-size:12px">暂无历史记录</div>';
      return;
    }
    let lastDate = '';
    history.forEach((h, i) => {
      const d = new Date(h.time);
      const dateStr = d.toLocaleDateString('zh-CN');
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        const sep = document.createElement('div');
        sep.style.cssText = 'padding:8px 4px 4px;font-size:11px;color:var(--fg-2);font-weight:600';
        sep.textContent = dateStr;
        historyListEl.appendChild(sep);
      }
      const el = document.createElement('div');
      el.className = 'sp-item';
      el.innerHTML = `
        <span class="sp-item-text">${window.FBrowser.data.escHtml(h.title)}</span>
        <span class="sp-item-del" data-idx="${i}"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg></span>
      `;
      el.querySelector('.sp-item-text').addEventListener('click', () => window.FBrowser.navigation.navigateTo(h.url));
      el.querySelector('.sp-item-del').addEventListener('click', e => {
        e.stopPropagation();
        const allHistory = window.FBrowser.data.getHistory();
        allHistory.splice(i, 1);
        window.FBrowser.data.saveHistory();
        renderHistory(filter);
      });
      historyListEl.appendChild(el);
    });
  }

  // 历史搜索
  if (historySearchEl) {
    historySearchEl.addEventListener('input', () => {
      renderHistory(historySearchEl.value.trim());
    });
  }

  // 清空历史（侧边栏）
  const btnClearHist = document.getElementById('btnClearHistory');
  if (btnClearHist) {
    btnClearHist.addEventListener('click', () => {
      window.FBrowser.data.clearHistoryData();
      renderHistory();
    });
  }

  function onSidebarOpen() {
    renderHistory();
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.history = { renderHistory, onSidebarOpen };
})();
