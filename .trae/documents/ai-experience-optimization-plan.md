# AI 对话体验全面优化计划

## 问题诊断

### 🔴 严重问题（功能缺失）

| # | 问题 | 影响 |
|---|------|------|
| 1 | **Agent 页面完全没有 CSS 样式** | 所有 `.agent-*` 类（`.agent-layout`, `.agent-sidebar`, `.agent-main`, `.agent-input-area`, `.agent-status-bar`, `.agent-task-item`, `.agent-log-entry` 等）在 CSS 中不存在。打开 Agent 标签页会看到完全无样式的原始 HTML |
| 2 | **消息渲染结构不匹配** | [ai-chat.js](src/js/modules/ai-chat.js) 的 `renderMessages()` 委托给 `R.renderMessages()`，但新代码生成的消息 HTML 缺少 `.ai-msg-inner` 包裹层，导致样式错乱 |
| 3 | **AI Chat 欢迎页/空状态缺失** | `init()` 生成的 HTML 中没有欢迎页容器，`R.renderMessages()` 在空对话时无法渲染 `.ai-welcome` |

### 🟠 中等问题（体验缺陷）

| # | 问题 | 说明 |
|---|------|------|
| 4 | 无打字/思考动画 | 流式输出只有光标闪烁，缺少"正在思考..."的骨架屏或脉冲动画 |
| 5 | 错误状态无重试按钮 | API 错误只显示红色文本，没有"重试"按钮 |
| 6 | 输入框无拖拽上传图片 | AI Chat 不支持图片粘贴/拖拽上传 |
| 7 | 消息无时间戳 | 用户看不到每条消息的发送时间 |
| 8 | 工具结果截断无展开 | 超长工具结果显示"已截断"，无法点击展开查看完整内容 |
| 9 | 发送按钮状态反馈弱 | 禁用状态只变灰，没有明确的加载旋转动画 |
| 10 | 对话列表无搜索/过滤 | 对话多了之后难以查找历史 |

### 🟡 体验增强（锦上添花）

| # | 功能 | 说明 |
|---|------|------|
| 11 | Markdown 渲染增强 | 支持语法高亮（代码块）、LaTeX公式、任务列表 `- [ ]` |
| 12 | 消息气泡差异化 | 用户消息右对齐+头像在右，助手消息左对齐+头像在左（类ChatGPT） |
| 13 | 快捷键提示 | 输入框下方显示 Enter发送 / Shift+Enter换行 / Ctrl+V粘贴图片 |
| 14 | 自动滚动控制 | 新消息自动滚动到底部，用户上翻时锁定不滚动 |
| 15 | 复制成功Toast | 点击复制代码后显示"已复制"微提示 |

---

## 执行步骤

### Step 1: 补全 Agent 页面完整 CSS（🔴 关键）
**文件**: `src/css/ai-chat.css`（追加）

需要为以下所有类添加完整样式：

```
/* ===== Agent 页面布局 ===== */
#aiAgentPage { background: var(--bg-0); flex-direction: column; overflow: hidden; }
.agent-layout { display: flex; width: 100%; height: 100%; position: relative; overflow: hidden; }

/* 左侧栏 */
.agent-sidebar { width: 260px; min-width: 260px; background: var(--bg-1); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.agent-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 10px; }
.agent-sidebar-title { font-size: 14px; font-weight: 700; color: var(--fg-0); }
.agent-new-task-btn { ... } /* 类似 .ai-new-chat-btn 但绿色主题 */

/* 任务列表 */
.agent-task-list { flex: 1; overflow-y: auto; padding: 4px 8px; }
.agent-task-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; margin-bottom: 2px; transition: all .12s ease; }
.agent-task-item:hover { background: var(--glass-hover); }
.agent-task-item.active { background: rgba(16,185,129,.12); border-left: 3px solid #10b981; }
.task-status { font-size: 12px; width: 18px; text-align: center; }
.task-title { flex: 1; font-size: 13px; color: var(--fg-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-meta { font-size: 11px; color: var(--fg-3); }

/* 日志面板 */
.agent-sidebar-section { padding: 10px 14px 6px; border-top: 1px solid var(--border); }
.agent-section-title { font-size: 11px; font-weight: 600; color: var(--fg-3); text-transform: uppercase; letter-spacing: .04em; }
.agent-clear-log-btn { font-size: 11px; color: var(--fg-3); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.agent-clear-log-btn:hover { color: #ef4444; background: rgba(239,68,68,.08); }
.agent-log-list { flex: 1; overflow-y: auto; padding: 4px 8px; max-height: 200px; }
.agent-log-entry { display: flex; gap: 6px; padding: 4px 8px; font-size: 11px; color: var(--fg-2); line-height: 1.5; border-radius: 4px; margin-bottom: 1px; }
.agent-log-entry.log-error { color: #ef4444; background: rgba(239,68,68,.06); }
.agent-log-entry.log-success { color: #22c55e; }
.log-time { color: var(--fg-3); font-family: monospace; font-size: 10px; white-space: nowrap; }
.log-icon { flex-shrink: 0; width: 16px; text-align: center; }
.log-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 主区域 */
.agent-main { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
.agent-main-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: var(--bg-0); border-bottom: 1px solid var(--border); z-index: 2; }
.agent-main-title { font-size: 14px; font-weight: 600; color: var(--fg-0); display: flex; align-items: center; gap: 8px; }
.agent-main-actions { display: flex; gap: 4px; }

/* 控制台/消息区 */
.agent-console { flex: 1; overflow-y: auto; position: relative; }
.agent-messages { padding: 16px 20px; }

/* Agent空状态 */
.agent-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; padding: 40px 20px; animation: aiFadeIn .5s ease; }
.agent-empty-icon { width: 64px; height: 64px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: 0 8px 32px rgba(16,185,129,.25); }
.agent-empty-title { font-size: 22px; font-weight: 700; color: var(--fg-0); }
.agent-empty-hint { font-size: 13px; color: var(--fg-2); text-align: center; line-height: 1.6; max-width: 400px; }
.agent-prompt-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; max-width: 480px; width: 100%; }
.agent-prompt-card { padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-1); cursor: pointer; transition: all .15s ease; font-size: 12px; color: var(--fg-1); }
.agent-prompt-card:hover { border-color: #10b981; background: rgba(16,185,129,.08); transform: translateY(-2px); }

/* 输入区 */
.agent-input-area { padding: 14px 20px 20px; background: var(--bg-0); border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: flex-end; }
.agent-input { flex: 1; border: 1px solid var(--border); border-radius: 14px; padding: 10px 16px; background: var(--bg-1); color: var(--fg-0); font-size: 14px; resize: none; outline: none; max-height: 120px; min-height: 24px; line-height: 1.5; font-family: inherit; transition: border-color .2s ease; }
.agent-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.15); }
.agent-send-btn { width: 38px; height: 38px; flex-shrink: 0; border: none; border-radius: 12px; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s ease; }
.agent-send-btn:hover { background: #059669; transform: scale(1.06); }
.agent-send-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }

/* 状态栏 */
.agent-status-bar { display: flex; align-items: center; gap: 16px; padding: 6px 20px; background: var(--bg-1); border-top: 1px solid var(--border); font-size: 11px; color: var(--fg-3); }
.status-mode { font-weight: 500; color: #10b981; }
.status-steps { color: var(--fg-2); }
.status-time { margin-left: auto; font-family: monospace; }
```

### Step 2: 修复消息渲染结构（🔴 关键）
**文件**: `src/js/modules/ai-chat.js` 和 `src/js/modules/ai/ai-agent-ui.js`

问题：当前 `renderMessages()` 生成的消息缺少 `.ai-msg-inner` 包裹层，而 CSS 中 `.ai-msg-content` 是 `.ai-msg-body > .ai-msg-inner > .ai-msg-content` 的嵌套关系。

修复：在两个文件的 renderMessages 中，将每个消息的 body 包裹一层：
```javascript
// 当前：
html += '<div class="ai-msg-body"><div class="ai-msg-content">...</div></div>';
// 修复为：
html += '<div class="ai-msg-body"><div class="ai-msg-inner"><div class="ai-msg-content">...</div></div></div>';
```

### Step 3: 修复 AI Chat 空状态/欢迎页（🔴 关键）
**文件**: `src/js/modules/ai-chat.js` 的 `init()`

在生成的 HTML 中，确保 `#aiMessages` 容器存在且初始渲染欢迎页。当前 `renderMessages()` 通过 `R.renderMessages()` 处理空状态，需确认 `R.renderMessages()` 能正确找到 `#aiMessages` 容器并插入 `.ai-welcome` HTML。

同时需要在 `init()` HTML 中添加欢迎页的默认结构或让 `R.renderMessages()` 正确处理。

### Step 4: 增强流式输出体验（🟠）
**文件**: `src/css/ai-chat.css` + `src/js/modules/ai/ai-render.js`

- 添加"思考中"骨架屏动画：3条渐变线条的 pulse 动画
- 光标闪烁优化：增加呼吸效果
- 首字延迟显示：模拟打字机效果的渐进式显示

```css
.ai-thinking-indicator {
  display: inline-flex; gap: 4px; padding: 8px 0;
}
.ai-thinking-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  animation: thinkingBounce 1.4s ease-in-out infinite;
}
.ai-thinking-dot:nth-child(2) { animation-delay: .16s; }
.ai-thinking-dot:nth-child(3) { animation-delay: .32s; }
@keyframes thinkingBounce {
  0%,80%,100% { transform: scale(.6); opacity: .4; }
  40% { transform: scale(1); opacity: 1; }
}
```

### Step 5: 错误重试按钮（🟠）
**文件**: `src/js/modules/ai/ai-render.js` 或 `src/js/modules/ai-chat.js`

当消息有 `error` 属性时，在错误信息旁添加重试按钮：
```html
<div class="ai-msg-error">
  <span>⚠ 错误信息</span>
  <button class="ai-retry-btn" onclick="retryLastMessage()">🔄 重试</button>
</div>
```
CSS: `.ai-retry-btn { padding: 4px 12px; font-size: 11px; ... }`

### Step 6: 图片粘贴/拖拽支持（🟠）
**文件**: `src/js/modules/ai-chat.js`

在输入框上监听：
- `paste` 事件 → 从 `clipboardData.items` 提取图片 → 转 base64 → 作为 image 参数发送
- `dragover/drop` 事件 → 从 `dataTransfer.files` 提取图片

### Step 7: 消息时间戳（🟡）
**文件**: `src/js/modules/ai/ai-render.js` 或 CSS

在每个消息底部添加格式化时间：
```html
<div class="ai-msg-time">14:32</div>
```
CSS 定位到右侧小字号灰色。

### Step 8: 工具结果展开/折叠（🟡）
**文件**: `src/js/modules/ai/ai-render.js`

当 `_truncated === true` 时，工具结果显示截断版本 + "展开全部" 按钮：
```html
<pre class="ai-tool-result-content truncated">...前800字符...</pre>
<button class="ai-expand-result-btn">展开全部 (N字符)</button>
```
点击后替换为完整内容。

### Step 9: 发送按钮加载动画（🟡）
**文件**: `src/css/ai-chat.css`

```css
.ai-send-btn.loading svg {
  animation: sendSpin .6s linear infinite;
}
@keyframes sendSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
```
JS: 当 `isGenerating=true` 时给 sendBtn 添加 `loading` 类。

### Step 10: 自动滚动智能控制（🟡）
**文件**: `src/js/modules/ai/ai-chat.js` + `src/js/modules/ai/ai-agent-ui.js`

- 记录用户是否手动滚动过（`isUserScrolling`）
- 新消息到来时，如果 `!isUserScrolling` 则 `scrollTop = scrollHeight`
- 用户滚动到距离底部 < 100px 时解除锁定
- 底部显示"↓ 新消息"浮动按钮（当被锁定时）

---

## 文件变更清单

| 文件 | 操作 | 内容 |
|------|------|------|
| `src/css/ai-chat.css` | **大量追加** | Agent 页面完整CSS (~300行) + 思考动画 + 重试按钮 + 加载动画 + 时间戳 + 展开按钮 |
| `src/js/modules/ai-chat.js` | 微调 | 消息HTML加 `.ai-msg-inner` 包裹 + 图片粘贴 + 重试函数 + 滚动控制 |
| `src/js/modules/ai/ai-agent-ui.js` | 微调 | 消息HTML加 `.ai-msg-inner` 包裹 + 滚动控制 |
| `src/js/modules/ai/ai-render.js` | 小改 | 空状态欢迎页渲染确认 + 工具结果展开逻辑（可选） |

## 实施顺序

```
Step 1 (CSS补全) ─── 最关键，无此则Agent页面完全不可用
    ↓
Step 2 (消息结构) ─── 修复渲染错乱
    ↓
Step 3 (欢迎页)     ─── 修复空状态
    ↓
Step 4-10 (体验增强) ── 可并行，按优先级排序
```

## 风险评估
- Step 1-3 为必须修复的功能性问题
- Step 4-10 为体验增强，可分批迭代
- 所有修改均为增量式，不影响现有功能
