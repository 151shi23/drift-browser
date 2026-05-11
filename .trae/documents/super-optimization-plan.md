# Drift 浏览器超级优化方案 — 自适应性能调控引擎

## 目标

打开 20 个抖音/B站等极度消耗资源的标签页，总内存占用 ≤ 1GB。

---

## 一、现状分析

### 1.1 当前性能优化机制

| 模块 | 文件 | 当前能力 | 问题 |
|------|------|----------|------|
| 性能模式 | `src/js/modules/power-mode.js` | 静态开关+固定阈值 | 无自适应，配置写死 |
| 标签冻结 | `src/js/modules/tabs.js` | 5分钟冻结→about:blank | 冻结策略单一，无分级 |
| 内存监控 | `main/window-manager.js` | V8堆统计，15秒轮询 | 仅监控主进程堆，不监控webview子进程 |
| 后台节流 | `power-mode.js` | JS注入RAF/setInterval节流 | 注入时机不可靠，页面可绕过 |
| 缓存清理 | `main/ipc-handlers.js` | 手动/定时全量清理 | 无智能策略，可能清掉视频缓冲 |
| 广告拦截 | `src/js/modules/ad-blocker.js` | 域名+正则匹配 | 仅前端判断，未接入webRequest |
| 进程管理 | `main.js` | `max-renderer-processes=8` | 固定值，不随负载调整 |

### 1.2 核心瓶颈

1. **每个webview独立渲染进程**：20个抖音标签 = 20个渲染进程，每个100-200MB = 2-4GB
2. **冻结只是导航到about:blank**：进程仍在，内存未真正释放
3. **无系统级资源感知**：不知道Windows整体内存压力
4. **无用户行为学习**：不知道用户哪些标签常用、哪些可以激进冻结
5. **广告/追踪脚本未在请求层拦截**：大量无效资源加载

### 1.3 内存占用实测估算（20个视频标签页）

| 组件 | 当前占用 | 优化后目标 |
|------|----------|-----------|
| 主进程 | ~80MB | ~60MB |
| GPU进程 | ~120MB | ~100MB |
| 活跃webview(1个) | ~150MB | ~120MB |
| 冻结webview(19个) | ~1900MB(进程仍在) | ~95MB(5MB×19，进程已释放) |
| 缓存/其他 | ~250MB | ~125MB |
| **合计** | **~2500MB** | **~500MB** |

---

## 二、架构设计：自适应性能调控引擎 (Adaptive Performance Governor)

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    自适应性能调控引擎 (APG)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 系统资源感知  │  │ 用户行为学习  │  │    决策引擎 (核心)    │  │
│  │              │  │              │  │                      │  │
│  │ · Windows内存 │  │ · 标签使用频率│  │ · 压力等级判定       │  │
│  │ · CPU使用率   │  │ · 切换间隔    │  │ · 策略选择           │  │
│  │ · 磁盘IO     │  │ · 媒体播放习惯│  │ · 动态参数调整       │  │
│  │ · 进程数     │  │ · 时段偏好    │  │ · 预测性冻结         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────────┬────┘                      │              │
│                      │                           │              │
│                      ▼                           ▼              │
│              ┌──────────────────────────────────────┐          │
│              │          执行层 (Executors)           │          │
│              │                                      │          │
│              │  ┌─────────┐ ┌─────────┐ ┌────────┐│          │
│              │  │进程调控器│ │冻结调控器│ │资源调控器││          │
│              │  └─────────┘ └─────────┘ └────────┘│          │
│              │  ┌─────────┐ ┌─────────┐ ┌────────┐│          │
│              │  │媒体调控器│ │网络调控器│ │缓存调控器││          │
│              │  └─────────┘ └─────────┘ └────────┘│          │
│              └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 五级压力模型

| 压力等级 | 系统内存占用 | 浏览器内存占用 | 策略 |
|----------|-------------|---------------|------|
| 🟢 空闲 | < 50% | < 400MB | 无限制，全量运行 |
| 🟡 轻度 | 50-65% | 400-600MB | 后台节流，轻量冻结 |
| 🟠 中度 | 65-80% | 600-800MB | 激进冻结，进程合并，广告拦截 |
| 🔴 重度 | 80-90% | 800-1000MB | 丢弃非活跃标签，强制进程共享 |
| ⚫ 紧急 | > 90% | > 1000MB | 紧急丢弃，仅保留1个活跃标签 |

### 2.3 冻结策略分级

| 策略 | 操作 | 内存释放 | 恢复时间 |
|------|------|---------|---------|
| L0-无冻结 | 无操作 | 0% | 0s |
| L1-轻量节流 | 注入JS节流脚本 | ~10% | 即时 |
| L2-媒体暂停 | 暂停视频/音频+隐藏iframe | ~30% | ~0.5s |
| L3-进程挂起 | webview.setBackgroundThrottling(true)+停止JS | ~50% | ~1s |
| L4-导航丢弃 | 导航到about:blank，释放渲染进程 | ~90% | ~2-3s(重新加载) |
| L5-进程销毁 | 移除webview DOM，彻底销毁进程 | ~95% | ~3-5s(重建webview) |

---

## 三、模块设计

### 3.1 系统资源感知器（主进程）

**文件**: `main/resource-monitor.js`（新建）

功能：
- 每5秒采集一次系统资源数据
- 使用 `os.freemem()`/`os.totalmem()` 获取Windows内存
- 使用 `process.memoryUsage()` 获取浏览器各进程内存
- 通过 `webContents.getAllWebContents()` 遍历所有webview进程内存
- 使用 `process.cpuUsage()` 计算CPU使用率
- 将数据通过IPC推送给渲染进程

```javascript
// 核心数据结构
{
  timestamp: number,
  system: {
    totalMemory: number,      // MB
    freeMemory: number,       // MB
    memoryPressure: number,   // 0-1
    cpuUsage: number          // 0-1
  },
  browser: {
    mainProcessMemory: number, // MB
    rendererProcesses: [{
      webContentsId: number,
      url: string,
      memory: number,          // MB
      cpuPercent: number,
      type: 'webview'|'main'|'extension'
    }],
    totalMemory: number,       // MB
    gpuProcessMemory: number   // MB
  },
  tabs: [{
    tabId: number,
    url: string,
    isAudible: boolean,
    isFullscreen: boolean,
    lastActiveTime: number,
    freezeLevel: 0-5
  }]
}
```

### 3.2 用户行为学习器（渲染进程）

**文件**: `src/js/modules/behavior-learner.js`（新建）

功能：
- 记录每个标签的切换频率、停留时长
- 学习用户的标签使用模式（哪些标签常用、哪些是"打开就忘"）
- 预测用户下一步可能切换的标签（提前解冻）
- 识别媒体播放习惯（是否习惯后台听歌）
- 时段偏好（工作时间 vs 休闲时间）

```javascript
// 行为数据结构
{
  tabs: {
    [tabId]: {
      switchCount: number,
      totalActiveTime: number,
      lastSwitchTime: number,
      avgStayDuration: number,
      isMediaTab: boolean,
      siteCategory: 'video'|'social'|'work'|'other',
      priority: number  // 0-1, 越高越不应冻结
    }
  },
  patterns: {
    frequentSwitchIds: [],    // 最近频繁切换的标签
    predictedNextIds: [],     // 预测下一步切换的标签
    mediaPlayingIds: [],      // 正在播放媒体的标签
    longIdleIds: []           // 长时间未访问的标签
  }
}
```

### 3.3 决策引擎（渲染进程）

**文件**: `src/js/modules/performance-governor.js`（新建，替代现有 power-mode.js）

核心逻辑：
1. 接收系统资源数据 + 用户行为数据
2. 计算当前压力等级
3. 为每个标签决定最优冻结策略
4. 考虑预测性解冻（提前解冻用户可能切换的标签）
5. 输出执行指令给各调控器

```javascript
// 决策输出
{
  pressureLevel: 'idle'|'light'|'moderate'|'heavy'|'critical',
  actions: [{
    tabId: number,
    action: 'none'|'throttle'|'pause-media'|'suspend'|'discard'|'destroy',
    priority: number,
    reason: string
  }],
  processConfig: {
    maxRendererProcesses: number,  // 动态调整
    siteIsolation: boolean
  },
  networkConfig: {
    adBlockLevel: 'off'|'basic'|'enhanced'|'aggressive',
    resourceHints: boolean
  },
  cacheConfig: {
    clearAggressiveness: 'none'|'light'|'moderate'|'aggressive'
  }
}
```

### 3.4 进程调控器（主进程）

**文件**: `main/process-controller.js`（新建）

功能：
- 动态调整 `max-renderer-processes`
- 实现站点级进程共享（同域标签共享进程）
- 冻结标签的进程降级（降低进程优先级）
- 销毁长时间冻结标签的渲染进程

关键实现：
```javascript
// 通过 session partition 实现站点共享进程
function getPartitionForUrl(url) {
  if (pressureLevel >= MODERATE) {
    const domain = new URL(url).hostname;
    // 视频站点共享进程
    if (VIDEO_SITES.includes(domain)) {
      return `persist:video-shared`;
    }
    // 社交站点共享进程
    if (SOCIAL_SITES.includes(domain)) {
      return `persist:social-shared`;
    }
  }
  // 低压力时独立进程
  return `persist:tab-${tabId}`;
}
```

### 3.5 冻结调控器（渲染进程，增强 tabs.js）

**文件**: `src/js/modules/tabs.js`（修改）

新增分级冻结能力：

| 冻结级别 | 操作 | 实现方式 |
|----------|------|---------|
| L1-节流 | 降低JS执行频率 | 注入节流脚本(已有) |
| L2-暂停 | 暂停媒体+隐藏iframe | executeJavaScript注入 |
| L3-挂起 | 停止渲染+JS执行 | webview API |
| L4-丢弃 | 导航到about:blank | 修改webview.src(已有) |
| L5-销毁 | 移除DOM+销毁进程 | removeChild + 保存状态 |

L3实现（新增，关键优化）：
```javascript
function suspendTab(tab) {
  // 保存完整状态
  tab.suspendedState = {
    url: tab.webview.getURL(),
    title: tab.element.querySelector('.tab-title').textContent,
    scrollY: await tab.webview.executeJavaScript('window.scrollY'),
    favicon: tab.element.querySelector('.tab-favicon').src
  };
  
  // 暂停媒体
  await tab.webview.executeJavaScript(`
    document.querySelectorAll('video,audio').forEach(el => {
      el.pause();
      el.dataset._driftWasPlaying = !el.paused;
    });
    document.querySelectorAll('iframe').forEach(el => {
      el.style.display = 'none';
    });
  `);
  
  // 导航到空白页释放渲染进程
  tab.webview.src = 'about:blank';
  tab.freezeLevel = 4;
  
  // 渲染进程已释放，内存从~150MB降到~5MB
}
```

L5实现（极端情况）：
```javascript
function destroyTab(tab) {
  // 保存完整状态到内存
  tab.destroyedState = {
    url: tab.webview.getURL(),
    title: tab.element.querySelector('.tab-title').textContent,
    scrollY: 0,
    favicon: tab.element.querySelector('.tab-favicon').src
  };
  
  // 彻底移除webview
  tab.webview.remove();
  tab.webview = null;
  tab.freezeLevel = 5;
  
  // 显示缩略图占位
  showTabPlaceholder(tab);
  
  // 渲染进程完全销毁，内存从~150MB降到~0MB
}
```

### 3.6 媒体调控器（渲染进程）

**文件**: `src/js/modules/media-controller.js`（新建）

功能：
- 后台标签自动暂停视频（可配置）
- 恢复时自动继续播放
- 检测媒体播放状态
- 音频标签特殊处理（只暂停视频，保留音频）

### 3.7 网络调控器（主进程）

**文件**: `main/network-controller.js`（新建）

功能：
- 基于压力等级动态调整广告拦截强度
- L0: 不拦截 / L1: 拦截广告域名 / L2: 拦截广告+追踪器 / L3: 拦截广告+追踪器+统计+社交按钮
- 使用 `session.webRequest.onBeforeRequest` 在请求层拦截
- 冻结标签的网络请求降级（只允许关键请求）

### 3.8 缓存调控器（主进程，增强）

**文件**: `main/window-manager.js`（修改）

功能：
- 根据压力等级调整缓存策略
- 轻度：正常缓存 / 中度：限制缓存大小 / 重度：频繁清理
- 冻结标签的缓存标记为可清理
- 视频缓冲区保护（不清理正在播放的视频缓冲）

---

## 四、文件修改清单

### 4.1 新建文件

| 文件 | 功能 | 代码量估算 |
|------|------|-----------|
| `main/resource-monitor.js` | 系统资源感知器 | ~200行 |
| `main/process-controller.js` | 进程调控器 | ~150行 |
| `main/network-controller.js` | 网络调控器 | ~200行 |
| `src/js/modules/performance-governor.js` | 决策引擎 | ~400行 |
| `src/js/modules/behavior-learner.js` | 用户行为学习器 | ~250行 |
| `src/js/modules/media-controller.js` | 媒体调控器 | ~150行 |

### 4.2 修改文件

| 文件 | 修改内容 | 影响范围 |
|------|---------|---------|
| `main.js` | 引入新模块，添加Chromium启动参数 | 入口文件 |
| `main/window-manager.js` | 增强内存监控，集成资源感知 | 内存管理 |
| `main/ipc-handlers.js` | 添加新IPC接口，增强缓存清理 | IPC路由 |
| `preload.js` | 添加新API暴露 | 桥接层 |
| `src/js/modules/tabs.js` | 增强冻结机制(L0-L5)，集成调控器 | 核心模块 |
| `src/js/modules/power-mode.js` | 重构为APG前端，接入决策引擎 | 性能模式 |
| `src/js/modules/ad-blocker.js` | 接入网络调控器，支持分级拦截 | 广告拦截 |
| `src/index.html` | 更新性能优化设置区域UI | 界面 |
| `src/css/settings.css` | 新增APG相关样式 | 样式 |

---

## 五、详细实现方案

### 5.1 main/resource-monitor.js — 系统资源感知器

```javascript
const os = require('os');
const { webContents } = require('electron');

const SAMPLE_INTERVAL = 5000;
let monitorTimer = null;
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

function startMonitor() {
  if (monitorTimer) return;
  monitorTimer = setInterval(collectAndPush, SAMPLE_INTERVAL);
}

function stopMonitor() {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
}

function collectAndPush() {
  const data = collectData();
  const { getMainWindow } = require('./window-manager');
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('resource-monitor-update', data);
  }
}

function collectData() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = process.memoryUsage();
  
  // CPU使用率
  const currentCpu = process.cpuUsage();
  const now = Date.now();
  const elapsed = now - lastCpuTime;
  const cpuPercent = elapsed > 0 
    ? Math.min(100, ((currentCpu.user + currentCpu.system - lastCpuUsage.user - lastCpuUsage.system) / 1000) / elapsed * 100)
    : 0;
  lastCpuUsage = currentCpu;
  lastCpuTime = now;
  
  // 各webContents内存
  const rendererMem = [];
  try {
    const allWC = webContents.getAllWebContents();
    allWC.forEach(wc => {
      if (!wc.isDestroyed()) {
        rendererMem.push({
          id: wc.id,
          url: wc.getURL(),
          type: wc.getType()
        });
      }
    });
  } catch(e) {}
  
  return {
    timestamp: Date.now(),
    system: {
      totalMemoryMB: Math.round(totalMem / 1024 / 1024),
      freeMemoryMB: Math.round(freeMem / 1024 / 1024),
      memoryPressure: 1 - (freeMem / totalMem),
      cpuUsage: cpuPercent / 100
    },
    browser: {
      mainProcessMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      rendererCount: rendererMem.length
    }
  };
}

function getResourceData() {
  return collectData();
}

module.exports = { startMonitor, stopMonitor, getResourceData };
```

### 5.2 main/process-controller.js — 进程调控器

```javascript
const { app, session } = require('electron');

const VIDEO_SITES = ['douyin.com', 'bilibili.com', 'b23.tv', 'youtube.com', 'tiktok.com'];
const SOCIAL_SITES = ['weibo.com', 'twitter.com', 'x.com', 'zhihu.com', 'reddit.com'];

let currentMaxProcesses = 8;

function adjustProcessLimit(pressureLevel) {
  const limits = {
    idle: 16,
    light: 8,
    moderate: 6,
    heavy: 4,
    critical: 2
  };
  const newLimit = limits[pressureLevel] || 8;
  if (newLimit !== currentMaxProcesses) {
    currentMaxProcesses = newLimit;
    app.commandLine.appendSwitch('max-renderer-processes', String(newLimit));
    console.log('[ProcessController] 渲染进程限制调整为:', newLimit);
  }
}

function getPartitionForUrl(url, pressureLevel, tabId) {
  if (pressureLevel === 'idle' || pressureLevel === 'light') {
    return null; // 使用默认partition，独立进程
  }
  
  try {
    const domain = new URL(url).hostname;
    
    if (pressureLevel === 'critical') {
      return 'persist:shared-all'; // 极端情况所有标签共享
    }
    
    if (pressureLevel === 'heavy') {
      if (VIDEO_SITES.some(s => domain.includes(s))) {
        return 'persist:shared-video';
      }
      return 'persist:shared-other';
    }
    
    // moderate
    if (VIDEO_SITES.some(s => domain.includes(s))) {
      return 'persist:shared-video';
    }
    if (SOCIAL_SITES.some(s => domain.includes(s))) {
      return 'persist:shared-social';
    }
    return null; // 其他站点保持独立进程
  } catch(e) {
    return null;
  }
}

function setProcessPriority(pid, priority) {
  // 通过Windows API调整进程优先级
  const { exec } = require('child_process');
  const priorities = {
    low: 'BelowNormal',
    normal: 'Normal',
    high: 'AboveNormal'
  };
  if (pid && priorities[priority]) {
    exec(`wmic process where ProcessId=${pid} CALL setpriority "${priorities[priority]}"`, 
      () => {}
    );
  }
}

module.exports = { 
  adjustProcessLimit, 
  getPartitionForUrl, 
  setProcessPriority,
  VIDEO_SITES,
  SOCIAL_SITES
};
```

### 5.3 main/network-controller.js — 网络调控器

```javascript
const { session } = require('electron');

const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'facebook.net',
  'fbcdn.net', 'ads.yahoo.com', 'amazon-adsystem.com',
  'adnxs.com', 'adsrvr.org', 'criteo.com', 'outbrain.com',
  'taboola.com', 'rubiconproject.com', 'pubmatic.com',
  'ad.360.cn', 'hm.baidu.com', 'cnzz.com', 'umeng.com',
  'ads.tiktok.com', 'ads.douyin.com', 'pangolin-sdk-toutiao.com'
];

const TRACKER_DOMAINS = [
  'hotjar.com', 'mixpanel.com', 'amplitude.com', 'segment.io',
  'branch.io', 'appsflyer.com', 'adjust.com', 'kochava.com',
  'sensorsdata.cn', 'growingio.com', 'zhugeio.com'
];

const SOCIAL_WIDGET_DOMAINS = [
  'platform.twitter.com', 'connect.facebook.net',
  'apis.google.com/js/plusone.js', 'widgets.pin.it'
];

let currentLevel = 'off';
let blockedCount = 0;

function setBlockLevel(level) {
  if (level === currentLevel) return;
  currentLevel = level;
  applyBlocking(level);
}

function applyBlocking(level) {
  const ses = session.defaultSession;
  
  // 移除之前的监听器
  ses.webRequest.onBeforeRequest(null);
  
  if (level === 'off') return;
  
  let blockedDomains = [...AD_DOMAINS];
  if (level === 'enhanced' || level === 'aggressive') {
    blockedDomains = blockedDomains.concat(TRACKER_DOMAINS);
  }
  if (level === 'aggressive') {
    blockedDomains = blockedDomains.concat(SOCIAL_WIDGET_DOMAINS);
  }
  
  ses.webRequest.onBeforeRequest((details, callback) => {
    try {
      const url = new URL(details.url);
      const hostname = url.hostname.toLowerCase();
      
      for (const domain of blockedDomains) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          blockedCount++;
          callback({ cancel: true });
          return;
        }
      }
    } catch(e) {}
    callback({});
  });
}

function getBlockedCount() { return blockedCount; }
function getCurrentLevel() { return currentLevel; }

module.exports = { setBlockLevel, getBlockedCount, getCurrentLevel };
```

### 5.4 src/js/modules/performance-governor.js — 决策引擎

核心决策算法：

```javascript
function calculatePressureLevel(systemData, browserData) {
  const sysPressure = systemData.memoryPressure;
  const browserMB = browserData.mainProcessMemoryMB;
  
  // 综合系统压力和浏览器自身内存
  let level = 'idle';
  
  if (sysPressure > 0.9 || browserMB > 1000) {
    level = 'critical';
  } else if (sysPressure > 0.8 || browserMB > 800) {
    level = 'heavy';
  } else if (sysPressure > 0.65 || browserMB > 600) {
    level = 'moderate';
  } else if (sysPressure > 0.5 || browserMB > 400) {
    level = 'light';
  }
  
  return level;
}

function decideTabActions(pressureLevel, tabs, behaviorData) {
  const actions = [];
  const activeId = window.FBrowser?.tabs?.activeTabId;
  
  for (const tab of tabs) {
    if (tab.id === activeId) {
      actions.push({ tabId: tab.id, action: 'none', priority: 0 });
      continue;
    }
    
    const behavior = behaviorData?.tabs?.[tab.id];
    const priority = behavior?.priority || 0;
    const isMedia = behavior?.isMediaTab || false;
    const idleTime = Date.now() - (tab.lastActiveTime || 0);
    
    let action = 'none';
    
    switch(pressureLevel) {
      case 'idle':
        if (idleTime > 600000) action = 'throttle'; // 10分钟+节流
        break;
      case 'light':
        if (idleTime > 300000) action = isMedia ? 'throttle' : 'pause-media';
        else if (idleTime > 60000) action = 'throttle';
        break;
      case 'moderate':
        if (priority > 0.7 && isMedia) action = 'pause-media';
        else if (idleTime > 120000) action = 'suspend';
        else if (idleTime > 30000) action = 'pause-media';
        else action = 'throttle';
        break;
      case 'heavy':
        if (priority > 0.9 && isMedia) action = 'pause-media';
        else if (idleTime > 60000) action = 'discard';
        else if (idleTime > 15000) action = 'suspend';
        else action = 'pause-media';
        break;
      case 'critical':
        if (priority > 0.95) action = 'pause-media';
        else action = 'discard';
        break;
    }
    
    actions.push({ tabId: tab.id, action, priority, reason: `pressure=${pressureLevel}, idle=${idleTime}ms, media=${isMedia}` });
  }
  
  return actions;
}
```

### 5.5 src/js/modules/behavior-learner.js — 用户行为学习器

```javascript
// 核心数据结构
let tabBehaviors = {};
let switchHistory = [];

function recordTabSwitch(tabId) {
  const now = Date.now();
  switchHistory.push({ tabId, time: now });
  
  // 只保留最近100次切换
  if (switchHistory.length > 100) switchHistory.shift();
  
  if (!tabBehaviors[tabId]) {
    tabBehaviors[tabId] = {
      switchCount: 0,
      totalActiveTime: 0,
      lastSwitchTime: now,
      avgStayDuration: 0,
      isMediaTab: false,
      siteCategory: 'other',
      priority: 0.5
    };
  }
  
  tabBehaviors[tabId].switchCount++;
  tabBehaviors[tabId].lastSwitchTime = now;
}

function recordTabLeave(tabId) {
  if (!tabBehaviors[tabId]) return;
  const stayDuration = Date.now() - tabBehaviors[tabId].lastSwitchTime;
  const b = tabBehaviors[tabId];
  b.avgStayDuration = (b.avgStayDuration * 0.7) + (stayDuration * 0.3); // EMA
  b.totalActiveTime += stayDuration;
}

function calculatePriority(tabId) {
  const b = tabBehaviors[tabId];
  if (!b) return 0.5;
  
  // 频繁切换 = 高优先级
  const switchScore = Math.min(1, b.switchCount / 20);
  
  // 长停留 = 高优先级
  const stayScore = Math.min(1, b.avgStayDuration / 300000); // 5分钟
  
  // 最近使用 = 高优先级
  const recencyScore = Math.max(0, 1 - (Date.now() - b.lastSwitchTime) / 3600000); // 1小时衰减
  
  // 媒体标签 = 高优先级
  const mediaBonus = b.isMediaTab ? 0.3 : 0;
  
  b.priority = Math.min(1, switchScore * 0.3 + stayScore * 0.3 + recencyScore * 0.3 + mediaBonus);
  return b.priority;
}

function predictNextTabs() {
  // 基于切换历史预测下一步
  if (switchHistory.length < 5) return [];
  
  const recent = switchHistory.slice(-10);
  const currentTabId = recent[recent.length - 1].tabId;
  
  // 找出当前标签之后经常切换到的标签
  const transitions = {};
  for (let i = 0; i < switchHistory.length - 1; i++) {
    if (switchHistory[i].tabId === currentTabId) {
      const next = switchHistory[i + 1].tabId;
      transitions[next] = (transitions[next] || 0) + 1;
    }
  }
  
  return Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => Number(id));
}
```

### 5.6 tabs.js 修改 — 增强冻结机制

在现有 `freezeTab`/`unfreezeTab` 基础上，新增分级冻结：

```javascript
// 新增：分级冻结
function freezeTabLevel(tab, level) {
  if (!tab || !tab.webview) return;
  if (tab.freezeLevel >= level) return; // 已经在更高冻结级别
  
  switch(level) {
    case 1: // L1-节流
      injectThrottleScript(tab);
      tab.freezeLevel = 1;
      break;
      
    case 2: // L2-暂停媒体
      tab.webview.executeJavaScript(`
        (function() {
          document.querySelectorAll('video').forEach(function(v) {
            if (!v.paused) { v.pause(); v.dataset._driftWasPlaying = 'true'; }
          });
          document.querySelectorAll('audio').forEach(function(a) {
            if (!a.paused) { a.pause(); a.dataset._driftWasPlaying = 'true'; }
          });
          document.querySelectorAll('iframe').forEach(function(f) {
            f.dataset._driftDisplay = f.style.display;
            f.style.display = 'none';
          });
        })();
      `).catch(() => {});
      tab.freezeLevel = 2;
      break;
      
    case 3: // L3-挂起（暂停媒体+停止JS定时器）
      tab.webview.executeJavaScript(`
        (function() {
          document.querySelectorAll('video').forEach(function(v) {
            if (!v.paused) { v.pause(); v.dataset._driftWasPlaying = 'true'; }
          });
          document.querySelectorAll('audio').forEach(function(a) {
            if (!a.paused) { a.pause(); a.dataset._driftWasPlaying = 'true'; }
          });
          document.querySelectorAll('iframe').forEach(function(f) {
            f.dataset._driftDisplay = f.style.display;
            f.style.display = 'none';
          });
          // 停止所有定时器
          var maxId = setTimeout(function(){}, 0);
          for (var i = 0; i <= maxId; i++) {
            clearTimeout(i); clearInterval(i);
          }
        })();
      `).catch(() => {});
      tab.freezeLevel = 3;
      break;
      
    case 4: // L4-丢弃（导航到about:blank，释放渲染进程）
      // 先保存状态
      tab.suspendedState = {
        url: tab.webview.src || tab.url,
        scrollY: 0,
        title: tab.element.querySelector('.tab-title')?.textContent || ''
      };
      // 尝试保存滚动位置
      tab.webview.executeJavaScript('window.scrollY').then(scrollY => {
        if (tab.suspendedState) tab.suspendedState.scrollY = scrollY;
      }).catch(() => {});
      
      tab.webview.src = 'about:blank';
      tab.frozen = true;
      tab.freezeLevel = 4;
      tab.element.classList.add('frozen');
      updateFrozenIndicator(tab);
      break;
      
    case 5: // L5-销毁（移除DOM，彻底释放）
      tab.destroyedState = {
        url: tab.webview.src || tab.url || tab.suspendedState?.url,
        scrollY: tab.suspendedState?.scrollY || 0,
        title: tab.element.querySelector('.tab-title')?.textContent || ''
      };
      tab.webview.stop();
      tab.webview.clearHistory();
      tab.webview.remove();
      tab.webview = null;
      tab.frozen = true;
      tab.freezeLevel = 5;
      tab.element.classList.add('frozen');
      tab.element.classList.add('destroyed');
      updateFrozenIndicator(tab);
      break;
  }
}

function unfreezeTabLevel(tab) {
  if (!tab) return;
  
  if (tab.freezeLevel === 5 && tab.destroyedState) {
    // L5→活跃：重建webview
    const url = tab.destroyedState.url;
    tab.frozen = false;
    tab.freezeLevel = 0;
    tab.element.classList.remove('frozen', 'destroyed');
    createWebview(tab, url);
    delete tab.destroyedState;
    return;
  }
  
  if (tab.freezeLevel === 4 && tab.suspendedState) {
    // L4→活跃：重新加载
    tab.frozen = false;
    tab.freezeLevel = 0;
    tab.element.classList.remove('frozen');
    tab.webview.src = tab.suspendedState.url;
    // 恢复滚动位置
    tab.webview.addEventListener('did-finish-load', function restore() {
      if (tab.suspendedState?.scrollY > 0) {
        tab.webview.executeJavaScript('window.scrollTo(0, ' + tab.suspendedState.scrollY + ')').catch(() => {});
      }
      delete tab.suspendedState;
      tab.webview.removeEventListener('did-finish-load', restore);
    });
    return;
  }
  
  // L1-L3→活跃：恢复媒体和iframe
  if (tab.webview && tab.freezeLevel >= 2) {
    tab.webview.executeJavaScript(`
      (function() {
        document.querySelectorAll('video').forEach(function(v) {
          if (v.dataset._driftWasPlaying === 'true') { v.play(); delete v.dataset._driftWasPlaying; }
        });
        document.querySelectorAll('audio').forEach(function(a) {
          if (a.dataset._driftWasPlaying === 'true') { a.play(); delete a.dataset._driftWasPlaying; }
        });
        document.querySelectorAll('iframe').forEach(function(f) {
          if (f.dataset._driftDisplay !== undefined) { f.style.display = f.dataset._driftDisplay; delete f.dataset._driftDisplay; }
        });
      })();
    `).catch(() => {});
  }
  
  tab.frozen = false;
  tab.freezeLevel = 0;
  tab.element.classList.remove('frozen');
}
```

### 5.7 main.js 修改 — 新增Chromium启动参数

```javascript
// 在现有启动参数后追加
app.commandLine.appendSwitch('enable-low-res-tiling');
app.commandLine.appendSwitch('enable-low-end-device-mode');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-compositor-resources');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,ProcessSharingForCrossOriginIframes');
app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder,MediaFoundationVideoCapture,HeavyAdIntervention');
app.commandLine.appendSwitch('enable-memory-pressure-signal');

// 引入新模块
const { startMonitor: startResourceMonitor } = require('./main/resource-monitor');
const { adjustProcessLimit } = require('./main/process-controller');
const { setBlockLevel } = require('./main/network-controller');

// 在 app.whenReady() 中启动
startResourceMonitor();
```

### 5.8 preload.js 修改 — 新增API

```javascript
// 资源监控
onResourceMonitorUpdate: (cb) => ipcRenderer.on('resource-monitor-update', (_, data) => cb(data)),

// 进程调控
processAdjustLimit: (level) => ipcRenderer.invoke('process-adjust-limit', level),
processGetPartition: (url, level, tabId) => ipcRenderer.invoke('process-get-partition', url, level, tabId),

// 网络调控
networkSetBlockLevel: (level) => ipcRenderer.invoke('network-set-block-level', level),
networkGetBlockedCount: () => ipcRenderer.invoke('network-get-blocked-count'),

// 内存压力事件
onMemoryPressure: (cb) => ipcRenderer.on('memory-pressure', (_, data) => cb(data)),
onMemoryCritical: (cb) => ipcRenderer.on('memory-critical', (_, data) => cb(data)),

// 标签冻结级别
tabFreezeLevel: (tabId, level) => ipcRenderer.invoke('tab-freeze-level', tabId, level),
tabUnfreezeLevel: (tabId) => ipcRenderer.invoke('tab-unfreeze-level', tabId),
```

### 5.9 设置界面更新

将现有的静态开关替换为APG状态面板：

```html
<!-- 自适应性能调控 -->
<div class="settings-card highlight">
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-label">🧠 自适应性能调控</div>
      <div class="settings-row-desc">根据系统资源和使用习惯自动优化</div>
    </div>
    <div class="settings-row-action">
      <div class="toggle-switch" id="toggleAPG">
        <div class="toggle-switch-track"></div>
      </div>
    </div>
  </div>
  <!-- 实时状态 -->
  <div class="apg-status" id="apgStatus">
    <div class="apg-pressure-indicator">
      <span class="apg-pressure-dot"></span>
      <span class="apg-pressure-label">空闲</span>
    </div>
    <div class="apg-stats">
      <span>内存: <b id="apgMem">--</b> MB</span>
      <span>标签: <b id="apgTabs">0</b></span>
      <span>冻结: <b id="apgFrozen">0</b></span>
    </div>
  </div>
</div>
```

---

## 六、执行流程

### 6.1 主循环（每5秒）

```
1. resource-monitor 采集系统数据 → IPC推送
2. governor 接收数据 → 计算压力等级
3. behavior-learner 更新行为数据 → 计算标签优先级
4. governor 决策 → 为每个标签选择冻结级别
5. 执行层执行：
   - process-controller 调整进程限制
   - tabs.js 执行分级冻结/解冻
   - network-controller 调整拦截级别
   - media-controller 控制媒体播放
6. 预测性解冻：提前解冻用户可能切换的标签
```

### 6.2 关键场景

**场景1：打开20个抖音标签**
1. 前3个标签正常加载（空闲级别）
2. 第4-8个标签触发轻度压力 → 后台标签L1节流
3. 第9-15个标签触发中度压力 → 后台标签L2暂停媒体
4. 第16-20个标签触发重度压力 → 非活跃标签L4丢弃
5. 稳定状态：1个活跃(~120MB) + 19个L4冻结(~95MB) = ~215MB + 主进程60MB + GPU100MB = ~375MB

**场景2：在20个标签间快速切换**
1. behavior-learner 学习切换模式
2. 预测性解冻：提前解冻下一个可能切换的标签
3. 切换时先解冻目标标签，再冻结当前标签
4. 保证切换体验流畅

**场景3：后台播放B站音乐**
1. behavior-learner 识别为媒体标签
2. 即使在重度压力下也只执行L2（暂停视频，保留音频）
3. 不会被L4丢弃

---

## 七、实施步骤

### 阶段1：基础设施（Day 1）
1. 创建 `main/resource-monitor.js` — 系统资源感知器
2. 修改 `main.js` — 引入新模块+Chromium参数
3. 修改 `preload.js` — 添加新IPC接口
4. 修改 `main/ipc-handlers.js` — 注册新IPC处理器

### 阶段2：决策引擎（Day 2）
5. 创建 `src/js/modules/behavior-learner.js` — 用户行为学习器
6. 创建 `src/js/modules/performance-governor.js` — 决策引擎
7. 修改 `src/js/modules/power-mode.js` — 重构为APG前端

### 阶段3：执行层（Day 3）
8. 创建 `main/process-controller.js` — 进程调控器
9. 创建 `main/network-controller.js` — 网络调控器
10. 创建 `src/js/modules/media-controller.js` — 媒体调控器
11. 修改 `src/js/modules/tabs.js` — 增强分级冻结

### 阶段4：集成与UI（Day 4）
12. 修改 `src/index.html` — 更新设置界面
13. 修改 `src/css/settings.css` — APG样式
14. 修改 `src/js/modules/ad-blocker.js` — 接入网络调控器
15. 修改 `main/window-manager.js` — 增强内存监控

### 阶段5：测试与调优（Day 5）
16. 20标签压力测试
17. 参数调优
18. 边界情况处理

---

## 八、验收标准

| 指标 | 目标 |
|------|------|
| 20个视频标签页总内存 | ≤ 1GB |
| 单标签切换延迟 | ≤ 3秒（L4解冻） |
| 自适应响应延迟 | ≤ 10秒 |
| 后台标签内存占用 | ≤ 5MB/标签（L4冻结） |
| 广告拦截效果 | 拦截率 ≥ 80%（增强模式） |
| 用户无感知 | 活跃标签不受任何影响 |
| 系统内存<50%时 | 无任何优化干预（空闲级别） |

---

## 九、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| L4/L5冻结导致表单数据丢失 | 用户填写的数据丢失 | 冻结前检测表单，有未提交数据时降级到L2 |
| 进程共享导致同站标签联动崩溃 | 一个崩溃全部崩溃 | 共享进程标签数限制≤5，崩溃时自动恢复 |
| 预测性解冻浪费资源 | 解冻了不需要的标签 | 预测置信度阈值，只解冻高置信度标签 |
| webview partition切换需要重建 | 切换partition时页面闪烁 | partition只在创建时设置，不动态切换 |
| 网络拦截误杀 | 正常请求被拦截 | 维护白名单，拦截统计可查看 |

---

## 十、假设与决策

1. **假设**：Electron 33 支持 `webContents.getAllWebContents()` 获取子进程内存 — 需验证
2. **决策**：L4冻结使用 `webview.src = 'about:blank'` 而非 `webview.loadURL()`，因为前者更可靠地释放渲染进程
3. **决策**：进程共享通过 session partition 实现，而非 Chromium 启动参数（更灵活可控）
4. **决策**：行为学习器使用 EMA（指数移动平均）而非简单平均，更敏感于近期行为
5. **假设**：Windows `wmic` 命令可用于调整进程优先级 — 需验证权限
6. **决策**：网络拦截在主进程 session 层实现，而非渲染进程 JS 注入（更彻底、不可绕过）
