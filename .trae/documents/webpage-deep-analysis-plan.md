# 🔍 网页深度分析 — 提取代码/CSS/元素发给AI

> **目标**: 升级「总结网页」按钮，从纯文本提取升级为**深度页面分析**，将 HTML 结构、CSS 样式、DOM 元素信息完整提取给 AI，使其能分析网页的**实现方式、布局结构、样式设计**
> **涉及文件**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) 的 `summarizePage()` 函数

---

## 当前状态

**现有 `summarizePage()` (L149-191)**:
- 只提取文本: h1/h2 → p/li → body.innerText
- 输出给 AI 的 prompt 只有「标题 + URL + 纯文本」
- **问题**: AI 无法看到网页的结构、CSS、HTML 代码

## 目标效果

点击「📄 总结网页」后，发送给 AI 的内容包含：

```
请深度分析以下网页的实现方式：

【基本信息】
- 标题: xxx
- URL: https://...
- 页面类型: SPA / 传统网站 / 框架页面
- 视口尺寸: 1920x1080
- 总元素数: 342 个

【DOM结构树】（前30个关键节点）
├─ html
│  ├─ head
│  │  ├─ meta charset=utf-8
│  │  ├─ title "xxx"
│  │  └─ style (12条规则)
│  └─ body
│     ├─ header.navbar
│     │  ├─ div.logo
│     │  └─ nav > ul > li*5
│     ├─ main.container
│     │  ├─ section.hero
│     │  │  ├─ h1 "..."
│     │  │  └─ button.cta
│     │  └─ article.content > p*8
│     └─ footer

【关键CSS规则】（提取前20条重要规则）
.navbar { position: fixed; top: 0; ... }
.hero { background: linear-gradient(...); ... }
.cta { border-radius: 8px; padding: 12px 24px; ... }

【关键元素详情】（交互元素）
- 按钮 .cta: 文本="立即开始", onclick=..., position=(120,340)
- 表单 input#search: type=search, placeholder="搜索...", required
- 链接 a[href="/about"]: 文本="关于我们"

【页面文本内容】（摘要）
正文内容摘要...

---

请分析：
1. 页面使用了什么技术栈？（框架/CSS方案/构建工具）
2. 页面的布局结构是怎样的？
3. 有哪些值得注意的设计模式或技术亮点？
4. 如果要复刻这个页面，关键的 HTML+CSS 是什么？
```

---

## 实施步骤

### Step 1: 重写 extractJS 注入脚本

**文件**: [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) L159-172

将当前的简单文本提取脚本替换为**多维度深度分析脚本**：

```javascript
var extractJS = `(function(){
  var info = {};

  // === 基本信息 ===
  info.title = document.title || '无标题';
  info.url = location.href;
  info.viewport = window.innerWidth + 'x' + window.innerHeight;
  info.totalElements = document.querySelectorAll('*').length;

  // === 页面类型检测 ===
  var types = [];
  if (document.querySelector('#app,[data-reactroot],__NEXT_DATA__')) types.push('React/Next.js');
  if (document.querySelector('#nuxt,.nuxt-progress')) types.push('Nuxt/Vue');
  if (document.querySelector('[ng-version],ng-app,ng-controller')) types.push('Angular');
  if (document.querySelector('.svelte')) types.push('Svelte');
  if (document.querySelector('meta[name=generator]')) {
    var gen = document.querySelector('meta[name=generator]').content || '';
    if (gen) types.push('Generator: ' + gen);
  }
  if (!types.length) types.push('传统静态/未知');
  info.pageType = types.join(', ');

  // === DOM 结构树（缩进可视化） ===
  function buildTree(el, depth, maxDepth) {
    if (depth > maxDepth) return '';
    if (!el || !el.tagName) return '';
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return '';
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0,3).join('.')
      : '';
    var children = el.children;
    var childCount = children.length;
    var textSnippet = '';
    var text = el.textContent.trim();
    if (text && text.length < 50 && childCount === 0 && ['h1','h2','h3','p','a','button','span'].indexOf(tag) !== -1) {
      textSnippet = ' "' + text.replace(/\\n/g,' ').substring(0,40) + '"';
    }
    var indent = '  '.repeat(depth);
    var line = indent + tag + id + cls + textSnippet;
    var result = line;
    for (var i = 0; i < Math.min(childCount, 5); i++) {
      result += '\\n' + buildTree(children[i], depth + 1, maxDepth);
      if (i === 4 && childCount > 5) { result += '\\n' + indent + '  ... (+' + (childCount - 5) + ' more)'; break; }
    }
    return result;
  }
  info.domTree = buildTree(document.body, 0, 6);

  // === CSS 规则提取 ===
  var cssRules = [];
  try {
    var sheets = document.styleSheets;
    for (var s = 0; s < Math.min(sheets.length, 10); s++) {
      try {
        var rules = sheets[s].cssRules || [];
        for (var r = 0; r < Math.min(rules.length, 20); r++) {
          var rule = rules[r];
          if (rule.selectorText && rule.cssText) {
            cssRules.push(rule.cssText.substring(0, 150));
          }
          if (cssRules.length >= 25) break;
        }
      } catch(e) {}
      if (cssRules.length >= 25) break;
    }
  } catch(e) {}
  info.cssRules = cssRules;

  // === 关键交互元素 ===
  var interactiveEls = [];
  var tagsToCheck = ['a', 'button', 'input', 'textarea', 'select', 'form', '[onclick]', '[tabindex]'];
  tagsToCheck.forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el, idx) {
      if (idx >= 10) return;
      var rect = el.getBoundingClientRect();
      var item = {};
      item.tag = el.tagName.toLowerCase();
      item.id = el.id || '';
      item.cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/)[0] : '';
      item.type = el.type || el.getAttribute('type') || '';
      item.placeholder = el.placeholder || '';
      item.text = el.textContent.trim().substring(0, 60);
      item.href = el.href || '';
      item.src = el.src || '';
      item.alt = el.alt || '';
      item.position = Math.round(rect.left) + ',' + Math.round(rect.top);
      item.size = Math.round(rect.width) + 'x' + Math.round(rect.height);
      interactiveEls.push(item);
    });
  });
  info.interactiveElements = interactiveEls;

  // === 文本内容（保留原有逻辑）===
  var body = document.body;
  var text = "";
  var h1s = document.querySelectorAll("h1,h2");
  h1s.forEach(function(h){text += h.textContent.trim() + "\\n";});
  if(!text){
    var ps = document.querySelectorAll("p,li");
    ps.forEach(function(p){if(p.textContent.trim().length > 20) text += p.textContent.trim().substring(0,200) + "\\n";});
  }
  if(!text) text = body.innerText.substring(0, 3000);
  else text = text.substring(0, 3000);
  info.textContent = text;
  info.textLength = text.length;

  return JSON.stringify(info);
})()`;
```

### Step 2: 重构 prompt 构建逻辑

**文件**: 同上 L179-182

```javascript
// 根据提取的数据构建结构化 prompt
var prompt = '请深度分析以下网页的实现方式：\n\n';

prompt += '【基本信息】\n';
prompt += '- 标题: ' + data.title + '\n';
prompt += '- URL: ' + data.url + '\n';
prompt += '- 页面类型: ' + data.pageType + '\n';
prompt += '- 视口尺寸: ' + data.viewport + '\n';
prompt += '- 总元素数: ' + data.totalElements + ' 个\n\n';

if (data.domTree) {
  prompt += '【DOM结构树】(关键节点)\n```\n' + data.domTree.substring(0, 2000) + '\n```\n\n';
}

if (data.cssRules && data.cssRules.length > 0) {
  prompt += '【关键CSS规则】(' + data.cssRules.length + '条)\n';
  data.cssRules.forEach(function(r) { prompt += r + '\n'; });
  prompt += '\n';
}

if (data.interactiveElements && data.interactiveElements.length > 0) {
  prompt += '【关键交互元素】\n';
  data.interactiveElements.forEach(function(el) {
    var desc = el.tag + (el.id ? '#' + el.id : '') + (el.cls ? '.' + el.cls : '');
    if (el.text) desc += ' 文本="' + el.text + '"';
    if (el.placeholder) desc += ' placeholder="' + el.placeholder + '"';
    if (el.href) desc += ' href="' + el.href + '"';
    desc += ' pos=' + el.position + ' size=' + el.size;
    prompt += '- ' + desc + '\n';
  });
  prompt += '\n';
}

if (data.textContent) {
  prompt += '【页面文本内容】(' + data.textLength + '字)\n' + data.textContent + '\n\n';
}

prompt += '---\n请从以下角度分析这个网页：\n';
prompt += '1. 技术栈识别（框架/CSS方案/构建工具）\n';
prompt += '2. 布局结构和组件划分\n';
prompt += '3. 关键 CSS 设计模式和技巧\n';
prompt += '4. 交互元素的实现方式\n';
prompt += '5. 如果要复刻这个页面，核心代码是什么？\n';
```

### Step 3: UI 微调（可选增强）

在工具栏中增加一个下拉选择器让用户选择分析模式：

| 模式 | 说明 |
|------|------|
| 📝 内容总结 | （原有）只提取文本，做内容摘要 |
| 🔍 深度分析 | （新增）提取 DOM+CSS+元素，做技术分析 |
| 🎨 样式提取 | （新增）重点提取 CSS 和视觉样式 |
| 📊 结构分析 | （新增）只提取 DOM 树和布局结构 |

**实现方式**: 在 `.fc-toolbar` 中 `.fc-summarize-btn` 前加一个小 select：
```html
<select class="fc-analyze-mode" id="fcAnalyzeMode">
  <option value="deep">🔍 深度</option>
  <option value="content">📝 内容</option>
  <option value="style">🎨 样式</option>
  <option value="structure">📊 结构</option>
</select>
```

根据不同模式值，`summarizePage(mode)` 内部决定提取哪些数据、构建不同的 prompt。

### Step 4: 错误处理和性能优化

- **超时控制**: `wv.executeJavaScript()` 加 `{ timeout: 8000 }` 参数
- **大数据截断**: DOM Tree 超过 2000 字符截断，CSS 规则最多 25 条
- **跨域处理**: 部分 CSP 限制页面可能无法执行 JS，catch 并提示用户
- **特殊页面检测**: `about:blank` / `chrome://` / `edge://` 等内部页面提前返回错误

---

## 文件变更汇总

| 文件 | 变更 | 行数 |
|------|------|------|
| [ai-float-overlay.js](src/js/modules/ai/ai-float-overlay.js) | 重写 `extractJS` 脚本 + 重构 prompt 构建 | ~80 行改为 ~180 行 |
| [overlay.css](src/css/overlay.css) | 可选：添加 `.fc-analyze-mode` 下拉样式 | +8 行 |

## 验收标准

- [ ] 点击「📄 总结网页」默认进入**深度分析模式**
- [ ] 提取的信息包含：标题/URL/页面类型/视口尺寸/元素总数
- [ ] 提取 DOM 结构树（可视化的缩进格式）
- [ ] 提取关键 CSS 规则（selector + 声明）
- [ ] 提取交互元素列表（标签/id/class/文本/位置/尺寸）
- [ ] 提取页面文本内容作为补充上下文
- [ ] 发送给 AI 的 prompt 结构清晰、分段明确
- [ ] AI 能据此准确判断技术栈、布局、CSS 技巧
- [ ] 特殊页面（about:blank/chrome://）有友好错误提示
- [ ] 大页面不会导致提取卡死（有截断和超时保护）
