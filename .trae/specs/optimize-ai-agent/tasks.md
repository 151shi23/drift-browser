# Tasks

- [x] Task 1: 实现混合Agent架构 — ReAct + Plan-and-Execute + Reflexion
  - [x] SubTask 1.1: 在 ai-api.js 中添加任务复杂度判断逻辑（简单问答→即时响应，多步骤→Plan模式）
  - [x] SubTask 1.2: 在 ai-chat.js 中实现 Plan-and-Execute 循环（规划→执行→观察→重规划）
  - [x] SubTask 1.3: 在 ai-tools.js 中实现 Reflexion 反思评估器（分析失败原因→生成改进策略→重试最多3次）
  - [x] SubTask 1.4: 在 ai-core.js 中添加执行模式状态管理（instant/react/plan/reflexion）

- [x] Task 2: 实现任务规划器
  - [x] SubTask 2.1: 创建 src/js/modules/ai/ai-planner.js — 任务分解和DAG生成
  - [x] SubTask 2.2: 实现步骤依赖关系分析和可并行步骤识别
  - [x] SubTask 2.3: 实现动态重规划（执行结果反馈后调整后续步骤）
  - [x] SubTask 2.4: 在 ai-chat.js 中集成规划器，复杂任务先规划再执行

- [x] Task 3: 实现上下文压缩（Compaction）机制
  - [x] SubTask 3.1: 在 ai-api.js 的 buildApiMessages 中实现自动摘要化（超过20条消息时压缩早期消息）
  - [x] SubTask 3.2: 实现工具结果智能截断（超过2000字符保留首尾）
  - [x] SubTask 3.3: 实现 Compaction 提示词（让AI生成对话摘要替代原始消息）

- [x] Task 4: 优化系统提示词为分层设计
  - [x] SubTask 4.1: 重构 ai-api.js 的 buildSystemPrompt 为分层架构（身份→硬约束→工具说明→示例→输出规范）
  - [x] SubTask 4.2: 工具说明仅包含已启用的工具，按命名空间分组
  - [x] SubTask 4.3: 添加 Few-shot 示例（正确使用工具的示例对话）

- [x] Task 5: 优化工具命名和描述
  - [x] SubTask 5.1: 在 ai-agent.js 中重构 TOOL_DEFINITIONS，工具名遵循"动词+名词"模式
  - [x] SubTask 5.2: 工具描述增加使用场景、参数组合建议、常见错误提示
  - [x] SubTask 5.3: 工具返回值优化为Agent友好格式（自然语言名称+关键数据）

- [x] Task 6: 实现 Checkpoint 机制
  - [x] SubTask 6.1: 在 ai-core.js 中实现对话状态快照保存/恢复
  - [x] SubTask 6.2: 在关键操作（文件写入/删除）前自动保存Checkpoint
  - [x] SubTask 6.3: 在前端添加回滚按钮，支持回到上一个Checkpoint

- [x] Task 7: 改进浏览器自动化为双模式
  - [x] SubTask 7.1: 在 ai-browser-handler.js 中实现 Accessibility Tree 提取（主模式）
  - [x] SubTask 7.2: 实现自动模式切换（标准元素用Accessibility Tree，Canvas/动态内容用截图）
  - [x] SubTask 7.3: 优化 browser_get_structure 返回格式为精简的Accessibility Tree

- [x] Task 8: 编译测试验证
  - [x] SubTask 8.1: 语法检查所有修改文件
  - [ ] SubTask 8.2: 编译打包新版本
  - [ ] SubTask 8.3: 测试AI对话基本功能
  - [ ] SubTask 8.4: 测试工具调用（FC和正则两种模式）
  - [ ] SubTask 8.5: 测试任务规划和反思功能

# Task Dependencies
- [Task 2] depends on [Task 1] (规划器需要混合架构支持)
- [Task 3] depends on [Task 1] (Compaction需要架构中的消息管理)
- [Task 4] depends on [Task 5] (提示词分层需要工具描述优化完成)
- [Task 6] depends on [Task 1] (Checkpoint需要架构状态管理)
- [Task 7] independent (浏览器自动化可独立开发)
- [Task 8] depends on [Task 1-7] (最终验证)
