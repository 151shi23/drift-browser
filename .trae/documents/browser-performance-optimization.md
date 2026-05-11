# 全面提升浏览器性能 — B站全屏视频卡死修复计划

## 问题分析

### 核心问题：B站全屏视频卡死

**根本原因（按优先级排序）：**

1. **webview 缺少硬件加速属性** — `createWebview` 创建的 webview 没有启用 GPU 加速相关配置，视频解码全靠 CPU，4K视频直接卡死
2. **`process-per-site` 限制渲染进程数** — 同域名共享进程导致B站视频播放器和页面其他脚本争抢CPU时间片，全屏时进程负载过高
3. **`max-renderer-processes: 4` 太激进** — 4个进程上限导致多标签时新页面无法获得独立进程，视频页面被强制共享进程
4. **内存保护自动冻结** — `freezeDelay: 300000`（5分钟）后自动冻结后台标签，如果B站视频在后台播放会被冻结
5. **缺少崩溃/卡死恢复机制** — 没有 `crashed`/`unresponsive`/`responsive`/`gpu-process-crashed` 事件监听，卡死只能杀进程
6. **30分钟自动清理缓存** — `configureSession` 每30分钟 `clearCache()`，可能清掉B站视频缓冲区导致重新加载卡顿
7. **硬件加速设置未生效** — 设置页有硬件加速开关，但主进程没有读取配置并调用 `app.disableHardwareAcceleration()`
8. **缺少全屏优化** — 没有监听 webview 的 `enter-html-full-screen`/`leave-html-full-screen` 事件，全屏时未做性能优化

---

## 修复计划

### 步骤1：修复 Chromium 启动参数（main.js）

**问题：** `process-per-site` + `max-renderer-processes: 4` 过于激进
**修复：**
- 移除 `process-per-site`（视频站点需要独立进程）
- `max-renderer-processes` 改为 `8`（允许更多独立进程）
- 添加 GPU 相关优化参数：
  - `enable-gpu-rasterization` — GPU 光栅化
  - `enable-zero-copy` — 零拷贝减少内存拷贝
  - `ignore-gpu-blocklist` — 忽略 GPU 黑名单（某些GPU被错误禁用）
  - `enable-features=VaapiVideoDecoder` — 硬件视频解码
  - `disable-features=UseChromeOSDirectVideoDecoder` — 禁用有问题的解码器

### 步骤2：webview 创建优化（tabs.js）

**问题：** webview 缺少性能相关属性和事件监听
**修复：**
- 添加 `allowpopups` 保留
- 监听 `enter-html-full-screen` / `leave-html-full-screen` 事件
- 全屏时：冻结其他标签、禁用后台定时器、提升该标签优先级
- 退出全屏时：恢复所有标签
- 添加 `crashed` 事件监听，自动重新加载
- 添加 `unresponsive` / `responsive` 事件监听，显示卡死提示
- 添加 `gpu-process-crashed` 事件监听
- 添加 `plugin-crashed` 事件监听

### 步骤3：硬件加速设置生效（main.js + ipc-handlers.js）

**问题：** 设置页有开关但主进程未读取
**修复：**
- 在 `app.whenReady()` 前读取配置文件
- 如果 `hardwareAcceleration === false`，调用 `app.disableHardwareAcceleration()`
- 添加 IPC 处理器 `app:restart` 用于切换硬件加速后重启

### 步骤4：缓存清理策略优化（window-manager.js）

**问题：** 30分钟全量 `clearCache()` 过于暴力
**修复：**
- 改为只清理过期缓存（`clearStorageData` 带 `ages` 参数）
- 不清理媒体缓存（视频/音频缓冲区）
- 延长清理间隔到 60 分钟

### 步骤5：内存保护策略优化（tabs.js）

**问题：** 自动冻结可能冻结正在播放视频的标签
**修复：**
- 冻结前检查标签是否正在播放音频（`wv.isCurrentlyAudible()`）
- 正在播放音频的标签跳过冻结
- 全屏标签跳过冻结

### 步骤6：B站专项优化（tabs.js）

**问题：** B站视频播放器在全屏模式下与浏览器框架冲突
**修复：**
- 监听B站页面的全屏事件
- 全屏时隐藏浏览器标题栏/工具栏
- 注入B站视频播放器优化脚本（禁用弹幕动画降帧、优化Canvas渲染）

### 步骤7：GPU 进程监控与恢复（main.js + ipc-handlers.js）

**问题：** GPU 进程崩溃后无法恢复
**修复：**
- 监听 `app.on('gpu-process-crashed')` 事件
- 自动重启 GPU 进程
- 通知用户并建议降低视频质量

### 步骤8：重新编译并测试

- 编译打包新版本
- 测试B站全屏视频播放
- 测试多标签性能
- 测试硬件加速开关

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `main.js` | Chromium 启动参数优化、硬件加速配置读取、GPU崩溃监听 |
| `src/js/modules/tabs.js` | webview 全屏事件、崩溃恢复、音频检测、B站优化 |
| `main/window-manager.js` | 缓存清理策略优化 |
| `main/ipc-handlers.js` | 添加 app:restart IPC |

## 预期效果

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| B站全屏4K视频 | 卡死需杀进程 | 流畅播放 |
| GPU 视频解码 | 未启用 | 硬件加速解码 |
| GPU 进程崩溃 | 无法恢复 | 自动重启 |
| 标签页崩溃 | 无处理 | 自动重新加载 |
| 后台视频冻结 | 被误冻结 | 检测音频跳过 |
| 缓存清理 | 30分钟全量 | 60分钟智能 |
