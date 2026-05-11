// ==================== Edge 数据导入 UI ====================
(function() {
  'use strict';

  const btnImportEdge = document.getElementById('btnImportEdge');
  if (!btnImportEdge) return;
  btnImportEdge.addEventListener('click', async () => {
    const btn = document.getElementById('btnImportEdge');
    const resultEl = document.getElementById('importResult');
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" class="spin"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="20 15" stroke-linecap="round"/></svg> 导入中...';
    resultEl.style.display = 'none';

    try {
      const result = await window.electronAPI.importEdgeData();

      if (!result.success) {
        showImportResult(resultEl, false, result.error);
        return;
      }

      let bmCount = 0, hiCount = 0;

      // 合并书签
      if (result.bookmarks && result.bookmarks.length) {
        const existingUrls = new Set(window.FBrowser.data.getBookmarks().map(b => b.url));
        result.bookmarks.forEach(b => {
          if (!existingUrls.has(b.url)) {
            window.FBrowser.data.getBookmarks().push({ url: b.url, title: b.title || b.url });
            existingUrls.add(b.url);
            bmCount++;
          }
        });
        window.FBrowser.data.saveBookmarks();
        window.FBrowser.bookmarks.renderBookmarks();
        window.FBrowser.bookmarks.updateBookmarkBtn();
      }

      // 合并历史
      if (result.history && result.history.length) {
        const existingUrls = new Set(window.FBrowser.data.getHistory().map(h => h.url));
        const newItems = [];
        result.history.forEach(h => {
          if (!existingUrls.has(h.url)) {
            newItems.push({ url: h.url, title: h.title || h.url, time: h.time || Date.now() });
            existingUrls.add(h.url);
            hiCount++;
          }
        });
        const merged = [...newItems, ...window.FBrowser.data.getHistory()];
        if (merged.length > 500) merged.length = 500;
        window.FBrowser.data.getHistory().length = 0;
        window.FBrowser.data.getHistory().push(...merged);
        window.FBrowser.data.saveHistory();
        window.FBrowser.history.renderHistory();
      }

      if (bmCount === 0 && hiCount === 0) {
        showImportResult(resultEl, false, '没有发现可导入的新数据，所有书签和历史已存在。');
      } else {
        const parts = [];
        if (bmCount) parts.push(`书签 ${bmCount} 条`);
        if (hiCount) parts.push(`历史 ${hiCount} 条`);
        showImportResult(resultEl, true, `成功导入 ${parts.join('，')}。`);
      }
    } catch (e) {
      showImportResult(resultEl, false, '导入过程中发生错误：' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v8M4 6l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> 导入';
    }
  });

  function showImportResult(el, success, msg) {
    el.style.display = 'block';
    el.className = 'import-result ' + (success ? 'success' : 'error');
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16">${success
        ? '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 8l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
      }</svg>
      <span>${window.FBrowser.data.escHtml(msg)}</span>
    `;
  }
})();
