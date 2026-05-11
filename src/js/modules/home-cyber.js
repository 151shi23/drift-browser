// ==================== Dashboard 主页功能 ====================
(function () {
  'use strict';

  // ---- 时钟 ----
  const dashTimeEl = document.getElementById('dashTime');
  const dashDateEl = document.getElementById('dashDate');
  const dashWeekdayEl = document.getElementById('dashWeekday');
  const dashGreetingEl = document.getElementById('dashGreeting');

  function updateClock() {
    if (!dashTimeEl) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    dashTimeEl.textContent = h + ':' + m;

    if (dashDateEl) {
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dashDateEl.textContent = y + '-' + mo + '-' + d;
    }

    if (dashWeekdayEl) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      dashWeekdayEl.textContent = days[now.getDay()];
    }

    if (dashGreetingEl) {
      const hour = now.getHours();
      let greet = '你好';
      if (hour < 6) greet = '夜深了';
      else if (hour < 9) greet = '早上好';
      else if (hour < 12) greet = '上午好';
      else if (hour < 14) greet = '中午好';
      else if (hour < 18) greet = '下午好';
      else greet = '晚上好';
      dashGreetingEl.textContent = greet;
    }
  }

  updateClock();
  setInterval(updateClock, 10000);

  // ---- 鼠标跟随光晕 ----
  const dashScrollEl = document.querySelector('.dashboard-scroll');
  if (dashScrollEl) {
    dashScrollEl.addEventListener('mousemove', function(e) {
      dashScrollEl.style.setProperty('--mouse-x', e.clientX + 'px');
      dashScrollEl.style.setProperty('--mouse-y', e.clientY + 'px');
      const style = dashScrollEl.style;
      style.setProperty('--mx', e.clientX);
      style.setProperty('--my', e.clientY);
    });

    const hasScroll = dashScrollEl.scrollHeight > dashScrollEl.clientHeight;
    if (hasScroll) dashScrollEl.classList.add('can-scroll');
  }

  // ---- 搜索 ----
  const dashSearchEl = document.getElementById('dashSearch');
  if (dashSearchEl) {
    dashSearchEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = dashSearchEl.value.trim();
        if (!q) return;
        const engine = window.FBrowser.config.config.engine;
        const urls = {
          baidu: 'https://www.baidu.com/s?wd=',
          google: 'https://www.google.com/search?q=',
          bing: 'https://www.bing.com/search?q='
        };
        window.FBrowser.navigation.navigateTo((urls[engine] || urls.baidu) + encodeURIComponent(q));
        dashSearchEl.value = '';
      }
    });
  }

  // ---- 引擎切换 ----
  const dashEngineEl = document.getElementById('dashEngine');
  if (dashEngineEl) {
    dashEngineEl.addEventListener('click', () => {
      const engines = ['baidu', 'google', 'bing'];
      const labels = { baidu: '百度', google: 'Google', bing: 'Bing' };
      const current = window.FBrowser.config.config.engine;
      const idx = engines.indexOf(current);
      const next = engines[(idx + 1) % engines.length];
      window.FBrowser.config.config.engine = next;
      window.FBrowser.config.saveConfig();
      dashEngineEl.textContent = labels[next];
      window.FBrowser.search.updateEngineLabel();
    });
    const labels = { baidu: '百度', google: 'Google', bing: 'Bing' };
    dashEngineEl.textContent = labels[window.FBrowser.config.config.engine] || '百度';
  }

  // ---- 快捷站点 ----
  function renderDashSites() {
    const gridEl = document.getElementById('dashGrid');
    if (!gridEl) return;
    const sites = window.FBrowser.data.getSites();
    gridEl.innerHTML = '';
    sites.forEach((site, i) => {
      const el = document.createElement('div');
      el.className = 'dash-site';
      el.style.animationDelay = (i * 0.05 + 0.2) + 's';
      el.innerHTML = `
        <div class="dash-site-icon" style="background:linear-gradient(135deg,${site.color},${site.color}cc)">${window.FBrowser.data.escHtml(site.name[0])}</div>
        <div class="dash-site-name">${window.FBrowser.data.escHtml(site.name)}</div>
      `;
      el.addEventListener('click', () => window.FBrowser.navigation.navigateTo(site.url));
      gridEl.appendChild(el);
    });
  }

  renderDashSites();

  // ---- 最近访问 ----
  function renderRecentHistory() {
    const recentEl = document.getElementById('dashRecent');
    if (!recentEl) return;
    const history = window.FBrowser.data.getHistory().slice(0, 8);
    recentEl.innerHTML = '';
    if (history.length === 0) {
      recentEl.innerHTML = '<div style="padding:24px 10px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2)">暂无浏览记录</div>';
      return;
    }
    history.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'dash-recent-item';
      try {
        const domain = new URL(item.url).hostname.replace('www.', '');
        el.innerHTML = `
          <div class="dash-recent-icon">${domain[0]?.toUpperCase() || '?'}</div>
          <div class="dash-recent-info">
            <div class="dash-recent-title">${window.FBrowser.data.escHtml(item.title || domain)}</div>
            <div class="dash-recent-url">${window.FBrowser.data.escHtml(domain)}</div>
          </div>
          <div class="dash-recent-time">${formatTime(item.time)}</div>
        `;
      } catch (e) {
        el.innerHTML = `
          <div class="dash-recent-icon">?</div>
          <div class="dash-recent-info">
            <div class="dash-recent-title">${window.FBrowser.data.escHtml(item.title || '未知页面')}</div>
          </div>
        `;
      }
      el.addEventListener('click', () => window.FBrowser.navigation.navigateTo(item.url));
      recentEl.appendChild(el);
    });
  }

  function formatTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    const d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  renderRecentHistory();

  // ---- 书签收藏 ----
  function renderDashBookmarks() {
    const bmEl = document.getElementById('dashBookmarks');
    if (!bmEl) return;
    const bookmarks = window.FBrowser.data.getBookmarks().slice(0, 8);
    bmEl.innerHTML = '';
    if (bookmarks.length === 0) {
      bmEl.innerHTML = '<div style="padding:24px 10px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2)">暂无书签</div>';
      return;
    }
    bookmarks.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'dash-bookmark-item';
      try {
        const domain = new URL(item.url).hostname.replace('www.', '');
        const name = item.title || item.name || domain;
        el.innerHTML = `
          <div class="dash-bookmark-icon" style="background:linear-gradient(135deg,#4A90D9,#6C5CE7)">${name[0]?.toUpperCase() || '?'}</div>
          <div class="dash-bookmark-name">${window.FBrowser.data.escHtml(name)}</div>
          <div class="dash-bookmark-url">${window.FBrowser.data.escHtml(domain)}</div>
        `;
      } catch (e) {
        const name = item.title || item.name || '未知';
        el.innerHTML = `
          <div class="dash-bookmark-icon" style="background:linear-gradient(135deg,#4A90D9,#6C5CE7)">${name[0]?.toUpperCase() || '?'}</div>
          <div class="dash-bookmark-name">${window.FBrowser.data.escHtml(name)}</div>
        `;
      }
      el.addEventListener('click', () => window.FBrowser.navigation.navigateTo(item.url));
      bmEl.appendChild(el);
    });
  }

  renderDashBookmarks();

  // ---- 快速笔记 ----
  const dashNotesEl = document.getElementById('dashNotes');
  if (dashNotesEl) {
    const saved = localStorage.getItem('f-dash-notes') || '';
    dashNotesEl.value = saved;

    let saveTimer = null;
    dashNotesEl.addEventListener('input', () => {
      dashNotesEl.classList.remove('saved');
      dashNotesEl.classList.add('saving');
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem('f-dash-notes', dashNotesEl.value);
        dashNotesEl.classList.remove('saving');
        dashNotesEl.classList.add('saved');
        setTimeout(() => dashNotesEl.classList.remove('saved'), 2000);
      }, 500);
    });
  }

  // ---- 3D 卡片视差效果 ----
  document.querySelectorAll('.dash-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-2px) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

})();
