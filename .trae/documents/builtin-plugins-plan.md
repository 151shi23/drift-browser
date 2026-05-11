# 内置插件实现计划：GitHub中文翻译 + 个性化浏览器

## 摘要

为 Drift 浏览器创建两个内置插件：
1. **GitHub 中文翻译插件** — 通过网络请求拦截替换 GitHub 页面文本为中文，覆盖 UI 元素 + 状态标签
2. **个性化浏览器插件** — 支持主页背景、UI颜色/透明度、布局样式微调、自定义CSS注入，提供预设主题+自定义

## 当前状态分析

### 插件系统已就绪
- `main/plugin-loader.js` — 扫描 `plugins/` 目录，注入渲染进程代码
- `src/js/modules/plugin-host.js` — `DriftPluginSDK` API（tabs/storage/i18n/ui/messaging等）
- `plugins/english-i18n/` — 参考实现

### Webview 注入机制
- `tabs.js` 中 `bindWebviewEvents()` 已有 `did-stop-loading` 事件监听
- 已有 `wv.executeJavaScript()` 注入先例（B站适配、自动登录等）
- 插件可通过 `sdk.tabs` API 访问标签页，但**缺少 webview 内容注入 API**

### 关键缺口
当前 `DriftPluginSDK` 没有 `webview` 相关 API，插件无法向 webview 注入 JS。需要扩展 SDK。

## 设计方案

### 插件1：GitHub 中文翻译 (`plugins/github-zh/`)

#### 翻译方式：网络请求拦截 + DOM 文本替换混合

**实际方案调整**：由于 Electron webview 的网络拦截在主进程（`onBeforeRequest` 等），而插件运行在渲染进程，纯网络拦截对插件不友好。采用**DOM 文本替换**方案，但通过 MutationObserver 实现动态内容覆盖，效果等同于持续拦截：

1. 监听 GitHub 域名的 `did-stop-loading` / `dom-ready` 事件
2. 通过 `webview.executeJavaScript()` 注入翻译脚本
3. 翻译脚本使用 MutationObserver 持续监听 DOM 变化
4. 维护中英对照表，匹配文本节点和属性进行替换

#### 翻译范围
- GitHub 导航栏（Pull requests / Issues / Codespaces / Marketplace / Explore 等）
- 仓库页面 UI（Code / Issues / Pull requests / Actions / Projects / Wiki / Security / Insights）
- 状态标签（Open / Closed / Merged / Draft / Reopened）
- 按钮文本（New / Create / Edit / Delete / Merge / Close / Reopen / Fork / Star / Watch）
- 侧边栏（About / Releases / Packages / Contributors / Languages）
- Issue/PR 列表表头和筛选器
- 文件浏览器（Add file / Go to file / Code）
- 个人页面（Overview / Repositories / Projects / Stars / Followers / Following）
- 通用 UI（Search / Sign in / Sign up / Settings / Notifications）

#### 文件结构
```
plugins/github-zh/
  drift-plugin.json
  renderer.js          ← 注册 webview 注入钩子
  translations.js      ← 中英对照翻译表（大文件，500+条目）
  inject.js            ← 注入到 GitHub webview 的翻译脚本
```

#### drift-plugin.json
```json
{
  "id": "com.drift.github-zh",
  "name": "GitHub 中文翻译",
  "version": "1.0.0",
  "description": "将 GitHub 页面 UI 文本翻译为中文",
  "author": "Drift Team",
  "type": ["feature"],
  "permissions": ["tabs", "storage"],
  "renderer": "renderer.js",
  "inject": "inject.js",
  "minVersion": "2.33.0"
}
```

#### 核心实现

**renderer.js** — 注册 webview 内容注入钩子：
```javascript
(function() {
  var sdk = window.DriftPluginSDK.register(__pluginMeta);
  
  // 注册 webview 内容注入规则
  sdk.webview.onPageLoad(function(url, webview) {
    if (url && (url.indexOf('github.com') !== -1 || url.indexOf('github.dev') !== -1)) {
      // 读取翻译表并注入
      var translations = __pluginMeta.translations; // 从主进程预加载
      var injectCode = __pluginMeta.injectCode;
      webview.executeJavaScript(injectCode);
    }
  });
})();
```

**inject.js** — 注入到 GitHub 页面的翻译脚本：
```javascript
(function() {
  if (window.__githubZhLoaded) return;
  window.__githubZhLoaded = true;
  
  var translations = { /* 中英对照表 */ };
  
  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.textContent.trim();
      if (translations[text]) {
        node.textContent = node.textContent.replace(text, translations[text]);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 翻译 placeholder, title, aria-label 等属性
      translateAttributes(node);
      // 递归翻译子节点
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        translateNode(children[i]);
      }
    }
  }
  
  function translateAttributes(el) {
    var attrs = ['placeholder', 'title', 'aria-label', 'data-hovercard-type'];
    for (var i = 0; i < attrs.length; i++) {
      var val = el.getAttribute(attrs[i]);
      if (val && translations[val]) {
        el.setAttribute(attrs[i], translations[val]);
      }
    }
  }
  
  // 初始翻译
  translateNode(document.body);
  
  // MutationObserver 持续翻译动态内容
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        translateNode(added[j]);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
```

### 插件2：个性化浏览器 (`plugins/customizer/`)

#### 自定义能力
1. **主页背景** — 上传图片 / 渐变色 / 纯色
2. **UI 颜色/透明度** — 标题栏、工具栏、标签栏、侧边栏的颜色和透明度
3. **布局样式微调** — 标签栏圆角、间距、字体大小
4. **自定义 CSS 注入** — 用户编写 CSS 代码直接注入

#### 预设主题（5个）
1. **暗夜紫** — 深紫渐变背景 + 紫色强调色
2. **海洋蓝** — 深蓝背景 + 青色强调色
3. **樱花粉** — 深灰背景 + 粉色强调色
4. **森林绿** — 深绿背景 + 翠绿强调色
5. **极简白** — 浅色背景 + 灰色强调色

#### 文件结构
```
plugins/customizer/
  drift-plugin.json
  renderer.js          ← 主逻辑：设置面板、CSS注入、主题切换
  presets.js           ← 预设主题定义
  locales/
    en.json            ← 英文翻译
```

#### drift-plugin.json
```json
{
  "id": "com.drift.customizer",
  "name": "个性化浏览器",
  "version": "1.0.0",
  "description": "自定义浏览器外观：背景、颜色、布局、CSS",
  "author": "Drift Team",
  "type": ["ui", "feature"],
  "permissions": ["ui", "storage", "theme", "settings"],
  "renderer": "renderer.js",
  "i18n": "locales/",
  "minVersion": "2.33.0"
}
```

#### 核心实现

**renderer.js** — 设置面板 + CSS 注入引擎：
- 创建 `drift://customizer` 设置页面（或集成到设置页）
- 通过 `sdk.storage` 持久化用户配置
- 通过动态 `<style>` 标签注入自定义 CSS
- 监听 `sdk.theme.onChange` 适配主题切换
- 提供可视化颜色选择器、透明度滑块、CSS 编辑器

**presets.js** — 5个预设主题对象：
```javascript
var PRESETS = {
  'midnight-purple': {
    name: '暗夜紫',
    nameEn: 'Midnight Purple',
    accent: '#8B5CF6',
    bg: 'linear-gradient(135deg, #1a0a2e, #2d1b4e)',
    toolbarBg: 'rgba(26, 10, 46, 0.85)',
    tabActive: 'rgba(139, 92, 246, 0.2)',
    // ...
  },
  // ... 其他预设
};
```

### SDK 扩展：webview 内容注入 API

当前 `DriftPluginSDK` 缺少 webview 注入能力。需要扩展：

**plugin-host.js** 添加：
```javascript
webview: {
  onPageLoad: function(callback) {
    // 注册回调，当任意 webview 页面加载完成时触发
    // callback(url, webviewElement)
  },
  injectScript: function(tabId, code) {
    // 向指定标签页的 webview 注入 JS
  }
}
```

**tabs.js** 修改：
- 在 `did-stop-loading` 事件中，通知 plugin-host 有页面加载完成
- plugin-host 遍历已注册的 onPageLoad 回调并执行

**plugin-loader.js** 修改：
- `getRendererPluginCode()` 中，如果 manifest 有 `inject` 字段，读取该文件内容并包含在 `__pluginMeta` 中

## 文件修改清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `plugins/github-zh/drift-plugin.json` | GitHub 中文翻译插件清单 |
| `plugins/github-zh/renderer.js` | 注册 webview 注入钩子 |
| `plugins/github-zh/translations.js` | 中英对照翻译表（500+条目） |
| `plugins/github-zh/inject.js` | 注入到 GitHub 页面的翻译脚本 |
| `plugins/customizer/drift-plugin.json` | 个性化浏览器插件清单 |
| `plugins/customizer/renderer.js` | 设置面板 + CSS 注入引擎 |
| `plugins/customizer/presets.js` | 预设主题定义 |
| `plugins/customizer/locales/en.json` | 英文翻译 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/js/modules/plugin-host.js` | 添加 `webview` API（onPageLoad, injectScript）+ `settings` API |
| `src/js/modules/tabs.js` | 在 `did-stop-loading` 中通知 plugin-host 页面加载完成 |
| `main/plugin-loader.js` | `getRendererPluginCode()` 支持 `inject` 字段读取 |

## 实现步骤

### 步骤1：扩展 SDK — plugin-host.js 添加 webview API
- 添加 `webview.onPageLoad(callback)` 注册钩子
- 添加 `webview.injectScript(tabId, code)` 注入脚本
- 添加 `settings` API（registerSettingsSection）
- 维护 `pageLoadCallbacks` 数组

### 步骤2：扩展 SDK — tabs.js 页面加载通知
- 在 `bindWebviewEvents` 的 `did-stop-loading` 中调用 `window.FBrowser.pluginHost.onPageLoad(url, wv)`
- plugin-host 遍历回调并执行

### 步骤3：扩展 plugin-loader.js 支持 inject 字段
- `getRendererPluginCode()` 读取 `manifest.inject` 文件内容
- 将 inject 代码包含在 `__pluginMeta.injectCode` 中

### 步骤4：创建 GitHub 中文翻译插件
- `drift-plugin.json` 清单
- `translations.js` — 500+ 中英对照条目
- `inject.js` — MutationObserver + DOM 翻译脚本
- `renderer.js` — 注册 webview 钩子，匹配 github.com 域名

### 步骤5：创建个性化浏览器插件
- `drift-plugin.json` 清单
- `presets.js` — 5个预设主题
- `renderer.js` — 设置面板 UI + CSS 注入引擎 + 存储持久化
- `locales/en.json` — 英文翻译

## 验证步骤

1. 启动浏览器，打开 `f://plugins`，确认两个插件显示在列表中
2. 打开 github.com，确认 UI 文本被翻译为中文（导航栏、按钮、标签等）
3. 在 GitHub 页面导航（切换仓库、Issue、PR），确认动态内容也被翻译
4. 打开个性化浏览器设置，选择预设主题，确认浏览器外观变化
5. 自定义背景颜色、标签栏圆角，确认实时生效
6. 注入自定义 CSS，确认生效
7. 重启浏览器，确认自定义设置持久化
8. 切换语言到 English，确认插件 UI 文本切换
