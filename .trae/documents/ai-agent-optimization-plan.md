# AI Agent 能力全面优化 — 执行计划

## 当前进度分析

### 已完成（上一轮实施）
| 任务 | 状态 | 说明 |
|------|------|------|
| Task 1: 混合Agent架构 | ✅ 已完成 | ai-core.js（执行模式状态）、ai-api.js（classifyTaskComplexity）、ai-tools.js（reflexionEvaluate/applyReflexionStrategy）、ai-chat.js（Plan-and-Execute循环+Reflexion集成） |
| Task 5: 工具命名优化 | ✅ 已完成 | ai-agent.js TOOL_DEFINITIONS 描述增强，ai-tools.js VALID_TOOLS 更新 |

### 待完成
| 任务 | 优先级 | 依赖 |
|------|--------|------|
| Task 7: 浏览器双模式 | 高 | 无（独立） |
| Task 2: 任务规划器 | 高 | Task 1 ✅ |
| Task 3: 上下文压缩 | 高 | Task 1 ✅ |
| Task 4: 分层系统提示词 | 中 | Task 5 ✅ |
| Task 6: Checkpoint机制 | 中 | Task 1 ✅ |
| Task 8: 编译测试 | 中 | Task 1-7 |

---

## 执行步骤

### 第一批：并行实施（3个独立任务）

#### Step 1: Task 7 — 浏览器自动化双模式
**文件**: `main/ai-browser-handler.js`
**修改内容**:
1. 添加 `ACCESSIBILITY_TREE_SCRIPT` — 提取精简的 Accessibility Tree
   - 只提取可交互元素（button/link/input/select/textarea/[role]）
   - 每个元素返回：`{ role, name, selector, boundingBox }`
   - 相比DOM提取减少约60% token消耗
2. 添加 `CANVAS_DETECT_SCRIPT` — 检测页面Canvas占比
3. 修改 `ai-browser-get-structure` handler：
   - 先执行 Canvas 检测
   - Canvas 占比 > 50% → 返回 `mode: 'screenshot'` + 提示信息
   - 否则 → 执行 Accessibility Tree 提取，返回 `mode: 'a11y'`
   - 保留 DOM_EXTRACTOR_SCRIPT 作为 fallback
4. 新返回格式：
   ```js
   { mode: 'a11y'|'screenshot', url, title, viewport, tree: [...], meta: { elementCount, hasCanvas, canvasRatio } }
   ```

**文件**: `src/js/modules/ai/ai-tools.js`
- executeToolCall 中 browser_get_structure 结果处理适配新格式

#### Step 2: Task 2 — 任务规划器
**新建文件**: `src/js/modules/ai/ai-planner.js`
**功能**:
1. `decomposeTask(userMessage, chatHistory)` — 将复杂任务分解为步骤列表
   - 返回 `{ steps: [{ id, description, toolHint, dependsOn, status }], dag: {...} }`
   - 基于关键词和工具匹配生成步骤
2. `analyzeDependencies(steps)` — 分析步骤间依赖关系
   - 识别可并行步骤（无依赖关系）
   - 生成 DAG 邻接表
3. `replanAfterFailure(steps, failedStepId, error)` — 动态重规划
   - 标记失败步骤
   - 调整后续步骤
   - 返回更新后的步骤列表
4. `getNextExecutableSteps(steps)` — 获取下一批可执行步骤
   - 返回所有依赖已满足且未执行的步骤

**修改文件**: `src/js/modules/ai-chat.js`
- 在 plan 模式下，首次请求后解析AI返回的计划
- 将计划存入 executionMeta.plan
- 逐步执行每个步骤

#### Step 3: Task 3 — 上下文压缩（Compaction）
**修改文件**: `src/js/modules/ai/api.js`
1. 修改 `buildApiMessages`：
   - 当消息超过20条时，将前 N-5 条消息压缩为摘要
   - 摘要格式：`[对话摘要] 用户询问了X，AI回答了Y，使用了Z工具...`
   - 保留最近5条完整消息
2. 修改 `truncateContent`：
   - 工具结果超过2000字符时，保留首尾各800字符，中间用 `[已截断，原始长度: N字符]` 替代
3. 添加 `compactMessages(messages)` 函数：
   - 将早期消息合并为摘要消息
   - 摘要消息 role='system'，content 以 `[对话历史摘要]` 开头
   - 保留关键信息：用户意图、AI关键结论、工具调用结果摘要

---

### 第二批：依赖任务（2个并行任务）

#### Step 4: Task 4 — 分层系统提示词
**修改文件**: `src/js/modules/ai/api.js`
1. 重构 `buildSystemPrompt` 为分层架构：
   ```
   Layer 1: 身份定义（SYSTEM_RULES.identity）
   Layer 2: 硬约束（SYSTEM_RULES.safety + behavior）
   Layer 3: 工具说明（仅已启用工具，按命名空间分组：文件/系统/浏览器）
   Layer 4: Few-shot 示例（正确使用工具的示例对话）
   Layer 5: 输出规范（SYSTEM_RULES.format + quality + optimization）
   Layer 6: 自定义规则 + 用户指令
   ```
2. 工具说明按命名空间分组：
   - 📁 文件操作：file_read, file_write, file_list, file_mkdir, file_delete, file_move
   - 💻 系统操作：system_info, process_list, shell_exec, app_launch, app_open_url
   - 📋 剪贴板：clipboard_read, clipboard_write
   - 🌐 浏览器自动化：browser_*
3. 添加 Few-shot 示例：
   - 示例1：读取文件 → `{"tool":"file_read","params":{"path":"..."}}`
   - 示例2：浏览器操作 → 先 create_tab → get_structure → click
   - 示例3：多步骤任务 → 先规划再执行

#### Step 5: Task 6 — Checkpoint 机制
**修改文件**: `src/js/modules/ai/ai-core.js`
1. 添加 Checkpoint 存储：
   - `CHECKPOINT_KEY = 'drift-ai-checkpoints'`
   - `saveCheckpoint(chatId, label)` — 保存当前对话状态快照
   - `loadCheckpoints(chatId)` — 加载对话的检查点列表
   - `restoreCheckpoint(chatId, checkpointId)` — 恢复到指定检查点
2. Checkpoint 数据结构：
   ```js
   { id, chatId, label, messages: [...], timestamp, executionMode, executionMeta }
   ```
3. 每个对话最多保存5个检查点，超出时删除最旧的

**修改文件**: `src/js/modules/ai/ai-chat.js`
- 在执行高风险工具（file_write, file_delete, shell_exec）前自动保存 Checkpoint
- 标签格式：`操作前: file_write xxx` 或 `操作前: file_delete xxx`

**修改文件**: `src/js/modules/ai/ai-render.js`
- 在工具消息旁添加"回滚"按钮
- 点击后恢复到该工具调用前的 Checkpoint

---

### 第三批：验证

#### Step 6: Task 8 — 编译测试验证
1. 语法检查所有修改文件（Node.js --check）
2. 编译打包新版本
3. 功能验证清单：
   - AI对话基本功能
   - 工具调用（FC和正则两种模式）
   - 任务规划（plan模式触发和执行）
   - 反思重试（工具失败后自动重试）
   - 浏览器双模式（Accessibility Tree + 截图切换）
   - 上下文压缩（长对话自动摘要）
   - Checkpoint回滚

---

## 实施顺序图

```
第一批（并行）:
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │ Task 7: 浏览器   │  │ Task 2: 规划器   │  │ Task 3: 压缩     │
  │ 双模式           │  │ ai-planner.js    │  │ Compaction       │
  └─────────────────┘  └─────────────────┘  └─────────────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
第二批（并行）:
  ┌─────────────────┐  ┌─────────────────┐
  │ Task 4: 分层     │  │ Task 6: Checkpt  │
  │ 系统提示词       │  │ 机制             │
  └─────────────────┘  └─────────────────┘
          │                     │
          └─────────────────────┘
                                │
第三批:
  ┌─────────────────┐
  │ Task 8: 编译测试  │
  └─────────────────┘
```

## 风险和注意事项

1. **ES5 兼容性**：所有前端 JS 必须使用 var/function，不能使用 let/const/箭头函数
2. **向后兼容**：工具名保持不变，只增强描述；新功能通过 executionMode 控制，默认不影响现有行为
3. **Token 预算**：分层提示词需要控制总长度，工具说明按需包含
4. **浏览器模式切换**：Accessibility Tree 提取失败时自动 fallback 到 DOM 提取
5. **Checkpoint 存储**：使用 localStorage，注意单条消息大小限制
