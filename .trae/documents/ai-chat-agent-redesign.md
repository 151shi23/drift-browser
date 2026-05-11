# AI Chat & Agent 全面重构计划

## 一、设计方向

**视觉论点**: "沉静力量" — 深色画布上精准排布的信息建筑，极少量accent色点亮关键状态，一切多余装饰被剥离，只留下思考的痕迹。

**交互论点**:
1. 消息以呼吸感逐条浮现（staggered fade-in）
2. Agent工具调用以时间线展开（collapsible timeline）
3. 输入区聚焦时微妙发光扩散（glow spread）

**色彩系统** (基于brand-guidelines + Drift浏览器暗色主题):
- 主背景: `#0a0a0b` (近乎纯黑)
- 次背景: `#111113` (卡片/侧栏)
- 三级背景: `#1a1a1e` (代码块/输入框)
- 主文字: `#e8e6dc` (暖白)
- 次文字: `#8a8880` (暖灰)
- Accent: `#d97757` (Anthropic橙)
- Accent2: `#6a9bcc` (Anthropic蓝)
- Success: `#788c5d` (Anthropic绿)
- Error: `#e54d4d`

**字体**:
- 标题/品牌: `Poppins` (fallback: Arial)
- 正文: `Lora` (fallback: Georgia)
- 代码: `Cascadia Code` / `Consolas`

---

## 二、文件修改清单

### 2.1 新建文件

| 文件 | 功能 |
|------|------|
| `src/css/ai-chat-v2.css` | AI Chat全新视觉样式 |
| `src/css/ai-agent-v2.css` | AI Agent全新视觉样式 |
| `src/js/modules/ai/ai-render-v2.js` | 全新消息渲染引擎（增量渲染+虚拟滚动） |
| `src/js/modules/ai/ai-state.js` | 集中式状态管理（替代ai-core中的散乱状态） |

### 2.2 重写文件

| 文件 | 重写范围 |
|------|---------|
| `src/css/ai-chat.css` | 完全替换为v2样式 |
| `src/js/modules/ai/ai-chat.js` | 完全重写UI构建和交互逻辑 |
| `src/js/modules/ai/ai-render.js` | 完全重写Markdown渲染引擎 |
| `src/js/modules/ai/ai-agent-ui.js` | 完全重写Agent UI |
| `src/js/modules/ai/ai-float-overlay.js` | 完全重写浮窗UI |
| `src/js/modules/ai/ai-core.js` | 重构状态管理和数据模型 |
| `src/js/modules/ai/ai-api.js` | 重构请求层（支持增量渲染回调） |
| `src/js/modules/ai/ai-settings.js` | 重写设置面板UI |

### 2.3 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/index.html` | 更新CSS引用，添加新JS模块 |
| `src/js/app.js` | 更新AI模块初始化调用 |

---

## 三、核心重构方案

### 3.1 ai-core.js — 状态管理重构

**当前问题**: 状态散落在 `state` 对象、`localStorage`、全局变量中，无统一变更通知

**新方案**: 引入集中式状态管理 `AIState`

```javascript
window.AIState = {
  _state: { ... },
  _listeners: new Map(),
  
  get(key) { ... },
  set(key, value) { 
    this._state[key] = value;
    this._notify(key, value);
  },
  
  subscribe(key, callback) { ... },
  unsubscribe(key, callback) { ... },
  _notify(key, value) { ... }
};
```

**状态模型**:
```javascript
{
  // 对话
  chats: [],           // 所有对话列表
  activeChatId: null,  // 当前对话ID
  
  // 生成
  isGenerating: false,
  streamingContent: '',
  streamingMsgId: null,
  
  // Agent
  agentRunning: false,
  agentMode: 'react',  // instant|react|plan|reflexion
  agentSteps: { current: 0, total: 0 },
  agentLog: [],
  
  // UI
  sidebarOpen: true,
  settingsOpen: false,
  searchOpen: false,
  
  // 模型
  activeProvider: '',
  activeModel: '',
  modelList: [],
  
  // 配置
  config: { ... }
}
```

### 3.2 ai-render.js — 渲染引擎重构

**当前问题**: 
- 全量重渲染（每次流式chunk重渲染整个消息）
- Markdown解析用正则，不支持嵌套
- 代码高亮简单，无语言检测

**新方案**: 增量渲染 + AST式Markdown解析

```javascript
// 增量渲染：只更新变化的部分
function renderIncremental(container, oldContent, newContent) {
  const diff = computeDiff(oldContent, newContent);
  // 只更新diff部分，不重渲染整个消息
}

// Markdown AST解析器
function parseMarkdown(text) {
  // 返回AST树，支持嵌套
  return {
    type: 'root',
    children: [
      { type: 'paragraph', children: [...] },
      { type: 'code-block', lang: 'js', content: '...' },
      ...
    ]
  };
}

// AST → HTML 渲染
function renderAST(ast) {
  // 递归渲染AST节点
}
```

**特殊块渲染**:
- `[PLAN]` → 可折叠执行计划时间线
- `[THINK]` → 可折叠思考过程（默认折叠）
- `[DONE]` → 完成标记+摘要
- 工具调用 → 时间线卡片（展开/折叠）

### 3.3 ai-chat.js — UI重构

**新布局**:
```
┌──────────────────────────────────────────────────┐
│  ┌─────────┐  ┌──────────────────────────────┐   │
│  │ 侧栏    │  │ 消息区                        │   │
│  │         │  │                              │   │
│  │ 对话列表│  │  ┌────────────────────────┐  │   │
│  │         │  │  │ 欢迎页/消息流          │  │   │
│  │ ─────── │  │  │                        │  │   │
│  │ 模型选择│  │  │  用户消息(右对齐气泡)   │  │   │
│  │         │  │  │  AI消息(左对齐,Markdown)│  │   │
│  │         │  │  │  工具调用(时间线卡片)   │  │   │
│  │         │  │  └────────────────────────┘  │   │
│  │         │  │                              │   │
│  │         │  │  ┌────────────────────────┐  │   │
│  │         │  │  │ 输入区(发光边框)       │  │   │
│  │         │  │  └────────────────────────┘  │   │
│  └─────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**关键交互**:
- 消息逐条浮现动画（staggered `animation-delay`）
- 用户消息：右对齐圆角气泡，accent背景
- AI消息：左对齐，无气泡，直接在画布上排版
- 代码块：深色容器+语言标签+一键复制
- 工具调用：可折叠时间线卡片
- 输入区：聚焦时边框发光扩散
- 搜索：Ctrl+F 消息内搜索

### 3.4 ai-agent-ui.js — Agent UI重构

**新布局**:
```
┌──────────────────────────────────────────────────┐
│  ┌─────────┐  ┌──────────────────────────────┐   │
│  │ 任务栏  │  │ Agent 主控台                  │   │
│  │         │  │                              │   │
│  │ 任务列表│  │  ┌─ 执行时间线 ─────────────┐│   │
│  │         │  │  │ ● 用户指令              ││   │
│  │ ─────── │  │  │ ├─ AI分析               ││   │
│  │ 执行日志│  │  │ ├─ 🔧 工具调用(可折叠)   ││   │
│  │         │  │  │ │  └─ 结果              ││   │
│  │         │  │  │ ├─ AI推理               ││   │
│  │         │  │  │ └─ ✅ 完成              ││   │
│  │         │  │  └──────────────────────────┘│   │
│  │         │  │                              │   │
│  │         │  │  ┌────────────────────────┐  │   │
│  │         │  │  │ 任务输入               │  │   │
│  │         │  │  └────────────────────────┘  │   │
│  │         │  │  ┌────────────────────────┐  │   │
│  │         │  │  │ 状态栏: 模式|步骤|时间  │  │   │
│  │         │  │  └────────────────────────┘  │   │
│  └─────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**关键交互**:
- 执行时间线视图（替代平铺消息列表）
- 工具调用卡片可展开/折叠
- 实时执行状态指示（脉冲动画）
- 执行日志面板（底部抽屉式）
- 停止按钮在执行时显示为脉冲红色

### 3.5 ai-float-overlay.js — 浮窗重构

**新设计**: 
- 圆角矩形浮窗，毛玻璃背景
- 顶部拖拽条+模型选择
- 消息流+输入区
- 可调整大小
- 网页分析按钮（分析当前页面）

### 3.6 ai-settings.js — 设置面板重构

**新设计**:
- 右侧抽屉（保持）
- 提供商选择改为水平标签页
- 每个提供商的配置区域更紧凑
- 技能网格改为可搜索列表
- 参数调节使用精致滑块

### 3.7 ai-api.js — 请求层重构

**改进**:
- 流式回调改为增量回调（只传新增chunk，不传全量）
- 支持请求取消（AbortController）
- 错误重试策略改进（指数退避）
- 请求队列管理

---

## 四、CSS设计规范

### 4.1 设计Token

```css
:root {
  /* 色彩 */
  --ai-bg-0: #0a0a0b;
  --ai-bg-1: #111113;
  --ai-bg-2: #1a1a1e;
  --ai-bg-3: #222226;
  --ai-fg-0: #e8e6dc;
  --ai-fg-1: #b0aea5;
  --ai-fg-2: #8a8880;
  --ai-fg-3: #5c5a54;
  --ai-accent: #d97757;
  --ai-accent-dim: rgba(217,119,87,.12);
  --ai-accent2: #6a9bcc;
  --ai-success: #788c5d;
  --ai-error: #e54d4d;
  --ai-border: rgba(255,255,255,.06);
  --ai-border-hover: rgba(255,255,255,.12);
  
  /* 圆角 */
  --ai-radius-sm: 6px;
  --ai-radius-md: 10px;
  --ai-radius-lg: 14px;
  --ai-radius-xl: 20px;
  
  /* 阴影 */
  --ai-shadow-sm: 0 1px 3px rgba(0,0,0,.3);
  --ai-shadow-md: 0 4px 12px rgba(0,0,0,.4);
  --ai-shadow-lg: 0 8px 32px rgba(0,0,0,.5);
  --ai-shadow-glow: 0 0 20px rgba(217,119,87,.15);
  
  /* 字体 */
  --ai-font-heading: 'Poppins', Arial, sans-serif;
  --ai-font-body: 'Lora', Georgia, serif;
  --ai-font-mono: 'Cascadia Code', Consolas, 'SF Mono', monospace;
  
  /* 动画 */
  --ai-ease-out: cubic-bezier(.16,1,.3,1);
  --ai-ease-spring: cubic-bezier(.34,1.56,.64,1);
  --ai-duration-fast: .15s;
  --ai-duration-normal: .25s;
  --ai-duration-slow: .4s;
}
```

### 4.2 关键组件样式

**消息**:
- 用户消息：右对齐，accent背景圆角气泡，白色文字
- AI消息：左对齐，无背景，直接在画布上，最大宽度680px
- 工具调用：左侧彩色竖线 + 可折叠卡片
- 代码块：深色容器，顶部语言标签+复制按钮

**输入区**:
- 默认：`--ai-bg-2`背景，`--ai-border`边框
- 聚焦：边框变为accent色，外扩glow阴影
- 发送按钮：accent背景，hover时微放大

**侧栏**:
- 背景：`--ai-bg-1`
- 对话项：hover时`--ai-bg-2`背景，active时accent左边框
- 模型选择：底部固定区域

**Agent时间线**:
- 竖线连接各步骤
- 每步有圆形节点（颜色表示状态）
- 工具调用节点可展开

---

## 五、实施步骤

### 阶段1: 基础设施 (ai-state.js + CSS Token)
1. 创建 `src/js/modules/ai/ai-state.js` — 集中式状态管理
2. 创建 `src/css/ai-chat-v2.css` — CSS Token + 基础组件样式
3. 修改 `src/index.html` — 引用新CSS

### 阶段2: 渲染引擎 (ai-render-v2.js)
4. 创建 `src/js/modules/ai/ai-render-v2.js` — 增量渲染引擎
5. 重写 `src/js/modules/ai/ai-render.js` — 接入新渲染引擎

### 阶段3: AI Chat UI
6. 重写 `src/js/modules/ai/ai-chat.js` — 新UI构建+交互
7. 重写 `src/js/modules/ai/ai-core.js` — 接入AIState
8. 重写 `src/js/modules/ai/ai-api.js` — 增量回调+AbortController

### 阶段4: Agent UI
9. 创建 `src/css/ai-agent-v2.css` — Agent专用样式
10. 重写 `src/js/modules/ai/ai-agent-ui.js` — 时间线UI

### 阶段5: 浮窗+设置
11. 重写 `src/js/modules/ai/ai-float-overlay.js` — 新浮窗设计
12. 重写 `src/js/modules/ai/ai-settings.js` — 新设置面板

### 阶段6: 集成测试
13. 修改 `src/index.html` — 更新所有script引用
14. 修改 `src/js/app.js` — 更新初始化逻辑
15. 全面功能测试

---

## 六、验收标准

| 指标 | 目标 |
|------|------|
| 视觉一致性 | Chat/Agent/浮窗/设置统一设计语言 |
| 流式渲染性能 | 不再全量重渲染，CPU占用降低50% |
| 消息渲染质量 | Markdown完整支持（嵌套列表、表格、代码） |
| Agent可视化 | 时间线视图清晰展示执行流程 |
| 交互流畅度 | 所有动画60fps，无卡顿 |
| 代码质量 | 状态集中管理，无散落全局变量 |
