# AI Agent 能力全面优化 Spec

## Why
当前 Drift 浏览器内置 AI Agent 存在架构单一（仅ReAct循环）、工具调用解析不可靠、缺乏任务规划能力、上下文管理粗放、浏览器自动化效率低等问题。需要基于2025年主流AI Agent产品（Claude Computer Use、OpenAI Operator、Manus、LangGraph等）的最佳实践，系统化提升Agent核心能力。

## What Changes
- 重构Agent架构为 ReAct + Plan-and-Execute + Reflexion 混合模式
- 实现任务规划器（Task Planner），支持DAG分解和动态重规划
- 实现上下文压缩（Compaction）机制，避免长对话token溢出
- 改进浏览器自动化为 Accessibility Tree + 截图双模式
- 优化系统提示词为分层设计（身份→硬约束→工具说明→示例→输出规范）
- 优化工具命名和描述，遵循"动词+名词"模式
- 实现反思评估器（Reflexion），失败时生成改进策略
- 实现子Agent派生机制，复杂任务可并行执行
- 增强MCP集成，支持外部MCP Server动态发现
- 实现Checkpoint机制，支持关键步骤回滚

## Impact
- Affected code: `src/js/modules/ai/`（全部AI模块）, `main/ai-agent.js`, `main/ai-browser-handler.js`
- Affected capabilities: AI对话、工具调用、浏览器自动化、MCP集成、任务规划

## ADDED Requirements

### Requirement: 混合Agent架构
系统 SHALL 实现 ReAct + Plan-and-Execute + Reflexion 混合Agent架构，根据任务复杂度自动选择执行模式。

#### Scenario: 简单问答任务
- **WHEN** 用户发送简单问答（无需工具调用）
- **THEN** 直接使用即时响应模式，不进入Agent循环

#### Scenario: 多步骤工具任务
- **WHEN** 用户请求需要多步骤工具调用（如"帮我搜索XX并整理成表格"）
- **THEN** 系统先通过Plan-and-Execute生成执行计划，再逐步执行

#### Scenario: 任务执行失败
- **WHEN** 工具调用失败或结果不符合预期
- **THEN** Reflexion反思评估器分析失败原因，生成改进策略，重新尝试（最多3次）

### Requirement: 任务规划器
系统 SHALL 提供任务规划器，将复杂任务分解为可执行的步骤DAG。

#### Scenario: 复杂任务分解
- **WHEN** 用户请求复杂任务（如"帮我调研XX市场并生成报告"）
- **THEN** 规划器生成步骤列表，包含步骤描述、依赖关系、预期输出

#### Scenario: 动态重规划
- **WHEN** 执行过程中某步骤失败或产生意外结果
- **THEN** 规划器根据新信息重新规划后续步骤

### Requirement: 上下文压缩（Compaction）
系统 SHALL 实现上下文压缩机制，当对话历史接近token限制时自动摘要化。

#### Scenario: 长对话自动压缩
- **WHEN** 对话消息超过20条或总token接近模型限制
- **THEN** 系统自动将早期消息压缩为摘要，保留最近5条完整消息

#### Scenario: 工具结果截断
- **WHEN** 工具返回结果超过2000字符
- **THEN** 自动截断中间部分，保留首尾关键信息

### Requirement: 分层系统提示词
系统 SHALL 采用分层系统提示词设计：身份定义 → 硬约束 → 工具说明 → 示例 → 输出规范。

#### Scenario: 提示词构建
- **WHEN** 发送API请求
- **THEN** 系统提示词按层级组装，工具说明仅包含已启用的工具

### Requirement: 工具命名优化
系统 SHALL 将工具命名遵循"动词+名词"模式，工具描述包含使用模式和常见组合。

#### Scenario: 工具描述增强
- **WHEN** Agent需要选择工具
- **THEN** 工具名称和描述清晰表达使用场景，如 `browser_navigate` 描述为"导航到指定URL，用于打开网页、跳转页面"

### Requirement: 反思评估器
系统 SHALL 实现反思评估器，在工具调用失败时分析原因并生成改进策略。

#### Scenario: 工具调用失败反思
- **WHEN** 工具调用返回错误
- **THEN** 评估器分析错误类型（参数错误/网络错误/权限错误），生成具体改进建议注入后续请求

### Requirement: Checkpoint机制
系统 SHALL 实现Checkpoint机制，在关键操作前保存状态，支持回滚。

#### Scenario: 关键操作前保存
- **WHEN** Agent执行文件写入、删除等不可逆操作前
- **THEN** 自动保存当前对话状态快照

#### Scenario: 操作回滚
- **WHEN** 用户对Agent操作结果不满意
- **THEN** 可回滚到上一个Checkpoint继续

### Requirement: 浏览器自动化双模式
系统 SHALL 改进浏览器自动化为 Accessibility Tree（主模式）+ 截图（备选模式）双模式。

#### Scenario: 结构化页面操作
- **WHEN** Agent需要点击、输入等操作标准网页元素
- **THEN** 优先使用Accessibility Tree获取结构化数据，减少token消耗

#### Scenario: Canvas/动态内容
- **WHEN** 页面包含Canvas渲染或动态内容无法通过Accessibility Tree获取
- **THEN** 自动切换到截图+视觉模式

## MODIFIED Requirements

### Requirement: 工具调用解析
原正则匹配JSON方式 SHALL 改进为：优先FC → JSON修复解析 → 验证工具名有效性。解析结果必须验证tool名称在有效列表中，无效调用直接忽略。

### Requirement: 消息历史管理
原无限增长方式 SHALL 改为：保留最近20条消息 + 系统提示词，单条消息超4000字符自动截断，工具结果超2000字符自动截断。

### Requirement: MCP进程管理
原崩溃无法恢复 SHALL 改为：监听进程close/error事件自动清理，下次调用自动重启，限制最大5个并发进程。

## REMOVED Requirements

### Requirement: 旧版单文件AI模块
**Reason**: 已拆分为6个模块化文件（ai-core、ai-api、ai-tools、ai-render、ai-settings、ai-chat）
**Migration**: 旧ai-chat.js已重写为模块入口，所有功能由子模块提供
