# Drift Browser

<p align="center">
  <strong>独具一格的桌面浏览器</strong> / <strong>A Distinctive Desktop Browser</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.33.0-blue" alt="version">
  <img src="https://img.shields.io/badge/Electron-33-green" alt="electron">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
  <img src="https://img.shields.io/badge/platform-Windows-lightgrey" alt="platform">
</p>

---

## 🇨🇳 中文

### ✨ 特性

- 🚀 **基于 Electron 33 + Chromium** — 现代化的桌面浏览器体验
- 🎨 **深色/浅色主题** — 自由切换，护眼舒适
- 🤖 **AI 集成** — 内置 AI Chat 和 AI Agent，支持多模型配置
- 📦 **侧载插件系统** — 无需重新打包即可扩展浏览器功能
- 🌐 **GitHub 中文翻译** — 内置插件，自动翻译 GitHub 页面 UI
- 🎭 **个性化定制** — 内置插件，自定义背景、颜色、布局、CSS
- 🔄 **自动更新** — 监控 GitHub Releases，自动下载并提醒安装
- 🛡️ **广告拦截** — 内置广告和追踪器过滤
- ⚡ **性能优化** — 自适应性能调节器 (APG)，智能冻结后台标签页
- 📑 **多标签管理** — 标签分组、垂直标签栏、分屏视图
- 🔒 **隐身模式** — 独立隐身窗口
- 📝 **文档编辑** — 内置 DocForge 文档编辑器
- 📊 **任务管理器** — 实时监控进程资源占用
- 🔍 **智能搜索** — 多搜索引擎支持，地址栏快速搜索
- ⌨️ **快捷键** — 丰富的键盘快捷键支持
- 🌍 **国际化** — 插件化 i18n 系统，支持多语言扩展

### 📥 安装

从 [Releases](https://github.com/151shi23/drift-browser/releases) 页面下载最新版本：

- **安装版** — `Drift-Setup-x.x.x.exe` — 推荐大多数用户
- **便携版** — `Drift-x.x.x.exe` — 免安装，直接运行

### 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/151shi23/drift-browser.git
cd drift-browser

# 安装依赖
npm install

# 启动开发模式
npm start

# 打包构建
npm run build
```

### 🔌 插件系统

Drift 支持侧载插件，在 `plugins/` 目录放置符合规范的文件夹即可加载。

#### 插件目录结构

```
plugins/
  my-plugin/
    drift-plugin.json    ← 插件清单（必需）
    renderer.js          ← 渲染进程入口（可选）
    index.js             ← 主进程入口（可选）
    inject.js            ← Webview 注入脚本（可选）
    locales/             ← 国际化文件（可选）
      en.json
    icon.png             ← 插件图标（可选）
```

#### drift-plugin.json 清单

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author",
  "type": ["feature"],
  "permissions": ["tabs", "storage"],
  "renderer": "renderer.js",
  "inject": "inject.js",
  "i18n": "locales/",
  "minVersion": "2.33.0"
}
```

#### 插件类型

| 类型 | 说明 |
|------|------|
| `i18n` | 国际化翻译 |
| `ui` | UI 增强 |
| `feature` | 功能扩展 |
| `system` | 系统集成 |

#### 插件权限

| 权限 | 说明 |
|------|------|
| `i18n` | 访问国际化 API |
| `tabs` | 访问标签页和 Webview API |
| `bookmarks` | 访问书签 API |
| `storage` | 访问插件存储 API |
| `notifications` | 发送通知 |
| `clipboard` | 访问剪贴板 |
| `theme` | 访问主题 API |
| `ui` | 注册 UI 组件 |
| `shell` | 打开外部链接 |
| `settings` | 修改设置 |
| `network` | 访问网络请求 API |
| `menu` | 修改菜单 |

#### DriftPluginSDK API

```javascript
var sdk = window.DriftPluginSDK.register(__pluginMeta);

// 国际化
sdk.i18n.register('en', translations);
sdk.i18n.t('key');

// 标签页
sdk.tabs.create(url);
sdk.tabs.list();

// Webview 注入
sdk.webview.onPageLoad(function(url, webview) {
  if (url.indexOf('example.com') !== -1) {
    webview.executeJavaScript(injectCode);
  }
});

// 插件存储
await sdk.storage.set('key', value);
var val = await sdk.storage.get('key');

// 插件间通讯
sdk.messaging.send('target-plugin-id', data);
sdk.messaging.onMessage(function(msg) { });

// 主题
sdk.theme.getCurrent();
sdk.theme.onChange(function(theme) { });
```

#### 内置插件

| 插件 | 说明 |
|------|------|
| `english-i18n` | 英文语言包，切换浏览器界面为英文 |
| `github-zh` | GitHub 中文翻译，自动翻译 GitHub 页面 UI 文本和状态标签 |
| `customizer` | 个性化浏览器，自定义背景/颜色/布局/CSS，5个预设主题 |

### 📁 项目结构

```
├── main.js                 ← 主进程入口
├── main/                   ← 主进程模块
│   ├── ipc-handlers.js     ← IPC 处理器
│   ├── plugin-loader.js    ← 插件加载器
│   ├── updater.js          ← 自动更新
│   ├── extensions.js       ← Chrome 扩展加载
│   ├── resource-monitor.js ← 资源监控
│   ├── process-controller.js ← 进程控制
│   └── network-controller.js ← 网络控制
├── preload.js              ← 预加载脚本（IPC 桥接）
├── src/                    ← 渲染进程
│   ├── index.html          ← 主页面
│   ├── css/                ← 样式文件
│   ├── js/modules/         ← 功能模块
│   │   ├── tabs.js         ← 标签页管理
│   │   ├── plugin-host.js  ← 插件宿主
│   │   ├── plugin-manager-ui.js ← 插件管理页面
│   │   ├── updater-ui.js   ← 更新 UI
│   │   ├── settings.js     ← 设置页面
│   │   └── ai/             ← AI 模块
│   └── assets/             ← 静态资源
└── plugins/                ← 侧载插件目录
    ├── english-i18n/       ← 英文语言包
    ├── github-zh/          ← GitHub 中文翻译
    └── customizer/         ← 个性化浏览器
```

### 📄 许可证

[MIT License](LICENSE)

---

## 🇺🇸 English

### ✨ Features

- 🚀 **Built on Electron 33 + Chromium** — Modern desktop browsing experience
- 🎨 **Dark/Light Theme** — Switch freely, comfortable for your eyes
- 🤖 **AI Integration** — Built-in AI Chat and AI Agent with multi-model support
- 📦 **Sideloading Plugin System** — Extend browser functionality without repackaging
- 🌐 **GitHub Chinese Translation** — Built-in plugin that auto-translates GitHub UI text
- 🎭 **Customization** — Built-in plugin for custom backgrounds, colors, layouts, and CSS
- 🔄 **Auto Update** — Monitors GitHub Releases, auto-downloads and prompts for installation
- 🛡️ **Ad Blocker** — Built-in ad and tracker filtering
- ⚡ **Performance Optimization** — Adaptive Performance Governor (APG), smart background tab freezing
- 📑 **Tab Management** — Tab groups, vertical tab bar, split view
- 🔒 **Incognito Mode** — Separate incognito window
- 📝 **Document Editor** — Built-in DocForge document editor
- 📊 **Task Manager** — Real-time process resource monitoring
- 🔍 **Smart Search** — Multi-search engine support, quick search from address bar
- ⌨️ **Keyboard Shortcuts** — Rich keyboard shortcut support
- 🌍 **Internationalization** — Plugin-based i18n system, supports multi-language extension

### 📥 Installation

Download the latest version from the [Releases](https://github.com/151shi23/drift-browser/releases) page:

- **Installer** — `Drift-Setup-x.x.x.exe` — Recommended for most users
- **Portable** — `Drift-x.x.x.exe` — No installation required, run directly

### 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/151shi23/drift-browser.git
cd drift-browser

# Install dependencies
npm install

# Start development mode
npm start

# Build
npm run build
```

### 🔌 Plugin System

Drift supports sideloading plugins. Place a properly structured folder in the `plugins/` directory to load it.

#### Plugin Directory Structure

```
plugins/
  my-plugin/
    drift-plugin.json    ← Plugin manifest (required)
    renderer.js          ← Renderer process entry (optional)
    index.js             ← Main process entry (optional)
    inject.js            ← Webview injection script (optional)
    locales/             ← Internationalization files (optional)
      en.json
    icon.png             ← Plugin icon (optional)
```

#### drift-plugin.json Manifest

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author",
  "type": ["feature"],
  "permissions": ["tabs", "storage"],
  "renderer": "renderer.js",
  "inject": "inject.js",
  "i18n": "locales/",
  "minVersion": "2.33.0"
}
```

#### Plugin Types

| Type | Description |
|------|-------------|
| `i18n` | Internationalization |
| `ui` | UI enhancement |
| `feature` | Feature extension |
| `system` | System integration |

#### Plugin Permissions

| Permission | Description |
|------------|-------------|
| `i18n` | Access i18n API |
| `tabs` | Access tabs and webview API |
| `bookmarks` | Access bookmarks API |
| `storage` | Access plugin storage API |
| `notifications` | Send notifications |
| `clipboard` | Access clipboard |
| `theme` | Access theme API |
| `ui` | Register UI components |
| `shell` | Open external links |
| `settings` | Modify settings |
| `network` | Access network request API |
| `menu` | Modify menus |

#### DriftPluginSDK API

```javascript
var sdk = window.DriftPluginSDK.register(__pluginMeta);

// Internationalization
sdk.i18n.register('en', translations);
sdk.i18n.t('key');

// Tabs
sdk.tabs.create(url);
sdk.tabs.list();

// Webview injection
sdk.webview.onPageLoad(function(url, webview) {
  if (url.indexOf('example.com') !== -1) {
    webview.executeJavaScript(injectCode);
  }
});

// Plugin storage
await sdk.storage.set('key', value);
var val = await sdk.storage.get('key');

// Inter-plugin messaging
sdk.messaging.send('target-plugin-id', data);
sdk.messaging.onMessage(function(msg) { });

// Theme
sdk.theme.getCurrent();
sdk.theme.onChange(function(theme) { });
```

#### Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `english-i18n` | English language pack, switch browser interface to English |
| `github-zh` | GitHub Chinese translation, auto-translates GitHub page UI text and status labels |
| `customizer` | Browser customization, custom backgrounds/colors/layouts/CSS, 5 preset themes |

### 📁 Project Structure

```
├── main.js                 ← Main process entry
├── main/                   ← Main process modules
│   ├── ipc-handlers.js     ← IPC handlers
│   ├── plugin-loader.js    ← Plugin loader
│   ├── updater.js          ← Auto updater
│   ├── extensions.js       ← Chrome extension loader
│   ├── resource-monitor.js ← Resource monitor
│   ├── process-controller.js ← Process controller
│   └── network-controller.js ← Network controller
├── preload.js              ← Preload script (IPC bridge)
├── src/                    ← Renderer process
│   ├── index.html          ← Main page
│   ├── css/                ← Stylesheets
│   ├── js/modules/         ← Feature modules
│   │   ├── tabs.js         ← Tab management
│   │   ├── plugin-host.js  ← Plugin host
│   │   ├── plugin-manager-ui.js ← Plugin manager page
│   │   ├── updater-ui.js   ← Update UI
│   │   ├── settings.js     ← Settings page
│   │   └── ai/             ← AI modules
│   └── assets/             ← Static assets
└── plugins/                ← Sideloading plugins directory
    ├── english-i18n/       ← English language pack
    ├── github-zh/          ← GitHub Chinese translation
    └── customizer/         ← Browser customization
```

### 📄 License

[MIT License](LICENSE)
