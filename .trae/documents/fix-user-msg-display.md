# 🔧 修复 AI 浮窗用户聊天信息不显示问题

> **问题描述**: 用户在浮窗中发送的消息不显示，只有 AI 回复显示
> **涉及文件**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js)
> **优先级**: P0（立即修复）

---

## 问题分析

### 发现的问题

#### 1. ⭐ 关键 Bug：流式输出时 `escHtml` 未定义错误
**位置**: [L466](src/js/modules/ai/ai-float-overlay.js#L466)

**问题代码**:
```javascript
// 第 466 行 - 流式输出渲染
html += '...<span class="ai-stream-text">' + (st === '__thinking__' ? '' : escHtml(st)) + '</span>...
```

**问题**: 使用了 `escHtml(st)` 而不是 `C.escHtml(st)`
- `escHtml` 未在当前作用域定义 → **ReferenceError**
- 这个错误会导致整个 `renderMessages()` 函数中断
- 结果：**所有消息（包括用户消息）都无法渲染**

**影响范围**:
- 当 AI 正在流式输出且内容非空时触发
- 每次流式 chunk 更新都可能触发重新渲染
- 导致用户消息"消失"

#### 2. 次要问题：工具调用消息（role: 'tool'）未渲染
**位置**: [L457-471](src/js/modules/ai/ai-float-overlay.js#L457-L471)

**问题**: `renderMessages()` 只处理 `user` 和 `assistant` 角色，忽略 `tool` 消息
```javascript
if (msg.role === 'user') { ... }
else if (msg.role === 'assistant') { ... }
// tool 消息被完全跳过！
```

**影响**: 用户执行工具调用时看不到结果反馈

---

## 修复方案

### Fix 1: 修复 escHtml 未定义错误 ⭐⭐⭐（根本原因）

**改动**: 将 `escHtml(st)` 改为 `C.escHtml(st)`

**修改前** (L466):
```javascript
html += '<div class="ai-msg ai-msg-assistant"><div class="ai-msg-inner"><div class="ai-msg-streaming"><span class="ai-stream-text">' + (st === '__thinking__' ? '' : escHtml(st)) + '</span><span class="ai-stream-cursor"></span></div></div></div>';
```

**修改后**:
```javascript
html += '<div class="ai-msg ai-msg-assistant"><div class="ai-msg-inner"><div class="ai-msg-streaming"><span class="ai-stream-text">' + (st === '__thinking__' ? '' : C.escHtml(st)) + '</span><span class="ai-stream-cursor"></span></div></div></div>';
```

---

### Fix 2: 添加工具调用消息渲染支持 ⭐⭐（增强功能）

**改动**: 在 `renderMessages()` 中添加 `tool` 角色的处理

**修改位置**: L457-471 的 forEach 循环

**新增代码**:
```javascript
chat.messages.forEach(function(msg) {
  if (msg.role === 'user') {
    html += '<div class="ai-msg ai-msg-user"><div class="ai-msg-inner"><div class="ai-msg-content">' + C.escHtml(msg.content) + '</div></div></div>';
  } else if (msg.role === 'tool') {
    // 新增：渲染工具调用结果
    var toolCls = msg.toolSuccess ? 'ai-tool-success' : 'ai-tool-error';
    var toolIcon = msg.toolSuccess ? '✅' : '❌';
    var toolName = msg.toolName || '工具';
    var toolContent = msg.content ? msg.content.substring(0, 200) : '';
    html += '<div class="ai-msg ai-msg-tool"><div class="ai-msg-inner"><div class="ai-tool-result ' + toolCls + '"><span class="tool-icon">' + toolIcon + '</span><span class="tool-name">' + C.escHtml(toolName) + '</span><span class="tool-content">' + C.escHtml(toolContent) + '</span></div></div></div>';
  } else if (msg.role === 'assistant') {
    // ... 原有 assistant 渲染逻辑不变 ...
  }
});
```

---

### Fix 3: 添加工具消息 CSS 样式 ⭐（配套样式）

**改动位置**: [overlay.css](src/css/overlay.css)

**新增样式**:
```css
/* 工具调用结果消息 */
.float-chat-messages .ai-msg-tool { justify-content: center; }
.float-chat-messages .ai-msg-tool .ai-msg-inner {
  background: transparent;
  padding: 4px 12px;
  max-width: 95%;
}
.float-chat-messages .ai-tool-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  background: var(--bg-2);
  color: var(--fg-2);
}
.float-chat-messages .ai-tool-success {
  background: rgba(34,197,94,.1);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,.2);
}
.float-chat-messages .ai-tool-error {
  background: rgba(239,68,68,.1);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,.2);
}
.float-chat-messages .tool-icon { flex-shrink: 0; }
.float-chat-messages .tool-name { font-weight: 500; }
.float-chat-messages .tool-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
```

---

## 文件变更汇总

| 文件 | 变更类型 | 影响行数 | 风险等级 |
|------|---------|---------|---------|
| [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) | **Bug 修复** | ~15 行 | 低 |
| [overlay.css](src/css/overlay.css) | 新增样式 | ~25 行 | 低 |

---

## 实施顺序

```
Phase 1: 根本原因修复（必须）
└── Fix 1: 修复 escHtml 未定义错误 → 解决用户消息不显示

Phase 2: 功能增强（可选但推荐）
├── Fix 2: 添加工具调用消息渲染
└── Fix 3: 添加工具消息 CSS 样式
```

---

## 验收标准

### 功能验收
- [ ] 用户发送的消息正确显示在右侧（蓝色气泡）
- [ ] AI 回复的消息正确显示在左侧
- [ ] 流式输出期间无 JavaScript 错误
- [ ] 工具调用结果显示（如果实施 Fix 2+3）
- [ ] 长对话滚动正常
- [ ] 消息历史持久化正常

### 错误验证
- [ ] 控制台无 `ReferenceError: escHtml is not defined` 错误
- [ ] 所有角色消息（user/assistant/tool）都能正确渲染

---

## 风险评估

### 风险等级：低
- **Fix 1**: 只修改一个函数名前缀，风险极低
- **Fix 2+3**: 新增功能不影响现有逻辑，向后兼容

### 回滚方案
如果出现问题：
1. 将 `C.escHtml(st)` 改回 `escHtml(st)`（但不建议，因为原版有 bug）
2. 删除 tool 消息渲染代码块
3. 删除新增的 CSS 样式
