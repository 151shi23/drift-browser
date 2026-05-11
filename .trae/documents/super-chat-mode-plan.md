# 🚀 超级牛逼 Chat 模式 — 实施计划

> **目标**: 将 AI Chat 从"能用"升级到"惊艳"，对标 ChatGPT / Claude 的视觉和交互体验
> **涉及文件**: `ai-chat.js` / `ai-render.js` / `ai-chat.css`
> **技术约束**: ES5 语法、零外部依赖、纯 CSS 动画

---

## 当前代码基线

### 已有功能（保留不动）
- ✅ 纯对话模式约束（ai-api.js chat mode）
- ✅ 流式输出 + 光标动画
- ✅ 思考中脉冲动画
- ✅ 图片粘贴/拖拽上传
- ✅ 错误重试按钮
- ✅ 智能滚动控制
- ✅ Markdown 基础渲染（标题/代码/链接/粗体/斜体/列表）
- ✅ 代码块复制
- ✅ 对话列表 CRUD
- ✅ 模型切换 + Provider 切换
- ✅ Agent 跳转按钮
- ✅ 设置抽屉（API Key / 参数 / 系统提示词）
- ✅ CSS 已有: 消息气泡、代码块精致样式、特殊命令块[PLAN][DONE][THINK]、Agent页面样式

### 需要改造的点（6大模块）

---

## Module A: 🎨 视觉大改造

### A1. 欢迎/空状态页面重设计
**文件**: [ai-render.js:45-48](src/js/modules/ai/ai-render.js#L45-L48)

**当前代码**:
```javascript
container.innerHTML = '<div class="ai-empty"><svg width="48"...>...</svg><div class="ai-empty-title">开始对话</div><div class="ai-empty-hint">输入问题或使用下方快捷指令</div><div class="ai-prompt-cards"><div class="ai-prompt-card" data-prompt="帮我写一个Python爬虫">🐍 Python爬虫</div>...4个卡片...</div></div>';
```

**目标 HTML 结构**:
```html
<div class="ai-welcome">
  <div class="ai-welcome-icon">AI</div>
  <div class="ai-welcome-title">Drift AI 助手</div>
  <div class="ai-welcome-sub">随时待命，为你解答</div>
  <div class="ai-welcome-prompts">
    <div class="ai-prompt-card" data-prompt="帮我写一个Python爬虫">
      <div class="ai-prompt-card-title">💻 写代码</div>
      <div class="ai-prompt-card-desc">Python、JS、Java 随你选</div>
    </div>
    <div class="ai-prompt-card" data-prompt="解释这段代码的工作原理">
      <div class="ai-prompt-card-title">🔍 查资料</div>
      <div class="ai-prompt-card-desc">技术文档、API 一网打尽</div>
    </div>
    <div class="ai-prompt-card" data-prompt="帮我优化这段代码的性能">
      <div class="ai-prompt-card-title">⚡ 改性能</div>
      <div class="ai-prompt-card-desc">算法优化、瓶颈定位</div>
    </div>
    <div class="ai-prompt-card" data-prompt="帮我审查这段代码的安全性">
      <div class="ai-prompt-card-title">🔒 安全审计</div>
      <div class="ai-prompt-card-desc">漏洞扫描、最佳实践</div>
    </div>
  </div>
  <div class="ai-welcome-tip">💡 今日灵感: <span id="aiWelcomeTip">如何用一行 Python 实现斐波那契？</span></div>
</div>
```

**CSS 新增** (ai-chat.css 已有 `.ai-welcome-*` 基础样式在 L212-269，需微调):
- `.ai-welcome-icon` — 渐变背景圆角方块 + 脉冲光晕动画 (已有)
- `.ai-welcome-prompts` — 2x2 grid 布局 (已有)
- `.ai-prompt-card` hover 上浮 + 阴影 (已有)
- **新增** `.ai-welcome-tip` — 底部灵感条，淡入动画，点击可发送

**JS 逻辑**:
- 新增 `getRandomTip()` 函数，从内置数组随机返回一条
- 在 renderMessages 空状态时调用

### A2. 消息气泡差异化布局
**文件**: [ai-render.js:52-65](src/js/modules/ai/ai-render.js#L52-L65)

**当前问题**: 用户消息和助手消息都是左对齐，没有区分度

**改动点**:
1. 用户消息: `flex-direction: row-reverse` 右对齐，头像在右
2. 助手消息: 保持左对齐，头像在左
3. 用户消息气泡: accent 色背景 + 白色文字 + 圆角 `16px 16px 4px 16px`
4. 助手消息气泡: bg-2 背景 + 圆角 `4px 16px 16px 16px`

**HTML结构调整**:
```javascript
// 用户消息 - 头像放后面（通过 CSS order 或直接调换顺序）
html += '<div class="ai-msg ai-msg-user" data-id="' + msg.id + '">'
  + '<div class="ai-msg-body"><div class="ai-msg-inner">'
  + '<div class="ai-msg-name">你</div>'
  + '<div class="ai-msg-content">' + C.escHtml(msg.content) + '</div>'
  + '</div></div>'
  + '<div class="ai-msg-avatar">👤</div>'
  + '</div>';

// 助手消息 - 头像在左
html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '">'
  + '<div class="ai-msg-avatar">🤖</div>'
  + '<div class="ai-msg-body"><div class="ai-msg-inner">'
  + '<div class="ai-msg-name">AI 助手</div>'
  + '<div class="ai-msg-content">' + formatMarkdown(content) + '</div>'
  // + 操作工具栏（Module D）
  + '</div></div>'
  + '</div>';
```

**CSS 关键变更**:
```css
.ai-msg { display: flex; gap: 12px; padding: 16px 24px; max-width: 720px; margin: 0 auto; }
.ai-msg-user { flex-direction: row-reverse; }
.ai-msg-user .ai-msg-avatar { background: var(--accent); }
.ai-msg-user .ai-msg-inner { background: var(--accent); color: #fff; border-radius: 16px 16px 4px 16px; }
.ai-msg-user .ai-msg-content { color: #fff; }
.ai-msg-user .ai-msg-name { color: rgba(255,255,255,0.8); }

.ai-msg-assistant .ai-msg-inner { background: var(--bg-2); border-radius: 4px 16px 16px 16px; }
```

### A3. 打字机逐字显示效果
**文件**: [ai-chat.js:47-59](src/js/modules/ai-chat.js#L47-L59) 的 `onChunk` 回调

**当前问题**: 每个 chunk 都重新 `formatMarkdown()` 全量替换 innerHTML，导致：
1. 性能差（频繁 DOM 操作）
2. 光标跳动（整个 innerHTML 重绘）
3. 无法看到"逐字出现"效果

**方案**: 流式期间用纯文本追加，完成后一次性渲染 Markdown

```javascript
// 在 sendMessage 内部，onChunk 定义之前
var _displayedLen = 0;
var _streamTextEl = null;

var onChunk = function(chunk) {
  C.state.streamingContent += chunk;
  var fullText = C.state.streamingContent;
  var msgEl = document.querySelector('.ai-msg[data-id="' + assistantMsg.id + '"] .ai-msg-body');
  if (msgEl) {
    var contentEl = msgEl.querySelector('.ai-msg-streaming');
    if (!contentEl) return;
    // 找到或创建纯文本容器
    var textSpan = contentEl.querySelector('.ai-stream-text');
    if (!textSpan) {
      contentEl.innerHTML = '<span class="ai-stream-text"></span><span class="ai-stream-cursor"></span>';
      textSpan = contentEl.querySelector('.ai-stream-text');
    }
    // 只追加增量部分
    if (fullText.length > _displayedLen) {
      var delta = fullText.substring(_displayedLen);
      textSpan.textContent += delta;
      _displayedLen = fullText.length;
    }
    // 自动滚动
    var container = document.getElementById('aiMessages');
    if (container && !window.AIRender._isUserScrolling()) container.scrollTop = container.scrollHeight;
  }
};

// ... 发送请求完成后 ...
// 用完整 Markdown 替换纯文本
assistantMsg.content = content;
// renderMessages 会自动调用 formatMarkdown
```

**CSS**: 流式文本不渲染 markdown，保持纯文本等宽感
```css
.ai-stream-text { white-space: pre-wrap; word-break: break-word; }
```

---

## Module B: ⚡ 输入体验升级

### B1. 输入框增强功能
**文件**: [ai-chat.js:123](src/js/modules/ai-chat.js#L123) input 事件监听区域

**新增功能清单**:

| 功能 | 实现方式 | 代码位置 |
|------|----------|----------|
| 字数统计 | input 事件实时更新计数器 | input handler 追加 |
| 清空按钮 | 有内容时显示 ✕，点击清空 | init() 中动态创建 |
| Ctrl+Enter 发送 | keydown 判断 ctrlKey | 已有 Enter 逻辑扩展 |
| Escape 清空 | keydown 判断 Esc | 同上 |
| 粘贴 URL 检测 | paste 事件检查 clipboardData | 已有 paste handler 扩展 |
| @提及快捷指令 | input 监听 `@` 字符弹出菜单 | 新增逻辑 |

**字数统计 UI**:
```html
<!-- 在 ai-input-wrap 内部，input 后面 -->
<span class="ai-input-count" id="aiInputCount"></span>
```
```css
.ai-input-count { font-size: 11px; color: var(--fg-3); white-space: nowrap; padding: 0 4px; }
```

**清空按钮**:
```javascript
// 当 input.value 长度 > 0 时显示
var clearBtn = input.parentElement.querySelector('.ai-input-clear');
if (input.value.length > 0) {
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.className = 'ai-input-clear';
    clearBtn.innerHTML = '✕';
    clearBtn.onclick = function() { input.value = ''; input.style.height = 'auto'; this.remove(); updateCount(); };
    input.parentElement.insertBefore(clearBtn, input.nextSibling);
  }
} else if (clearBtn) {
  clearBtn.remove();
}
```

### B2. 快捷指令系统增强
**文件**: [ai-render.js:47-48](src/js/modules/ai/ai-render.js#L47-L48) 空状态卡片

**从固定 4 卡片升级为动态卡片 + 分类标签**:

数据结构:
```javascript
var PROMPT_CATEGORIES = {
  code: [
    { icon: '💻', title: '写代码', desc: 'Python、JS、Java', prompt: '帮我写一个' },
    { icon: '🔍', title: '查资料', desc: '技术文档、API', prompt: '解释一下' },
    { icon: '⚡', title: '改性能', desc: '算法优化', prompt: '帮我优化' },
    { icon: '🔒', title: '安全审计', desc: '漏洞扫描', prompt: '帮我审查' },
  ],
  write: [
    { icon: '📝', title: '写文章', desc: '博客、报告、文案', prompt: '帮我写一篇关于' },
    { icon: '✏️', title: '改文章', desc: '润色、缩写、翻译', prompt: '帮我修改这段文字' },
    { icon: '🌐', title: '翻译', desc: '多语言互译', prompt: '把以下内容翻译成英文' },
  ],
  life: [
    { icon: '🍳', title: '做菜谱', desc: '食材搭配、烹饪步骤', prompt: '用以下食材做一道菜' },
    { icon: '💡', title: '出主意', desc: '创意方案、决策建议', prompt: '给我一些关于' },
  ]
};

var RANDOM_TIPS = [
  '如何用一行 Python 实现斐波那契？',
  'JavaScript 的 Promise 和 async/await 有什么区别？',
  '怎样写出让面试官眼前一亮的自我介绍？',
  'RESTful API 设计的最佳实践有哪些？',
  '如何优雅地处理 JavaScript 的异步错误？',
  'Docker 和虚拟机有什么本质区别？',
  '写一个高效的正则表达式验证邮箱格式',
  '前端性能优化的 10 个关键指标',
  // ... 共 20 条
];
```

**UI 升级为**:
```html
<div class="ai-welcome">
  <!-- 图标+标题（同 A1） -->
  <div class="ai-welcome-categories">
    <button class="ai-cat-btn active" data-cat="all">全部</button>
    <button class="ai-cat-btn" data-cat="code">编程</button>
    <button class="ai-cat-btn" data-cat="write">写作</button>
    <button class="ai-cat-btn" data-cat="life">生活</button>
  </div>
  <div class="ai-welcome-prompts" id="aiWelcomePrompts">
    <!-- 动态渲染卡片 -->
  </div>
  <div class="ai-welcome-tip">💡 <span id="aiWelcomeTip">...</span></div>
</div>
```

### B3. 语音输入按钮
**文件**: [ai-chat.js:103-107](src/js/modules/ai-chat.js#L103-L107) init() 中的 input area HTML

**在发送按钮左侧添加麦克风按钮**:
```html
<button class="ai-voice-btn" id="aiVoiceBtn" title="语音输入" style="display:none;">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
  </svg>
</button>
```

**逻辑**:
```javascript
// 检测浏览器是否支持 Web Speech API
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  voiceBtn.style.display = 'flex';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognizer = new SR();
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.lang = 'zh-CN';

  voiceBtn.addEventListener('click', function() {
    if (voiceBtn.classList.contains('recording')) {
      recognizer.stop();
    } else {
      recognizer.start();
      voiceBtn.classList.add('recording');
    }
  });

  recognizer.onresult = function(e) {
    var transcript = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    input.value = transcript;
    updateCount();
  };

  recognizer.onend = function() {
    voiceBtn.classList.remove('recording');
  };
}
```

**CSS**:
```css
.ai-voice-btn { width: 38px; height: 38px; flex-shrink: 0; border: none; border-radius: 12px; background: var(--bg-2); color: var(--fg-2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s ease; }
.ai-voice-btn:hover { background: var(--glass-hover); color: var(--fg-0); }
.ai-voice-btn.recording { background: #ef4444; color: #fff; animation: voicePulse 1.5s ease-in-out infinite; }
@keyframes voicePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } }
```

---

## Module C: 📝 Markdown 渲染引擎升级

### C1. 代码块语法高亮
**文件**: [ai-render.js:7-9](src/js/modules/ai/ai-render.js#L7-L9) formatMarkdown() 中的代码块处理

**当前**: `<pre><code>` 包裹原始代码，无着色

**升级为轻量级语法高亮** (~120行):

```javascript
function highlightCode(code, lang) {
  if (!lang || lang === 'text') return escCode(code);
  var escaped = escCode(code);
  // 根据语言选择关键字
  var kwMap = {
    python: ['def','class','import','from','return','if','elif','else','for','while','try','except','with','as','yield','lambda','pass','break','continue','and','or','not','in','is','None','True','False','self'],
    javascript: ['const','let','var','function','return','if','else','for','while','class','extends','new','this','try','catch','finally','throw','async','await','import','export','from','typeof','instanceof','null','undefined','true','false'],
    java: ['public','private','protected','class','interface','extends','implements','static','final','void','int','String','boolean','return','if','else','for','while','new','this','super','try','catch','throws','import','package'],
    sql: ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER','JOIN','LEFT','RIGHT','INNER','ON','AND','OR','NOT','NULL','ORDER','BY','GROUP','HAVING','LIMIT'],
    bash: ['if','then','else','elif','fi','for','in','do','done','case','esac','function','return','exit','echo','cd','ls','pwd','export','source','apt','npm','pip','git','curl','wget','sudo','chmod','chown'],
    css: ['@media','@keyframes','@import','!important'],
    json: []  // JSON 不需要关键字着色
  };
  var kws = kwMap[lang] || [];
  // 关键字着色
  kws.forEach(function(kw) {
    escaped = escaped.replace(new RegExp('\\b' + kw + '\\b', 'g'), '<span class="hl-kw">' + kw + '</span>');
  });
  // 字符串着色（单引号和双引号）
  escaped = escaped.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;)/g, '<span class="hl-str">$1</span>');
  // 注释着色
  if (lang === 'python') escaped = escaped.replace(/(#.*$)/gm, '<span class="hl-cmt">$1</span>');
  else if (lang === 'javascript' || lang === 'java') escaped = escaped.replace(/(\/\/.*$)/gm, '<span class="hl-cmt">$1</span>');
  else if (lang === 'bash') escaped = escaped.replace(/(#.*$)/gm, '<span class="hl-cmt">$1</span>');
  // 数字着色
  escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');
  // 特殊值
  escaped = escaped.replace(/\b(None|True|False|null|undefined|true|false)\b/g, '<span class="hl-special">$1</span>');
  return escaped;
}
```

**集成到 formatMarkdown**:
```javascript
html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
  var langLabel = lang ? '<span class="code-lang">' + lang + '</span>' : '';
  return '<div class="code-block">' + langLabel
    + '<button class="code-copy-btn" onclick="window.FBrowser.aiChat.copyCode(this)">复制</button>'
    + '<pre><code class="hl-code">' + highlightCode(code.trim(), lang) + '</code></pre></div>';
});
```

**CSS 高亮颜色**:
```css
.hl-kw { color: #c678dd; font-weight: 500; }        /* 紫色 - 关键字 */
.hl-str { color: #98c379; }                          /* 绿色 - 字符串 */
.hl-cmt { color: #5c6370; font-style: italic; }       /* 灰色 - 注释 */
.hl-num { color: #d19a66; }                           /* 橙色 - 数字 */
.hl-special { color: #e5c07b; }                       /* 黄色 - 特殊值 */
/* 暗色主题下效果最佳，亮色主题也兼容 */
```

### C2. LaTeX 公式支持
**文件**: [ai-render.js:4-25](src/js/modules/ai/ai-render.js#L4-L25) formatMarkdown()

**在所有其他处理之后添加**:
```javascript
// 行内公式 $...$
html = html.replace(/\$([^\$\n]+?)\$/g, function(match, formula) {
  return '<span class="math-inline" title="' + escAttr(formula) + '">𝑓 ' + escHtml(formula) + '</span>';
});
// 块级公式 $$...$$
html = html.replace(/\$\$([\s\S]+?)\$\$/g, function(match, formula) {
  return '<div class="math-block">' + escHtml(formula.trim()) + '</div>';
});
```

**CSS**:
```css
.math-inline { font-family: 'Cambria Math', 'Times New Roman', serif; color: var(--accent); background: var(--accent-dim); padding: 1px 6px; border-radius: 4px; font-style: italic; }
.math-block { font-family: 'Cambria Math', 'Times New Roman', serif; color: var(--fg-0); background: var(--bg-2); padding: 14px 20px; border-radius: 8px; text-align: center; margin: 12px 0; overflow-x: auto; border-left: 3px solid var(--accent); }
```

### C3. 任务列表支持
**文件**: [ai-render.js](src/js/modules/ai/ai-render.js) formatMarkdown()

**在列表处理之后添加**:
```javascript
// 任务列表 - [ ] 和 [x]
html = html.replace(/^- \[x\] (.+)$/gm, '<label class="task-item task-done"><input type="checkbox" checked disabled> $1</label>');
html = html.replace(/^- \[ \] (.+)$/gm, '<label class="task-item"><input type="checkbox" disabled> $1</label>');
// 包装连续的任务项
html = html.replace(/((<label class="task-item[\s\S]*?<\/label>\n?)+)/g, '<div class="task-list">$1</div>');
```

**CSS**:
```css
.task-list { margin: 10px 0; padding: 0; list-style: none; }
.task-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 14px; cursor: default; }
.task-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); flex-shrink: 0; }
.task-done { opacity: 0.6; }
.task-done .task-item-text { text-decoration: line-through; }
```

### C4. 表格渲染
**文件**: [ai-render.js](src/js/modules/ai/ai-render.js) formatMarkdown()

**新增表格解析**:
```javascript
// 表格渲染
function renderTable(tableMd) {
  var lines = tableMd.trim().split('\n');
  if (lines.length < 2) return tableMd;
  // 解析表头
  var headers = lines[0].split('|').map(function(c) { return c.trim(); }).filter(Boolean);
  // 检查分隔行
  var sepLine = lines[1] || '';
  if (!/^[-| :]+$/.test(sepLine)) return tableMd;
  // 解析数据行
  var rows = [];
  for (var i = 2; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('|') === -1) break;
    var cells = line.split('|').map(function(c) { return c.trim(); }).filter(Boolean);
    rows.push(cells);
  }
  // 构建 HTML
  var html = '<table class="ai-md-table"><thead><tr>';
  headers.forEach(function(h) { html += '<th>' + h + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function(row) {
    html += '<tr>';
    row.forEach(function(cell) { html += '<td>' + cell + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// 在 formatMarkdown 中检测表格
html = html.replace(/(\|.+\|\n\|[-| :]+\|(?:\n|.+)*)/g, function(match) {
  return renderTable(match);
});
```

> 注意: CSS 中已有 `.ai-md-table` 样式 (L398-429)，无需额外添加。

### C5. 引用块增强
**文件**: [ai-render.js](src/js/modules/ai/ai-render.js) formatMarkdown()

**当前缺失引用块 `> ` 支持**:
```javascript
// 引用块
html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="ai-md-blockquote">$1</html>');
// 多行引用合并
html = html.replace(/(<blockquote class="ai-md-blockquote">.*?<\/blockquote>\n?)+/g, function(m) {
  return '<div class="ai-md-blockquote-wrap">' + m + '</div>';
});
```

> CSS 已有 `.ai-md-blockquote` (L470-479)。

---

## Module D: 🔧 消息操作工具栏

### D1. 每条助手消息的操作按钮
**文件**: [ai-render.js:63-64](src/js/modules/ai/ai-render.js#L63-L64) assistant 消息渲染

**在 `.ai-msg-inner` 内部底部追加操作栏**:
```javascript
// 助手消息 HTML 追加操作栏
html += '<div class="ai-msg-actions">'
  + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.copyMsg(\'' + msg.id + '\')" title="复制">📋</button>'
  + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.regenerateMsg(\'' + msg.id + '\')" title="重新生成">🔄</button>'
  + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.likeMsg(\'' + msg.id + '\',this)" title="点赞">👍</button>'
  + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.dislikeMsg(\'' + msg.id + '\',this)" title="点踩">👎</button>'
  + '</div>';
```

**CSS**:
```css
.ai-msg-actions { display: flex; gap: 4px; margin-top: 8px; opacity: 0; transition: opacity .15s ease; }
.ai-msg-assistant:hover .ai-msg-actions { opacity: 1; }
.ai-msg-action { width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--fg-3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s ease; font-size: 13px; }
.ai-msg-action:hover { background: var(--bg-2); color: var(--fg-0); }
.ai-msg-action.liked { color: #3b82f6; }
.ai-msg-action.disliked { color: #ef4444; }
```

**JS 操作函数** (添加到 `window.FBrowser.aiChat`):
```javascript
copyMsg: function(msgId) {
  var chat = C.getActiveChat();
  if (!chat) return;
  var msg = chat.messages.find(function(m) { return m.id === msgId; });
  if (msg && msg.content) {
    navigator.clipboard.writeText(msg.content).then(function() {
      C.showNotification('已复制到剪贴板', 'success');
    });
  }
},
regenerateMsg: function(msgId) {
  var chat = C.getActiveChat();
  if (!chat) return;
  var idx = chat.messages.findIndex(function(m) { return m.id === msgId; });
  if (idx <= 0) return;
  // 找到该条消息对应的用户消息
  var userMsg = null;
  for (var i = idx - 1; i >= 0; i--) {
    if (chat.messages[i].role === 'user') { userMsg = chat.messages[i]; break; }
  }
  if (!userMsg) return;
  // 删除从用户消息之后的所有消息
  chat.messages = chat.messages.slice(0, i);
  C.saveChats();
  R.renderMessages();
  // 重新发送
  sendMessage(userMsg.content);
},
likeMsg: function(msgId, btn) {
  if (btn.classList.contains('liked')) { btn.classList.remove('liked'); return; }
  btn.classList.add('liked');
  var sibling = btn.nextElementSibling;
  if (sibling && sibling.classList.contains('disliked')) sibling.classList.remove('disliked');
  // 存储
  var likes = JSON.parse(localStorage.getItem('ai_msg_likes') || '{}');
  likes[msgId] = 'like';
  localStorage.setItem('ai_msg_likes', JSON.stringify(likes));
},
dislikeMsg: function(msgId, btn) {
  if (btn.classList.contains('disliked')) { btn.classList.remove('disliked'); return; }
  btn.classList.add('disliked');
  var sibling = btn.previousElementSibling;
  if (sibling && sibling.classList.contains('liked')) sibling.classList.remove('liked');
  var likes = JSON.parse(localStorage.getItem('ai_msg_likes') || '{}');
  likes[msgId] = 'dislike';
  localStorage.setItem('ai_msg_likes', JSON.stringify(likes));
}
```

### D2. 导出对话功能
**文件**: [ai-chat.js](src/js/modules/ai-chat.js) init() header 区域

**在 `.ai-main-actions` 中添加导出按钮**:
```html
<button class="ai-header-btn" id="aiExportBtn" title="导出对话">
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 11h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
</button>
```

**导出逻辑**:
```javascript
exportChat: function(format) {
  var chat = C.getActiveChat();
  if (!chat || chat.messages.length === 0) { C.showNotification('没有可导出的内容', 'warning'); return; }
  if (format === 'md') {
    var md = '# ' + chat.title + '\n\n';
    chat.messages.forEach(function(msg) {
      var role = msg.role === 'user' ? '**你**' : '**AI**';
      md += role + ': ' + msg.content + '\n\n';
    });
    downloadFile(chat.title + '.md', md, 'text/markdown');
  } else if (format === 'json') {
    downloadFile(chat.title + '.json', JSON.stringify(chat.messages, null, 2), 'application/json');
  }
}
```

**下载辅助函数**:
```javascript
function downloadFile(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
```

---

## Module E: 🔍 搜索与导航增强

### E1. 对话内搜索
**文件**: [ai-chat.js](src/js/modules/ai-chat.js) init()

**在 `.ai-main-header` 中添加搜索触发按钮 + 搜索浮层**:
```html
<!-- 搜索按钮（在 actions 组中） -->
<button class="ai-header-btn" id="aiSearchToggle" title="搜索 (Ctrl+F)">
  <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9 9l3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
</button>

<!-- 搜索浮层（默认隐藏） -->
<div class="ai-search-overlay" id="aiSearchOverlay" style="display:none;">
  <div class="ai-search-bar">
    <input type="text" class="ai-search-input" id="aiSearchInput" placeholder="搜索对话...">
    <span class="ai-search-count" id="aiSearchCount"></span>
    <button class="ai-search-nav" id="aiSearchPrev" title="上一个">↑</button>
    <button class="ai-search-nav" id="aiSearchNext" title="下一个">↓</button>
    <button class="ai-search-close" id="aiSearchClose">✕</button>
  </div>
</div>
```

**搜索逻辑**:
```javascript
function initSearch() {
  var toggle = document.getElementById('aiSearchToggle');
  var overlay = document.getElementById('aiSearchOverlay');
  var input = document.getElementById('aiSearchInput');
  var countEl = document.getElementById('aiSearchCount');
  var results = [];
  var currentIdx = 0;

  function doSearch() {
    var q = input.value.toLowerCase().trim();
    if (!q) { clearHighlights(); countEl.textContent = ''; results = []; return; }
    var msgs = document.querySelectorAll('.ai-msg-content');
    results = [];
    msgs.forEach(function(el, i) {
      var text = el.textContent.toLowerCase();
      if (text.indexOf(q) !== -1) results.push({ el: el, index: i });
    });
    countEl.textContent = results.length ? (currentIdx + 1) + '/' + results.length : '无结果';
    highlightAll(q);
    scrollToResult(currentIdx);
  }

  function highlightAll(q) {
    clearHighlights();
    results.forEach(function(r) {
      var html = r.el.innerHTML;
      var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      r.el.innerHTML = html.replace(regex, '<mark class="ai-search-mark">$1</mark>');
    });
  }

  function clearHighlights() {
    document.querySelectorAll('.ai-search-mark').forEach(function(m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  function scrollToResult(idx) {
    if (results[idx]) {
      results[idx].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  input.addEventListener('input', doSearch);
  document.getElementById('aiSearchNext').addEventListener('click', function() {
    if (results.length === 0) return;
    currentIdx = (currentIdx + 1) % results.length; doSearch();
  });
  document.getElementById('aiSearchPrev').addEventListener('click', function() {
    if (results.length === 0) return;
    currentIdx = (currentIdx - 1 + results.length) % results.length; doSearch();
  });
  document.getElementById('aiSearchClose').addEventListener('click', function() {
    overlay.style.display = 'none'; clearHighlights();
  });

  toggle.addEventListener('click', function() {
    overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    if (overlay.style.display === 'block') { input.focus(); doSearch(); }
  });

  // Ctrl+F 快捷键
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      overlay.style.display = 'block'; input.focus();
    }
    if (e.key === 'Escape' && overlay.style.display === 'block') {
      overlay.style.display = 'none'; clearHighlights();
    }
  });
}
```

**CSS**:
```css
.ai-search-overlay { position: absolute; top: 0; left: 0; right: 0; z-index: 10; background: var(--bg-0); border-bottom: 1px solid var(--border); padding: 8px 20px; }
.ai-search-bar { display: flex; align-items: center; gap: 8px; max-width: 500px; }
.ai-search-input { flex: 1; padding: 7px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-1); color: var(--fg-0); font-size:13px; outline:none; }
.ai-search-input:focus { border-color: var(--accent); }
.ai-search-count { font-size: 11px; color: var(--fg-3); min-width: 40px; }
.ai-search-nav { width:28px;height:28px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--fg-2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center }
.ai-search-nav:hover { background: var(--glass-hover); }
.ai-search-close { width:28px;height:28px;border:none;border-radius:6px;background:transparent;color:var(--fg-3);cursor:pointer;font-size:14px }
.ai-search-mark { background: #fbbf24; color: inherit; padding: 0 2px; border-radius: 2px; }
```

### E2. 对话列表搜索
**文件**: [ai-render.js:92-114](src/js/modules/ai/ai-render.js#L92-L114) renderChatList()

**在侧栏顶部添加搜索框**:
```javascript
function renderChatList() {
  var C = window.AICore;
  var list = document.getElementById('aiChatList');
  if (!list) return;

  var searchVal = (list._searchValue || '').toLowerCase();

  var filteredChats = C.state.chats.filter(function(chat) {
    if (!searchVal) return true;
    return chat.title.toLowerCase().indexOf(searchVal) !== -1;
  });

  var html = '';
  if (searchVal) {
    html += '<div class="ai-chat-list-info">' + filteredChats.length + ' 个结果</div>';
  }
  filteredChats.forEach(function(chat) {
    var isActive = chat.id === C.state.activeChatId;
    html += '<div class="ai-chat-item' + (isActive ? ' active' : '') + '" data-id="' + chat.id + '">'
      + '<div class="ai-chat-item-title">' + C.escHtml(chat.title) + '</div>'
      + '<div class="ai-chat-item-meta">' + chat.messages.length + ' 条消息</div>'
      + '<button class="ai-chat-item-del" data-id="' + chat.id + '" title="删除">&times;</button></div>';
  });
  list.innerHTML = html;
  // ... 事件绑定不变 ...
}

// 搜索框初始化（在 ai-chat.js init() 中）
var chatSearchInput = document.getElementById('aiChatSearch');
if (chatSearchInput) {
  chatSearchInput.addEventListener('input', function() {
    var listEl = document.getElementById('aiChatList');
    if (listEl) { listEl._searchValue = this.value; R.renderChatList(); }
  });
}
```

**HTML**: 在 `.ai-sidebar-header` 下面添加:
```html
<div class="ai-sidebar-search">
  <input type="text" id="aiChatSearch" placeholder="搜索对话..." class="ai-chat-search-input">
</div>
```

**CSS**:
```css
.ai-sidebar-search { padding: 0 12px 8px; }
.ai-chat-search-input { width: 100%; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-0); color: var(--fg-1); font-size: 12px; outline: none; }
.ai-chat-search-input:focus { border-color: var(--accent); }
.ai-chat-search-input::placeholder { color: var(--fg-3); }
.ai-chat-list-info { padding: 8px 12px; font-size: 11px; color: var(--fg-3); }
```

---

## Module F: ✨ 细节打磨

### F1. 连接状态指示器
**位置**: 输入框上方或侧栏底部

**HTML**:
```html
<div class="ai-status-indicator" id="aiStatusIndicator">
  <span class="ai-status-dot" id="aiStatusDot"></span>
  <span class="ai-status-text" id="aiStatusText">已连接</span>
</div>
```

**逻辑**:
```javascript
function updateConnectionStatus() {
  var config = C.loadConfig();
  var dot = document.getElementById('aiStatusDot');
  var text = document.getElementById('aiStatusText');
  if (!dot || !text) return;
  var apiKey = config.apiKey || config[config.provider + '_key'] || '';
  if (apiKey) {
    dot.className = 'ai-status-dot status-ok';
    text.textContent = '已连接';
  } else {
    dot.className = 'ai-status-dot status-off';
    text.textContent = '未配置 API Key';
  }
}
```

**CSS**:
```css
.ai-status-indicator { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; color: var(--fg-3); }
.ai-status-dot { width: 7px; height: 7px; border-radius: 50%; }
.status-ok { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
.status-off { background: var(--fg-3); }
.status-busy { background: #f59e0b; animation: statusPulse 1s infinite; }
@keyframes statusPulse { 50% { opacity: 0.4; } }
```

### F2. Token 用量估算
**位置**: 侧栏底部或状态栏

**估算函数**:
```javascript
function estimateTokens(text) {
  if (!text) return 0;
  // 中文约 1.5 token/字，英文约 0.25 token/字符
  var chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  var other = text.length - chinese;
  return Math.ceil(chinese * 1.5 + other * 0.25);
}

function updateTokenEstimate() {
  var chat = C.getActiveChat();
  if (!chat) return;
  var totalInput = 0;
  var totalOutput = 0;
  chat.messages.forEach(function(msg) {
    var t = estimateTokens(msg.content || '');
    if (msg.role === 'user' || msg.role === 'system') totalInput += t;
    else totalOutput += t;
  });
  var el = document.getElementById('aiTokenEstimate');
  if (el) el.textContent = '~' + (totalInput + totalOutput) + ' tokens';
}
```

### F3. 键盘快捷键完善
**文件**: [ai-chat.js](src/js/modules/ai-chat.js) 全局 keydown 监听

**新增快捷键**:
| 快捷键 | 功能 |
|--------|------|
| `Esc` | 清空输入框 |
| `Ctrl+/` | 切换侧栏 |
| `Ctrl+N` | 新建对话 |
| `Ctrl+E` | 导出对话 |
| `↑` (输入框聚焦) | 上一条历史输入 |
| `↓` (输入框聚焦) | 下一条历史输入 |

**实现**:
```javascript
var inputHistory = [];
var historyIdx = -1;

// 在 send 成功后记录历史
inputHistory.push(sentText);
historyIdx = inputHistory.length;

// keydown 监听（在 input 上）
input.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { input.value = ''; input.style.height = 'auto'; return; }
  if (e.key === 'ArrowUp' && !e.shiftKey && input.selectionStart === 0) {
    e.preventDefault();
    if (historyIdx > 0) { historyIdx--; input.value = inputHistory[historyIdx]; }
  }
  if (e.key === 'ArrowDown' && !e.shiftKey) {
    e.preventDefault();
    if (historyIdx < inputHistory.length - 1) { historyIdx++; input.value = inputHistory[historyIdx]; }
    else { historyIdx = inputHistory.length; input.value = ''; }
  }
});

// 全局快捷键
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleSidebar(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); C.createChat('新对话'); R.renderChatList(); R.renderMessages(); }
});
```

### F4. 消息时间戳
**文件**: [ai-render.js:52-65](src/js/modules/ai/ai-render.js#L52-L65)

**每条消息底部添加时间**:
```javascript
// 在消息内容后面
var timeStr = formatTime(msg.timestamp);
// ...
+ '<div class="ai-msg-time">' + timeStr + '</div>'
```

**时间格式化函数**:
```javascript
function formatTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var h = d.getHours().toString().padStart(2, '0');
  var m = d.getMinutes().toString().padStart(2, '0');
  return h + ':' + m;
}
```

> CSS 已有 `.ai-msg-time` (L1336-1338)。

### F5. 滚动到底部按钮
**当用户向上滚动时显示**:

**逻辑** (在 scroll handler 中):
```javascript
var scrollHint = document.getElementById('aiScrollHint');
if (!scrollHint) {
  scrollHint = document.createElement('div');
  scrollHint.id = 'aiScrollHint';
  scrollHint.className = 'ai-scroll-hint';
  scrollHint.innerHTML = '↓ 回到底部';
  scrollHint.onclick = function() {
    var c = document.getElementById('aiMessages');
    if (c) c.scrollTop = c.scrollHeight;
  };
  document.getElementById('aiMessages').parentElement.appendChild(scrollHint);
}
scrollHint.style.display = isUserScrolling ? 'block' : 'none';
```

> CSS 已有 `.ai-scroll-hint` (L1343-1344)。

---

## 实施顺序与依赖关系

```
Phase 1: 视觉基础 (最直观，用户第一眼看到的)
├── A1. 欢迎页重设计          [ai-render.js + ai-chat.css]
├── A2. 消息气泡差异化         [ai-render.js + ai-chat.css]
└── A3. 打字机效果             [ai-chat.js]

Phase 2: 内容质量 (核心体验)
├── C1. 代码语法高亮           [ai-render.js]
├── C2. LaTeX 公式             [ai-render.js]
├── C3. 任务列表               [ai-render.js]
├── C4. 表格渲染               [ai-render.js]
└── C5. 引用块                 [ai-render.js]

Phase 3: 交互提升
├── B1. 输入框增强             [ai-chat.js + ai-chat.css]
├── B2. 快捷指令分类           [ai-render.js]
├── B3. 语音输入               [ai-chat.js + ai-chat.css]
├── D1. 消息操作工具栏         [ai-render.js + ai-chat.js + ai-chat.css]
└── D2. 导出功能               [ai-chat.js]

Phase 4: 细节打磨
├── E1. 对话内搜索             [ai-chat.js + ai-chat.css]
├── E2. 对话列表搜索           [ai-render.js + ai-chat.css]
├── F1. 连接状态指示            [ai-chat.js + ai-chat.css]
├── F2. Token 估算              [ai-chat.js]
├── F3. 键盘快捷键             [ai-chat.js]
├── F4. 时间戳                  [ai-render.js]
└── F5. 滚动到底部按钮          [ai-render.js]
```

---

## 文件变更汇总

| 文件 | 变更类型 | 预估新增行数 |
|------|----------|-------------|
| [ai-chat.js](src/js/modules/ai-chat.js) | 重大修改 | +250 行 |
| [ai-render.js](src/js/modules/ai/ai-render.js) | 重大修改 | +300 行 |
| [ai-chat.css](src/css/ai-chat.css) | 大量追加 | +200 行 |

**总计**: ~750 行新增/修改代码

---

## 验收标准

### 必须达成 (Must Have)
- [ ] 欢迎页显示渐变图标 + 标题 + 2x2 快捷卡片 + 灵感条
- [ ] 用户消息右对齐(accent色)，助手消息左对齐(bg-2)
- [ ] 流式输出逐字显示（非整段替换）
- [ ] 代码块语法高亮（至少 python/javascript/java/sql/bash）
- [ ] 任务列表 `[ ]` / `[x]` 正确渲染
- [ ] 表格正确渲染为 HTML table
- [ ] 每条助手消息 hover 显示 复制/重生/点赞/点踩 按钮
- [ ] 复制按钮可用，重生按钮可重新生成
- [ ] 对话内搜索高亮 + 跳转正常工作
- [ ] 侧栏搜索过滤对话列表
- [ ] 输入框字数统计 + 清空按钮正常

### 应该达成 (Should Have)
- [ ] LaTeX 公式显示为斜体样式
- [ ] 语音输入按钮（支持的浏览器显示并可用）
- [ ] 导出为 Markdown / JSON 可下载
- [ ] 连接状态指示器显示正确
- [ ] Token 估算数字合理
- [ ] 键盘快捷键 (Esc/Ctrl+N/Ctrl+/) 正常工作
- [ ] 消息时间戳显示
- [ ] 滚动到底部按钮自动显隐

### 可以有 (Nice to Have)
- [ ] 快捷指令分类标签页切换
- [ ] @提及 弹出菜单
- [ ] 粘贴 URL/JSON 自动处理
- [ ] 输入历史上下浏览 (↑/↓)
