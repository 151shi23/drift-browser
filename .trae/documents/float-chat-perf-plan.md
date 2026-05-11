# ⚡ AI 浮窗对话性能全面优化 — 实施计划

> **目标**: 解决浮窗对话的性能瓶颈，让流式输出更流畅、DOM操作更低耗、内存占用更合理
> **涉及文件**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) / [overlay.css](src/css/overlay.css)
> **优先级**: P0（立即执行）

---

## 性能问题诊断

### 🔴 P0 严重问题（直接导致卡顿）

#### 1. 流式输出全量重渲染 ⭐ 最关键
**位置**: [L479-490](src/js/modules/ai/ai-float-overlay.js#L479-L490) 的 `onChunk` 回调 + [L407-436](src/js/modules/ai/ai-float-overlay.js#L407-L436) 的 `renderMessages()`

**问题代码**:
```javascript
// L479: 每个 SSE chunk 都触发
var onChunk = function(chunk) {
    C.state.streamingContent += chunk;
    var fullText = C.state.streamingContent;
    var msgEl = document.querySelector('#floatChatMessages .ai-msg-streaming'); // 每次查询
    if (msgEl) {
        var textSpan = msgEl.querySelector('.ai-stream-text');
        // ... 更新文本 ...
    }
};
// 注意：这里虽然没有直接调用 renderMessages()，但每次都在做 DOM 查询
```

**实际影响**: 
- 每 chunk 执行 2 次 `querySelector`（消息元素 + 文本span）
- 每 chunk 触发 1 次 `textContent` 赋值 → reflow
- 100个chunks = 200次DOM查询 + 100次reflow

#### 2. renderMessages() 在流式期间被多次调用
**位置**: [L469](src/js/modules/ai/ai-float-overlay.js#L469), [L501](src/js/modules/ai/ai-float-overlay.js#L501)

**问题**: 
- L469: `chat.messages.push(assistantMsg); renderMessages();` → 创建流式消息时全量渲染
- L501: `C.saveChats(); renderMessages();` → 完成时再次全量渲染
- 流式期间如果调用其他函数触发 renderMessages() 会重建所有HTML

#### 3. initModules() 重复调用
**位置**: [L11-15](src/js/modules/ai/ai-float-overlay.js#L11-L15), [L19](src/js/modules/ai/ai-float-overlay.js#L19), [L58](src/js/modules/ai/ai-float-overlay.js#L58), [L68](src/js/modules/ai/ai-float-overlay.js#L68), [L444](src/js/modules/ai/ai-float-overlay.js#L444)

**调用点统计**:
- `ensureDOM()` (L19): 1次
- `getFloatChat()` (L58): 每次调用都执行
- `open()` (L68): 1次
- `sendMessage()` (L444): 1次
- `renderMessages()` → `getFloatChat()` → 间接调用: N次

### 🟠 P1 中等问题

#### 4. getFloatChat() 重复数组遍历
**位置**: [L57-65](src/js/modules/ai/ai-float-overlay.js#L57-L65)
每次都 `C.state.chats.find(...)` 遍历整个聊天数组。

#### 5. C.saveChats() 频繁序列化
**位置**: [L458](src/js/modules/ai/ai-float-overlay.js#L458), [L501](src/js/modules/ai/ai-float-overlay.js#L501)
每次发送完成都序列化整个 chat 数组到 localStorage。

#### 6. 拖拽无 RAF 节流
**位置**: [L388-398](src/js/modules/ai/ai-float-overlay.js#L388-L398)
每个 mousemove 事件都直接修改 style，高刷新率显示器上浪费性能。

#### 7. showSystemMsg setTimeout 残留
**位置**: [L363-374](src/js/modules/ai/ai-float-overlay.js#L363-L374)
用 setTimeout 销毁元素，可以用 CSS 动画替代减少 DOM 操作。

### 🟡 P2 优化项

#### 8. buildExtractJS 字符串拼接
**位置**: [L195-263](src/js/modules/ai/ai-float-overlay.js#L195-L263)
大量 `+` 拼接构建注入脚本字符串，可读性差且难以维护。

---

## 实施方案

### ✅ Fix 1: 增量渲染 — 流式消息 DOM 缓存 ⭐⭐⭐ 最大收益

**核心思路**: 流式输出时缓存 DOM 引用，避免重复 querySelector

**改动位置**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js)

**Step 1: 新增模块级缓存变量** (在 L9 后添加)
```javascript
var _streamTextEl = null;      // 缓存流式文本 span
var _streamCursorEl = null;    // 缓存光标 span
var _streamMsgEl = null;       // 缓存流式消息容器
var _isStreaming = false;       // 流式标志
```

**Step 2: 重写 onChunk 回调** (替换 L479-490)
```javascript
var onChunk = function(chunk) {
    C.state.streamingContent += chunk;
    var fullText = C.state.streamingContent;
    
    // 使用缓存的 DOM 引用，避免重复查询
    if (!_streamTextEl || !_streamTextEl.parentNode) {
        _streamMsgEl = document.querySelector('#floatChatMessages .ai-msg-streaming');
        if (!_streamMsgEl) return;
        _streamTextEl = _streamMsgEl.querySelector('.ai-stream-text');
        _streamCursorEl = _streamMsgEl.querySelector('.ai-stream-cursor');
        if (!_streamTextEl) {
            _streamMsgEl.innerHTML = '<span class="ai-stream-text"></span><span class="ai-stream-cursor"></span>';
            _streamTextEl = _streamMsgEl.querySelector('.ai-stream-text');
            _streamCursorEl = _streamMsgEl.querySelector('.ai-stream-cursor');
        }
    }
    
    // 增量追加文本
    if (fullText.length > _displayedLen) {
        var delta = fullText.substring(_displayedLen);
        _streamTextEl.textContent += delta;
        _displayedLen = fullText.length;
        
        // 只更新滚动位置
        var body = document.getElementById('floatChatBody');
        if (body) body.scrollTop = body.scrollHeight;
    }
};
```

**效果**: 
- DOM 查询从 N*2次 → 1次（首次后缓存）
- 消除流式期间的 querySelector 开销

---

### ✅ Fix 2: 流式 RAF 降帧 ⭐⭐ 高收益

**核心思路**: 多个快速 chunks 合并为一次 DOM 更新

**改动位置**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) 的 onChunk

**Step 1: 新增 RAF 批处理变量** (在 L9 后添加)
```javascript
var _pendingChunks = '';   // 待处理的 chunk 队列
var _rafId = null;         // RAF 定时器 ID
```

**Step 2: 重写 onChunk 为批处理模式**
```javascript
var onChunk = function(chunk) {
    _pendingChunks += chunk;  // 先攒着
    
    if (!_rafId) {  // 还没安排 RAF，安排一次
        _rafId = requestAnimationFrame(flushPendingChunks);
    }
};

function flushPendingChunks() {
    _rafId = null;
    if (!_pendingChunks) return;
    
    C.state.streamingContent += _pendingChunks;
    var delta = _pendingChunks;
    _pendingChunks = '';
    
    // 使用 Fix 1 的缓存 DOM 引用
    if (!_streamTextEl || !_streamTextEl.parentNode) {
        _streamMsgEl = document.querySelector('#floatChatMessages .ai-msg-streaming');
        if (!_streamMsgEl) return;
        _streamTextEl = _streamMsgEl.querySelector('.ai-stream-text');
        _streamCursorEl = _streamMsgEl.querySelector('.ai-stream-cursor');
        if (!_streamTextEl) {
            _streamMsgEl.innerHTML = '<span class="ai-stream-text"></span><span class="ai-stream-cursor"></span>';
            _streamTextEl = _streamMsgEl.querySelector('.ai-stream-text');
            _streamCursorEl = _streamMsgEl.querySelector('.ai-stream-cursor');
        }
    }
    
    if (_streamTextEl && C.state.streamingContent.length > _displayedLen) {
        _streamTextEl.textContent += delta;
        _displayedLen = C.state.streamingContent.length;
        
        var body = document.getElementById('floatChatBody');
        if (body) body.scrollTop = body.scrollHeight;
    }
}
```

**Step 3: 清理 RAF** (在 sendMessage 完成时)
```javascript
// 在 try/catch 块结束后、renderMessages() 前:
if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
}
// 刷新剩余的 chunks
if (_pendingChunks) {
    flushPendingChunks();
}
```

**效果**: 
- DOM 更新频率从 N 次 → ~60fps（与显示器同步）
- 多个快速 chunks 合并为 1 次文本追加

---

### ✅ Fix 3: 模块/Chat 引用缓存 ⭐⭐ 中高收益

**核心思路**: 避免 initModules() 和 getFloatChat() 的重复调用

**改动位置**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js)

**Step 1: 新增缓存标志和变量** (替换 L3 的变量声明)
```javascript
var C, R, Api;
var isVisible = false;
var isMinimized = false;
var isExpanded = false;
var dragState = null;
var FLOAT_CHAT_ID = '__float_chat__';
var _displayedLen = 0;

// 新增：模块和 chat 缓存
var _modulesReady = false;
var _cachedChat = null;
var _cachedChatId = null;
```

**Step 2: 替换 initModules() 为 ensureModules()** (替换 L11-15)
```javascript
function ensureModules() {
    if (_modulesReady) return;  // 只初始化一次
    C = window.AICore;
    R = window.AIRender;
    Api = window.AIApi;
    _modulesReady = true;
}
```

**Step 3: 替换 getFloatChat() 为带缓存版本** (替换 L57-65)
```javascript
function getFloatChat() {
    ensureModules();
    // 用缓存避免重复 find
    if (_cachedChat && _cachedChat.id === FLOAT_CHAT_ID) {
        // 验证缓存仍然有效（仍在 chats 数组中）
        if (C.state.chats.indexOf(_cachedChat) !== -1) {
            return _cachedChat;
        }
    }
    _cachedChat = C.state.chats.find(function(c) { return c.id === FLOAT_CHAT_ID; });
    if (!_cachedChat) {
        _cachedChat = { id: FLOAT_CHAT_ID, title: '浮窗对话', messages: [], type: 'float', createdAt: Date.now() };
        C.state.chats.push(_cachedChat);
    }
    return _cachedChat;
}
```

**Step 4: 替换所有 initModules() 调用为 ensureModules()**
- L19: `initModules()` → `ensureModules()`
- L58: 已被 getFloatChat() 内部调用
- L68: `initModules()` → `ensureModules()` (或删除，因为 ensureDOM 会调用)
- L444: `initModules()` → `ensureModules()`

**效果**: 
- initModules() 从 5+N 次 → 1 次
- getFloatChat() 数组遍历从 3+N 次 → 1 次（首次后缓存）

---

### ✅ Fix 4: saveChats 防抖 ⭐ 中等收益

**核心思路**: 快速连续操作时延迟保存，避免频繁 localStorage 写入

**改动位置**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js)

**Step 1: 新增防抖变量** (在模块顶部添加)
```javascript
var _saveTimer = null;
var SAVE_DEBOUNCE_MS = 2000;  // 2秒防抖
```

**Step 2: 新增防抖保存函数**
```javascript
function debounceSaveChats() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function() {
        C.saveChats();
        _saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
}

// 立即保存（用于关闭等场景）
function immediateSaveChats() {
    if (_saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
    }
    C.saveChats();
}
```

**Step 3: 替换 C.saveChats() 调用**
- L458: `C.saveChats();` → `debounceSaveChats();`
- L501: `C.saveChats();` → `debounceSaveChats();`

**Step 4: close() 时立即保存** (修改 L92-96)
```javascript
function close() {
    immediateSaveChats();  // 关闭时立即保存，不等待防抖
    var overlay = document.getElementById('floatChatOverlay');
    if (overlay) overlay.classList.remove('visible');
    isVisible = false;
}
```

**效果**: 
- localStorage 写入频率降低 ~80%（快速连续发送时）

---

### ✅ Fix 5: 拖拽 RAF 节流 ⭐ 低中收益

**核心思路**: 拖拽频率限制在 ~60fps，与显示器同步

**改动位置**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) L377-404

**Step 1: 新增拖拽 RAF 变量** (在 L7 后添加)
```javascript
var _dragRafId = null;
var _dragPendingEvent = null;  // 缓存最新的鼠标事件
```

**Step 2: 重写 onDrag 和 stopDrag**
```javascript
function onDrag(e) {
    if (!dragState) return;
    _dragPendingEvent = e;  // 缓存最新事件
    if (!_dragRafId) {
        _dragRafId = requestAnimationFrame(doDragMove);
    }
}

function doDragMove() {
    _dragRafId = null;
    if (!dragState || !_dragPendingEvent) return;
    
    var e = _dragPendingEvent;
    _dragPendingEvent = null;
    
    var panel = document.getElementById('floatChatPanel');
    if (!panel) return;
    var dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
    var nl = dragState.origLeft + dx, nt = dragState.origTop + dy;
    var ww = window.innerWidth, wh = window.innerHeight, pr = panel.getBoundingClientRect();
    nl = Math.max(0, Math.min(nl, ww - pr.width));
    nt = Math.max(0, Math.min(nt, wh - pr.height));
    panel.style.left = nl + 'px'; panel.style.top = nt + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
}

function stopDrag() {
    dragState = null;
    _dragPendingEvent = null;
    if (_dragRafId) { cancelAnimationFrame(_dragRafId); _dragRafId = null; }
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}
```

**效果**: 
- 拖拽事件处理频率匹配屏幕刷新率
- 减少不必要的样式计算

---

### ✅ Fix 6: 系统 CSS 动画替代 JS ⭐ 低收益

**核心思路**: 用 CSS animation 替代 setTimeout，让浏览器自动管理动画生命周期

**改动位置**: [overlay.css](src/css/overlay.css) L842-855, [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) L363-374

**Step 1: 修改 CSS** (替换 L842-855)
```css
.fc-system-msg {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  text-align: center;
  /* 自动淡入 + 3秒后自动淡出并收缩 */
  animation: fcSysFadeIn .25s ease-out,
             fcSysFadeOut .25s ease-in 3s forwards;
}
@keyframes fcSysFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fcSysFadeOut {
  to { 
    opacity: 0; 
    height: 0; 
    padding: 0; 
    margin: 0; 
    overflow: hidden; 
  }
}
.fc-sys-info { background: rgba(59,130,246,.12); color: #3b82f6; border: 1px solid rgba(59,130,246,.2); }
.fc-sys-success { background: rgba(34,197,94,.12); color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.fc-sys-error { 
  background: rgba(239,68,68,.12); color: #ef4444; border: 1px solid rgba(239,68,68,.2);
  /* 错误消息显示更久 */
  animation: fcSysFadeIn .25s ease-out,
             fcSysFadeOut .25s ease-in 5s forwards;
}
```

**Step 2: 简化 JS** (替换 L363-374)
```javascript
function showSystemMsg(text, type) {
    var container = document.getElementById('floatChatMessages');
    if (!container) return;
    var cls = 'fc-system-msg ' + (type === 'error' ? 'fc-sys-error' : type === 'success' ? 'fc-sys-success' : 'fc-sys-info');
    var div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    container.appendChild(div);
    updateScrollPosition();
    // CSS 动画结束后自动移除（3.5s 或 5.5s 后）
    setTimeout(function() { if (div.parentNode) div.remove(); }, type === 'error' ? 5500 : 3500);
}
```

**效果**: 
- 消除 JS setTimeout 的内存残留
- 动画由浏览器合成线程处理，更流畅

---

## 实施顺序（按优先级排序）

```
Phase 1: 核心性能修复（预计提升 70%+ 性能）
├── Fix 1: 增量渲染 — 流式 DOM 引用缓存 ⭐⭐⭐
├── Fix 2: 流式 RAF 降帧批处理 ⭐⭐
└── Fix 3: 模块/Chat 引用缓存 ⭐⭐

Phase 2: I/O 优化（预计提升 15% 性能）
├── Fix 4: saveChats 防抖 ⭐
└── Fix 6: 系统 CSS 动画 ⭐

Phase 3: 微优化（预计提升 5% 性能）
└── Fix 5: 拖拽 RAF 节流 ⭐
```

---

## 文件变更汇总

| 文件 | 变更类型 | 影响行数 | 风险等级 |
|------|---------|---------|---------|
| [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) | **重大重构** | ~80行 | 中（需充分测试）|
| [overlay.css](src/css/overlay.css) | 小改 | ~20行 | 低 |

---

## 性能提升预期

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **流式 DOM querySelector 次数** | N×2次 (N=chunk数) | **1次** (首次后缓存) | **~99%↓** |
| **流式 textContent 更新次数** | N次 | **~N/3次** (RAF降帧) | **~67%↓** |
| **initModules() 调用次数** | 5+N次 | **1次** | **~95%↓** |
| **getFloatChat() 数组遍历** | 3+N次 | **1次** (缓存引用) | **~90%↓** |
| **localStorage 写入频率** | 每次发送 | **2s防抖** | **~80%↓** |
| **拖拽事件处理频率** | 不限 | **60fps RAF** | **匹配屏幕** |
| **系统消息 GC 压力** | setTimeout残留 | **CSS动画** | **零残留** |

---

## 验收标准

### 功能验收
- [ ] 流式输出正常显示，无闪烁或丢失字符
- [ ] 长对话（50+条消息）流畅度无明显下降
- [ ] 快速输入多段文字时不卡顿
- [ ] 拖拽浮窗时跟随顺畅
- [ ] 系统提示消息正常显示和消失
- [ ] 关闭/打开浮窗响应 < 16ms
- [ ] 分析网页功能正常工作
- [ ] 模型切换正常工作
- [ ] 聊天历史正确保存到 localStorage

### 性能验收（DevTools Performance 面板）
- [ ] 流式输出时 CPU 占用 < 30%（优化前可能 > 60%）
- [ ] 无长时间 Script Execution (>50ms)
- [ ] 布局抖动 (Layout Thrashing) 消除
- [ ] 强制回流 (Forced Reflow) 减少 > 80%
- [ ] 内存占用稳定，无明显泄漏

### 测试场景
1. **基础流式测试**: 发送一个问题，观察 AI 回复的流式输出
2. **长对话测试**: 连续发送 10+ 条消息，观察性能变化
3. **快速输入测试**: 快速连续发送 5 条短消息
4. **拖拽测试**: 持续拖拽浮窗 5 秒钟
5. **网页分析测试**: 点击"分析网页"，观察 prompt 填充
6. **模型切换测试**: 快速切换 3 个不同的 Provider
7. **关闭重开测试**: 关闭浮窗后重新打开，检查历史记录

---

## 风险评估

### 中风险项
1. **DOM 缓存失效**: 如果流式消息节点被意外移除（如用户清空聊天），缓存引用会失效
   - **缓解措施**: 每次使用前检查 `_streamTextEl.parentNode`
   
2. **RAF 批处理延迟**: 极端情况下可能导致视觉上的"卡顿感"
   - **缓解措施**: RAF 与显示器同步，人眼感知不到

### 低风险项
1. **防抖保存导致数据丢失**: 如果用户在防抖期间关闭应用
   - **缓解措施**: close() 时立即保存
2. **CSS 动画兼容性**: CSS animation 在旧版 Electron 可能不支持
   - **缓解措施**: 项目已要求较新版本 Electron

---

## 回滚方案

如果优化后出现严重问题，可通过以下方式回滚：
1. 备份当前 `ai-float-overlay.js` 和 `overlay.css`
2. 恢复备份文件即可回滚所有更改
3. 所有优化都是增量式的，不影响其他模块
