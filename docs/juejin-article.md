# 我用 Electron 写了一个 AI 浏览器，内置 ChatGPT 和插件系统

> 最近用 Electron 33 写了一个桌面浏览器 **Drift Browser**，分享下核心功能和架构设计。

![Drift Browser](https://github.com/151shi23/drift-browser/raw/main/assets/screenshots/hero.png)

## 🌟 为什么做这个浏览器？

市面上浏览器很多，但我想做一个**真正为开发者/AI 用户定制**的浏览器：

- 内置 AI 对话，不用切窗口
- 插件侧载机制，扩展自由度极高
- UI 要好看（WebGL 星云背景 + 电影级动画）

## 🚀 核心亮点

### 🤖 AI 集成
- **多模型支持**：ChatGPT / Claude / Gemini 一键切换
- **AI Agent**：自动化操作浏览器（填表、爬取、测试）
- **浮窗对话**：`Ctrl+Shift+A` 呼出 AI 浮窗，不离开当前页面

### 📦 侧载插件系统
这是最独特的设计——**不用重新打包就能装插件**：

```
plugins/
  my-plugin/
    drift-plugin.json   ← 清单文件
    renderer.js         ← 渲染进程逻辑
    inject.js           ← 注入到网页的脚本
```

### 🎬 开屏动画
- WebGL 星云着色器（绿色渐变极光）
- 环境粒子漂浮系统
- CSS 微光网格 + 中心辉光
- 哲学名言逐字显现动画（《中庸》+《道德经》）
- Canvas 教程遮罩（真正的透明洞 + 桥接按钮转发事件）

### 🔄 自动更新
- 监控 GitHub Releases API
- 启动后自动检查新版本
- 弹窗提醒 + 中英文自动切换
- 设置页可开关开屏动画、重播教程

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| Electron 33 | 主框架 |
| Chromium 130 | 渲染引擎 |
| WebGL 2D | 星云背景着色器 |
| Canvas API | 教程遮罩透明洞 |
| contextBridge | 安全 IPC |
| sideloading | 插件加载机制 |

## 📁 架构概览

```
┌─────────────────────────────┐
│        渲染进程 (Chromium)     │
│  index.html → tabs.js       │
│  → plugin-host.js            │
│  → ai-core.js                │
│  → updater-ui.js             │
│  → settings.js               │
└──────────┬──────────────────┘
           │ contextBridge IPC
┌──────────▼──────────────────┐
│          主进程 (Node.js)      │
│  main.js                     │
│  → ipc-handlers.js           │
│  → plugin-loader.js          │
│  → updater.js (GitHub API)   │
│  → extensions.js              │
└─────────────────────────────┘
```

## ⚡ 性能优化

- **APG 自适应性能调节器**：根据硬件自动调整渲染质量
- **标签冻结**：后台标签智能休眠，释放内存
- **进程控制**：GPU 进程隔离，崩溃不影响主进程
- **网络控制**：请求过滤、缓存策略

## 📥 下载使用

从 [Releases](https://github.com/151shi23/drift-browser/releases) 下载：

- **安装版** `Drift-Setup-2.33.1.exe` — 推荐大多数用户
- **便携版** `Drift-2.33.1.exe` — 免安装直接运行

```bash
# 或者自己构建
git clone https://github.com/151shi23/drift-browser.git
cd drift-browser
npm install
npm start
```

## 🔗 相关链接

- **GitHub**: [https://github.com/151shi23/drift-browser](https://github.com/151shi23/drift-browser)
- **Releases**: [https://github.com/151shi23/drift-browser/releases](https://github.com/151shi23/drift-browser/releases)
- **Issue / Feature Request**: 欢迎提 Issue！

---

如果觉得有意思，欢迎 **Star ⭐** 支持！也欢迎 fork 二次开发。

#前端 #Electron #AI #开源 #桌面应用 #JavaScript #Chromium #浏览器 #ChatGPT
