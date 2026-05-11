# TODO - AI 浏览器自动化系统待办事项

## 需要用户配置/确认的事项

### 1. 标签页创建方式适配
- **问题**: `ai-browser-handler.js` 中通过 `window.FBrowser.tabs.createTab()` 创建标签页，需要确认 `tabs.js` 中 `createTab` 方法是否存在且参数兼容
- **位置**: `main/ai-browser-handler.js` 第 112-118 行
- **操作指引**: 检查 `src/js/modules/tabs.js` 中 `createTab` 方法的签名，确保接受 URL 参数并返回包含 `id` 和 `webview` 属性的对象

### 2. webContentsId 获取时机
- **问题**: webview 标签页创建后，`getWebContentsId()` 可能需要等待 `did-attach-webview` 事件后才能获取
- **位置**: `main/ai-browser-handler.js` 第 122-136 行
- **操作指引**: 如果标签页创建后 webContentsId 始终为 null，需要在 tabs.js 中添加 `did-attach-webview` 事件回调来通知主进程

### 3. AI 代理标签页视觉标识
- **问题**: 当前 AI 代理标签页在标签栏没有特殊视觉区分
- **位置**: `src/js/modules/tabs.js`（需修改）
- **操作指引**: 在 tabs.js 的标签页渲染逻辑中，检查 `tab.isAiProxy` 属性，添加 AI 图标或特殊颜色标识

### 4. 全页面截图
- **问题**: 当前仅实现可视区域截图，全页面截图（fullPage）需要滚动拼接
- **位置**: `main/ai-browser-handler.js` screenshot handler
- **操作指引**: 后续可添加全页面截图支持，通过注入脚本获取页面高度，分多次截图拼接

### 5. AI-SMP 功能
- **问题**: 设计文档提到的 AI-SMP（Smart Mouse Pointer）功能暂未实现
- **操作指引**: 作为后续增强功能，需要在 webview 内注入智能鼠标指针脚本

### 6. 运行时验证
- **问题**: 代码已通过语法检查，但尚未在 Electron 运行时中实际测试
- **操作指引**: 启动应用 `npm start`，打开 AI 聊天，尝试让 AI 执行 `browser_create_tab` 工具
