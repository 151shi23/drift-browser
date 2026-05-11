// ==================== 标签页管理 ====================
(function() {
  'use strict';

  const tabStripEl = document.getElementById('tabStrip');
  const webviewHostEl = document.getElementById('webviewHost');
  const homePageEl = document.getElementById('homePage');
  const homePageCyberEl = document.getElementById('homePageCyber');
  const settingsPageEl = document.getElementById('settingsPage');
  const taskManagerPageEl = document.getElementById('taskManagerPage');
  const performancePageEl = document.getElementById('performancePage');
  const aiChatPageEl = document.getElementById('aiChatPage');
  const aiAgentPageEl = document.getElementById('aiAgentPage');
  const docforgePageEl = document.getElementById('docforgePage');

  let tabs = [];
  let activeTabId = null;
  let tabSeq = 0;
  let cachedNewtabOverride = null;

  // ========== 内存保护配置 ==========
  const MEMORY_PROTECTION = {
    enabled: true,
    freezeDelay: 300000,
    checkInterval: 60000,
    maxActiveTabs: 5,
    frozenIndicator: true
  };

  let memoryCheckTimer = null;

  // 获取性能模式配置
  function getPowerModeConfig() {
    return window.FBrowser?.powerMode?.config || null;
  }

  // 更新内存保护配置
  function updateMemoryProtectionConfig() {
    const pmConfig = getPowerModeConfig();
    if (pmConfig) {
      MEMORY_PROTECTION.enabled = pmConfig.enabled && pmConfig.autoFreeze;
      MEMORY_PROTECTION.freezeDelay = pmConfig.freezeDelay || 300000;
    }
  }

  // 获取新标签页覆盖扩展
  async function checkNewtabOverride() {
    try {
      cachedNewtabOverride = await window.electronAPI.extensionsGetNewtabOverride();
    } catch (e) {}
  }
  
  // 初始化时检查
  checkNewtabOverride();

  // ========== 内存保护功能 ==========
  function startMemoryProtection() {
    if (memoryCheckTimer) clearInterval(memoryCheckTimer);
    memoryCheckTimer = setInterval(checkAndFreezeTabs, MEMORY_PROTECTION.checkInterval);
  }

  function checkAndFreezeTabs() {
    updateMemoryProtectionConfig();
    
    if (!MEMORY_PROTECTION.enabled) return;
    
    const now = Date.now();
    const backgroundTabs = tabs.filter(t => t.id !== activeTabId && t.webview && !t.frozen);
    
    backgroundTabs.forEach(tab => {
      if (tab.lastActiveTime && (now - tab.lastActiveTime) > MEMORY_PROTECTION.freezeDelay) {
        // 跳过正在播放音频的标签
        if (tab.webview && tab.webview.isCurrentlyAudible && tab.webview.isCurrentlyAudible()) return;
        // 跳过全屏标签
        if (tab.isFullScreen) return;
        freezeTab(tab);
      }
    });

    const activeTabs = tabs.filter(t => !t.frozen && t.webview);
    if (activeTabs.length > MEMORY_PROTECTION.maxActiveTabs) {
      activeTabs.sort((a, b) => (a.lastActiveTime || 0) - (b.lastActiveTime || 0));
      const toFreeze = activeTabs.slice(0, activeTabs.length - MEMORY_PROTECTION.maxActiveTabs);
      toFreeze.forEach(tab => {
        // 跳过正在播放音频的标签
        if (tab.webview && tab.webview.isCurrentlyAudible && tab.webview.isCurrentlyAudible()) return;
        if (tab.isFullScreen) return;
        freezeTab(tab);
      });
    }
  }

  function freezeTab(tab) {
    if (!tab || !tab.webview || tab.frozen) return;
    
    try {
      // 保存当前 URL 和滚动位置
      tab.frozenUrl = tab.webview.src || tab.url;
      tab.frozen = true;
      tab.frozenTime = Date.now();
      
      // 导航到空白页释放内存
      tab.webview.src = 'about:blank';
      
      // 添加冻结指示器
      if (MEMORY_PROTECTION.frozenIndicator) {
        tab.element.classList.add('frozen');
        updateFrozenIndicator(tab);
      }
      
      console.log('[Memory] 标签页已冻结:', tab.frozenUrl);
    } catch (e) {
      console.error('[Memory] 冻结标签页失败:', e);
    }
  }

  function unfreezeTab(tab) {
    if (!tab || !tab.frozen) return;
    
    try {
      tab.frozen = false;
      tab.element.classList.remove('frozen');
      
      // 恢复页面
      if (tab.frozenUrl) {
        tab.webview.src = tab.frozenUrl;
        delete tab.frozenUrl;
      }
      
      console.log('[Memory] 标签页已解冻');
    } catch (e) {
      console.error('[Memory] 解冻标签页失败:', e);
    }
  }

  function freezeTabLevel(tab, level) {
    if (!tab) return;
    if ((tab.freezeLevel || 0) >= level) return;

    if (level === 1) {
      if (window.FBrowser?.powerMode?.injectThrottleScript) {
        window.FBrowser.powerMode.injectThrottleScript(tab);
      }
      tab.freezeLevel = 1;
      return;
    }

    if (level === 2) {
      if (window.MediaController) {
        window.MediaController.pauseTabMedia(tab);
      }
      tab.freezeLevel = 2;
      return;
    }

    if (level === 3) {
      if (window.MediaController) {
        window.MediaController.pauseTabMedia(tab);
        window.MediaController.suspendTabTimers(tab);
      }
      tab.freezeLevel = 3;
      return;
    }

    if (level === 4) {
      if (!tab.webview) return;
      var currentUrl = tab.webview.src;
      if (!currentUrl || currentUrl === 'about:blank' || currentUrl.startsWith('f://')) {
        currentUrl = tab.url || tab.suspendedState?.url;
      }
      if (!currentUrl || currentUrl === 'about:blank') return;
      tab.suspendedState = {
        url: currentUrl,
        scrollY: 0,
        title: tab.element?.querySelector('.tab-title')?.textContent || ''
      };
      tab.webview.executeJavaScript('window.scrollY').then(function(scrollY) {
        if (tab.suspendedState) tab.suspendedState.scrollY = scrollY;
      }).catch(function() {});

      tab.frozen = true;
      tab.freezeLevel = 4;
      tab.element.classList.add('frozen');
      updateFrozenIndicator(tab);

      setTimeout(function() {
        if (tab.webview && tab.suspendedState) {
          tab.webview.src = 'about:blank';
        }
      }, 100);
      return;
    }

    if (level === 5) {
      if (!tab.webview) return;
      var destroyUrl = tab.webview.src;
      if (!destroyUrl || destroyUrl === 'about:blank' || destroyUrl.startsWith('f://')) {
        destroyUrl = tab.url || tab.suspendedState?.url;
      }
      if (!destroyUrl || destroyUrl === 'about:blank') return;
      tab.destroyedState = {
        url: destroyUrl,
        scrollY: tab.suspendedState?.scrollY || 0,
        title: tab.element?.querySelector('.tab-title')?.textContent || ''
      };
      try {
        tab.webview.stop();
        tab.webview.clearHistory();
        tab.webview.remove();
      } catch (e) {}
      tab.webview = null;
      tab.frozen = true;
      tab.freezeLevel = 5;
      tab.element.classList.add('frozen');
      tab.element.classList.add('destroyed');
      updateFrozenIndicator(tab);
      return;
    }
  }

  function unfreezeTabLevel(tab) {
    if (!tab) return;

    if ((tab.freezeLevel || 0) === 5 && tab.destroyedState) {
      var url = tab.destroyedState.url;
      tab.frozen = false;
      tab.freezeLevel = 0;
      tab.element.classList.remove('frozen', 'destroyed');
      var indicator = tab.element?.querySelector('.tab-frozen-indicator');
      if (indicator) indicator.remove();
      delete tab.destroyedState;

      if (url) {
        var webviewContainer = document.getElementById('webview-container');
        if (webviewContainer) {
          var wv = document.createElement('webview');
          wv.src = url;
          wv.className = 'tab-webview';
          wv.setAttribute('allowpopups', '');
          tab.webview = wv;
          webviewContainer.appendChild(wv);
          if (typeof bindWebviewEvents === 'function') {
            bindWebviewEvents(tab, wv);
          }
        }
      }
      return;
    }

    if ((tab.freezeLevel || 0) === 4 && tab.suspendedState) {
      tab.frozen = false;
      tab.freezeLevel = 0;
      tab.element.classList.remove('frozen');
      var indicator4 = tab.element?.querySelector('.tab-frozen-indicator');
      if (indicator4) indicator4.remove();

      if (tab.webview && tab.suspendedState.url) {
        tab.webview.src = tab.suspendedState.url;
        tab.webview.addEventListener('did-finish-load', function restore() {
          if (tab.suspendedState && tab.suspendedState.scrollY > 0) {
            tab.webview.executeJavaScript('window.scrollTo(0, ' + tab.suspendedState.scrollY + ')').catch(function() {});
          }
          delete tab.suspendedState;
          tab.webview.removeEventListener('did-finish-load', restore);
        });
      }
      return;
    }

    if (tab.freezeLevel >= 2 && window.MediaController) {
      window.MediaController.resumeTabMedia(tab);
    }

    tab.frozen = false;
    tab.freezeLevel = 0;
    tab.element.classList.remove('frozen');
    var indicatorL = tab.element?.querySelector('.tab-frozen-indicator');
    if (indicatorL) indicatorL.remove();
  }

  function updateFrozenIndicator(tab) {
    if (!tab.element) return;
    
    let indicator = tab.element.querySelector('.tab-frozen-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'tab-frozen-indicator';
      indicator.title = '此标签页已冻结以节省内存，点击恢复';
      tab.element.appendChild(indicator);
    }
  }

  function createTab(url = null) {
    const id = ++tabSeq;
    let isHome = !url;
    const isSettings = url === 'f://settings';
    const isTaskManager = url === 'f://task-manager';
    const isPerformance = url === 'f://performance';
    const isAiChat = url === 'f://ai-chat';
    const isDocforge = url === 'f://docforge';
    const isAiAgent = url === 'f://ai-agent';
    const isPlugins = url === 'f://plugins' || url === 'drift://plugins';
    const isIncognito = window.isIncognitoMode;

    // 如果是新标签页且有扩展覆盖，使用扩展的 URL
    if (isHome && cachedNewtabOverride && cachedNewtabOverride.newtabUrl && !isIncognito) {
      url = cachedNewtabOverride.newtabUrl;
      isHome = false;
      console.log('[Drift] 使用扩展覆盖新标签页:', url);
    }

    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item' + (isIncognito ? ' incognito-tab' : '');
    tabEl.dataset.id = id;
    
    // 无痕模式下使用紫色图标
    let iconText = isHome ? '\u2302' : isSettings ? '\u2699' : isTaskManager ? '\uD83D\uDCCA' : isPerformance ? '\uD83D\uDCC8' : isAiChat ? 'AI' : isAiAgent ? '\u{1F916}' : isDocforge ? '\u{1F4DD}' : isPlugins ? '\u{1F9E9}' : 'N';
    let iconBg = isIncognito ? '#8B5CF6' : isAiChat ? '#6366f1' : isAiAgent ? '#10b981' : isDocforge ? '#059669' : isPlugins ? '#6C5CE7' : '#555';

    let tabTitle = '加载中...';
    if (isHome) tabTitle = isIncognito ? '无痕新标签页' : '新标签页';
    else if (isSettings) tabTitle = '设置';
    else if (isTaskManager) tabTitle = '任务管理器';
    else if (isPerformance) tabTitle = '性能监视器';
    else if (isAiChat) tabTitle = 'AI \u52A9\u624B';
    else if (isAiAgent) tabTitle = 'AI Agent';
    else if (isDocforge) tabTitle = '\u6587\u6863\u7F16\u8F91';
    else if (isPlugins) tabTitle = '插件管理';
    
    tabEl.innerHTML = `
      <img class="tab-favicon" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='${iconBg}'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='10'>${iconText}</text></svg>" alt="">
      <span class="tab-title">${tabTitle}</span>
      <span class="tab-close"><svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg></span>
    `;
    tabEl.addEventListener('click', e => {
      if (e.target.closest('.tab-close')) { closeTab(id); return; }
      switchTab(id);
    });
    tabEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (window.FBrowser.tabContext) {
        window.FBrowser.tabContext.show(e, id);
      }
    });
    tabStripEl.appendChild(tabEl);

    const isSpecialPage = isSettings || isTaskManager || isPerformance || isAiChat || isAiAgent || isDocforge || isPlugins;
    const tab = {
      id,
      url: isSpecialPage ? url : url,
      element: tabEl,
      webview: null,
      isHome,
      isSettings,
      isTaskManager,
      isPerformance,
      isAiChat,
      isAiAgent,
      isDocforge,
      isPlugins,
      isIncognito,
      zoomLevel: 0
    };
    tabs.push(tab);

    if (url && !isSpecialPage) createWebview(tab, url);

    requestAnimationFrame(() => switchTab(id));
    return id;
  }

  function createWebview(tab, url) {
    const wv = document.createElement('webview');
    wv.dataset.tabId = tab.id;
    wv.setAttribute('allowpopups', '');
    wv.style.background = 'var(--bg-0)';
    
    // 无痕模式下使用独立 session
    if (window.isIncognitoMode) {
      wv.setAttribute('partition', 'persist:incognito');
    }
    
    webviewHostEl.appendChild(wv);
    tab.webview = wv;
    tab.isHome = false;
    tab.pendingUrl = url;

    bindWebviewEvents(tab, wv);
  }

  function bindWebviewEvents(tab, wv) {
    wv.addEventListener('did-start-loading', () => {
      if (activeTabId === tab.id) showProgress(40);
    });
    wv.addEventListener('dom-ready', () => {
      forceResizeWebview(wv);
      try {
        const wcId = wv.getWebContentsId();
        if (wcId) window.electronAPI.webviewReady(wcId);
      } catch(e) {}
      // 页面加载完成后才显示 webview，避免白屏闪烁
      if (tab.id === activeTabId) {
        wv.classList.add('visible');
      }
      fetchFavicon(wv, tab);
    });
    wv.addEventListener('did-stop-loading', () => {
      if (activeTabId === tab.id) showProgress(100);
      setTimeout(() => fetchFavicon(wv, tab), 800);

      // 通知插件系统页面加载完成
      try {
        var pageUrl = wv.getURL();
        if (pageUrl && (pageUrl.startsWith('http://') || pageUrl.startsWith('https://'))) {
          if (window.FBrowser && window.FBrowser.pluginHost && window.FBrowser.pluginHost.onPageLoad) {
            window.FBrowser.pluginHost.onPageLoad(pageUrl, wv);
          }
        }
      } catch(e) {}

      // 自动登录注入
      try {
        const url = wv.getURL();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          injectAutoLogin(wv, url);
        }
      } catch(e) {}

      // B站适配提示 + 视频优化
      try {
        const url = wv.getURL();
        if (url && (url.includes('bilibili.com') || url.includes('b23.tv'))) {
          wv.executeJavaScript(`
            (function() {
              if (document.getElementById('drift-bili')) return;
              var d = document.createElement('div');
              d.id = 'drift-bili';
              d.innerHTML = '<style>#drift-bili{position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:14px;background:linear-gradient(90deg,#00A1D6,#FB7299);color:#fff;font:600 14px/-apple-system sans-serif;text-align:center;animation:driftIn .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 20px rgba(0,161,214,.5)}#drift-bili span{background:rgba(255,255,255,.2);padding:3px 8px;border-radius:4px;margin-left:8px;font-size:12px}#drift-bili b{font-size:16px}@keyframes driftIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}</style><b>Drift</b> 已接管哔哩哔哩 <span>4K HDR</span>';
              document.body.appendChild(d);
              setTimeout(function(){d.style.cssText='transition:.3s;transform:translateY(-100%);opacity:0';setTimeout(function(){d.remove()},300)},3500);

              // B站视频播放器优化
              try {
                var style = document.createElement('style');
                style.textContent = '@media(prefers-reduced-motion:reduce){.bpx-player-row-dm-wrap,.bpx-player-dm-wrap{display:none!important}}';
                document.head.appendChild(style);

                // 监听全屏事件，优化性能
                document.addEventListener('fullscreenchange', function() {
                  if (document.fullscreenElement) {
                    // 全屏时降低弹幕渲染频率
                    var dmWrap = document.querySelector('.bpx-player-row-dm-wrap,.bpx-player-dm-wrap');
                    if (dmWrap) dmWrap.style.willChange = 'auto';
                  } else {
                    var dmWrap = document.querySelector('.bpx-player-row-dm-wrap,.bpx-player-dm-wrap');
                    if (dmWrap) dmWrap.style.willChange = '';
                  }
                });
              } catch(e) {}
            })();
          `).catch(() => {});
        }
      } catch(e) {}
    });
    wv.addEventListener('page-favicon-updated', e => {
      if (e.favicons && e.favicons.length > 0) {
        updateTabFavicon(tab, e.favicons[0]);
      }
    });
    wv.addEventListener('page-title-updated', e => {
      tab.element.querySelector('.tab-title').textContent = e.title;
    });
    wv.addEventListener('did-navigate', e => {
      tab.url = e.url;
      if (activeTabId === tab.id) updateUrlBar(e.url);
      window.FBrowser.data.addHistory(e.url, tab.element.querySelector('.tab-title').textContent);
      window.FBrowser.data.getUrlSuggestions('');
      if (window.FBrowser.aiBrowser) window.FBrowser.aiBrowser.onUrlChanged(e.url);
    });
    wv.addEventListener('did-navigate-in-page', e => {
      tab.url = e.url;
      if (activeTabId === tab.id) updateUrlBar(e.url);
      if (window.FBrowser.aiBrowser) window.FBrowser.aiBrowser.onUrlChanged(e.url);
    });
    wv.addEventListener('new-window', e => {
      e.preventDefault();
      createTab(e.url);
    });
    wv.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) {
        console.error('[Drift] 页面加载失败:', e.errorCode, e.errorDescription, e.validatedURL);
        if (activeTabId === tab.id) {
          showProgress(100);
          tab.element.querySelector('.tab-title').textContent = '加载失败';
        }
      }
    });
    wv.addEventListener('found-in-page', e => {
      if (window.FBrowser.findBar) {
        window.FBrowser.findBar.onFoundInPage(e.result);
      }
    });

    // ---- 全屏优化 ----
    wv.addEventListener('enter-html-full-screen', () => {
      console.log('[Drift] 进入全屏:', tab.id);
      tab.isFullScreen = true;
      document.body.classList.add('fullscreen-active');
      // 冻结其他标签释放资源
      tabs.forEach(t => {
        if (t.id !== tab.id && t.webview && !t.frozen) {
          t._frozenByFullscreen = true;
          freezeTab(t);
        }
      });
    });
    wv.addEventListener('leave-html-full-screen', () => {
      console.log('[Drift] 退出全屏:', tab.id);
      tab.isFullScreen = false;
      document.body.classList.remove('fullscreen-active');
      // 恢复被全屏冻结的标签
      tabs.forEach(t => {
        if (t._frozenByFullscreen) {
          delete t._frozenByFullscreen;
          unfreezeTab(t);
        }
      });
    });

    // ---- 崩溃恢复 ----
    wv.addEventListener('crashed', (e) => {
      console.error('[Drift] 标签页崩溃:', tab.id, e);
      tab.element.querySelector('.tab-title').textContent = '已崩溃 - 点击重新加载';
      tab.element.classList.add('crashed');
      tab.crashed = true;
    });
    wv.addEventListener('unresponsive', () => {
      console.warn('[Drift] 标签页无响应:', tab.id);
      tab.element.classList.add('unresponsive');
    });
    wv.addEventListener('responsive', () => {
      console.log('[Drift] 标签页恢复响应:', tab.id);
      tab.element.classList.remove('unresponsive');
    });
    wv.addEventListener('plugin-crashed', (e) => {
      console.warn('[Drift] 插件崩溃:', e.name, e.version);
    });
  }

  function fetchFavicon(wv, tab) {
    try {
      const pageUrl = wv.getURL();
      if (!pageUrl || pageUrl === 'about:blank') return;
      wv.executeJavaScript(`
        (function() {
          var links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
          if (links.length > 0) {
            return new URL(links[0].href, document.location.href).href;
          }
          return null;
        })();
      `).then(faviconUrl => {
        if (faviconUrl) {
          updateTabFavicon(tab, faviconUrl);
        } else {
          try {
            const url = new URL(pageUrl);
            updateTabFavicon(tab, url.origin + '/favicon.ico');
          } catch(e) {}
        }
      }).catch(() => {});
    } catch(e) {}
  }

  // 自动登录注入
  async function injectAutoLogin(wv, pageUrl) {
    try {
      const urlObj = new URL(pageUrl);
      const domain = urlObj.hostname;

      // 检查是否有保存的凭证
      const result = await window.electronAPI.authGetToken(domain);
      if (!result.success || !result.data) return;

      const authData = result.data;
      const token = authData.token;
      const method = authData.method || 'token';
      const extra = authData.extra || {};

      console.log(`[AuthBridge] 注入 ${domain} 的自动登录脚本`);

      // 根据认证方式注入不同脚本
      if (method === 'token' || method === 'jwt') {
        // Token/JWT 方式：注入到 localStorage/sessionStorage
        wv.executeJavaScript(`
          (function() {
            try {
              var token = '${token.replace(/'/g, "\\'")}';
              var extra = ${JSON.stringify(extra)};

              // 尝试多种存储方式
              if (extra.storage === 'localStorage') {
                localStorage.setItem('token', token);
                if (extra.tokenKey) localStorage.setItem(extra.tokenKey, token);
              } else if (extra.storage === 'sessionStorage') {
                sessionStorage.setItem('token', token);
                if (extra.tokenKey) sessionStorage.setItem(extra.tokenKey, token);
              } else {
                // 默认同时设置
                localStorage.setItem('token', token);
                localStorage.setItem('auth_token', token);
                sessionStorage.setItem('token', token);
                sessionStorage.setItem('auth_token', token);
              }

              // 设置 cookie（如果指定了）
              if (extra.cookieName) {
                document.cookie = extra.cookieName + '=' + token + ';path=/;max-age=604800';
              }

              // 触发存储事件让页面感知
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'token',
                newValue: token,
                oldValue: null,
                storageArea: localStorage
              }));

              console.log('[DriftAuth] 已注入登录凭证');
            } catch(e) {
              console.error('[DriftAuth] 注入失败:', e);
            }
          })();
        `).catch(() => {});
      } else if (method === 'cookie') {
        // Cookie 方式
        wv.executeJavaScript(`
          (function() {
            try {
              var token = '${token.replace(/'/g, "\\'")}';
              var extra = ${JSON.stringify(extra)};
              var cookieName = extra.cookieName || 'auth_token';
              var domain = '${domain}';
              document.cookie = cookieName + '=' + token + ';domain=' + domain + ';path=/;max-age=604800;SameSite=Lax';
              console.log('[DriftAuth] 已注入 Cookie');
            } catch(e) {
              console.error('[DriftAuth] Cookie注入失败:', e);
            }
          })();
        `).catch(() => {});
      } else if (method === 'session') {
        // Session 方式：自动填充表单并提交
        const username = extra.username || '';
        const password = extra.password || '';
        if (username && password) {
          wv.executeJavaScript(`
            (function() {
              try {
                var username = '${username.replace(/'/g, "\\'")}';
                var password = '${password.replace(/'/g, "\\'")}';

                // 查找用户名输入框
                var userFields = document.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], input[id*="user"], input[id*="email"]');
                var passFields = document.querySelectorAll('input[type="password"]');
                var submitBtns = document.querySelectorAll('button[type="submit"], input[type="submit"], button:contains("登录"), button:contains("Login")');

                if (userFields.length > 0 && passFields.length > 0) {
                  userFields[0].value = username;
                  userFields[0].dispatchEvent(new Event('input', { bubbles: true }));
                  userFields[0].dispatchEvent(new Event('change', { bubbles: true }));

                  passFields[0].value = password;
                  passFields[0].dispatchEvent(new Event('input', { bubbles: true }));
                  passFields[0].dispatchEvent(new Event('change', { bubbles: true }));

                  // 延迟提交，避免被检测为机器人
                  setTimeout(function() {
                    if (submitBtns.length > 0) {
                      submitBtns[0].click();
                    } else {
                      var form = passFields[0].closest('form');
                      if (form) form.submit();
                    }
                  }, 500 + Math.random() * 1000);

                  console.log('[DriftAuth] 已自动填充登录表单');
                }
              } catch(e) {
                console.error('[DriftAuth] 表单填充失败:', e);
              }
            })();
          `).catch(() => {});
        }
      }

      // 注入完成后清除凭证（一次性使用）
      if (extra.once !== false) {
        window.electronAPI.authClearToken(domain);
      }
    } catch (e) {
      console.error('[AuthBridge] 自动登录注入失败:', e);
    }
  }

  function updateTabFavicon(tab, faviconUrl) {
    if (!tab || !tab.element) return;
    const faviconEl = tab.element.querySelector('.tab-favicon');
    if (faviconEl) {
      faviconEl.src = faviconUrl;
      faviconEl.onerror = () => {
        const title = tab.element.querySelector('.tab-title').textContent;
        const initial = title ? title[0].toUpperCase() : '?';
        const colorHash = initial.charCodeAt(0);
        const hue = colorHash * 37 % 360;
        faviconEl.src = "data:image/svg+xml," + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
          '<rect width="16" height="16" rx="3" fill="hsl(' + hue + ',50%,40%)"/>' +
          '<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="10" font-family="sans-serif">' + initial + '</text>' +
          '</svg>'
        );
      };
    }
  }

  function forceResizeWebview(wv) {
    if (!wv || !wv.parentElement) return;
    const rect = wv.parentElement.getBoundingClientRect();
    wv.style.width = (rect.width - 1) + 'px';
    wv.style.height = (rect.height - 1) + 'px';
    requestAnimationFrame(() => {
      wv.style.width = '';
      wv.style.height = '';
    });
  }

  function switchTab(id) {
    activeTabId = id;
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    // 更新最后活跃时间
    tab.lastActiveTime = Date.now();

    // 行为学习器记录标签切换
    if (window.BehaviorLearner) {
      window.BehaviorLearner.recordTabSwitch(id, tab.url);
    }

    // 如果标签页有分级冻结，先解冻
    if (tab.freezeLevel && tab.freezeLevel > 0) {
      unfreezeTabLevel(tab);
    } else if (tab.frozen) {
      unfreezeTab(tab);
    }

    // 如果标签页崩溃，点击时重新加载
    if (tab.crashed && tab.webview) {
      tab.crashed = false;
      tab.element.classList.remove('crashed');
      tab.webview.reload();
    }

    // 1. 更新标签页激活状态
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    tab.element.classList.add('active');
    tab.element.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

    // 2. 隐藏所有 webview
    document.querySelectorAll('webview').forEach(w => w.classList.remove('visible'));

    // 3. 立即隐藏所有视图，确保不会出现多个视图叠加
    homePageEl.classList.remove('active', 'exiting');
    if (homePageCyberEl) homePageCyberEl.classList.remove('active', 'exiting');
    settingsPageEl.classList.remove('active', 'exiting');
    if (taskManagerPageEl) taskManagerPageEl.classList.remove('active', 'exiting');
    if (performancePageEl) performancePageEl.classList.remove('active', 'exiting');
    if (aiChatPageEl) aiChatPageEl.classList.remove('active', 'exiting');
    if (aiAgentPageEl) aiAgentPageEl.classList.remove('active', 'exiting');
    if (docforgePageEl) docforgePageEl.classList.remove('active', 'exiting');
    var pluginsPageEl = document.getElementById('pluginManagerPage');
    if (pluginsPageEl) pluginsPageEl.classList.remove('active', 'exiting');
    webviewHostEl.classList.remove('active');

    // 4. 根据标签类型显示对应内容
    if (tab.webview) {
      revealWebview();
    } else if (tab.isSettings) {
      revealSettings();
    } else if (tab.isTaskManager) {
      revealTaskManager();
    } else if (tab.isPerformance) {
      revealPerformance();
    } else if (tab.isAiChat) {
      revealAiChat();
    } else if (tab.isAiAgent) {
      revealAiAgent();
    } else if (tab.isDocforge) {
      revealDocforge();
    } else if (tab.isPlugins) {
      revealPlugins();
    } else {
      revealHome();
    }

    if (window.FBrowser.bookmarks) window.FBrowser.bookmarks.updateBookmarkBtn();
    if (window.FBrowser.findBar) window.FBrowser.findBar.close();

    function revealWebview() {
      webviewHostEl.classList.add('active');
      // 不再立即添加 visible 类，让 webview 在 dom-ready 时自己添加
      // 这样可以避免页面加载完成前显示空白/黑屏
      if (tab.webview.getAttribute('src') && tab.webview.getURL() !== 'about:blank') {
        tab.webview.classList.add('visible');
      }
      if (tab.pendingUrl) {
        tab.webview.src = tab.pendingUrl;
        tab.url = tab.pendingUrl;
        delete tab.pendingUrl;
      }
      requestAnimationFrame(() => forceResizeWebview(tab.webview));
      updateUrlBar(tab.url || '');
    }

    function revealSettings() {
      settingsPageEl.classList.add('active');
      updateUrlBar('f://settings');
      if (window.FBrowser.settings) {
        window.FBrowser.settings.syncSettingsPage();
        window.FBrowser.settings.renderSettingsSites();
        window.FBrowser.settings.switchSettingsSection('appearance');
      }
    }

    function revealTaskManager() {
      if (taskManagerPageEl) taskManagerPageEl.classList.add('active');
      updateUrlBar('f://task-manager');
      if (window.FBrowser.taskManager) window.FBrowser.taskManager.init();
    }

    function revealPerformance() {
      if (performancePageEl) performancePageEl.classList.add('active');
      updateUrlBar('f://performance');
      if (window.FBrowser.performance) window.FBrowser.performance.init();
    }

    function revealAiChat() {
      if (aiChatPageEl) aiChatPageEl.classList.add('active');
      updateUrlBar('f://ai-chat');
      if (window.FBrowser.aiChat) window.FBrowser.aiChat.activate();
    }

    function revealAiAgent() {
      if (aiAgentPageEl) aiAgentPageEl.classList.add('active');
      updateUrlBar('f://ai-agent');
      if (window.FBrowser.aiAgent) window.FBrowser.aiAgent.activate();
    }

    function revealDocforge() {
      if (docforgePageEl) docforgePageEl.classList.add('active');
      updateUrlBar('f://docforge');
      if (window.FBrowser.docforge) window.FBrowser.docforge.init();
    }

    function revealPlugins() {
      updateUrlBar('f://plugins');
      if (window.FBrowser.pluginManager) window.FBrowser.pluginManager.open();
    }

    function revealHome() {
      const homeStyle = window.FBrowser?.config?.config?.homeStyle || 'classic';
      if (homeStyle === 'cyber' && homePageCyberEl) {
        homePageCyberEl.classList.add('active');
      } else {
        homePageEl.classList.add('active');
      }
      updateUrlBar('');
    }
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = tabs[idx];

    // === 彻底清理 webview ===
    if (tab.webview) {
      try {
        // 1. 停止所有活动
        tab.webview.stop();
        tab.webview.clearHistory();
        
        // 2. 导航到空白页
        tab.webview.loadURL('about:blank');
        
        // 3. 延迟移除 DOM
        setTimeout(() => {
          try {
            tab.webview.remove();
          } catch (e) {}
        }, 100);
      } catch (e) {
        console.error('[Memory] 清理 webview 失败:', e);
      }
      tab.webview = null;
    }

    tab.element.classList.add('closing');
    tab.element.addEventListener('animationend', () => {
      tab.element.remove();
    }, { once: true });

    tabs.splice(idx, 1);

    if (tabs.length === 0) { createTab(); return; }
    if (activeTabId === id) {
      const ni = Math.min(idx, tabs.length - 1);
      setTimeout(() => switchTab(tabs[ni].id), 150);
    }
  }

  function closeOtherTabs(keepId) {
    const toClose = tabs.filter(t => t.id !== keepId).map(t => t.id);
    toClose.forEach(id => closeTab(id));
  }

  function duplicateTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab && tab.url) createTab(tab.url);
  }

  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
  }

  function getActiveWebview() {
    return getActiveTab()?.webview || null;
  }

  function showProgress(pct) {
    document.getElementById('progressFill').style.width = pct + '%';
    if (pct >= 100) setTimeout(() => { document.getElementById('progressFill').style.width = '0'; }, 250);
  }

  // URL 栏更新回调
  let _updateUrlBarFn = null;
  function setUpdateUrlBar(fn) { _updateUrlBarFn = fn; }
  function updateUrlBar(url) {
    if (_updateUrlBarFn) _updateUrlBarFn(url);
  }

  // 获取所有标签页数据（用于会话保存）
  function getTabsData() {
    return tabs.map(t => ({
      id: t.id,
      url: t.url || t.pendingUrl || '',
      isHome: t.isHome,
      isSettings: t.isSettings || false,
    }));
  }

  // 窗口 resize
  window.addEventListener('resize', () => {
    const activeTab = getActiveTab();
    if (activeTab && activeTab.webview) {
      forceResizeWebview(activeTab.webview);
    }
  });

  function init() {
    document.getElementById('btnNewTab').addEventListener('click', () => createTab());

    // 启动内存保护
    startMemoryProtection();

    // 键盘快捷键（由 shortcuts.js 模块统一管理，此处不再重复绑定）

    // 标签条滚动按钮
    const tabStrip = document.getElementById('tabStrip');
    const scrollLeftBtn = document.getElementById('tabScrollLeft');
    const scrollRightBtn = document.getElementById('tabScrollRight');

    if (scrollLeftBtn && tabStrip) {
      scrollLeftBtn.addEventListener('click', () => {
        tabStrip.scrollBy({ left: -200, behavior: 'smooth' });
      });
    }
    if (scrollRightBtn && tabStrip) {
      scrollRightBtn.addEventListener('click', () => {
        tabStrip.scrollBy({ left: 200, behavior: 'smooth' });
      });
    }

    // 自动显示/隐藏滚动按钮
    if (tabStrip && scrollLeftBtn && scrollRightBtn) {
      const updateScrollButtons = () => {
        const needScroll = tabStrip.scrollWidth > tabStrip.clientWidth;
        scrollLeftBtn.classList.toggle('visible', needScroll && tabStrip.scrollLeft > 0);
        scrollRightBtn.classList.toggle('visible', needScroll && tabStrip.scrollLeft < tabStrip.scrollWidth - tabStrip.clientWidth - 5);
      };
      tabStrip.addEventListener('scroll', updateScrollButtons);
      new MutationObserver(updateScrollButtons).observe(tabStrip, { childList: true, subtree: true });
      updateScrollButtons();
    }
  }

  init();

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.tabs = {
    get tabs() { return tabs; },
    get activeTabId() { return activeTabId; },
    getActiveTabId: () => activeTabId,
    createTab, switchTab, closeTab, closeOtherTabs, duplicateTab,
    getActiveTab, getActiveWebview,
    showProgress, setUpdateUrlBar, updateUrlBar,
    forceResizeWebview, bindWebviewEvents, getTabsData,
    refreshNewtabOverride: checkNewtabOverride,
    // 内存保护
    freezeTab, unfreezeTab,
    freezeTabLevel, unfreezeTabLevel,
    getFrozenTabs: () => tabs.filter(t => t.frozen),
    getActiveTabs: () => tabs.filter(t => !t.frozen),
  };
})();
