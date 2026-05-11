# ALIGNMENT - AI 浏览器自动化系统

## 一、原始需求

设计并实现一个 AI 驱动的浏览器自动化系统，支持两种操作模式：
- **标准模式**: AI 控制浏览器导航、表单填写、元素操作，返回结构化 DOM 数据和文本信息
- **多模态模式**: AI 控制虚拟鼠标定位和元素交互，返回当前界面截图和网站文本数据

## 二、项目上下文分析

### 2.1 技术栈
- **框架**: Electron 33.x（Chromium 内核）
- **前端**: 原生 HTML/CSS/JS（无框架），使用 `window.FBrowser` 全局命名空间
- **后端**: Electron 主进程（Node.js），使用 `ipcMain/ipcRenderer` 通信
- **安全**: contextBridge + contextIsolation，preload.js 暴露 `window.electronAPI`
- **Webview**: 使用 `<webview>` 标签加载网页内容

### 2.2 现有架构
```
main.js                    # 入口，初始化各模块
main/
  ai-agent.js              # AI Agent 工具定义与执行（已有12个工具）
  ipc-handlers.js          # IPC 处理器注册中心
  window-manager.js        # 窗口管理（主窗口、无痕、小窗等）
  security.js              # 安全策略
  session-manager.js       # 会话恢复
  downloads.js             # 下载管理
  extensions.js            # 扩展管理
  tray.js                  # 系统托盘
  context-menu.js          # 右键菜单

preload.js                 # 安全桥接层，暴露 electronAPI

src/
  index.html               # 主页面
  js/app.js                # 渲染进程入口
  js/modules/
    ai-chat.js             # AI 对话模块（核心交互界面）
    tabs.js                # 标签页管理（webview 宿主）
    screenshot.js          # 截图模块（已有基础功能）
    navigation.js          # 导航控制
    ...
  css/
    ai-chat.css            # AI 对话样式
    webview.css            # Webview 样式
    ...
```

### 2.3 现有 AI 系统
- **AI 对话**: 完整的多模型对话系统，支持 12+ 服务商
- **AI Agent**: 已有工具系统（file_read/write/list, app_launch, shell_exec 等）
- **工具调用**: 支持 Function Calling（FC）和文本解析两种模式
- **流式输出**: SSE 流式响应，支持工具调用流
- **MCP 支持**: 已集成 MCP 协议（本地进程 + HTTP）

### 2.4 Webview 机制
- 标签页使用 `<webview>` 标签，通过 `did-attach-webview` 事件获取 webContents
- 已有 `webview-ready` IPC 用于设置新窗口拦截
- webContents 可执行 `executeJavaScript` 注入脚本
- 截图模块已有 `capturePage` 基础功能

## 三、需求理解

### 3.1 核心功能
1. **AI 代理浏览器标签页**: AI 可以创建和控制独立的浏览器标签页
2. **页面结构提取**: 注入脚本到 webview，提取 DOM 结构、可交互元素
3. **元素操作**: 点击、输入、选择等操作，通过 CSS 选择器或坐标定位
4. **截图功能**: 全页面/可视区域截图，返回 base64 图片
5. **虚拟鼠标**: 多模态模式下显示虚拟鼠标，支持移动/点击/拖拽/滚动
6. **模式切换**: 标准/多模态两种操作模式

### 3.2 集成方式
- 作为 AI Agent 的新工具集添加到 `TOOL_DEFINITIONS`
- 前端在 AI 聊天界面中添加浏览器预览区
- 通过 IPC 通信桥接主进程 webview 控制和渲染进程 UI

## 四、边界确认

### 包含在范围内
- AI 代理标签页的创建/关闭/管理
- DOM 结构提取与元素操作
- 截图功能（可视区域 + 全页面）
- 虚拟鼠标控制与可视化
- AI 工具定义扩展
- 前端浏览器预览界面
- 模式切换（标准/多模态）

### 不包含在范围内
- 独立的浏览器窗口（使用现有 webview 标签页机制）
- 网络代理/VPN 功能
- 自动化脚本录制/回放
- 跨设备同步
- 性能基准测试

## 五、疑问澄清

### 5.1 已决策（基于项目分析）

| 问题 | 决策 | 依据 |
|------|------|------|
| AI 标签页是否使用独立 BrowserWindow？ | **否，使用现有 webview 标签页机制** | 项目已有完善的标签页系统，复用可减少复杂度 |
| 截图实现方式？ | **使用 webContents.capturePage()** | Electron 原生支持，性能最优 |
| DOM 提取方式？ | **通过 executeJavaScript 注入脚本** | 项目已有此模式（webview-ready），安全且灵活 |
| 虚拟鼠标实现位置？ | **前端 CSS 叠加层** | 不影响 webview 实际内容，纯 UI 展示 |
| 工具调用集成方式？ | **扩展 TOOL_DEFINITIONS + executeTool** | 与现有 Agent 系统完全一致 |

### 5.2 需确认问题

1. **AI 浏览器标签页是否对用户可见？**
   - 方案A：作为普通标签页显示在标签栏，用户可手动切换查看
   - 方案B：隐藏标签页，仅在 AI 预览区显示截图
   - **建议方案A**：用户可见更直观，也便于调试

2. **多标签页同时操作？**
   - 方案A：同时支持多个 AI 控制的标签页
   - 方案B：同一时间只有一个 AI 代理标签页
   - **建议方案A**：设计文档已规划多标签页支持

3. **AI-SMP（Smart Mouse Pointer）功能？**
   - 设计文档提到"支持网页内 AI-SMP 功能激活"
   - 这是指 AI 可以在网页内激活某种智能鼠标指针功能？
   - **建议先不实现**：优先完成核心浏览器自动化，SMP 作为后续增强

## 六、技术约束

1. **Electron 安全模型**: 必须通过 contextBridge 暴露 API，不能直接暴露 nodeIntegration
2. **Webview 沙箱**: webview 内脚本执行需要通过 executeJavaScript
3. **CSP 策略**: index.html 有严格的 CSP，注入脚本需兼容
4. **内存管理**: 项目已有内存保护机制（标签页冻结），AI 标签页需兼容
5. **代码风格**: 项目使用 var 声明（兼容性考虑），函数式风格，IIFE 模块封装
