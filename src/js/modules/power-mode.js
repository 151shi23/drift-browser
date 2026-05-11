(function() {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: false,
    apgEnabled: true,
    autoFreeze: true,
    freezeDelay: 300000,
    freezeOnBlur: true,
    memoryThreshold: 1000,
    backgroundThrottle: true,
    animationThrottle: true,
    timerThrottle: true,
    dnsPrefetch: true,
    preconnect: true,
    adBlock: false,
    hwVideoDecode: true,
    pauseBackgroundVideo: false,
    mediaProtection: true,
    cacheClearInterval: 21600000,
    cacheSizeLimit: 512,
    keepCookies: true,
    gpuPriority: 'normal',
    rendererLimit: 8,
    showNotifications: true
  };

  let config = { ...DEFAULT_CONFIG };
  let cacheClearTimer = null;
  let memoryCheckTimer = null;
  let throttledTabs = new Set();

  let blurListener = null;
  let focusListener = null;
  let resourceMonitorUnsubscribe = null;

  function loadConfig() {
    try {
      const saved = localStorage.getItem('f-power-mode');
      if (saved) {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[PowerMode] 加载配置失败:', e);
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem('f-power-mode', JSON.stringify(config));
    } catch (e) {
      console.error('[PowerMode] 保存配置失败:', e);
    }
  }

  function enable() {
    config.enabled = true;
    saveConfig();
    startMemoryMonitor();
    startCacheClear();
    applyOptimizations();

    if (config.apgEnabled && window.PerformanceGovernor) {
      window.PerformanceGovernor.start();
      window.electronAPI?.apgSetEnabled(true);
    }

    showNotification('性能模式已启用', 'success');
  }

  function disable() {
    config.enabled = false;
    saveConfig();
    stopMemoryMonitor();
    stopCacheClear();
    revertOptimizations();

    if (window.PerformanceGovernor) {
      window.PerformanceGovernor.stop();
      window.electronAPI?.apgSetEnabled(false);
    }

    showNotification('性能模式已禁用', 'info');
  }

  function enableAPG() {
    config.apgEnabled = true;
    saveConfig();
    if (config.enabled && window.PerformanceGovernor) {
      window.PerformanceGovernor.start();
      window.electronAPI?.apgSetEnabled(true);
    }
    showNotification('自适应性能调控已启用', 'success');
  }

  function disableAPG() {
    config.apgEnabled = false;
    saveConfig();
    if (window.PerformanceGovernor) {
      window.PerformanceGovernor.stop();
      window.electronAPI?.apgSetEnabled(false);
    }
    showNotification('自适应性能调控已禁用', 'info');
  }

  function applyOptimizations() {
    if (config.backgroundThrottle) {
      enableBackgroundThrottle();
    }
  }

  function revertOptimizations() {
    throttledTabs.clear();
  }

  function startMemoryMonitor() {
    if (memoryCheckTimer) clearInterval(memoryCheckTimer);
    if (!config.enabled || config.memoryThreshold === 0) return;

    memoryCheckTimer = setInterval(async () => {
      try {
        const memData = await window.electronAPI.getPerformanceData();
        if (!memData) return;

        const usedMB = parseInt(memData.memory);
        if (usedMB > config.memoryThreshold) {
          performEmergencyCleanup();
        }
      } catch (e) {}
    }, 30000);
  }

  function stopMemoryMonitor() {
    if (memoryCheckTimer) {
      clearInterval(memoryCheckTimer);
      memoryCheckTimer = null;
    }
  }

  async function performEmergencyCleanup() {
    const result = { frozenTabs: 0, clearedMB: 0, savedMemory: 0 };

    try {
      const beforeMem = await window.electronAPI.getPerformanceData();
      const beforeMB = parseInt(beforeMem?.memory || 0);

      const tabs = window.FBrowser?.tabs?.tabs || [];
      const activeId = window.FBrowser?.tabs?.activeTabId;

      for (const tab of tabs) {
        if (tab.id !== activeId && !tab.frozen && tab.webview) {
          await freezeTabSmart(tab);
          result.frozenTabs++;
        }
      }

      const cacheResult = await window.electronAPI.clearCache({ keepCookies: config.keepCookies });
      result.clearedMB = cacheResult?.clearedMB || 0;

      const afterMem = await window.electronAPI.getPerformanceData();
      const afterMB = parseInt(afterMem?.memory || 0);
      result.savedMemory = Math.max(0, beforeMB - afterMB);

      if (config.showNotifications) {
        showOptimizationComplete(result);
      }
    } catch (e) {
      console.error('[PowerMode] 紧急清理失败:', e);
    }
  }

  async function freezeTabSmart(tab) {
    if (!tab || !tab.webview || tab.frozen) return;

    try {
      if (config.mediaProtection) {
        const isPlaying = await isTabPlayingMedia(tab);
        if (isPlaying) {
          showMediaTabsDialog([tab]);
          return;
        }
      }

      if (window.FBrowser?.tabs?.freezeTab) {
        window.FBrowser.tabs.freezeTab(tab);
      }
    } catch (e) {
      console.error('[PowerMode] 冻结标签失败:', e);
    }
  }

  async function isTabPlayingMedia(tab) {
    if (!tab?.webview) return false;

    try {
      return await tab.webview.executeJavaScript(`
        (function() {
          var videos = document.querySelectorAll('video');
          var audios = document.querySelectorAll('audio');
          for (var i = 0; i < videos.length; i++) {
            if (!videos[i].paused && !videos[i].muted) return true;
          }
          for (var i = 0; i < audios.length; i++) {
            if (!audios[i].paused && !audios[i].muted) return true;
          }
          return false;
        })();
      `);
    } catch (e) {
      return false;
    }
  }

  function handleWindowBlur() {
    if (!config.enabled || !config.freezeOnBlur) return;
    freezeAllNonMediaTabs();
  }

  function handleWindowFocus() {
    if (!config.enabled) return;
  }

  async function freezeAllNonMediaTabs() {
    const tabs = window.FBrowser?.tabs?.tabs || [];
    const activeId = window.FBrowser?.tabs?.activeTabId;
    const mediaTabs = [];

    for (const tab of tabs) {
      if (tab.id === activeId || tab.frozen || !tab.webview) continue;

      try {
        const isPlaying = await isTabPlayingMedia(tab);
        if (isPlaying && config.mediaProtection) {
          mediaTabs.push(tab);
        } else {
          if (window.FBrowser?.tabs?.freezeTab) {
            window.FBrowser.tabs.freezeTab(tab);
          }
        }
      } catch (e) {}
    }

    if (mediaTabs.length > 0) {
      showMediaTabsDialog(mediaTabs);
    }
  }

  function startCacheClear() {
    if (cacheClearTimer) clearInterval(cacheClearTimer);
    if (!config.enabled || config.cacheClearInterval === 0) return;

    cacheClearTimer = setInterval(async () => {
      try {
        const result = await window.electronAPI.clearCache({
          keepCookies: config.keepCookies
        });

        if (result?.success && config.showNotifications) {
          showNotification('已清理 ' + result.clearedMB + ' MB 缓存', 'success');
        }
      } catch (e) {
        console.error('[PowerMode] 缓存清理失败:', e);
      }
    }, config.cacheClearInterval);
  }

  function stopCacheClear() {
    if (cacheClearTimer) {
      clearInterval(cacheClearTimer);
      cacheClearTimer = null;
    }
  }

  function enableBackgroundThrottle() {
    const tabs = window.FBrowser?.tabs?.tabs || [];
    tabs.forEach(tab => {
      if (tab.webview && !tab.frozen && !throttledTabs.has(tab.id)) {
        injectThrottleScript(tab);
        throttledTabs.add(tab.id);
      }
    });
  }

  function injectThrottleScript(tab) {
    if (!tab?.webview) return;

    tab.webview.executeJavaScript(`
      if (!window.__throttleInjected) {
        window.__throttleInjected = true;
        (function() {
          var originalRAF = window.requestAnimationFrame;
          var lastTime = 0;
          window.requestAnimationFrame = function(callback) {
            if (document.hidden) {
              var now = performance.now();
              if (now - lastTime < 33) {
                return originalRAF.call(window, function() {
                  setTimeout(function() { callback(now); }, 33 - (now - lastTime));
                });
              }
            }
            return originalRAF.call(window, callback);
          };
          var originalSetInterval = window.setInterval;
          window.setInterval = function(fn, delay) {
            var args = Array.prototype.slice.call(arguments);
            if (document.hidden && delay < 1000) {
              args[1] = 1000;
            }
            return originalSetInterval.apply(window, args);
          };
          var originalSetTimeout = window.setTimeout;
          window.setTimeout = function(fn, delay) {
            var args = Array.prototype.slice.call(arguments);
            if (document.hidden && delay > 0 && delay < 100) {
              args[1] = 100;
            }
            return originalSetTimeout.apply(window, args);
          };
        })();
      }
    `).catch(() => {});
  }

  function showNotification(message, type) {
    if (window.FBrowser?.notify) {
      window.FBrowser.notify.show(message, type);
      return;
    }

    type = type || 'info';
    var notification = document.createElement('div');
    notification.className = 'power-notification power-notification-' + type;
    var iconSvg;
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#22c55e" stroke-width="2"/><path d="M6 10l3 3 5-5" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#f59e0b" stroke-width="2"/><path d="M10 6v4M10 14h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#ef4444" stroke-width="2"/><path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#4A90D9" stroke-width="2"/><path d="M10 6v4M10 14h.01" stroke="#4A90D9" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    notification.innerHTML = iconSvg + '<span class="power-notification-text">' + message + '</span>';
    document.body.appendChild(notification);
    setTimeout(function() {
      notification.classList.add('fade-out');
      setTimeout(function() { notification.remove(); }, 300);
    }, 3000);
  }

  function showOptimizationComplete(result) {
    var dialog = document.createElement('div');
    dialog.className = 'power-dialog-overlay';
    dialog.innerHTML =
      '<div class="power-dialog">' +
        '<div class="power-dialog-icon">' +
          '<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="#22c55e" stroke-width="3"/><path d="M16 24l6 6 10-10" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div class="power-dialog-title">优化完成</div>' +
        '<div class="power-dialog-stats">' +
          '<div class="power-stat"><span class="power-stat-value">' + result.frozenTabs + '</span><span class="power-stat-label">标签页已冻结</span></div>' +
          '<div class="power-stat"><span class="power-stat-value">' + result.clearedMB + ' MB</span><span class="power-stat-label">缓存已清理</span></div>' +
          '<div class="power-stat"><span class="power-stat-value">' + result.savedMemory + ' MB</span><span class="power-stat-label">内存已释放</span></div>' +
        '</div>' +
        '<button class="power-dialog-btn primary">确定</button>' +
      '</div>';
    dialog.querySelector('.power-dialog-btn').onclick = function() { dialog.remove(); };
    document.body.appendChild(dialog);
  }

  function showMediaTabsDialog(mediaTabs) {
    var tabList = '';
    mediaTabs.forEach(function(tab) {
      tabList += '<li>' + (tab.title || '未知页面') + '</li>';
    });
    var dialog = document.createElement('div');
    dialog.className = 'power-dialog-overlay';
    dialog.innerHTML =
      '<div class="power-dialog">' +
        '<div class="power-dialog-icon">' +
          '<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="#f59e0b" stroke-width="3"/><path d="M20 18v12l10-6z" fill="#f59e0b"/></svg>' +
        '</div>' +
        '<div class="power-dialog-title">检测到媒体播放</div>' +
        '<div class="power-dialog-desc">' +
          '以下 ' + mediaTabs.length + ' 个标签页正在播放媒体：' +
          '<ul class="power-media-list">' + tabList + '</ul>' +
        '</div>' +
        '<div class="power-dialog-actions">' +
          '<button class="power-dialog-btn secondary" data-action="keep">保持播放</button>' +
          '<button class="power-dialog-btn primary" data-action="freeze">冻结全部</button>' +
        '</div>' +
      '</div>';
    dialog.querySelector('[data-action="keep"]').onclick = function() { dialog.remove(); };
    dialog.querySelector('[data-action="freeze"]').onclick = function() {
      mediaTabs.forEach(function(tab) {
        if (window.FBrowser?.tabs?.freezeTab) {
          window.FBrowser.tabs.freezeTab(tab);
        }
      });
      dialog.remove();
    };
    document.body.appendChild(dialog);
  }

  loadConfig();

  if (window.electronAPI?.onWindowBlur) {
    blurListener = window.electronAPI.onWindowBlur(handleWindowBlur);
  }
  if (window.electronAPI?.onWindowFocus) {
    focusListener = window.electronAPI.onWindowFocus(handleWindowFocus);
  }

  if (config.enabled) {
    startMemoryMonitor();
    startCacheClear();
    applyOptimizations();

    if (config.apgEnabled && window.PerformanceGovernor) {
      window.PerformanceGovernor.start();
      window.electronAPI?.apgSetEnabled(true);
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.powerMode = {
    get config() { return config; },
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    enable: enable,
    disable: disable,
    enableAPG: enableAPG,
    disableAPG: disableAPG,
    handleWindowBlur: handleWindowBlur,
    handleWindowFocus: handleWindowFocus,
    freezeAllNonMediaTabs: freezeAllNonMediaTabs,
    performEmergencyCleanup: performEmergencyCleanup,
    showNotification: showNotification,
    injectThrottleScript: injectThrottleScript
  };
})();
