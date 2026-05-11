// ==================== 书签模块 ====================
(function() {
  'use strict';

  const bookmarkListEl = document.getElementById('bookmarkList');
  const urlBarEl = document.getElementById('urlBar');
  const btnBookmarkEl = document.getElementById('btnBookmark');

  // 收藏面板相关
  let bookmarkPanelEl = null;
  let isEditingBookmark = false;

  function updateBookmarkBtn() {
    const url = urlBarEl?.value;
    if (!btnBookmarkEl) return;
    const isBookmarked = window.FBrowser.data.isUrlBookmarked(url);
    btnBookmarkEl.classList.toggle('bookmarked', isBookmarked);
    
    // 更新按钮图标
    if (isBookmarked) {
      btnBookmarkEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    } else {
      btnBookmarkEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    }
  }

  function renderBookmarks() {
    const bookmarks = window.FBrowser.data.getBookmarks();
    if (!bookmarkListEl) return;
    bookmarkListEl.innerHTML = '';
    if (bookmarks.length === 0) {
      bookmarkListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--fg-2);font-size:12px">暂无书签</div>';
      return;
    }
    bookmarks.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'sp-item';
      el.innerHTML = `
        <span class="sp-item-text">${window.FBrowser.data.escHtml(b.title || b.url)}</span>
        <span class="sp-item-del" data-idx="${i}"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg></span>
      `;
      el.querySelector('.sp-item-text').addEventListener('click', () => window.FBrowser.navigation.navigateTo(b.url));
      el.querySelector('.sp-item-del').addEventListener('click', e => {
        e.stopPropagation();
        const bookmarks = window.FBrowser.data.getBookmarks();
        bookmarks.splice(i, 1);
        window.FBrowser.data.saveBookmarks();
        renderBookmarks();
        updateBookmarkBtn();
      });
      bookmarkListEl.appendChild(el);
    });
  }

  // 创建收藏面板（Edge风格）
  function createBookmarkPanel() {
    if (bookmarkPanelEl) return;
    
    bookmarkPanelEl = document.createElement('div');
    bookmarkPanelEl.id = 'bookmarkPanel';
    bookmarkPanelEl.className = 'bookmark-panel';
    bookmarkPanelEl.innerHTML = `
      <div class="bm-panel-header">
        <span class="bm-panel-title">添加到收藏夹</span>
        <button class="bm-panel-close" id="btnCloseBookmarkPanel">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
      <div class="bm-panel-content">
        <div class="bm-field">
          <label>名称</label>
          <input type="text" id="bmPanelName" class="bm-input" placeholder="页面名称">
        </div>
        <div class="bm-field">
          <label>文件夹</label>
          <select id="bmPanelFolder" class="bm-select">
            <option value="favorites">收藏夹</option>
            <option value="other">其他收藏夹</option>
          </select>
        </div>
        <div class="bm-field">
          <label>网址</label>
          <input type="text" id="bmPanelUrl" class="bm-input bm-url" readonly>
        </div>
      </div>
      <div class="bm-panel-footer">
        <button class="bm-btn bm-btn-cancel" id="bmPanelCancel">取消</button>
        <button class="bm-btn bm-btn-save" id="bmPanelSave">保存</button>
      </div>
    `;
    document.body.appendChild(bookmarkPanelEl);

    // 绑定事件
    document.getElementById('btnCloseBookmarkPanel')?.addEventListener('click', hideBookmarkPanel);
    document.getElementById('bmPanelCancel')?.addEventListener('click', hideBookmarkPanel);
    document.getElementById('bmPanelSave')?.addEventListener('click', saveBookmarkFromPanel);

    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (bookmarkPanelEl && bookmarkPanelEl.classList.contains('visible') && 
          !bookmarkPanelEl.contains(e.target) && 
          !btnBookmarkEl?.contains(e.target)) {
        hideBookmarkPanel();
      }
    });
  }

  // 显示收藏面板
  function showBookmarkPanel() {
    if (!bookmarkPanelEl) createBookmarkPanel();
    
    const url = urlBarEl?.value || '';
    const title = document.querySelector('.tab-item.active .tab-title')?.textContent || url;
    
    // 检查是否已收藏
    const isBookmarked = window.FBrowser.data.isUrlBookmarked(url);
    
    if (isBookmarked) {
      // 已收藏，显示编辑面板或提示
      window.FBrowser?.notify?.info('此页面已在收藏夹中');
      return;
    }

    // 设置面板内容
    const nameInput = document.getElementById('bmPanelName');
    const urlInput = document.getElementById('bmPanelUrl');
    if (nameInput) nameInput.value = title;
    if (urlInput) urlInput.value = url;

    // 定位面板
    const btnRect = btnBookmarkEl?.getBoundingClientRect();
    if (btnRect) {
      bookmarkPanelEl.style.top = (btnRect.bottom + 8) + 'px';
      bookmarkPanelEl.style.right = (window.innerWidth - btnRect.right) + 'px';
    }

    bookmarkPanelEl.classList.add('visible');
    isEditingBookmark = true;
    
    // 聚焦名称输入框
    setTimeout(() => {
      document.getElementById('bmPanelName')?.focus();
      document.getElementById('bmPanelName')?.select();
    }, 100);
  }

  // 隐藏收藏面板
  function hideBookmarkPanel() {
    if (bookmarkPanelEl) {
      bookmarkPanelEl.classList.remove('visible');
    }
    isEditingBookmark = false;
  }

  // 从面板保存书签
  function saveBookmarkFromPanel() {
    const nameInput = document.getElementById('bmPanelName');
    const urlInput = document.getElementById('bmPanelUrl');
    
    const name = nameInput?.value?.trim();
    const url = urlInput?.value?.trim();
    
    if (!url) {
      window.FBrowser?.notify?.warning('网址不能为空');
      return;
    }

    window.FBrowser.data.addBookmark(url, name || url);
    renderBookmarks();
    updateBookmarkBtn();
    hideBookmarkPanel();
    window.FBrowser?.notify?.success('已添加到收藏夹');
  }

  // 收藏按钮点击
  if (btnBookmarkEl) {
    btnBookmarkEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = urlBarEl?.value;
      if (!url) return;
      
      const isBookmarked = window.FBrowser.data.isUrlBookmarked(url);
      if (isBookmarked) {
        // 已收藏，取消收藏
        const bookmarks = window.FBrowser.data.getBookmarks();
        const idx = bookmarks.findIndex(b => b.url === url);
        if (idx >= 0) {
          bookmarks.splice(idx, 1);
          window.FBrowser.data.saveBookmarks();
          renderBookmarks();
          updateBookmarkBtn();
          window.FBrowser?.notify?.info('已从收藏夹移除');
        }
      } else {
        // 未收藏，显示收藏面板
        showBookmarkPanel();
      }
    });
  }

  // 清空书签（侧边栏）
  const btnClearBm = document.getElementById('btnClearBookmarks');
  if (btnClearBm) {
    btnClearBm.addEventListener('click', () => {
      window.FBrowser.data.clearBookmarks();
      renderBookmarks();
      updateBookmarkBtn();
    });
  }

  /**
   * 添加书签（供右键菜单等外部调用）
   */
  function addBookmark(url, title) {
    if (!url) return;
    window.FBrowser.data.addBookmark(url, title || url);
    renderBookmarks();
    updateBookmarkBtn();
  }

  /**
   * 快速收藏（不显示面板，直接添加）
   */
  function quickBookmark() {
    const url = urlBarEl?.value;
    if (!url) return;
    
    const isBookmarked = window.FBrowser.data.isUrlBookmarked(url);
    if (isBookmarked) {
      // 已收藏，取消收藏
      const bookmarks = window.FBrowser.data.getBookmarks();
      const idx = bookmarks.findIndex(b => b.url === url);
      if (idx >= 0) {
        bookmarks.splice(idx, 1);
        window.FBrowser.data.saveBookmarks();
        renderBookmarks();
        updateBookmarkBtn();
        window.FBrowser?.notify?.info('已从收藏夹移除');
      }
    } else {
      // 未收藏，快速添加
      const title = document.querySelector('.tab-item.active .tab-title')?.textContent || url;
      window.FBrowser.data.addBookmark(url, title);
      renderBookmarks();
      updateBookmarkBtn();
      window.FBrowser?.notify?.success('已添加到收藏夹');
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.bookmarks = { 
    updateBookmarkBtn, 
    renderBookmarks, 
    addBookmark,
    quickBookmark,
    showBookmarkPanel,
    hideBookmarkPanel
  };
})();
