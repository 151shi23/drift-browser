# 🗨️ 右键菜单 Chat 浮窗对话 — 实施计划

> **目标**: 在网页右键菜单中添加「AI 对话」选项，点击后在当前网页上弹出浮窗聊天面板，无需切换标签页即可与 AI 对话
> **涉及文件**: `context-menu.js` / `app.js` / 新建 `ai-float-overlay.js` / `ai-chat.css` / `overlay.css`

---

## 架构分析

### 现有流程（右键菜单）
```
webview contextmenu 事件
  → main/window-manager.js 捕获
  → 调用 context-menu.js showContextMenu(params)
  → 构建 Electron Menu 并 popup
  → 用户点击 → sendAction(action, data) 
  → IPC 发送 'context-menu:action' 到渲染进程
  → app.js 的 onContextMenuAction 回调处理
```

### 目标流程（新增 Chat 浮窗）
```
用户在网页右键 → 点击「AI 对话」菜单项
  → sendAction('open-float-chat', { selectionText, pageURL })
  → app.js 处理: 创建/显示浮窗覆盖层
  → 浮窗内嵌精简版 AI Chat UI
  → 用户直接在浮窗中对话
  → 可拖拽、可关闭、可展开/收起
```

---

## 实施步骤

### Step 1: 右键菜单添加「AI 对话」选项
**文件**: [context-menu.js](main/context-menu.js)

**位置**: 在"检查元素"之前（约 L73-74），添加 AI 对话入口

**改动**:
```javascript
// 在"全屏"分隔线之后、"检查元素"之前插入：
items.push({ type: 'separator' });

// AI 对话（始终显示）
items.push({
  label: 'AI 对话\tCtrl+Shift+A',
  click: () => sendAction('open-float-chat', {
    text: params.selectionText || '',
    url: params.pageURL || ''
  }),
});
```

**同时**: 如果有选中文本，在文本操作区也加入快捷入口：
```javascript
// 在文本选中时的搜索子菜单后面追加
if (params.selectionText && params.selectionText.trim()) {
  // ... 已有搜索子菜单后 ...
  items.splice(items.length - 4, 0,
    { label: `AI 解释: "${shortText}"`, click: () => sendAction('open-float-chat', { text: text, url: params.pageURL || '', mode: 'explain' }) },
  );
}
```

---

### Step 2: app.js 处理 open-float-chat 动作
**文件**: [src/js/app.js](src/js/app.js) 的 onContextMenuAction 回调（L463 起）

**新增 case**:
```javascript
case 'open-float-chat':
  if (window.FBrowser && window.FBrowser.floatChat) {
    window.FBrowser.floatChat.open(dat?.text || '', dat?.url || '', dat?.mode);
  }
  break;
```

**同时注册全局快捷键 Ctrl+Shift+A**:
```javascript
// 在 document keydown 监听中（或新建一个全局监听）
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    if (window.FBrowser && window.FBrowser.floatChat) {
      window.FBrowser.floatChat.open('', '');
    }
  }
});
```

---

### Step 3: 创建浮窗对话模块 `ai-float-overlay.js`
**文件**: 新建 `src/js/modules/ai/ai-float-overlay.js`

**核心设计**:

#### 3.1 浮窗 HTML 结构
```html
<div class="float-chat-overlay" id="floatChatOverlay">
  <div class="float-chat-panel" id="floatChatPanel">
    <!-- 标题栏：可拖拽 -->
    <div class="float-chat-header" id="floatChatHeader">
      <span class="float-chat-title">🤖 AI 对话</span>
      <div class="float-chat-controls">
        <button class="fc-btn fc-minimize" id="fcMinBtn" title="最小化">─</button>
        <button class="fc-btn fc-expand" id="fcExpandBtn" title="展开">⤢</button>
        <button class="fc-btn fc-close" id="fcCloseBtn" title="关闭">✕</button>
      </div>
    </div>

    <!-- 消息区域 -->
    <div class="float-chat-body" id="floatChatBody">
      <div class="float-chat-messages" id="floatChatMessages">
        <!-- 欢迎消息 -->
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="float-chat-input-area">
      <textarea class="float-chat-input" id="floatChatInput"
        placeholder="输入问题... (Enter发送)" rows="1"></textarea>
      <button class="float-chat-send" id="floatChatSend">
        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 8l12-5-5 12z" fill="currentColor"/></svg>
      </button>
    </div>
  </div>
</div>
```

#### 3.2 核心功能清单

| 功能 | 说明 |
|------|------|
| **打开/关闭** | `open(text, url, mode)` 显示浮窗；关闭按钮/ESC 隐藏 |
| **拖拽移动** | 标题栏 mousedown + mousemove 实现自由拖拽 |
| **展开/收起** | 最小化只显示标题栏；展开恢复完整尺寸 |
| **边缘吸附** | 拖拽到屏幕边缘时自动吸附（左/右/底部） |
| **对话功能** | 复用 ai-chat.js 的 sendMessage 逻辑（纯对话模式） |
| **页面上下文** | 打开时自动传入当前页面 URL 和选中文本作为上下文 |
| **AI 解释模式** | 选中文本后右键→AI解释，自动填充 prompt |
| **持久化** | 关闭不销毁，下次 open 直接显示（保留对话历史） |

#### 3.3 JS 核心逻辑骨架

```javascript
(function() {
  var C, R, Api;
  var isVisible = false;
  var isMinimized = false;
  var isExpanded = false; // 全屏展开模式
  var floatChat = null;
  var dragState = null;

  function initModules() {
    C = window.AICore;
    R = window.AIRender;
    Api = window.AIApi;
  }

  // 创建 DOM（仅一次）
  function ensureDOM() {
    if (document.getElementById('floatChatOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'floatChatOverlay';
    overlay.className = 'float-chat-overlay';
    overlay.innerHTML = '/* ... 上述HTML结构 ... */';
    document.body.appendChild(overlay);
    bindEvents();
  }

  // 打开浮窗
  function open(initialText, pageUrl, mode) {
    initModules();
    ensureDOM();
    var overlay = document.getElementById('floatChatOverlay');
    var panel = document.getElementById('floatChatPanel');
    overlay.classList.add('visible');
    isVisible = true;
    isMinimized = false;

    if (mode === 'explain' && initialText) {
      // AI 解释模式：预填 prompt
      var input = document.getElementById('floatChatInput');
      input.value = '请解释以下内容:\n\n' + initialText;
    } else if (initialText) {
      var input2 = document.getElementById('floatChatInput');
      input2.value = initialText;
    }

    renderWelcome();
    focusInput();
  }

  // 关闭浮窗
  function close() {
    var overlay = document.getElementById('floatChatOverlay');
    if (overlay) overlay.classList.remove('visible');
    isVisible = false;
  }

  // 最小化/展开切换
  function toggleMinimize() {
    isMinimized = !isMinimized;
    var panel = document.getElementById('floatChatPanel');
    panel.classList.toggle('minimized', isMinimized);
  }

  // 全屏展开切换
  function toggleExpand() {
    isExpanded = !isExpanded;
    var overlay = document.getElementById('floatChatOverlay');
    overlay.classList.toggle('expanded', isExpanded);
  }

  // 拖拽实现
  function initDrag(e) {
    var header = document.getElementById('floatChatHeader');
    var panel = document.getElementById('floatChatPanel');
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: panel.offsetLeft,
      origTop: panel.offsetTop
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  }
  // ... onDrag / stopDrag 实现 ...

  // 发送消息（复用 chat 模式 API）
  async function sendMessage() {
    var input = document.getElementById('floatChatInput');
    var text = input.value.trim();
    if (!text || C.state.isGenerating) return;

    // 使用独立的浮动对话 chat 对象
    var floatId = '__float_chat__';
    var chat = C.state.chats.find(function(c) { return c.id === floatId; });
    if (!chat) {
      chat = { id: floatId, title: '浮窗对话', messages: [], type: 'float', createdAt: Date.now() };
      C.state.chats.push(chat);
    }

    // 追加消息并调用 API（同 ai-chat.js 的 sendMessage 逻辑）
    // ... 流式输出渲染到 floatChatMessages ...
  }

  // 渲染欢迎消息
  function renderWelcome() { /* ... */ }

  // 渲染消息列表
  function renderMessages() { /* ... 复用 R.formatMarkdown ... */ }

  // 绑定事件
  function bindEvents() {
    // 标题栏拖拽
    document.getElementById('floatChatHeader').addEventListener('mousedown', initDrag);
    // 按钮
    document.getElementById('fcCloseBtn').addEventListener('click', close);
    document.getElementById('fcMinBtn').addEventListener('click', toggleMinimize);
    document.getElementById('fcExpandBtn').addEventListener('click', toggleExpand);
    // 输入
    var input = document.getElementById('floatChatInput');
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      if (e.key === 'Escape') close();
    });
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    document.getElementById('floatChatSend').addEventListener('click', sendMessage);
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.floatChat = {
    open: open,
    close: close,
    toggle: function() { isVisible ? close() : open(); },
    isVisible: function() { return isVisible; }
  };
})();
```

---

### Step 4: CSS 样式
**文件**: [overlay.css](src/css/overlay.css) 或 [ai-chat.css](src/css/ai-chat.css)

**核心样式**:
```css
/* ===== 浮窗对话覆盖层 ===== */
.float-chat-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9000;
  display: none;
  pointer-events: none; /* 让点击穿透到下层 */
}
.float-chat-overlay.visible { display: block; }

.float-chat-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 520px;
  max-height: 70vh;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.05);
  display: flex;
  flex-direction: column;
  pointer-events: auto; /* 恢复面板自身交互 */
  overflow: hidden;
  transition: width .25s ease, height .25s ease, border-radius .2s ease;
  animation: floatChatIn .3s cubic-bezier(.16,1,.3,1);
}

@keyframes floatChatIn {
  from { opacity: 0; transform: translateY(20px) scale(.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 展开模式 */
.float-chat-overlay.expanded .float-chat-panel {
  width: 60vw;
  height: 80vh;
  bottom: 10vh;
  right: 20vw;
  border-radius: 12px;
}

/* 最小化模式 */
.float-chat-panel.minimized {
  width: 200px;
  height: 44px;
  border-radius: 22px;
  overflow: hidden;
}

/* 标题栏（可拖拽） */
.float-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-2);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.float-chat-header:active { cursor: grabbing; }
.float-chat-title { font-size: 13px; font-weight: 600; color: var(--fg-0); }
.float-chat-controls { display: flex; gap: 4px; }
.fc-btn {
  width: 24px; height: 24px;
  border: none; border-radius: 6px;
  background: transparent; color: var(--fg-3);
  cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 12px; transition: all .12s ease;
}
.fc-btn:hover { background: var(--glass-hover); color: var(--fg-0); }
.fc-close:hover { background: #ef4444; color: #fff; }

/* 消息区域 */
.float-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 0;
}
.float-chat-messages { display: flex; flex-direction: column; gap: 8px; }

/* 输入区域 */
.float-chat-input-area {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-0);
  align-items: flex-end;
  flex-shrink: 0;
}
.float-chat-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--bg-1);
  color: var(--fg-0);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  max-height: 100px;
  font-family: inherit;
}
.float-chat-input:focus { border-color: var(--accent); }
.float-chat-input::placeholder { color: var(--fg-3); }
.float-chat-send {
  width: 36px; height: 36px;
  border: none; border-radius: 10px;
  background: var(--accent); color: #fff;
  cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .15s ease;
}
.float-chat-send:hover { filter: brightness(1.15); transform: scale(1.05); }
.float-chat-send:disabled { opacity: .5; cursor: not-allowed; }

/* 浮窗内的消息气泡（复用超级Chat样式） */
.float-chat-messages .ai-msg { padding: 8px 0; }
.float-chat-messages .ai-msg-user { justify-content: flex-end; }
.float-chat-messages .ai-msg-assistant { justify-content: flex-start; }
.float-chat-messages .ai-msg-inner {
  padding: 8px 12px;
  border-radius: 12px;
  max-width: 85%;
  font-size: 13px;
}
.float-chat-messages .ai-msg-user .ai-msg-inner {
  background: var(--accent);
  color: #fff;
  border-radius: 12px 12px 2px 12px;
}
.float-chat-messages .ai-msg-assistant .ai-msg-inner {
  background: var(--bg-2);
  border-radius: 12px 12px 12px 2px;
}

/* 移动端适配 */
@media (max-width: 600px) {
  .float-chat-panel {
    width: calc(100vw - 16px);
    height: 60vh;
    left: 8px !important;
    right: 8px !important;
    bottom: 8px;
  }
  .float-chat-overlay.expanded .float-chat-panel {
    width: 100vw;
    height: 100vh;
    left: 0 !important;
    right: 0 !important;
    bottom: 0;
    border-radius: 0;
  }
}
```

---

### Step 5: index.html 引入新脚本
**文件**: [src/index.html](src/index.html) L1309 区域

在 `ai-chat.js` 之后添加:
```html
<script src="js/modules/ai/ai-float-overlay.js"></script>
```

---

## 文件变更汇总

| 文件 | 操作 | 变更量 |
|------|------|--------|
| [context-menu.js](main/context-menu.js) | 修改 | +10 行（添加 AI 对话菜单项 + AI 解释快捷项） |
| [app.js](src/js/app.js) | 修改 | +8 行（case 处理 + 快捷键） |
| [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) | **新建** | ~280 行（浮窗组件完整实现） |
| [overlay.css](src/css/overlay.css) | 修改 | +150 行（浮窗样式） |
| [index.html](src/index.html) | 修改 | +1 行（引入脚本） |

## 交互流程图

```
┌──────────────────────────────────────────────┐
│              网页浏览中                        │
│                                               │
│   [鼠标右键] ──→ 弹出 Edge 风格菜单             │
│                    │                          │
│         ┌──────────┼──────────┐               │
│         ▼          ▼          ▼               │
│    后退/前进    收藏此页   🔥 AI 对话           │
│    重新加载    另存为...  AI 解释:"xxx"        │
│    缩放▸       打印...                         │
│                                               │
│   点击"AI 对话"                               │
│         │                                     │
│         ▼                                     │
│   ┌─────────────────┐                         │
│   │ 🤖 AI 对话  ─ ✕ │ ← 可拖拽标题栏          │
│   ├─────────────────┤                         │
│   │                 │                         │
│   │  你: 帮我看看   │  ← 右下角浮窗            │
│   │  这段代码       │     380×520px            │
│   │                 │                         │
│   │  AI: 这段代码   │                         │
│   │  用了闭包...    │                         │
│   │                 │                         │
│   ├─────────────────┤                         │
│   │ [输入框] [发送] │                         │
│   └─────────────────┘                         │
│                                               │
│   快捷键: Ctrl+Shift+A 直接呼出               │
│   ESC 关闭 / 拖拽移动 / 边缘吸附              │
└──────────────────────────────────────────────┘
```

## 验收标准

- [ ] 右键菜单中有「AI 对话」选项（带快捷键提示 Ctrl+Shift+A）
- [ ] 有选中文本时额外显示「AI 解释: "xxx"」选项
- [ ] 点击后在网页右下角弹出浮窗聊天面板
- [ ] 浮窗可通过标题栏自由拖拽移动
- [ ] 浮窗支持最小化（只显示标题栏）、全屏展开、关闭
- [ ] 浮窗内可正常输入并发送消息给 AI
- [ ] AI 回复使用流式输出 + Markdown 渲染
- [ ] 选中文本用「AI 解释」打开时自动填充上下文
- [ ] ESC 键关闭浮窗
- [ ] Ctrl+Shift+A 全局快捷键呼出浮窗
- [ ] 浮窗不影响底层网页的正常交互（pointer-events 控制）
