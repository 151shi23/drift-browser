// ==================== 主页快捷站点网格 ====================
(function() {
  'use strict';

  const homeGridEl = document.getElementById('homeGrid');
  const cyberGridEl = document.getElementById('cyberGrid');
  const homePageEl = document.getElementById('homePage');
  const homePageCyberEl = document.getElementById('homePageCyber');

  function getConfig() {
    return window.FBrowser?.config?.config || {};
  }

  function renderHomeGrid() {
    const sites = window.FBrowser.data.getSites();
    // 渲染经典主页
    if (homeGridEl) {
      homeGridEl.innerHTML = '';
      sites.forEach(site => {
        const el = document.createElement('div');
        el.className = 'home-site';
        const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(site.color) ? site.color : '#555';
        el.innerHTML = `
          <div class="home-site-icon" style="background:linear-gradient(135deg,${safeColor},${safeColor}cc)">${window.FBrowser.data.escHtml(site.name[0])}</div>
          <div class="home-site-name">${window.FBrowser.data.escHtml(site.name)}</div>
        `;
        el.addEventListener('click', () => window.FBrowser.navigation.navigateTo(site.url));
        homeGridEl.appendChild(el);
      });
    }
    // 渲染赛博主页
    if (cyberGridEl) {
      cyberGridEl.innerHTML = '';
      sites.forEach(site => {
        const el = document.createElement('div');
        el.className = 'cyber-site';
        const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(site.color) ? site.color : '#555';
        el.innerHTML = `
          <div class="cyber-site-icon" style="background:linear-gradient(135deg,${safeColor},${safeColor}cc)">${window.FBrowser.data.escHtml(site.name[0])}</div>
          <div class="cyber-site-name">${window.FBrowser.data.escHtml(site.name)}</div>
        `;
        el.addEventListener('click', () => window.FBrowser.navigation.navigateTo(site.url));
        cyberGridEl.appendChild(el);
      });
    }
  }

  // 应用主页风格
  function applyHomeStyle(style) {
    if (!homePageEl || !homePageCyberEl) return;
    if (style === 'cyber') {
      homePageEl.classList.remove('active');
      homePageCyberEl.classList.add('active');
    } else {
      homePageCyberEl.classList.remove('active');
      homePageEl.classList.add('active');
    }
  }

  // 初始化时应用配置的风格（延迟确保配置已加载）
  function initHomeStyle() {
    const cfg = getConfig();
    const style = cfg.homeStyle || 'classic';
    applyHomeStyle(style);
  }

  // 立即尝试初始化
  initHomeStyle();

  // DOM加载完成后再次确认
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeStyle);
  }

  renderHomeGrid();

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.homeGrid = { renderHomeGrid, applyHomeStyle };
})();
