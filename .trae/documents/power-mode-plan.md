# 强力优化（性能模式）完整实现计划

## 功能概述
在设置中添加"强力优化"功能，提供全方位的浏览器性能优化，包括内存管理、CPU优化、网络加速、媒体优化、智能冻结等。

---

## 一、设置界面新增

### 1.1 性能优化设置区域 (src/index.html)

```html
<!-- 性能优化 -->
<div class="settings-content-section" id="section-performance">
  <div class="settings-section">
    <div class="settings-section-title">性能优化</div>
    
    <!-- 总开关 -->
    <div class="settings-card highlight">
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">🚀 强力优化模式</div>
          <div class="settings-row-desc">一键启用所有性能优化功能</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch" id="togglePowerMode">
            <div class="toggle-switch-track"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内存优化 -->
    <div class="settings-card">
      <div class="settings-card-title">💾 内存优化</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">自动冻结后台标签</div>
          <div class="settings-row-desc">后台标签页自动冻结以释放内存</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleAutoFreeze"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">冻结延迟</div>
          <div class="settings-row-desc">标签页进入后台后多久冻结</div>
        </div>
        <div class="settings-row-action">
          <select id="freezeDelay" class="settings-select">
            <option value="60000">1 分钟</option>
            <option value="300000" selected>5 分钟</option>
            <option value="900000">15 分钟</option>
            <option value="1800000">30 分钟</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">窗口失焦时冻结</div>
          <div class="settings-row-desc">浏览器失去焦点时冻结所有后台标签</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleFreezeOnBlur"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">内存警告阈值</div>
          <div class="settings-row-desc">内存使用超过阈值时自动清理</div>
        </div>
        <div class="settings-row-action">
          <select id="memoryThreshold" class="settings-select">
            <option value="500">500 MB</option>
            <option value="1000" selected>1 GB</option>
            <option value="2000">2 GB</option>
            <option value="0">关闭</option>
          </select>
        </div>
      </div>
    </div>

    <!-- CPU 优化 -->
    <div class="settings-card">
      <div class="settings-card-title">⚡ CPU 优化</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">后台标签节流</div>
          <div class="settings-row-desc">降低后台标签的 JavaScript 执行频率</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleBackgroundThrottle"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">动画帧率限制</div>
          <div class="settings-row-desc">后台标签动画限制为 30fps</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleAnimationThrottle"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">定时器节流</div>
          <div class="settings-row-desc">后台标签定时器最小间隔 1 秒</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleTimerThrottle"></div>
        </div>
      </div>
    </div>

    <!-- 网络优化 -->
    <div class="settings-card">
      <div class="settings-card-title">🌐 网络优化</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">DNS 预解析</div>
          <div class="settings-row-desc">预先解析常用域名加速访问</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleDnsPrefetch"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">预连接</div>
          <div class="settings-row-desc">预先建立 TCP 连接减少延迟</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="togglePreconnect"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">广告拦截</div>
          <div class="settings-row-desc">拦截广告和跟踪器提升速度</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch" id="toggleAdBlock"></div>
        </div>
      </div>
    </div>

    <!-- 媒体优化 -->
    <div class="settings-card">
      <div class="settings-card-title">📺 媒体优化</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">硬件视频解码</div>
          <div class="settings-row-desc">使用 GPU 加速视频播放</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleHwVideoDecode"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">自动暂停后台视频</div>
          <div class="settings-row-desc">标签页不可见时自动暂停视频</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch" id="togglePauseBackgroundVideo"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">媒体标签页保护</div>
          <div class="settings-row-desc">播放中的标签页询问后再冻结</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleMediaProtection"></div>
        </div>
      </div>
    </div>

    <!-- 缓存管理 -->
    <div class="settings-card">
      <div class="settings-card-title">🧹 缓存管理</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">自动清理缓存</div>
          <div class="settings-row-desc">定时清理浏览器缓存释放空间</div>
        </div>
        <div class="settings-row-action">
          <select id="cacheClearInterval" class="settings-select">
            <option value="0">关闭</option>
            <option value="3600000">每小时</option>
            <option value="21600000" selected>每 6 小时</option>
            <option value="86400000">每天</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">缓存大小限制</div>
          <div class="settings-row-desc">超过限制时自动清理旧缓存</div>
        </div>
        <div class="settings-row-action">
          <select id="cacheSizeLimit" class="settings-select">
            <option value="256">256 MB</option>
            <option value="512" selected>512 MB</option>
            <option value="1024">1 GB</option>
            <option value="2048">2 GB</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">清理时保留登录状态</div>
          <div class="settings-row-desc">清理缓存时保留 Cookie 和登录信息</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleKeepCookies"></div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">立即清理</div>
          <div class="settings-row-desc">手动清理所有缓存数据</div>
        </div>
        <div class="settings-row-action">
          <button class="settings-btn" id="btnClearCacheNow">清理</button>
        </div>
      </div>
    </div>

    <!-- 高级选项 -->
    <div class="settings-card">
      <div class="settings-card-title">🔧 高级选项</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">GPU 进程优先级</div>
          <div class="settings-row-desc">调整 GPU 进程的系统优先级</div>
        </div>
        <div class="settings-row-action">
          <select id="gpuPriority" class="settings-select">
            <option value="low">低</option>
            <option value="normal" selected>正常</option>
            <option value="high">高</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">渲染进程数限制</div>
          <div class="settings-row-desc">限制最大渲染进程数量</div>
        </div>
        <div class="settings-row-action">
          <select id="rendererLimit" class="settings-select">
            <option value="4">4 个</option>
            <option value="8" selected>8 个</option>
            <option value="16">16 个</option>
            <option value="0">不限制</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-label">显示优化通知</div>
          <div class="settings-row-desc">优化完成后显示释放的资源量</div>
        </div>
        <div class="settings-row-action">
          <div class="toggle-switch active" id="toggleShowNotifications"></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 二、核心功能实现

### 2.1 性能模式管理器 (src/js/modules/power-mode.js)

```javascript
// ==================== 性能模式管理器 ====================
(function() {
  'use strict';

  // 默认配置
  const DEFAULT_CONFIG = {
    enabled: false,
    
    // 内存优化
    autoFreeze: true,
    freezeDelay: 300000,
    freezeOnBlur: true,
    memoryThreshold: 1000,
    
    // CPU 优化
    backgroundThrottle: true,
    animationThrottle: true,
    timerThrottle: true,
    
    // 网络优化
    dnsPrefetch: true,
    preconnect: true,
    adBlock: false,
    
    // 媒体优化
    hwVideoDecode: true,
    pauseBackgroundVideo: false,
    mediaProtection: true,
    
    // 缓存管理
    cacheClearInterval: 21600000,
    cacheSizeLimit: 512,
    keepCookies: true,
    
    // 高级选项
    gpuPriority: 'normal',
    rendererLimit: 8,
    showNotifications: true
  };

  let config = { ...DEFAULT_CONFIG };
  let cacheClearTimer = null;
  let memoryCheckTimer = null;

  // 加载配置
  function loadConfig() {
    try {
      const saved = localStorage.getItem('f-power-mode');
      if (saved) {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  // 保存配置
  function saveConfig() {
    localStorage.setItem('f-power-mode', JSON.stringify(config));
  }

  // 启用性能模式
  function enable() {
    config.enabled = true;
    saveConfig();
    
    startMemoryMonitor();
    startCacheClear();
    applyOptimizations();
    
    showNotification('性能模式已启用');
  }

  // 禁用性能模式
  function disable() {
    config.enabled = false;
    saveConfig();
    
    stopMemoryMonitor();
    stopCacheClear();
    revertOptimizations();
    
    showNotification('性能模式已禁用');
  }

  // 应用优化
  function applyOptimizations() {
    // CPU 节流
    if (config.backgroundThrottle) {
      enableBackgroundThrottle();
    }
    
    // 网络优化
    if (config.dnsPrefetch) {
      enableDnsPrefetch();
    }
    
    // 媒体优化
    if (config.hwVideoDecode) {
      enableHwVideoDecode();
    }
  }

  // ========== 内存监控 ==========
  function startMemoryMonitor() {
    if (memoryCheckTimer) clearInterval(memoryCheckTimer);
    
    memoryCheckTimer = setInterval(async () => {
      if (!config.enabled || config.memoryThreshold === 0) return;
      
      const memData = await window.electronAPI.getPerformanceData();
      if (!memData) return;
      
      const usedMB = parseInt(memData.memory);
      if (usedMB > config.memoryThreshold) {
        performEmergencyCleanup();
      }
    }, 30000);
  }

  function stopMemoryMonitor() {
    if (memoryCheckTimer) {
      clearInterval(memoryCheckTimer);
      memoryCheckTimer = null;
    }
  }

  // 紧急清理
  async function performEmergencyCleanup() {
    const result = {
      frozenTabs: 0,
      clearedMB: 0,
      savedMemory: 0
    };

    // 冻结所有后台标签
    const tabs = window.FBrowser.tabs.tabs;
    const activeId = window.FBrowser.tabs.activeTabId;
    
    for (const tab of tabs) {
      if (tab.id !== activeId && !tab.frozen) {
        await freezeTabSmart(tab);
        result.frozenTabs++;
      }
    }

    // 清理缓存
    const cacheResult = await window.electronAPI.clearCache({
      keepCookies: config.keepCookies
    });
    result.clearedMB = cacheResult.clearedMB || 0;

    // 强制垃圾回收
    if (window.gc) window.gc();

    // 计算节省的内存
    const newMem = await window.electronAPI.getPerformanceData();
    result.savedMemory = parseInt(memData.memory) - parseInt(newMem.memory);

    if (config.showNotifications) {
      showOptimizationComplete(result);
    }
  }

  // ========== 智能冻结 ==========
  async function freezeTabSmart(tab) {
    if (!tab || !tab.webview || tab.frozen) return;
    
    // 检查是否正在播放媒体
    if (config.mediaProtection) {
      const isPlaying = await isTabPlayingMedia(tab);
      if (isPlaying) {
        const shouldFreeze = await showMediaDialog(tab);
        if (!shouldFreeze) return;
      }
    }
    
    // 执行冻结
    window.FBrowser.tabs.freezeTab(tab);
  }

  // 检测媒体播放
  async function isTabPlayingMedia(tab) {
    if (!tab.webview) return false;
    
    try {
      return await tab.webview.executeJavaScript(`
        (function() {
          const videos = document.querySelectorAll('video');
          const audios = document.querySelectorAll('audio');
          
          for (const v of videos) {
            if (!v.paused && !v.muted) return true;
          }
          for (const a of audios) {
            if (!a.paused && !a.muted) return true;
          }
          
          return false;
        })();
      `);
    } catch (e) {
      return false;
    }
  }

  // ========== 窗口焦点处理 ==========
  function handleWindowBlur() {
    if (!config.enabled || !config.freezeOnBlur) return;
    freezeAllNonMediaTabs();
  }

  function handleWindowFocus() {
    if (!config.enabled) return;
    // 可选：自动解冻最后使用的标签
  }

  async function freezeAllNonMediaTabs() {
    const tabs = window.FBrowser.tabs.tabs;
    const activeId = window.FBrowser.tabs.activeTabId;
    const mediaTabs = [];
    
    for (const tab of tabs) {
      if (tab.id === activeId || tab.frozen) continue;
      
      const isPlaying = await isTabPlayingMedia(tab);
      if (isPlaying && config.mediaProtection) {
        mediaTabs.push(tab);
      } else {
        window.FBrowser.tabs.freezeTab(tab);
      }
    }
    
    if (mediaTabs.length > 0) {
      showMediaTabsDialog(mediaTabs);
    }
  }

  // ========== 缓存清理 ==========
  function startCacheClear() {
    if (cacheClearTimer) clearInterval(cacheClearTimer);
    
    if (config.cacheClearInterval === 0) return;
    
    cacheClearTimer = setInterval(async () => {
      const result = await window.electronAPI.clearCache({
        keepCookies: config.keepCookies,
        maxSize: config.cacheSizeLimit
      });
      
      if (result.success && config.showNotifications) {
        showNotification(`已清理 ${result.clearedMB} MB 缓存`);
      }
    }, config.cacheClearInterval);
  }

  function stopCacheClear() {
    if (cacheClearTimer) {
      clearInterval(cacheClearTimer);
      cacheClearTimer = null;
    }
  }

  // ========== 后台节流 ==========
  function enableBackgroundThrottle() {
    // 注入节流脚本到所有 webview
    const tabs = window.FBrowser.tabs.tabs;
    tabs.forEach(tab => {
      if (tab.webview && !tab.frozen) {
        injectThrottleScript(tab.webview);
      }
    });
  }

  function injectThrottleScript(webview) {
    webview.executeJavaScript(`
      if (!window.__throttleInjected) {
        window.__throttleInjected = true;
        
        // 节流 requestAnimationFrame
        const originalRAF = window.requestAnimationFrame;
        let lastTime = 0;
        window.requestAnimationFrame = function(callback) {
          if (document.hidden) {
            // 后台时降低到 30fps
            const now = performance.now();
            if (now - lastTime < 33) {
              return originalRAF.call(window, () => {
                setTimeout(() => callback(now), 33 - (now - lastTime));
              });
            }
          }
          return originalRAF.call(window, callback);
        };
        
        // 节流 setInterval
        const originalSetInterval = window.setInterval;
        window.setInterval = function(fn, delay, ...args) {
          if (document.hidden && delay < 1000) {
            delay = 1000; // 最小 1 秒
          }
          return originalSetInterval.call(window, fn, delay, ...args);
        };
      }
    `).catch(() => {});
  }

  // ========== UI 组件 ==========
  function showNotification(message) {
    if (!config.showNotifications) return;
    
    const notification = document.createElement('div');
    notification.className = 'power-notification';
    notification.innerHTML = `
      <span class="power-notification-icon">✨</span>
      <span class="power-notification-text">${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function showOptimizationComplete(result) {
    const dialog = document.createElement('div');
    dialog.className = 'power-dialog-overlay';
    dialog.innerHTML = `
      <div class="power-dialog">
        <div class="power-dialog-icon">🚀</div>
        <div class="power-dialog-title">优化完成</div>
        <div class="power-dialog-stats">
          <div class="power-stat">
            <span class="power-stat-value">${result.frozenTabs}</span>
            <span class="power-stat-label">标签页已冻结</span>
          </div>
          <div class="power-stat">
            <span class="power-stat-value">${result.clearedMB} MB</span>
            <span class="power-stat-label">缓存已清理</span>
          </div>
          <div class="power-stat">
            <span class="power-stat-value">${result.savedMemory} MB</span>
            <span class="power-stat-label">内存已释放</span>
          </div>
        </div>
        <button class="power-dialog-btn">确定</button>
      </div>
    `;
    
    dialog.querySelector('.power-dialog-btn').onclick = () => dialog.remove();
    document.body.appendChild(dialog);
  }

  function showMediaTabsDialog(mediaTabs) {
    const dialog = document.createElement('div');
    dialog.className = 'power-dialog-overlay';
    dialog.innerHTML = `
      <div class="power-dialog">
        <div class="power-dialog-icon">🎵</div>
        <div class="power-dialog-title">检测到媒体播放</div>
        <div class="power-dialog-desc">
          以下 ${mediaTabs.length} 个标签页正在播放媒体：
          <ul class="power-media-list">
            ${mediaTabs.map(t => `<li>${t.title || '未知页面'}</li>`).join('')}
          </ul>
        </div>
        <div class="power-dialog-actions">
          <button class="power-dialog-btn secondary" data-action="keep">保持播放</button>
          <button class="power-dialog-btn primary" data-action="freeze">冻结全部</button>
        </div>
      </div>
    `;
    
    dialog.querySelector('[data-action="keep"]').onclick = () => dialog.remove();
    dialog.querySelector('[data-action="freeze"]').onclick = () => {
      mediaTabs.forEach(tab => window.FBrowser.tabs.freezeTab(tab));
      dialog.remove();
    };
    
    document.body.appendChild(dialog);
  }

  // ========== 导出 ==========
  window.FBrowser = window.FBrowser || {};
  window.FBrowser.powerMode = {
    get config() { return config; },
    loadConfig,
    saveConfig,
    enable,
    disable,
    handleWindowBlur,
    handleWindowFocus,
    freezeAllNonMediaTabs,
    performEmergencyCleanup
  };
})();
```

---

## 三、主进程支持 (main/ipc-handlers.js)

### 3.1 缓存清理 API

```javascript
// 清理缓存
ipcMain.handle('clear-cache', async (event, options = {}) => {
  const mainWin = getMainWindow();
  if (!mainWin) return { success: false };
  
  try {
    const session = mainWin.webContents.session;
    let clearedBytes = 0;
    
    // 获取清理前大小
    const beforeSize = await session.getCacheSize();
    
    // 清除 HTTP 缓存
    await session.clearCache();
    clearedBytes += beforeSize;
    
    // 可选：清除存储数据
    if (!options.keepCookies) {
      await session.clearStorageData({
        storages: ['localstorage', 'sessionstorage', 'indexdb', 'serviceworkers', 'cachestorage']
      });
    } else {
      await session.clearStorageData({
        storages: ['localstorage', 'sessionstorage', 'indexdb', 'serviceworkers', 'cachestorage']
      });
    }
    
    // 强制垃圾回收
    if (global.gc) global.gc();
    
    return {
      success: true,
      clearedMB: Math.round(clearedBytes / 1024 / 1024)
    };
  } catch (e) {
    console.error('[Cache] 清理失败:', e);
    return { success: false, error: e.message };
  }
});

// 获取缓存大小
ipcMain.handle('get-cache-size', async () => {
  const mainWin = getMainWindow();
  if (!mainWin) return 0;
  
  try {
    const size = await mainWin.webContents.session.getCacheSize();
    return Math.round(size / 1024 / 1024);
  } catch (e) {
    return 0;
  }
});
```

### 3.2 窗口焦点事件

```javascript
// 在 createWindow 中添加
function setupWindowEvents(mainWindow) {
  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window-blur');
  });
  
  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus');
  });
}
```

---

## 四、预加载脚本 (preload.js)

```javascript
// 性能模式相关 API
clearCache: (options) => ipcRenderer.invoke('clear-cache', options),
getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
onWindowBlur: (cb) => ipcRenderer.on('window-blur', cb),
onWindowFocus: (cb) => ipcRenderer.on('window-focus', cb),
```

---

## 五、CSS 样式 (src/css/settings.css)

```css
/* 性能模式通知 */
.power-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bg-1);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  z-index: 10000;
  animation: slideIn 0.3s ease;
}

.power-notification.fade-out {
  animation: slideOut 0.3s ease forwards;
}

/* 性能模式对话框 */
.power-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  animation: fadeIn 0.2s ease;
}

.power-dialog {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  text-align: center;
}

.power-dialog-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.power-dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.power-dialog-stats {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
}

.power-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.power-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
}

.power-stat-label {
  font-size: 12px;
  color: var(--fg-2);
}

.power-media-list {
  text-align: left;
  margin: 12px 0;
  padding-left: 20px;
  max-height: 150px;
  overflow-y: auto;
}

.power-dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.power-dialog-btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.power-dialog-btn.primary {
  background: var(--accent);
  color: #fff;
}

.power-dialog-btn.secondary {
  background: var(--bg-2);
  color: var(--fg-0);
}

/* 设置卡片高亮 */
.settings-card.highlight {
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(74,144,217,0.1), transparent);
}

.settings-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-1);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
```

---

## 六、文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/index.html` | 添加性能优化设置区域 |
| `src/css/settings.css` | 添加通知和对话框样式 |
| `src/js/modules/power-mode.js` | 新建 - 性能模式管理器 |
| `src/js/modules/tabs.js` | 集成智能冻结逻辑 |
| `src/js/modules/settings.js` | 添加性能设置绑定 |
| `main/ipc-handlers.js` | 添加缓存清理 API |
| `main/window-manager.js` | 添加窗口焦点事件 |
| `preload.js` | 添加新 IPC 接口 |

---

## 七、实现步骤

### 阶段一：基础框架
1. 创建 `power-mode.js` 模块
2. 添加设置界面 HTML
3. 添加 CSS 样式

### 阶段二：内存优化
4. 实现智能冻结逻辑
5. 实现窗口失焦处理
6. 实现媒体检测和保护

### 阶段三：CPU/网络优化
7. 实现后台节流脚本
8. 实现动画帧率限制
9. 实现 DNS 预解析

### 阶段四：缓存管理
10. 实现缓存清理 API
11. 实现定时清理
12. 实现内存阈值监控

### 阶段五：UI 和通知
13. 实现优化完成通知
14. 实现媒体标签页对话框
15. 测试和调试

---

## 八、验收标准

- [ ] 性能模式总开关正常工作
- [ ] 内存优化功能完整（冻结、阈值监控）
- [ ] CPU 优化功能有效（节流、帧率限制）
- [ ] 网络优化功能正常
- [ ] 媒体优化和保护功能正常
- [ ] 缓存自动清理正常工作
- [ ] 窗口失焦时正确处理标签页
- [ ] 媒体标签页显示询问对话框
- [ ] 优化完成显示详细统计
- [ ] 所有设置正确保存和恢复
- [ ] 不影响正常浏览体验
