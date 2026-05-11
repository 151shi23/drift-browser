# AI Agent 底层全面重构 — 执行计划

## 当前问题分析

### 现状：单页面混合架构
当前所有 AI 功能（对话 + Agent）全部耦合在 `f://ai-chat` 一个标签页中：

```
ai-chat.js（292行，巨型单体文件）
├── 纯对话逻辑（sendMessage 基础流程）
├── Agent 循环（ReAct / Plan-and-Execute / Reflexion）
├── FC 模式工具调用（87-123行，40行代码）
├── 正则模式工具调用（124-161行，38行代码）
├── Reflexion 重试逻辑（101-119行，138-155行）
├── Checkpoint 自动保存（94-98行，130-134行）
├── 执行模式分类（45-53行）
├── 计划解析集成（164-173行）
└── JSON 隐藏逻辑（178-186行）
```

**核心矛盾**：
1. 用户只想聊天时，系统仍加载全部 Agent 逻辑（工具说明、规划器、反思评估器等），token 浪费严重
2. Agent 能力被"稀释"在普通对话中，专业用户无法获得完整的 Agent 体验
3. 单一入口导致代码复杂度极高，维护困难
4. IPC 通道名称错误（上一轮修复了但暴露了更深层的架构问题）

## 重构目标

```
重构后架构：
┌─────────────────────────────────────────┐
│              共享底层模块                 │
│  ai-core.js │ ai-api.js │ ai-tools.js   │
│  ai-render.js │ ai-planner.js            │
├──────────────┬──────────────────────────┤
│  AI Chat 标签页  │   AI Agent 标签页      │
│  f://ai-chat    │   f://ai-agent        │
│                │                       │
│  ● 纯对话       │  ● 完整Agent循环       │
│  ● 无工具调用    │  ● 工具执行+重试       │
│  ● 轻量提示词    │  ● 任务规划器          │
│  ● 流式响应     │  ● Reflexion反思       │
│  ● 快捷指令     │  ● Checkpoint回滚      │
│  ● 多模型切换    │  ● 执行日志面板         │
│               │  ● MCP/Skill管理       │
└───────────────┴─────────────────────────┘
```

---

## 执行步骤

### Step 1: 新建 AI Agent 页面容器
**修改**: `src/index.html`
- 在 `#aiChatPage` 之后添加 `<div id="aiAgentPage" class="view"></div>`
- 这是新标签页的 DOM 容器

### Step 2: 注册新标签页路由
**修改**: `src/js/modules/tabs.js`
- 在 `createTab()` 函数中添加 `const isAiAgent = url === 'f://ai-agent';`
- 图标：`🤖` 或 `Ag`
- 标题：`'AI Agent'`
- 图标背景色：`'#10b981'`（绿色，区分于 AI Chat 的紫色）
- 在 `isSpecialPage` 判断中加入 `isAiAgent`
- 在 switchTab/active 切换逻辑中加入 `isAiAgent` 分支
- 在 tab 对象属性中添加 `isAiAgent: true`

**修改**: `src/js/modules/tabs.js` 的 showPage/hidePage 逻辑
- `isAiAgent` 时显示 `#aiAgentPage`，隐藏其他 view
- URL 栏显示 `f://ai-agent`

### Step 3: 创建 ai-agent.js（新文件）
**新建**: `src/js/modules/ai/ai-agent-ui.js`
这是 Agent 标签页的主模块，包含：

#### 3.1 UI 布局（init 函数）
```
┌──────────────────────────────────────────────────┐
│ 🤖 AI Agent                    [设置] [关闭]      │
├──────────┬───────────────────────────────────────┤
│ 任务列表  │  ┌─────────────────────────────┐     │
│          │  │  Agent 控制台              │     │
│ ▸ 任务1  │  │                             │     │
│ ▸ 任务2  │  │  [输入框]              [发送] │     │
│ ▸ 任务3  │  │                             │     │
│          │  │  ┌───────────────────┐      │     │
│ [新建任务]│  │  │  消息区域           │      │     │
│          │  │  │                   │      │     │
│ ─────── │  │  │  用户消息/助手回复  │      │     │
│ 执行日志  │  │  │  工具调用结果       │      │     │
│          │  │  │  执行计划步骤       │      │     │
│ ✓ file_  │  │  │                   │      │     │
│ ✓ browser │  │  └───────────────────┘      │     │
│ ✕ error  │  │                             │     │
│          │  │  [状态栏: 步骤2/5 | Plan模式] │     │
└──────────┴──────────────────────────────────────┘
```

关键 UI 元素：
- **左侧面板**：任务列表（可创建多个独立任务）、执行日志（实时工具调用记录）
- **主区域**：Agent 对话 + 工具结果 + 执行计划可视化
- **底部状态栏**：当前执行模式、步骤进度、运行时间
- **顶部操作栏**：停止执行、导出日志、查看Checkpoint

#### 3.2 Agent sendMessage（完整版）
从 ai-chat.js 中提取完整 Agent 逻辑：
- **保留**：executionMode 分类、maxRounds 设置、FC/正则双模式工具调用、Reflexion 重试、Checkpoint 自动保存、计划解析
- **新增**：执行状态可视化（步骤进度条）、工具调用实时日志、执行耗时统计
- **增强**：每轮执行前更新状态栏、工具结果显示更详细（含 meta 信息）

#### 3.3 任务管理
- 每个任务是一个独立的对话上下文（chat）
- 支持多任务并行（不同任务各自独立的状态）
- 任务状态：idle / running / paused / completed / failed
- 任务元数据：{ id, title, messages, status, createdAt, completedAt, stepsExecuted, toolsUsed }

#### 3.4 执行日志面板
- 实时记录每个工具调用的详细信息
- 格式：`[HH:mm:ss] → browser_create_tab {url:"https://..."} ✓ 1.2s`
- 支持筛选（按工具类型/成功失败）
- 支持复制单个日志条目

#### 3.5 暴露接口
```javascript
window.FBrowser.aiAgent = {
  open: openAsTab,       // 打开Agent标签页
  activate: activate,     // 激活（初始化UI）
  runTask: runTask,       // 直接运行一个任务
  stopTask: stopTask,     // 停止当前任务
  exportLog: exportLog    // 导出执行日志
};
```

### Step 4: 精简 ai-chat.js 为纯对话模式
**修改**: `src/js/modules/ai-chat.js`
将 ai-chat.js 从 292 行精简为约 120 行：

#### 4.1 移除的内容
- ❌ `classifyTaskComplexity` 调用和 `executionMode` 管理
- ❌ `maxRounds` 按 mode 设置的逻辑
- ❌ FC 模式工具调用循环（87-123行）
- ❌ 正则模式工具调用循环（124-161行）
- ❌ Reflexion 重试逻辑
- ❌ Checkpoint 自动保存
- ❌ 计划解析集成
- ❌ JSON 隐藏逻辑（纯对话不需要）

#### 4.2 保留和优化的内容
- ✅ 基础 sendMessage（单轮请求→流式响应→渲染）
- ✅ 用户手动输入工具JSON时的直接执行（第17-31行保留）
- ✅ 流式响应 onChunk 处理
- ✅ 错误处理和重试（仅网络层重试，无Agent层重试）
- ✅ 对话历史管理（createChat, switchChat等）
- ✅ UI 渲染（renderMessages, renderChatList等）

#### 4.3 精简后的 sendMessage 伪代码
```javascript
async function sendMessage(text, image) {
  // 1. 基础校验
  // 2. 处理用户手动输入的工具调用（保留）
  // 3. 创建/获取 chat，push user message
  // 4. 创建 assistant message (streaming=true)
  // 5. 单次 Api.sendRequest(chat, msgId, onChunk)  ← 不传 executionMode
  // 6. 渲染结果或错误
  // 7. 更新状态
}
```

### Step 5: 优化 AI Chat 的提示词
**修改**: `src/js/modules/ai/ai-api.js` 的 `buildSystemPrompt`
当从 AI Chat 标签页发起请求时（可通过参数控制）：
- 不包含 Layer 3（工具说明）
- 不包含 Layer 4（Few-shot 示例中的工具示例）
- 使用轻量级身份提示词（纯助手角色）
- 总 token 数减少约 60%

实现方式：
- `sendRequest` 新增 `mode` 参数：`'chat' | 'agent'`
- `'chat'` 模式下：不附加 tools 参数，不追加工具说明到 system prompt
- `'agent'` 模式下：保持现有完整逻辑

### Step 6: 优化 AI Agent 的提示词
**修改**: `src/js/modules/ai/ai-agent-ui.js`
Agent 模式使用完整版提示词：
- 6 层全量提示词
- 包含所有工具说明（按命名空间分组）
- Few-shot 示例（含工具调用示例）
- 规划模式指令（Plan-and-Execute 引导）
- 可选：根据任务类型动态调整提示词

### Step 7: 注册脚本引用
**修改**: `src/index.html`
在 ai-planner.js 之后添加：
```html
<script src="js/modules/ai/ai-agent-ui.js"></script>
```
确保加载顺序：ai-core → ai-api → ai-tools → ai-render → ai-settings → ai-planner → **ai-agent-ui** → ai-chat

### Step 8: 导航栏按钮适配
**修改**: `src/js/modules/ai-browser.js` 或相关导航逻辑
- AI 操作按钮在 AI Agent 标签页始终显示
- AI Chat 标签页不显示（或只显示基础模型切换）
- 新增 "打开 Agent" 按钮（可选，或在侧边栏入口）

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/index.html` | 修改 | 添加 `#aiAgentPage` 容器和 script 引用 |
| `src/js/modules/tabs.js` | 修改 | 注册 `f://ai-agent` 路由 |
| `src/js/modules/ai/ai-agent-ui.js` | **新建** | Agent 标签页主模块（~400行） |
| `src/js/modules/ai/ai-chat.js` | **重写** | 精简为纯对话模式（~120行） |
| `src/js/modules/ai/ai-api.js` | 微调 | sendRequest 支持 mode 参数区分 chat/agent |

## 数据兼容性

- **对话数据**：AI Chat 和 AI Agent 共享同一套 localStorage (`drift-ai-chat`)，但通过 `chat.type` 字段区分（`'chat'` vs `'agent'`）
- **配置数据**：完全共享（API Key、模型选择等）
- **Agent 配置**：Agent 专属配置（MCP服务器、技能等）仅在 Agent 标签页生效
- **向后兼容**：旧对话数据自动标记为 `'chat'` 类型

## 风险评估

1. **低风险**：共享底层模块不变，只是拆分入口
2. **中等风险**：tabs.js 路由修改需仔细测试，避免影响现有标签页
3. **需注意**：ai-chat.js 大幅删减时确保不破坏 AI Chat 的基本功能
