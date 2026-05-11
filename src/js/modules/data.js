// ==================== 数据层：书签 / 历史 / 站点 ====================
(function() {
  'use strict';

  const escHtml = (s) => {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  };

  // ---- 书签 ----
  let bookmarks = [];
  let bookmarkChangeCallbacks = [];
  try {
    bookmarks = JSON.parse(localStorage.getItem('f-bookmarks') || '[]');
    if (!Array.isArray(bookmarks)) bookmarks = [];
  } catch (e) {
    bookmarks = [];
  }

  function getBookmarks() { return bookmarks; }

  function saveBookmarks() {
    localStorage.setItem('f-bookmarks', JSON.stringify(bookmarks));
    // 通知书签变化监听器
    bookmarkChangeCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
  }

  function onBookmarksChange(callback) {
    if (typeof callback === 'function') {
      bookmarkChangeCallbacks.push(callback);
    }
  }

  function addBookmark(url, title) {
    const idx = bookmarks.findIndex(b => b.url === url);
    if (idx >= 0) {
      bookmarks.splice(idx, 1);
      saveBookmarks();
      return false;
    } else {
      bookmarks.push({ url, title });
      saveBookmarks();
      return true;
    }
  }

  function clearBookmarks() {
    bookmarks = [];
    saveBookmarks();
  }

  function isUrlBookmarked(url) {
    return bookmarks.some(b => b.url === url);
  }

  // ---- 历史 ----
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('f-history') || '[]');
    if (!Array.isArray(history)) history = [];
  } catch (e) {
    history = [];
  }

  function getHistory() { return history; }

  function saveHistory() {
    localStorage.setItem('f-history', JSON.stringify(history));
  }

  function addHistory(url, title) {
    // 无痕模式下不保存历史记录
    if (window.isIncognitoMode) return;
    if (!url || url === 'about:blank') return;
    if (history.length > 0 && history[0].url === url) return;
    history.unshift({ url, title: title || url, time: Date.now() });
    if (history.length > 500) history = history.slice(0, 500);
    saveHistory();
  }

  function clearHistoryData() {
    history = [];
    saveHistory();
  }

  function searchHistory(query) {
    if (!query) return history;
    const q = query.toLowerCase();
    return history.filter(h =>
      (h.title || '').toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
    );
  }

  // ---- 主页站点 ----
  let sites = [];
  try {
    const stored = localStorage.getItem('f-sites');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) sites = parsed;
    }
  } catch (e) {}
  if (sites.length === 0) sites = [
    { name: 'B站', url: 'https://www.bilibili.com', color: '#fb7299' },
    { name: '知乎', url: 'https://www.zhihu.com', color: '#0066ff' },
    { name: 'GitHub', url: 'https://github.com', color: '#8b5cf6' },
    { name: 'YouTube', url: 'https://www.youtube.com', color: '#ef4444' },
    { name: 'X', url: 'https://twitter.com', color: '#1d9bf0' },
    { name: '豆瓣', url: 'https://www.douban.com', color: '#16a34a' },
    { name: '淘宝', url: 'https://www.taobao.com', color: '#f97316' },
    { name: '微博', url: 'https://weibo.com', color: '#e11d48' },
  ];

  function getSites() { return sites; }

  function saveSites() {
    localStorage.setItem('f-sites', JSON.stringify(sites));
  }

  function addSite(name, url, color) {
    sites.push({
      name,
      url: url.startsWith('http') ? url : 'https://' + url,
      color: color || '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
    });
    saveSites();
  }

  function removeSite(index) {
    sites.splice(index, 1);
    saveSites();
  }

  // URL 自动补全建议
  function getUrlSuggestions(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    const seen = new Set();

    // 从书签匹配
    bookmarks.forEach(b => {
      if (seen.has(b.url)) return;
      if (b.url.toLowerCase().includes(q) || (b.title || '').toLowerCase().includes(q)) {
        results.push({ url: b.url, title: b.title || b.url, type: 'bookmark' });
        seen.add(b.url);
      }
    });

    // 从历史匹配
    history.forEach(h => {
      if (seen.has(h.url)) return;
      if (h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q)) {
        results.push({ url: h.url, title: h.title || h.url, type: 'history' });
        seen.add(h.url);
      }
    });

    return results.slice(0, 8);
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.data = {
    escHtml,
    getBookmarks, addBookmark, clearBookmarks, saveBookmarks, isUrlBookmarked, onBookmarksChange,
    getHistory, addHistory, clearHistoryData, saveHistory, searchHistory,
    getSites, saveSites, addSite, removeSite,
    getUrlSuggestions,
  };
})();
