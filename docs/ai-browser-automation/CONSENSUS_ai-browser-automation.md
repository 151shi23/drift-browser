# CONSENSUS - AI 浏览器自动化系统

## 一、需求描述

为 Drift 浏览器实现 AI 驱动的浏览器自动化系统，使 AI 助手能够创建、控制和操作浏览器标签页，支持标准模式（DOM 操作）和多模态模式（截图+虚拟鼠标）两种操作方式。

## 二、验收标准

### 2.1 核心功能验收

| 功能 | 验收标准 |
|------|----------|
| AI 代理标签页 | AI 可通过工具调用创建/关闭浏览器标签页，标签页在标签栏可见 |
| 页面导航 | AI 可导航到指定 URL、前进、后退 |
| DOM 结构提取 | AI 可获取页面的可交互元素列表、文本内容、表单结构 |
| 元素操作 | AI 可通过 CSS 选择器点击元素、输入文本、选择下拉选项 |
| 截图 | AI 可截取可视区域/全页面截图，返回 base64 图片数据 |
| 虚拟鼠标 | 多模态模式下显示虚拟鼠标位置，支持坐标点击/移动/滚动 |
| 模式切换 | 可在标准/多模态模式间切换 |
| 工具集成 | 所有浏览器操作作为 AI Agent 工具注册，支持 FC 和文本解析调用 |
| 前端预览 | AI 聊天界面可显示浏览器截图预览和虚拟鼠标 |

### 2.2 非功能验收

- 不破坏现有 AI 对话、标签页、截图等功能
- AI 浏览器操作需要用户授权（高风险操作确认机制）
- 兼容现有内存保护机制（标签页冻结）
- 代码风格与项目一致（var 声明、IIFE 模块）

## 三、技术实现方案

### 3.1 架构决策

| 决策项 | 方案 | 理由 |
|--------|------|------|
| AI 标签页实现 | 复用现有 webview 标签页，标记 `isAiProxy=true` | 复用已有标签页系统，用户可见可调试 |
| 多标签页支持 | 支持多个 AI 代理标签页，通过 tabId 管理 | 灵活性更高，设计文档已规划 |
| AI-SMP 功能 | 本期不实现 | 优先核心功能，SMP 作为后续增强 |
| 截图实现 | webContents.capturePage() | Electron 原生 API，性能最优 |
| DOM 提取 | executeJavaScript 注入提取脚本 | 项目已有此模式，安全灵活 |
| 虚拟鼠标 | 前端 CSS 叠加层 + IPC 同步位置 | 不影响 webview 内容，纯 UI 展示 |
| 工具注册 | 扩展 TOOL_DEFINITIONS 数组 | 与现有 Agent 系统完全一致 |

### 3.2 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `main/ai-browser-handler.js` | **新增** | AI 浏览器 IPC 处理器（标签页管理、DOM提取、截图、鼠标控制） |
| `src/js/modules/ai-browser.js` | **新增** | 前端 AI 浏览器模块（预览区、虚拟鼠标、操作控制） |
| `src/css/ai-browser.css` | **新增** | AI 浏览器预览区样式 |
| `main/ai-agent.js` | **修改** | 添加浏览器相关工具定义到 TOOL_DEFINITIONS |
| `main/ipc-handlers.js` | **修改** | 注册 AI 浏览器 IPC 处理器 |
| `preload.js` | **修改** | 暴露 AI 浏览器相关 API |
| `src/js/modules/ai-chat.js` | **修改** | 集成浏览器预览区到聊天界面 |
| `src/index.html` | **修改** | 引入 ai-browser.css |
| `src/js/modules/tabs.js` | **修改** | 支持 AI 代理标签页标记和管理 |

### 3.3 IPC 通信协议

#### 渲染进程 → 主进程（invoke）

```
ai-browser-create-tab      创建 AI 代理标签页
ai-browser-close-tab       关闭标签页
ai-browser-list-tabs       列出所有 AI 标签页
ai-browser-navigate        导航到 URL
ai-browser-go-back         后退
ai-browser-go-forward      前进
ai-browser-get-structure   获取页面 DOM 结构
ai-browser-get-text        获取页面文本
ai-browser-click-element   通过选择器点击元素
ai-browser-input-text      通过选择器输入文本
ai-browser-select-option   选择下拉选项
ai-browser-screenshot      截图（可视区域/全页面）
ai-browser-mouse-move      移动虚拟鼠标
ai-browser-mouse-click     鼠标点击（坐标）
ai-browser-scroll          滚动页面
ai-browser-set-mode        设置操作模式
```

#### 主进程 → 渲染进程（on）

```
ai-browser-screenshot-update   截图更新推送
ai-browser-mouse-update        鼠标位置更新
ai-browser-tab-closed          标签页关闭通知
```

### 3.4 AI Agent 工具定义

新增 8 个浏览器工具：

1. `browser_create_tab` - 创建 AI 代理浏览器标签页
2. `browser_navigate` - 导航到指定 URL
3. `browser_screenshot` - 截取当前页面截图
4. `browser_click` - 点击页面元素
5. `browser_input` - 在输入框中输入文本
6. `browser_get_structure` - 获取页面结构数据
7. `browser_mouse_move` - 移动虚拟鼠标
8. `browser_scroll` - 滚动页面

## 四、技术约束

1. 必须通过 contextBridge 暴露 API，遵守 Electron 安全模型
2. Webview 内脚本执行通过 executeJavaScript，不开启 nodeIntegration
3. 兼容现有 CSP 策略
4. AI 标签页需兼容内存保护机制（可被冻结/恢复）
5. 代码风格：var 声明、IIFE 模块封装、与项目一致

## 五、集成方案

1. **工具注册**: 在 `ai-agent.js` 的 `TOOL_DEFINITIONS` 数组中追加浏览器工具
2. **工具执行**: 在 `executeTool` 的 switch 中添加 browser_* 分支，调用 ai-browser-handler
3. **前端集成**: 在 AI 聊天界面底部添加可折叠的浏览器预览面板
4. **标签页集成**: AI 代理标签页在 tabs.js 中标记 `isAiProxy`，可被正常管理
