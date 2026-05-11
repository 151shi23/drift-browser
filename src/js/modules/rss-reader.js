// ==================== RSS 订阅器模块 ====================
// 内置 RSS 阅读器
(function() {
  'use strict';

  let feeds = JSON.parse(localStorage.getItem('f-rss-feeds') || '[]');
  let articles = JSON.parse(localStorage.getItem('f-rss-articles') || '{}');
  let panelEl = null;

  function getFeeds() {
    return feeds;
  }

  function addFeed(url, name) {
    if (feeds.some(f => f.url === url)) return false;
    feeds.push({
      id: Date.now().toString(36),
      url,
      name: name || url,
      lastFetched: 0,
    });
    saveFeeds();
    refreshFeed(feeds[feeds.length - 1].id);
    return true;
  }

  function removeFeed(feedId) {
    feeds = feeds.filter(f => f.id !== feedId);
    delete articles[feedId];
    saveFeeds();
    saveArticles();
  }

  function saveFeeds() {
    localStorage.setItem('f-rss-feeds', JSON.stringify(feeds));
  }

  function saveArticles() {
    localStorage.setItem('f-rss-articles', JSON.stringify(articles));
  }

  // 解析 RSS XML
  function parseRSS(xmlText, feedUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const items = [];
    // RSS 2.0
    const rssItems = doc.querySelectorAll('item');
    if (rssItems.length > 0) {
      rssItems.forEach(item => {
        items.push({
          title: item.querySelector('title')?.textContent || '',
          link: item.querySelector('link')?.textContent || '',
          description: item.querySelector('description')?.textContent || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
          author: item.querySelector('author')?.textContent || '',
        });
      });
    }

    // Atom
    const atomEntries = doc.querySelectorAll('entry');
    if (atomEntries.length > 0 && items.length === 0) {
      atomEntries.forEach(entry => {
        const link = entry.querySelector('link[href]');
        items.push({
          title: entry.querySelector('title')?.textContent || '',
          link: link?.getAttribute('href') || '',
          description: entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || '',
          pubDate: entry.querySelector('updated')?.textContent || entry.querySelector('published')?.textContent || '',
          author: entry.querySelector('author > name')?.textContent || '',
        });
      });
    }

    return items;
  }

  // 刷新 RSS 源
  async function refreshFeed(feedId) {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    try {
      // 通过主进程代理请求（CORS 限制）
      const result = await window.electronAPI?.fetchUrl?.(feed.url);
      if (result && result.body) {
        const items = parseRSS(result.body, feed.url);
        articles[feedId] = items.map(item => ({
          ...item,
          read: false,
          fetchedAt: Date.now(),
        }));
        feed.lastFetched = Date.now();
        saveFeeds();
        saveArticles();
      }
    } catch(e) {
      console.error('[RSS] 刷新失败:', feed.name, e);
    }
  }

  // 刷新所有源
  async function refreshAll() {
    for (const feed of feeds) {
      await refreshFeed(feed.id);
    }
  }

  // 获取文章列表
  function getArticles(feedId) {
    return articles[feedId] || [];
  }

  function getAllArticles() {
    return articles;
  }

  // 标记已读
  function markArticleRead(feedId, index) {
    if (articles[feedId] && articles[feedId][index]) {
      articles[feedId][index].read = true;
      saveArticles();
    }
  }

  // 面板
  function togglePanel() {
    if (panelEl && panelEl.classList.contains('visible')) {
      panelEl.classList.remove('visible');
    } else {
      ensurePanel();
      renderPanel();
      panelEl.classList.add('visible');
    }
  }

  function ensurePanel() {
    if (!panelEl) {
      panelEl = document.getElementById('rssPanel');
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'rssPanel';
      panelEl.className = 'rss-panel';
      document.body.appendChild(panelEl);
    }
  }

  function renderPanel() {
    ensurePanel();

    let currentFeedId = null;
    const totalUnread = feeds.reduce((sum, f) => {
      return sum + (articles[f.id] || []).filter(a => !a.read).length;
    }, 0);

    panelEl.innerHTML = `
      <div class="rss-header">
        <span>RSS 订阅${totalUnread > 0 ? ' (' + totalUnread + ')' : ''}</span>
        <div class="rss-actions">
          <button class="rss-refresh" title="刷新全部">🔄</button>
          <button class="rss-add" title="添加订阅">+</button>
          <button class="rss-close">✕</button>
        </div>
      </div>
      <div class="rss-body">
        <div class="rss-feeds">
          ${feeds.length === 0 ? '<div class="rss-empty">暂无订阅<br>点击 + 添加 RSS 源</div>' :
            feeds.map(f => `
              <div class="rss-feed-item" data-id="${f.id}">
                <span class="rss-feed-name">${window.FBrowser.data.escHtml(f.name)}</span>
                <span class="rss-feed-count">${(articles[f.id] || []).filter(a => !a.read).length}</span>
                <button class="rss-feed-del" data-id="${f.id}">✕</button>
              </div>
            `).join('')
          }
        </div>
        <div class="rss-articles" id="rssArticleList">
          <div class="rss-empty">选择一个订阅源</div>
        </div>
      </div>
    `;

    panelEl.querySelector('.rss-close')?.addEventListener('click', () => panelEl.classList.remove('visible'));
    panelEl.querySelector('.rss-add')?.addEventListener('click', () => {
      const url = prompt('输入 RSS 源地址:');
      if (url) {
        const name = prompt('输入名称 (可选):') || '';
        addFeed(url, name);
        renderPanel();
      }
    });
    panelEl.querySelector('.rss-refresh')?.addEventListener('click', async () => {
      panelEl.querySelector('.rss-refresh').textContent = '⏳';
      await refreshAll();
      renderPanel();
    });

    panelEl.querySelectorAll('.rss-feed-item').forEach(item => {
      item.addEventListener('click', () => {
        const feedId = item.dataset.id;
        showFeedArticles(feedId);
      });
    });

    panelEl.querySelectorAll('.rss-feed-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        removeFeed(btn.dataset.id);
        renderPanel();
      });
    });
  }

  function showFeedArticles(feedId) {
    const feed = feeds.find(f => f.id === feedId);
    const items = getArticles(feedId);
    const articleList = document.getElementById('rssArticleList');
    if (!articleList) return;

    articleList.innerHTML = `
      <div class="rss-feed-title">${window.FBrowser.data.escHtml(feed?.name || '')}</div>
      ${items.length === 0 ? '<div class="rss-empty">暂无文章</div>' :
        items.map((a, i) => `
          <div class="rss-article ${a.read ? 'read' : ''}" data-feed="${feedId}" data-index="${i}">
            <div class="rss-article-title">${window.FBrowser.data.escHtml(a.title)}</div>
            <div class="rss-article-meta">
              <span>${a.author || ''}</span>
              <span>${a.pubDate ? new Date(a.pubDate).toLocaleDateString('zh-CN') : ''}</span>
            </div>
          </div>
        `).join('')
      }
    `;

    articleList.querySelectorAll('.rss-article').forEach(el => {
      el.addEventListener('click', () => {
        const fId = el.dataset.feed;
        const idx = parseInt(el.dataset.index);
        markArticleRead(fId, idx);
        const article = articles[fId]?.[idx];
        if (article && article.link) {
          window.FBrowser.navigation.navigateTo(article.link);
        }
        panelEl.classList.remove('visible');
      });
    });
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.rss = {
    getFeeds, addFeed, removeFeed, refreshFeed, refreshAll,
    getArticles, getAllArticles, markArticleRead, togglePanel,
  };
})();
