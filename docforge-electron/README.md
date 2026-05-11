# DocForge Electron 插件

离线/在线全能文档查看/编辑器，支持 Word/PDF 编辑 + 云协作。可集成到任何 Electron 浏览器中。

## 功能特性

### 文档编辑
- **Word 编辑器**: 基于 Tiptap 的 WPS 级富文本编辑器
  - 双行工具栏: 字体/字号/颜色/对齐/列表/表格/图片
  - 格式刷/查找替换/修订追踪/批注系统
  - 导入 DOCX/Markdown/PDF，导出 HTML/TXT/DOCX/Markdown
- **PDF 查看器**: 基于 pdf.js 的完整 PDF 阅读
  - 批注/高亮/书签/签名/表单填写
  - 页面重组/PDF比较/OCR
  - 缩放/旋转/全屏

### 云协作
- **6 位协作码**: 创建房间 → 分享码 → 即时加入
- **WebSocket 实时同步**: 文档内容/光标位置/用户操作
- **内置聊天**: 协作者实时沟通
- **权限管理**: 观察者/编辑者/所有者 三级权限
- **离线降级**: 断网自动切换 HTTP 轮询，恢复后自动同步

### 离线能力
- **IndexedDB 本地存储**: 文档自动缓存到本地
- **操作队列**: 离线编辑操作排队，联网后自动同步
- **冲突检测**: 自动检测版本冲突，支持手动解决

---

## 安装

### 方式 1: npm 安装（推荐）

```bash
npm install docforge-electron
# 或
pnpm add docforge-electron
```

### 方式 2: 本地引用

将 `docforge-electron` 目录复制到你的项目中，然后在 `package.json` 中添加：

```json
{
  "dependencies": {
    "docforge-electron": "file:./docforge-electron"
  }
}
```

---

## 快速集成

### 第 1 步: 主进程注册

在你的 Electron 主进程 `main.js` 中：

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 导入 DocForge 插件
const { DocForgePlugin } = require('docforge-electron/dist/main');

// 创建插件实例
const docforge = new DocForgePlugin({
  userDataPath: app.getPath('userData'),
  serverUrl: 'https://your-docforge-server.com',  // 可选，协作服务器
  maxRecentFiles: 20,
  autoSaveInterval: 30000  // 30秒自动保存
});

// 注册 IPC 处理器
docforge.register(ipcMain);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'node_modules/docforge-electron/dist/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 加载 DocForge 渲染器
  win.loadFile(path.join(__dirname, 'node_modules/docforge-electron/dist/renderer/index.html'));
});
```

### 第 2 步: 打开文件

```javascript
// 通过 IPC 打开文件对话框
ipcMain.handle('docforge:open-file');

// 或直接打开指定文件
ipcMain.handle('docforge:open-file-path', '/path/to/document.docx');
```

### 第 3 步: 作为浏览器的一部分

如果你想把 DocForge 嵌入到你的浏览器标签页中：

```javascript
const { BrowserView } = require('electron');

// 创建 DocForge 视图
const docforgeView = new BrowserView({
  webPreferences: {
    preload: path.join(__dirname, 'node_modules/docforge-electron/dist/preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
});

// 检测到文档 URL 时加载 DocForge
mainWindow.setBrowserView(docforgeView);
docforgeView.webContents.loadFile(
  path.join(__dirname, 'node_modules/docforge-electron/dist/renderer/index.html')
);
```

---

## API 参考

### 主进程 API

#### `new DocForgePlugin(options)`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `userDataPath` | `string` | 必填 | Electron userData 路径 |
| `serverUrl` | `string` | `''` | 协作服务器地址 |
| `maxRecentFiles` | `number` | `20` | 最近文件数量 |
| `autoSaveInterval` | `number` | `30000` | 自动保存间隔(ms) |

#### `docforge.register(ipcMain)`

注册所有 IPC 处理器。

#### `docforge.destroy()`

清理所有资源。

---

### 渲染进程 API (通过 Preload)

渲染进程通过 `window.docforge` 访问所有 API：

#### 文件操作

```typescript
// 打开文件对话框
const file = await window.docforge.openFile();
// → { path: string, name: string, content: string (base64), format: string }

// 保存文件
await window.docforge.saveFile({
  content: 'base64-content',
  filename: 'document.docx',
  format: 'docx',
  path: '/optional/save/path'  // 不填则弹出保存对话框
});

// 获取最近文件
const recent = await window.docforge.getRecentFiles();
// → [{ path, name, format, lastOpened }]

// 读取文件内容
const content = await window.docforge.readFile('/path/to/file.docx');
// → string (base64)

// 写入文件
await window.docforge.writeFile('/path/to/file.docx', 'base64-content');
```

#### 协作操作

```typescript
// 创建协作房间
const room = await window.docforge.createRoom('doc-id', '文档内容', '用户名');
// → { code: 'ABC123', wsUrl: 'ws://...' }

// 加入协作房间
const joined = await window.docforge.joinRoom('ABC123', '用户名');
// → { success: true, wsUrl: 'ws://...' }

// 发送文档更新
await window.docforge.sendUpdate('ABC123', '更新内容');

// 获取房间用户
const users = await window.docforge.getRoomUsers('ABC123');
// → [{ id, name, color }]

// 离开房间
await window.docforge.leaveRoom('ABC123');
```

#### 离线存储

```typescript
// 获取离线文档列表
const docs = await window.docforge.getOfflineDocs();
// → [{ id, name, format, synced, lastModified }]

// 保存文档到离线存储
await window.docforge.saveOfflineDoc({
  id: 'doc-id',
  name: '文档名',
  content: 'base64-content',
  format: 'docx'
});

// 获取同步状态
const status = await window.docforge.getSyncStatus();
// → { isOnline, pendingOps, synced, totalDocs, conflictCount }

// 同步离线文档
await window.docforge.syncOffline();
```

#### 设置

```typescript
// 获取设置
const value = await window.docforge.getSetting('autoSave');

// 设置
await window.docforge.setSetting('autoSave', true);
```

#### 系统

```typescript
// 获取系统语言
const locale = await window.docforge.getLocale();
// → 'zh-CN'

// 显示通知
await window.docforge.showNotification({
  title: '保存成功',
  body: '文档已保存到本地'
});

// 用系统浏览器打开 URL
await window.docforge.openExternal('https://example.com');
```

---

## IPC 通道清单

| 通道 | 方向 | 参数 | 返回值 |
|------|------|------|--------|
| `docforge:open-file` | 主→渲染 | - | `OpenFileResult \| null` |
| `docforge:save-file` | 渲→主 | `{ content, filename, format, path? }` | `{ success, path? }` |
| `docforge:get-recent-files` | 渲→主 | - | `RecentFile[]` |
| `docforge:read-file` | 渲→主 | `string (path)` | `string (base64)` |
| `docforge:write-file` | 渲→主 | `path, content` | `boolean` |
| `docforge:create-room` | 渲→主 | `docId, content, userName` | `{ code, wsUrl }` |
| `docforge:join-room` | 渲→主 | `code, userName` | `{ success, wsUrl }` |
| `docforge:send-update` | 渲→主 | `code, content` | `void` |
| `docforge:get-room-users` | 渲→主 | `code` | `CollabUser[]` |
| `docforge:leave-room` | 渲→主 | `code` | `void` |
| `docforge:get-offline-docs` | 渲→主 | - | `DocMetadata[]` |
| `docforge:save-offline-doc` | 渲→主 | `OfflineDoc` | `void` |
| `docforge:get-sync-status` | 渲→主 | - | `SyncStatus` |
| `docforge:sync-offline` | 渲→主 | - | `{ synced, pending }` |
| `docforge:get-setting` | 渲→主 | `key` | `value` |
| `docforge:set-setting` | 渲→主 | `key, value` | `void` |
| `docforge:get-locale` | 渲→主 | - | `string` |
| `docforge:show-notification` | 渲→主 | `{ title, body }` | `void` |
| `docforge:open-external` | 渲→主 | `url` | `void` |

---

## 自定义样式

DocForge 使用 CSS 变量，你可以覆盖默认样式：

```css
:root {
  --docforge-bg: #0a0a0a;
  --docforge-text: #ffffff;
  --docforge-accent: #3b82f6;
  --docforge-sidebar-width: 280px;
  --docforge-toolbar-height: 80px;
}
```

---

## 目录结构

```
docforge-electron/
├── dist/                          # 构建输出
│   ├── main/
│   │   ├── index.js               # 主进程入口
│   │   ├── main/                  # 主进程模块
│   │   ├── preload/               # 预加载模块
│   │   └── shared/                # 共享类型
│   ├── preload/
│   │   └── index.js               # 预加载脚本
│   └── renderer/
│       ├── index.html             # 渲染器入口
│       └── app.js                 # 渲染器应用
├── src/
│   ├── main/                      # 主进程源码
│   │   ├── index.ts               # DocForgePlugin 类
│   │   ├── ipc-handlers.ts        # IPC 处理器
│   │   ├── file-system.ts         # 文件系统操作
│   │   ├── storage.ts             # 本地存储
│   │   └── tray.ts                # 系统托盘
│   ├── preload/
│   │   └── index.ts               # 预加载脚本
│   ├── renderer/
│   │   ├── index.html             # HTML 入口
│   │   ├── app.tsx                # React 应用
│   │   ├── hooks/
│   │   │   ├── use-doc.ts         # 文档 Hook
│   │   │   ├── use-collab.ts      # 协作 Hook
│   │   │   └── use-offline.ts     # 离线 Hook
│   │   └── lib/
│   │       └── ipc-client.ts      # IPC 客户端
│   └── shared/
│       └── types.ts               # 共享类型定义
├── demo.js                        # 集成演示
├── webpack.config.js              # 构建配置
├── tsconfig.main.json             # 主进程 TS 配置
├── tsconfig.renderer.json         # 渲染器 TS 配置
└── package.json
```

---

## 协作服务器

DocForge 协作功能需要 WebSocket 服务器。你可以：

1. **使用 DocForge 自带服务器**: 运行主项目 `pnpm dev` 即可启动
2. **自建服务器**: 参考主项目的 `src/server.ts` 实现
3. **不使用协作**: 离线模式仍然完整可用

---

## 常见问题

### Q: 如何只使用离线模式？

不配置 `serverUrl` 即可。所有文档操作都在本地完成。

### Q: 如何替换默认 UI？

渲染器是标准的 React 应用，你可以修改 `src/renderer/app.tsx` 然后重新构建。

### Q: 如何处理大文件？

大于 50MB 的文件会自动使用流式读取，避免内存溢出。

### Q: 支持哪些文件格式？

| 格式 | 查看 | 编辑 | 导出 |
|------|:----:|:----:|:----:|
| `.docx` | ✅ | ✅ | ✅ |
| `.pdf` | ✅ | ✅ | ✅ |
| `.md` | ✅ | ✅ | ✅ |
| `.txt` | ✅ | ✅ | ✅ |
| `.html` | ✅ | ✅ | ✅ |
| `.csv` | ✅ | ✅ | ✅ |
| `.xlsx` | ✅ | ✅ | ✅ |
| `.pptx` | ✅ | ✅ | ✅ |

---

## License

MIT
