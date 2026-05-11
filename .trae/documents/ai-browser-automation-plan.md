# AI 浏览器自动化系统设计方案

## 一、系统概述

设计并实现一个 AI 驱动的浏览器自动化系统，支持两种操作模式：

### 1.1 标准模式 (Standard Model)

- AI 控制浏览器导航、表单填写、元素操作
- 返回结构化 DOM 数据和文本信息
- 支持网页内 AI-SMP (Smart Mouse Pointer) 功能激活

### 1.2 多模态模式 (Multimodal Model)

- AI 控制虚拟鼠标定位和元素交互
- 给返回当前界面截图和网站文本数据
- 视觉与文本信息同步，支持视觉 AI 决策

***

## 二、架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Chat Interface                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  对话面板   │  │  控制面板   │  │   AI 代理浏览器预览     │  │
│  │             │  │  - 模式切换 │  │   (截图/实时画面)       │  │
│  │             │  │  - 鼠标控制 │  │   + 虚拟鼠标叠加层      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Automation Layer                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  DOM Parser   │  │ Screenshot    │  │  Mouse Controller │   │
│  │  - 元素定位   │  │  Capture      │  │  - 移动/点击/拖拽 │   │
│  │  - 结构提取   │  │  - 全屏/区域  │  │  - 滚动/输入      │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Electron WebView Layer                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AI-Proxied Browser Tab                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Webview │  │ Inject  │  │ Event   │  │ Coordinate  │  │  │
│  │  │ Content │  │ Script  │  │ Bridge  │  │ System      │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

***

## 三、核心模块设计

### 3.1 AI 代理浏览器标签页 (AI-Proxied Browser Tab)

**文件**: `src/js/modules/ai-browser.js`

```javascript
// AI 代理浏览器模块
class AIBrowserAgent {
  constructor() {
    this.mode = 'standard'; // 'standard' | 'multimodal'
    this.tabs = new Map();  // AI 控制的标签页
    this.activeTabId = null;
    this.mousePosition = { x: 0, y: 0 };
    this.mouseOverlay = null;
  }

  // 创建 AI 代理标签页
  createAIBrowserTab(url, options = {});

  // 获取页面结构数据
  getPageStructure(tabId);

  // 截图
  captureScreenshot(tabId, options);

  // 鼠标操作
  mouseMove(tabId, x, y);
  mouseClick(tabId, x, y, button);
  mouseDrag(tabId, startX, startY, endX, endY);
  scroll(tabId, direction, amount);

  // 元素操作
  clickElement(tabId, selector);
  inputText(tabId, selector, text);
  selectOption(tabId, selector, value);
}
```

### 3.2 页面结构提取器 (DOM Structure Extractor)

**文件**: `main/ai-dom-extractor.js`

注入到 webview 中的脚本，提取：

- 可交互元素（按钮、链接、输入框）
- 文本内容
- 表单结构
- 页面布局信息

### 3.3 截图与视觉模块 (Screenshot & Vision Module)

**文件**: `main/ai-vision.js`

- 全页面截图
- 可视区域截图
- 元素高亮截图
- 坐标系统转换

### 3.4 鼠标控制器 (Mouse Controller)

**文件**: `main/ai-mouse-controller.js`

- 虚拟鼠标位置管理
- 平滑移动动画
- 点击/双击/右键
- 拖拽操作
- 滚动操作

***

## 四、IPC 通信协议

### 4.1 AI 浏览器控制 API

```javascript
// preload.js 新增 API
{
  // ---- AI 浏览器标签页管理 ----
  aiBrowserCreateTab: (url, options) => ipcRenderer.invoke('ai-browser-create-tab', url, options),
  aiBrowserCloseTab: (tabId) => ipcRenderer.invoke('ai-browser-close-tab', tabId),
  aiBrowserListTabs: () => ipcRenderer.invoke('ai-browser-list-tabs'),
  aiBrowserSwitchTab: (tabId) => ipcRenderer.invoke('ai-browser-switch-tab', tabId),

  // ---- 页面数据获取 ----
  aiBrowserGetStructure: (tabId) => ipcRenderer.invoke('ai-browser-get-structure', tabId),
  aiBrowserGetText: (tabId) => ipcRenderer.invoke('ai-browser-get-text', tabId),
  aiBrowserGetForms: (tabId) => ipcRenderer.invoke('ai-browser-get-forms', tabId),
  aiBrowserGetInteractiveElements: (tabId) => ipcRenderer.invoke('ai-browser-get-interactive-elements', tabId),

  // ---- 截图 ----
  aiBrowserScreenshot: (tabId, options) => ipcRenderer.invoke('ai-browser-screenshot', tabId, options),
  aiBrowserScreenshotElement: (tabId, selector) => ipcRenderer.invoke('ai-browser-screenshot-element', tabId, selector),

  // ---- 鼠标控制 ----
  aiBrowserMouseMove: (tabId, x, y) => ipcRenderer.invoke('ai-browser-mouse-move', tabId, x, y),
  aiBrowserMouseClick: (tabId, x, y, button) => ipcRenderer.invoke('ai-browser-mouse-click', tabId, x, y, button),
  aiBrowserMouseDrag: (tabId, startX, startY, endX, endY) => ipcRenderer.invoke('ai-browser-mouse-drag', tabId, startX, startY, endX, endY),
  aiBrowserScroll: (tabId, direction, amount) => ipcRenderer.invoke('ai-browser-scroll', tabId, direction, amount),

  // ---- 元素操作 ----
  aiBrowserClickElement: (tabId, selector) => ipcRenderer.invoke('ai-browser-click-element', tabId, selector),
  aiBrowserInputText: (tabId, selector, text) => ipcRenderer.invoke('ai-browser-input-text', tabId, selector, text),
  aiBrowserSelectOption: (tabId, selector, value) => ipcRenderer.invoke('ai-browser-select-option', tabId, selector, value),
  aiBrowserNavigate: (tabId, url) => ipcRenderer.invoke('ai-browser-navigate', tabId, url),
  aiBrowserGoBack: (tabId) => ipcRenderer.invoke('ai-browser-go-back', tabId),
  aiBrowserGoForward: (tabId) => ipcRenderer.invoke('ai-browser-go-forward', tabId),

  // ---- 模式切换 ----
  aiBrowserSetMode: (mode) => ipcRenderer.invoke('ai-browser-set-mode', mode),
  aiBrowserGetMode: () => ipcRenderer.invoke('ai-browser-get-mode'),

  // ---- 事件监听 ----
  onAIBrowserScreenshot: (cb) => ipcRenderer.on('ai-browser-screenshot-update', (_, data) => cb(data)),
  onAIBrowserMouseUpdate: (cb) => ipcRenderer.on('ai-browser-mouse-update', (_, data) => cb(data)),
}
```

### 4.2 返回数据结构

#### 页面结构数据

```javascript
{
  url: 'https://example.com',
  title: 'Page Title',
  viewport: { width: 1920, height: 1080 },
  scrollPosition: { x: 0, y: 0 },
  documentHeight: 5000,
  elements: [
    {
      type: 'button',
      selector: '#submit-btn',
      text: 'Submit',
      boundingBox: { x: 100, y: 200, width: 80, height: 40 },
      visible: true,
      clickable: true
    },
    {
      type: 'input',
      selector: '#search-box',
      placeholder: 'Search...',
      boundingBox: { x: 50, y: 100, width: 200, height: 30 },
      inputType: 'text'
    }
  ],
  links: [...],
  forms: [...],
  headings: [...]
}
```

#### 截图数据

```javascript
{
  image: 'data:image/png;base64,...',
  viewport: { width: 1920, height: 1080 },
  timestamp: Date.now(),
  mousePosition: { x: 500, y: 300 }
}
```

***

## 五、前端界面设计

### 5.1 AI 聊天界面扩展

在现有 AI 聊天界面基础上添加：

1. **AI 浏览器控制面板**
   - 模式切换开关（标准/多模态）
   - 当前控制的标签页列表
   - 操作日志
2. **AI 代理浏览器预览区**
   - 实时截图显示
   - 虚拟鼠标叠加层
   - 操作状态指示
3. **鼠标控制可视化**
   - 显示 AI 鼠标位置
   - 操作轨迹动画
   - 点击效果反馈

### 5.2 CSS 样式

**文件**: `src/css/ai-browser.css`

```css
/* AI 浏览器预览区 */
.ai-browser-preview {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-1);
}

/* 虚拟鼠标 */
.ai-virtual-mouse {
  position: absolute;
  width: 20px;
  height: 20px;
  pointer-events: none;
  z-index: 9999;
  transition: left 0.15s ease, top 0.15s ease;
}

.ai-virtual-mouse::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 16px solid var(--accent);
  transform: rotate(-45deg);
}

/* 点击效果 */
.ai-click-ripple {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  animation: aiClickRipple 0.5s ease-out forwards;
}

@keyframes aiClickRipple {
  from { transform: scale(0.5); opacity: 1; }
  to { transform: scale(2); opacity: 0; }
}
```

***

## 六、后端实现

### 6.1 主进程 IPC Handler

**文件**: `main/ai-browser-handler.js`

```javascript
const { ipcMain, webContents } = require('electron');

// AI 浏览器标签页管理
const aiBrowserTabs = new Map();
let activeTabId = null;
let currentMode = 'standard';

// 注入脚本 - 提取页面结构
const DOM_EXTRACTOR_SCRIPT = `
  (function() {
    const elements = [];
    // 提取可交互元素
    document.querySelectorAll('button, a, input, select, textarea, [onclick], [role="button"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        elements.push({
          type: el.tagName.toLowerCase(),
          selector: generateSelector(el),
          text: el.innerText || el.placeholder || '',
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          visible: true,
          attributes: {
            id: el.id,
            className: el.className,
            type: el.type,
            href: el.href
          }
        });
      }
    });
    return elements;
  })();
`;

// 鼠标操作注入脚本
const MOUSE_SCRIPT = {
  move: (x, y) => `
    (function() {
      window.__aiMouseX = ${x};
      window.__aiMouseY = ${y};
    })();
  `,
  click: (x, y, button = 'left') => `
    (function() {
      const el = document.elementFromPoint(${x}, ${y});
      if (el) {
        const event = new MouseEvent('${button === 'right' ? 'contextmenu' : 'click'}', {
          bubbles: true,
          cancelable: true,
          clientX: ${x},
          clientY: ${y},
          button: ${button === 'right' ? 2 : 0}
        });
        el.dispatchEvent(event);
      }
    })();
  `
};
```

### 6.2 截图实现

```javascript
async function captureWebview(webContentsId, options = {}) {
  const webContent = webContents.fromId(webContentsId);
  if (!webContent) return null;

  const image = await webContent.capturePage(options.rect);
  return image.toDataURL();
}
```

***

## 七、AI 工具定义扩展

### 7.1 新增 AI Agent 工具

```javascript
// 添加到 TOOL_DEFINITIONS
{
  name: 'browser_create_tab',
  description: '创建 AI 代理浏览器标签页',
  risk: 1,
  params: {
    url: { type: 'string', required: true, description: '初始 URL' },
    mode: { type: 'string', description: '操作模式: standard | multimodal' }
  }
},
{
  name: 'browser_navigate',
  description: '导航到指定 URL',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    url: { type: 'string', required: true, description: '目标 URL' }
  }
},
{
  name:browser_screenshot',
  description: '截取当前页面截图',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    fullPage: { type: 'boolean', description: '是否全页面截图' }
  }
},
{
  name: 'browser_click',
  description: '点击页面元素',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    selector: { type: 'string', description: 'CSS 选择器' },
    x: { type: 'number', description: '点击 X 坐标' },
    y: { type: 'number', description: '点击 Y 坐标' }
  }
},
{
  name: 'browser_input',
  description: '在输入框中输入文本',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    selector: { type: 'string', required: true, description: 'CSS 选择器' },
    text: { type: 'string', required: true, description: '输入文本' }
  }
},
{
  name: 'browser_get_structure',
  description: '获取页面结构数据',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' }
  }
},
{
  name: 'browser_mouse_move',
  description: '移动虚拟鼠标到指定位置',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    x: { type: 'number', required: true, description: 'X 坐标' },
    y: { type: 'number', required: true, description: 'Y 坐标' }
  }
},
{
  name: 'browser_scroll',
  description: '滚动页面',
  risk: 1,
  params: {
    tabId: { type: 'string', required: true, description: '标签页 ID' },
    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: '滚动方向' },
    amount: { type: 'number', description: '滚动量（像素）' }
  }
}
```

***

## 八、实现步骤

### Phase 1: 基础架构 (Day 1-2)

1. [ ] 创建 `main/ai-browser-handler.js` 后端处理器
2. [ ] 创建 `src/js/modules/ai-browser.js` 前端模块
3. [ ] 更新 `preload.js` 暴露新 API
4. [ ] 添加 AI 浏览器工具定义到 `ai-agent.js`

### Phase 2: 标准模式 (Day 3-4)

1. [ ] 实现 AI 代理标签页创建/关闭
2. [ ] 实现页面结构提取（DOM 解析）
3. [ ] 实现元素定位和操作（点击、输入）
4. [ ] 实现导航控制（前进、后退、跳转）

### Phase 3: 多模态模式 (Day 5-6)

1. [ ] 实现截图功能（全页/可视区域）
2. [ ] 实现虚拟鼠标控制
3. [ ] 实现鼠标移动动画
4. [ ] 实现点击/拖拽/滚动操作

### Phase 4: 前端界面 (Day 7-8)

1. [ ] 创建 `src/css/ai-browser.css` 样式文件
2. [ ] 扩展 AI 聊天界面，添加浏览器预览区
3. [ ] 实现虚拟鼠标叠加层
4. [ ] 实现操作状态反馈 UI

### Phase 5: 集成与测试 (Day 9-10)

1. [ ] AI 工具调用与浏览器操作集成
2. [ ] 流式输出与截图同步
3. [ ] 错误处理和用户确认机制
4. [ ] 全面测试和性能优化

***

## 九、安全考虑

1. **权限控制**
   - AI 浏览器操作需要用户明确授权
   - 敏感操作（表单提交、文件上传）需要确认
2. **沙箱隔离**
   - AI 代理标签页使用独立 session
   - 防止跨域数据泄露
3. **操作审计**
   - 记录所有 AI 浏览器操作日志
   - 支持操作回滚（部分操作）

***

## 十、预期效果

### 标准模式示例

```
用户: 帮我在 GitHub 搜索 electron 相关项目

AI: 我将为您搜索 GitHub 上的 electron 项目。
[创建 AI 代理标签页] -> https://github.com/search?q=electron
[获取页面结构] -> 发现 25 个搜索结果
[返回结构化数据] -> 项目列表（名称、描述、stars）

搜索结果：
1. electron/electron - ⭐ 115k - Build cross-platform desktop apps...
2. electron-userland/electron-builder - ⭐ 13k - A complete solution...
```

### 多模态模式示例

```
用户: 帮我点击页面上的"Sign in"按钮

AI: 我将定位并点击"Sign in"按钮。
[截图分析] -> 发现 Sign in 按钮位于右上角 (x: 1850, y: 50)
[移动鼠标] -> (1850, 50)
[点击] -> 左键点击
[截图确认] -> 已跳转到登录页面

[返回截图和文本数据]
```

