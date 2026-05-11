# Drift 浏览器侧载插件系统设计

## 摘要

设计并实现一个侧载插件系统，允许用户在 `plugins/` 目录放置规范文件夹，浏览器启动时自动加载，无需重新打包即可修改浏览器功能（国际化、UI增强、功能扩展、系统集成），支持插件间通讯API。

## 当前状态分析

### 现有架构
- **主进程**：`main/` 目录，16个模块，通过 `ipcMain.handle` 注册 IPC handler
- **渲染进程**：`src/js/modules/` 目录，43个 IIFE 模块，全部挂载到 `window.FBrowser` 命名空间
- **IPC 桥接**：`preload.js` 使用 `contextBridge.exposeInMainWorld` 暴露 `window.electronAPI`
- **扩展系统**：`main/extensions.js` 已有 Chrome/Edge 扩展加载（基于 Chromium session.loadExtension），与插件系统是独立概念
- **数据路径**：`%APPDATA%/f-browser/` 用于配置、扩展、更新存储
- **无国际化**：项目中硬编码中文，无任何 i18n 基础设施
- **模块加载**：`src/index.html` 中硬编码 43 个 `<script>` 标签

### 关键约束
- 渲染进程模块使用 ES5 IIFE 模式，不能用 ES2020+ 语法
- `window.FBrowser` 是全局命名空间，所有模块共享
- CSP 策略：`script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- 应用打包为 asar，`plugins/` 目录需要在 asar 外

## 设计方案

### 1. 插件目录结构

```
应用根目录/
  plugins/                        ← 侧载插件根目录
    english-i18n/                 ← 内置英文语言包
      drift-plugin.json
      renderer.js
      locales/
        en.json
    my-plugin/
      drift-plugin.json           ← 插件清单（必需）
      index.js                    ← 主进程入口（可选）
      renderer.js                 ← 渲染进程入口（可选）
      locales/                    ← i18n 文件（可选）
        en.json
      assets/                     ← 插件资源
      icon.png                    ← 插件图标
```

### 2. drift-plugin.json 清单规范

```json
{
  "id": "com.drift.english-i18n",
  "name": "English Language Pack",
  "version": "1.0.0",
  "description": "English internationalization for Drift Browser",
  "author": "Drift Team",
  "type": ["i18n"],
  "permissions": ["i18n", "storage"],
  "main": "index.js",
  "renderer": "renderer.js",
  "i18n": "locales/",
  "icon": "icon.png",
  "minVersion": "2.33.0",
  "dependencies": []
}
```

**字段说明：**
| 字段 | 必需 | 说明 |
|------|------|------|
| id | ✅ | 唯一标识，反向域名格式 |
| name | ✅ | 显示名称 |
| version | ✅ | 语义化版本号 |
| description | ❌ | 插件描述 |
| author | ❌ | 作者 |
| type | ✅ | 类型数组：`i18n`/`ui`/`feature`/`system` |
| permissions | ❌ | 权限数组 |
| main | ❌ | 主进程入口文件（有则加载为主进程插件） |
| renderer | ❌ | 渲染进程入口文件（有则注入到渲染进程） |
| i18n | ❌ | 国际化文件目录路径 |
| icon | ❌ | 图标文件 |
| minVersion | ❌ | 最低浏览器版本要求 |
| dependencies | ❌ | 依赖的其他插件 ID |

**权限列表：**
| 权限 | 说明 |
|------|------|
| i18n | 访问国际化 API |
| tabs | 访问标签页 API |
| bookmarks | 访问书签 API |
| history | 访问历史记录 API |
| storage | 访问插件存储 API |
| network | 访问网络请求 API |
| notifications | 发送通知 |
| clipboard | 访问剪贴板 |
| shell | 打开外部链接/文件 |
| menu | 修改菜单 |
| settings | 修改设置 |
| theme | 修改主题 |

### 3. 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    主进程 (Main)                      │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         plugin-loader.js                      │   │
│  │  - 扫描 plugins/ 目录                         │   │
│  │  - 验证 drift-plugin.json                     │   │
│  │  - 加载主进程插件 (require + sandbox)          │   │
│  │  - 注入渲染进程插件 (executeJavaScript)        │   │
│  │  - 插件间通讯总线                              │   │
│  │  - 插件生命周期管理                            │   │
│  └──────────┬───────────────────────────────────┘   │
│             │ IPC                                     │
└─────────────┼────────────────────────────────────────┘
              │
┌─────────────┼────────────────────────────────────────┐
│             ▼          渲染进程 (Renderer)             │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │         plugin-host.js                        │     │
│  │  - DriftPluginSDK 全局对象                    │     │
│  │  - 权限检查中间件                              │     │
│  │  - 插件沙箱执行环境                            │     │
│  │  - 插件间通讯客户端                            │     │
│  │  - i18n 系统集成                               │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │         plugin-manager-ui.js                  │     │
│  │  - drift://plugins 页面                       │     │
│  │  - 插件列表/启用/禁用/删除                     │     │
│  │  - 权限详情显示                                │     │
│  └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

### 4. 核心模块设计

#### 4.1 main/plugin-loader.js — 主进程插件加载器

```javascript
// 核心职责：
// 1. 扫描 plugins/ 目录，读取 drift-plugin.json
// 2. 验证清单完整性和版本兼容性
// 3. 加载主进程插件：require() + 传入 sandboxed API
// 4. 注入渲染进程插件：webContents.executeJavaScript()
// 5. 插件间通讯总线（IPC 中转）
// 6. 插件状态持久化（启用/禁用）

// 沙箱 API 提供给主进程插件：
const mainPluginAPI = {
  id: plugin.id,
  ipc: {
    handle: (channel, handler) => { /* 注册 plugin:{id}:{channel} */ },
    send: (targetPluginId, channel, data) => { /* 插件间通讯 */ },
    on: (channel, handler) => { /* 监听 */ }
  },
  storage: {
    get: (key) => { /* 读取插件私有存储 */ },
    set: (key, value) => { /* 写入插件私有存储 */ }
  },
  app: {
    getVersion: () => app.getVersion(),
    getPath: (name) => app.getPath(name)
  },
  browser: {
    getMainWindow: () => getMainWindow(),
    createWindow: (url) => { /* 创建新窗口 */ }
  }
};
```

#### 4.2 src/js/modules/plugin-host.js — 渲染进程插件宿主

```javascript
// 核心职责：
// 1. 接收主进程注入的插件代码并执行
// 2. 提供 DriftPluginSDK 全局对象
// 3. 权限检查中间件
// 4. 插件间通讯客户端
// 5. i18n 系统集成

// DriftPluginSDK API：
window.DriftPluginSDK = {
  // 插件信息
  getPluginId: () => string,
  getPluginInfo: () => object,

  // 国际化
  i18n: {
    register: (locale, translations) => {},
    t: (key, params) => string,
    getCurrentLocale: () => string,
    setLocale: (locale) => {},
    onLocaleChange: (callback) => {}
  },

  // 标签页（需 tabs 权限）
  tabs: {
    create: (url) => {},
    close: (tabId) => {},
    list: () => [],
    getActive: () => object,
    onCreated: (callback) => {},
    onRemoved: (callback) => {}
  },

  // 书签（需 bookmarks 权限）
  bookmarks: {
    add: (url, title) => {},
    remove: (index) => {},
    list: () => [],
    onChanged: (callback) => {}
  },

  // 插件存储（需 storage 权限）
  storage: {
    get: (key) => Promise,
    set: (key, value) => Promise,
    remove: (key) => Promise
  },

  // 通知（需 notifications 权限）
  notifications: {
    info: (msg) => {},
    success: (msg) => {},
    warning: (msg) => {},
    error: (msg) => {}
  },

  // 插件间通讯
  messaging: {
    send: (targetPluginId, data) => {},
    onMessage: (callback) => {},
    broadcast: (data) => {}
  },

  // UI 增强（需 ui 权限）
  ui: {
    registerToolbarButton: (config) => {},
    registerSidePanel: (config) => {},
    registerSettingsSection: (config) => {},
    registerContextMenu: (items) => {}
  },

  // 主题（需 theme 权限）
  theme: {
    getCurrent: () => string,
    onChange: (callback) => {}
  },

  // 剪贴板（需 clipboard 权限）
  clipboard: {
    readText: () => Promise,
    writeText: (text) => Promise
  }
};
```

#### 4.3 插件间通讯机制

```
插件A (renderer)                    插件B (renderer)
     │                                   │
     │  DriftPluginSDK.messaging         │
     │    .send('plugin-b', data)        │
     ▼                                   │
  plugin-host.js                         │
     │                                   │
     │  ipcRenderer.invoke               │
     │    ('plugin:message', ...)        │
     ▼                                   │
  preload.js → 主进程                     │
     │                                   │
     │  plugin-loader.js (总线)           │
     │    路由到目标插件                   │
     ▼                                   │
  webContents.send('plugin-message')     │
     │                                   │
     │                    plugin-host.js  │
     │                        │          │
     │                        ▼          │
     │              DriftPluginSDK       │
     │                .onMessage(cb)     │
     │                        │          │
     └────────────────────────┘          │
```

#### 4.4 i18n 系统

**核心设计：**
- `plugin-host.js` 内置 `DriftI18n` 管理器
- 所有 i18n 类型插件注册翻译文本到统一翻译表
- 渲染进程提供 `window.DriftI18n.t(key)` 全局函数
- 现有硬编码中文作为默认 `zh-CN` 翻译
- 插件可注册新语言或覆盖现有翻译

**翻译文件格式 (locales/en.json)：**
```json
{
  "menu.newTab": "New Tab",
  "menu.settings": "Settings",
  "menu.bookmarks": "Bookmarks",
  "menu.history": "History",
  "menu.downloads": "Downloads",
  "settings.appearance": "Appearance",
  "settings.about": "About",
  "tabs.newTab": "New Tab",
  "search.placeholder": "Search or enter URL",
  "notify.tabCreated": "New tab created",
  ...
}
```

**翻译 key 命名规范：** `模块.功能` 如 `menu.settings`、`tabs.newTab`

**集成方式：**
1. `plugin-host.js` 在 DOM ready 后扫描所有 `[data-i18n]` 属性元素
2. 替换 `textContent` 为翻译文本
3. 语言切换时重新扫描并替换
4. 提供 `DriftI18n.t(key)` 供 JS 代码动态翻译

### 5. 文件修改清单

#### 新建文件

| 文件 | 说明 |
|------|------|
| `main/plugin-loader.js` | 主进程插件加载器 |
| `src/js/modules/plugin-host.js` | 渲染进程插件宿主 + DriftPluginSDK |
| `src/js/modules/plugin-manager-ui.js` | drift://plugins 管理页面 |
| `src/css/plugins.css` | 插件管理页面样式 |
| `plugins/english-i18n/drift-plugin.json` | 英文语言包清单 |
| `plugins/english-i18n/renderer.js` | 英文语言包渲染入口 |
| `plugins/english-i18n/locales/en.json` | 英文翻译文件 |

#### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `main.js` | 添加 plugin-loader 导入和初始化调用 |
| `main/ipc-handlers.js` | 添加 registerPluginHandlers() |
| `preload.js` | 添加插件相关 IPC API |
| `src/index.html` | 添加 plugin-host.js、plugin-manager-ui.js 脚本标签；添加 drift://plugins 路由处理 |
| `src/js/modules/tabs.js` | 添加 drift://plugins 页面路由 |
| `package.json` | build.files 添加 "plugins/**/*"；build.asarUnpack 添加 plugins |

### 6. 实现步骤（按依赖顺序）

#### 步骤1：主进程插件加载器 (`main/plugin-loader.js`)
- 扫描 `plugins/` 目录
- 读取验证 `drift-plugin.json`
- 加载状态持久化（`%APPDATA%/f-browser/plugins-state.json`）
- 主进程插件 require + sandbox API
- 渲染进程插件注入（`webContents.executeJavaScript`）
- 插件间通讯总线

#### 步骤2：IPC 桥接 (`preload.js` + `ipc-handlers.js`)
- `plugin:get-list` — 获取插件列表
- `plugin:enable` / `plugin:disable` — 启用/禁用
- `plugin:delete` — 删除插件
- `plugin:send-message` — 插件间通讯
- `plugin:storage-get` / `plugin:storage-set` — 插件存储
- `plugin:inject` — 主进程→渲染进程注入触发

#### 步骤3：渲染进程插件宿主 (`plugin-host.js`)
- `DriftPluginSDK` 全局对象
- 权限检查中间件
- 插件沙箱执行
- i18n 系统核心（DriftI18n）
- 插件间通讯客户端
- `[data-i18n]` DOM 翻译集成

#### 步骤4：主进程集成 (`main.js`)
- 导入 plugin-loader
- 在 `app.whenReady` 中初始化
- 窗口创建后注入渲染进程插件

#### 步骤5：drift://plugins 页面 (`plugin-manager-ui.js` + `plugins.css`)
- 独立管理页面
- 插件列表（名称、版本、类型、状态）
- 启用/禁用开关
- 删除按钮
- 权限详情展开
- 插件详情弹窗

#### 步骤6：路由集成 (`tabs.js`)
- `drift://plugins` 页面路由
- 类似 `f://settings`、`f://task-manager` 的处理方式

#### 步骤7：内置英文语言包 (`plugins/english-i18n/`)
- `drift-plugin.json` 清单
- `locales/en.json` 翻译文件（覆盖主要 UI 文本）
- `renderer.js` 注册翻译

#### 步骤8：HTML 和构建配置
- `index.html` 添加脚本标签
- `package.json` 确保 plugins 目录包含在构建中

### 7. 安全考量

1. **权限沙箱**：插件只能访问声明权限对应的 SDK API
2. **IPC 命名空间隔离**：插件 IPC channel 使用 `plugin:{pluginId}:{channel}` 格式
3. **存储隔离**：每个插件独立存储空间，key 前缀为 pluginId
4. **代码注入安全**：渲染进程插件代码在 try-catch 中执行，错误不影响主流程
5. **版本检查**：minVersion 不满足则拒绝加载
6. **依赖检查**：dependencies 未满足则警告但不阻止加载

### 8. 验证步骤

1. 在 `plugins/` 目录放置 `english-i18n` 插件，启动浏览器
2. 确认插件被扫描和加载，控制台输出加载日志
3. 打开 `drift://plugins` 页面，确认显示插件列表
4. 切换语言到 English，确认 UI 文本翻译
5. 禁用插件，确认翻译回退到中文
6. 重新启用插件，确认翻译恢复
7. 创建测试插件验证插件间通讯
8. 验证权限沙箱：未声明权限的 API 调用应被拒绝
