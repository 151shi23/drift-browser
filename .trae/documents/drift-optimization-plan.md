# Drift 浏览器深度优化计划

## 任务概述
1. 扩展管理功能增强：删除扩展（含本地文件）、打开扩展目录
2. **深度内存优化**：彻底解决内存占用问题，目标10标签页控制在2GB以内

---

## 一、扩展管理功能

### 1.1 实施步骤

#### 步骤1: 后端添加删除扩展文件功能
**文件**: `main/extensions.js`
- 新增 `deleteExtension(extId)` 函数
- 删除本地文件目录
- 清除状态配置

#### 步骤2: 后端添加打开扩展目录功能
**文件**: `main/extensions.js`
- 新增 `openExtensionFolder(extId)` 函数
- 使用 `shell.openPath()` 打开目录

#### 步骤3: 添加 IPC 接口
**文件**: `main/ipc-handlers.js`, `preload.js`

#### 步骤4: 前端UI修改
**文件**: `src/js/modules/extensions.js`
- 修改删除按钮调用新接口
- 添加"打开目录"按钮

---

## 二、深度内存优化

### 2.1 问题根源分析

| 问题 | 影响 | 当前状态 |
|------|------|----------|
| webview 共享进程 | 内存不隔离，泄漏累积 | ❌ 未优化 |
| 后台标签持续运行 | CPU+内存持续占用 | ❌ 未优化 |
| 无内存压力管理 | 内存无限增长 | ❌ 未优化 |
| 缓存无限制 | 磁盘+内存占用大 | ❌ 未优化 |
| 无渲染进程限制 | 进程数失控 | ❌ 未优化 |

### 2.2 深度优化策略

#### 策略1: 渲染进程管理（核心优化）

**文件**: `main/window-manager.js`

```javascript
// 主窗口创建时配置
mainWindow = new BrowserWindow({
  webPreferences: {
    // 关键配置
    webviewTag: true,
    sandbox: true,                    // 启用沙箱隔离
    enablePreferredSizeMode: true,    // 智能尺寸模式
    backgroundThrottling: true,       // 后台节流
    
    // 进程隔离配置
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    
    // 内存优化
    spellcheck: false,                // 禁用拼写检查节省内存
    enableWebSQL: false,              // 禁用 WebSQL
  },
});
```

#### 策略2: webview 独立进程 + 资源限制

**文件**: `src/js/modules/tabs.js`

```javascript
function createWebview(tab, url) {
  const wv = document.createElement('webview');
  
  // === 核心优化：进程隔离 ===
  // 每个标签页使用独立 partition，实现进程隔离
  const partitionId = `persist:tab-${tab.id}`;
  wv.setAttribute('partition', partitionId);
  
  // === 资源限制 ===
  wv.setAttribute('webpreferences', [
    'contextIsolation=yes',
    'sandbox=yes',
    'enablePreferredSizeMode=yes',
    'backgroundThrottling=yes',      // 后台节流
    'disableBlinkFeatures=AudioOutput', // 禁用后台音频
  ].join(','));
  
  // === 内存节省 ===
  wv.setAttribute('httpreferrer', '');
  wv.setAttribute('disablewebsecurity', 'false');
  
  // === 预加载优化 ===
  // 延迟加载非活动标签
  if (!isFirstTab) {
    wv.setAttribute('src', 'about:blank');
    tab.pendingUrl = url;
    tab.lazyLoad = true;
  } else {
    wv.setAttribute('src', url);
  }
  
  // ... 其余代码
}
```

#### 策略3: 激进的后台标签冻结

**文件**: `src/js/modules/tabs.js`

```javascript
// === 后台标签冻结机制 ===
const FREEZE_DELAY = 60000;           // 60秒后冻结
const KEEP_ACTIVE_COUNT = 3;          // 保持3个活跃标签
const MAX_PROCESS_COUNT = 8;          // 最大渲染进程数

let freezeTimers = new Map();

function scheduleFreeze(tabId) {
  // 清除之前的定时器
  if (freezeTimers.has(tabId)) {
    clearTimeout(freezeTimers.get(tabId));
  }
  
  // 设置新的冻结定时器
  const timer = setTimeout(() => {
    freezeTab(tabId);
  }, FREEZE_DELAY);
  
  freezeTimers.set(tabId, timer);
}

function freezeTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || tab.id === activeTabId || !tab.webview) return;
  
  console.log(`[Memory] 冻结标签页: ${tab.url}`);
  
  // 1. 保存状态
  tab.frozenUrl = tab.webview.getURL();
  tab.frozenTitle = tab.element.querySelector('.tab-title')?.textContent;
  
  // 2. 执行冻结脚本（暂停所有活动）
  tab.webview.executeJavaScript(`
    (function() {
      // 暂停视频/音频
      document.querySelectorAll('video, audio').forEach(el => {
        el.pause();
        el.dataset.wasPlaying = !el.paused;
      });
      
      // 停止动画
      document.querySelectorAll('iframe, embed, object').forEach(el => {
        el.style.display = 'none';
      });
      
      // 暂停 WebSocket
      if (window.WebSocket) {
        window.__frozenSockets = window.__frozenSockets || [];
        // 记录但不关闭
      }
      
      return 'frozen';
    })();
  `).catch(() => {});
  
  // 3. 导航到空白页释放内存（激进模式）
  tab.webview.loadURL('about:blank');
  tab.isFrozen = true;
}

function unfreezeTab(tab) {
  if (!tab.isFrozen || !tab.frozenUrl) return;
  
  console.log(`[Memory] 解冻标签页: ${tab.frozenUrl}`);
  
  // 恢复页面
  tab.webview.loadURL(tab.frozenUrl);
  tab.isFrozen = false;
  tab.frozenUrl = null;
}

// 切换标签时处理冻结状态
function switchTab(id) {
  // 取消新标签的冻结计划
  if (freezeTimers.has(id)) {
    clearTimeout(freezeTimers.get(id));
    freezeTimers.delete(id);
  }
  
  // 解冻目标标签
  const tab = tabs.find(t => t.id === id);
  if (tab?.isFrozen) {
    unfreezeTab(tab);
  }
  
  // 为当前活跃标签安排冻结
  if (activeTabId && activeTabId !== id) {
    scheduleFreeze(activeTabId);
  }
  
  // ... 其余切换逻辑
}
```

#### 策略4: 内存压力自动释放

**文件**: `main/window-manager.js`

```javascript
const v8 = require('v8');

// 内存监控和自动释放
let memoryCheckInterval;

function startMemoryMonitor() {
  memoryCheckInterval = setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const usedMB = Math.round(heapStats.used_heap_size / 1024 / 1024);
    const limitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    const usagePercent = (usedMB / limitMB) * 100;
    
    console.log(`[Memory] 堆内存: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`);
    
    // 内存压力分级处理
    if (usagePercent > 80) {
      // 严重压力：强制 GC
      console.log('[Memory] 严重内存压力，触发强制释放');
      global.gc?.();
      mainWindow?.webContents.send('memory-critical', usedMB);
    } else if (usagePercent > 60) {
      // 中等压力：通知渲染进程释放
      mainWindow?.webContents.send('memory-pressure', usedMB);
    }
  }, 15000); // 每15秒检查
}

// 启动时开启监控
app.whenReady().then(() => {
  startMemoryMonitor();
  // ...
});
```

**文件**: `src/js/modules/tabs.js` (前端响应)

```javascript
// 监听内存压力事件
window.electronAPI?.onMemoryPressure?.((usedMB) => {
  console.log(`[Memory] 收到内存压力通知: ${usedMB}MB`);
  
  // 冻结所有非活跃标签
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && !tab.isFrozen) {
      freezeTab(tab.id);
    }
  });
  
  // 清理缓存
  cleanupResources();
});

function cleanupResources() {
  // 清理主页缓存
  const homeGrid = document.querySelector('#homePage .home-grid');
  if (homeGrid) {
    homeGrid.querySelectorAll('img').forEach(img => {
      if (!img.complete) img.src = '';
    });
  }
  
  // 清理隐藏的 webview
  document.querySelectorAll('webview:not(.visible)').forEach(wv => {
    if (wv.getURL() !== 'about:blank') {
      wv.loadURL('about:blank');
    }
  });
}
```

#### 策略5: 智能缓存管理

**文件**: `main/window-manager.js`

```javascript
// Session 缓存配置
function configureSession() {
  const ses = session.defaultSession;
  
  // 缓存大小限制
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // 限制缓存
        'Cache-Control': ['max-age=3600']
      }
    });
  });
  
  // 定期清理缓存
  setInterval(async () => {
    try {
      await ses.clearCache();
      console.log('[Memory] 缓存已清理');
    } catch (e) {}
  }, 1800000); // 每30分钟
}

// 启动时配置
app.whenReady().then(() => {
  configureSession();
  // ...
});
```

#### 策略6: 标签页关闭彻底清理

**文件**: `src/js/modules/tabs.js`

```javascript
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
      
      // 2. 执行清理脚本
      tab.webview.executeJavaScript(`
        // 清理定时器
        for(let i = window.setTimeout(() => {}, 0); i > 0; i--) {
          window.clearTimeout(i);
          window.clearInterval(i);
        }
        // 清理事件监听
        window.onbeforeunload = null;
      `).catch(() => {});
      
      // 3. 移除所有事件监听
      const newWv = tab.webview.cloneNode(false);
      tab.webview.parentNode?.replaceChild(newWv, tab.webview);
      newWv.remove();
      
      // 4. 清除引用
      tab.webview = null;
    } catch (e) {
      console.error('[Memory] 清理 webview 失败:', e);
    }
  }
  
  // === 清理标签数据 ===
  tab.element.classList.add('closing');
  tab.element.addEventListener('animationend', () => {
    tab.element.remove();
  }, { once: true });
  
  // 清除冻结定时器
  if (freezeTimers.has(id)) {
    clearTimeout(freezeTimers.get(id));
    freezeTimers.delete(id);
  }
  
  // 清除标签数据
  tabs.splice(idx, 1);
  tab = null;
  
  // === 触发内存建议 ===
  if (tabs.length < 5) {
    // 标签页较少时建议 GC
    window.gc?.();
  }
  
  // ... 其余逻辑
}
```

#### 策略7: 渲染进程数量限制

**文件**: `main/window-manager.js`

```javascript
// 限制渲染进程数量
app.commandLine.appendSwitch('max-renderer-processes', '8');
app.commandLine.appendSwitch('renderer-process-limit', '8');

// 进程共享策略
app.commandLine.appendSwitch('process-per-site-instance', 'false');
app.commandLine.appendSwitch('process-per-site', 'true');  // 同站点共享进程

// 内存节省模式
app.commandLine.appendSwitch('enable-low-res-tiling', 'true');
app.commandLine.appendSwitch('enable-low-end-device-mode', 'true');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-compositor-resources', 'true');

// 禁用不必要的功能
app.commandLine.appendSwitch('disable-extensions-except', '');
app.commandLine.appendSwitch('disable-plugins', 'true');
app.commandLine.appendSwitch('disable-software-rasterizer', 'true');
```

### 2.3 优化效果预期

| 优化项 | 预期效果 |
|--------|----------|
| 进程隔离 | 防止内存泄漏扩散 |
| 后台冻结 | 后台标签内存降低70% |
| 内存监控 | 自动释放，防止OOM |
| 缓存管理 | 减少磁盘和内存占用 |
| 进程限制 | 最多8个渲染进程 |
| 彻底清理 | 关闭标签完全释放 |

**目标**: 10个标签页内存占用 < 2GB

---

## 三、实施顺序

| 序号 | 任务 | 文件 | 风险 |
|------|------|------|------|
| 1 | 扩展删除功能 | main/extensions.js | 低 |
| 2 | 扩展打开目录功能 | main/extensions.js | 低 |
| 3 | IPC 接口 | main/ipc-handlers.js, preload.js | 低 |
| 4 | 前端扩展管理UI | src/js/modules/extensions.js | 低 |
| 5 | 启动参数优化 | main.js (新增) | 低 |
| 6 | Session 缓存配置 | main/window-manager.js | 低 |
| 7 | 内存监控 | main/window-manager.js | 低 |
| 8 | webview 进程隔离 | src/js/modules/tabs.js | 中 |
| 9 | 后台标签冻结 | src/js/modules/tabs.js | 中 |
| 10 | 标签关闭彻底清理 | src/js/modules/tabs.js | 中 |
| 11 | 前端内存响应 | src/js/modules/tabs.js | 低 |

---

## 四、测试验证

### 内存测试方案
1. 打开10个标准网页（知乎、B站、微博等）
2. 等待5分钟稳定
3. 记录任务管理器内存占用
4. 切换标签测试流畅度
5. 关闭标签验证内存释放

### 预期结果
- 初始内存: < 500MB
- 10标签页: < 2GB
- 关闭后释放: > 80%
