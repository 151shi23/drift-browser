# Drift 浏览器 - 远程更新功能计划

## 摘要
为 Drift 浏览器添加 GitHub Releases 远程更新检测功能。启动时自动检查 `https://github.com/151shi23/drift-browser` 的新 Release，自动下载安装包并在下载完成后弹窗提醒用户安装。用户可手动触发检查，也可在设置中关闭自动检查（默认开启）。

## 当前状态分析
- **版本号**: `package.json` 中 `version: "2.33.0"`，设置页硬编码 `版本 2.33.0`
- **打包格式**: NSIS 安装包 + Portable 便携版（electron-builder）
- **GitHub 仓库**: `151shi23/drift-browser`，公开仓库，当前无 Releases
- **主进程**: `main.js` → `ipc-handlers.js` 处理所有 IPC
- **Preload**: `preload.js` 通过 `contextBridge` 暴露 `window.electronAPI`
- **设置页**: `index.html` 中 `#section-about` 区域，`settings.js` 管理
- **通知**: `notification-manager.js` 管理网页通知，`tray.js` 系统托盘
- **无现有更新机制**: 项目未使用 electron-updater

## 技术方案

### 架构设计
```
主进程 (updater.js)          Preload (preload.js)           渲染进程 (updater-ui.js)
┌─────────────────┐         ┌──────────────────┐          ┌──────────────────┐
│ checkForUpdate() │──IPC──→│ updaterCheck()   │──调用──→│ 手动检查按钮     │
│ downloadRelease()│──IPC──→│ updaterDownload() │──调用──→│ 下载进度条       │
│ getUpdateStatus()│──IPC──→│ updaterStatus()  │──调用──→│ 状态显示         │
│                  │←─IPC──│ onUpdateAvailable │←─推送──│ 更新弹窗         │
│                  │←─IPC──│ onUpdateProgress  │←─推送──│ 下载进度         │
│                  │←─IPC──│ onUpdateDownloaded│←─推送──│ 安装提醒弹窗     │
└─────────────────┘         └──────────────────┘          └──────────────────┘
```

### 版本比较逻辑
1. 从 `package.json` 读取当前版本 `app.getVersion()`
2. 请求 `https://api.github.com/repos/151shi23/drift-browser/releases?per_page=5`
3. 过滤出非 draft、非 prerelease 的最新 Release
4. 解析 `tag_name`（如 `v2.34.0`），去掉 `v` 前缀后与当前版本比较
5. 使用 semver 比较：major > minor > patch

### 下载逻辑
1. 从 Release 的 `assets` 中找到 `.exe` 文件（优先 NSIS 安装包，其次 Portable）
2. 下载到 `%APPDATA%/f-browser/updates/` 目录
3. 下载完成后通过 IPC 通知渲染进程
4. 用户点击"安装"后，运行下载的 exe 并退出当前应用

### 更新弹窗 UI
- 使用渲染进程内 HTML/CSS 弹窗（与项目风格一致）
- 弹窗内容：新版本号、更新说明（Release body Markdown 渲染）、下载进度条、操作按钮
- 三个状态：发现更新 → 下载中 → 下载完成/安装

## 具体文件改动

### 1. 新建 `main/updater.js` — 主进程更新模块
- `checkForUpdate()`: 请求 GitHub API，比较版本，返回更新信息
- `downloadRelease(assetUrl, assetName)`: 下载安装包到本地，推送进度
- `installUpdate(exePath)`: 运行安装包并退出应用
- `getUpdateStatus()`: 返回当前更新状态（空闲/检查中/下载中/下载完成）
- `getAutoCheckEnabled() / setAutoCheckEnabled()`: 读写自动检查配置
- 启动时自动检查逻辑（延迟 5 秒，避免影响启动速度）

### 2. 修改 `main.js` — 注册更新模块
- 引入 `updater.js`
- 在 `app.whenReady()` 中调用 `initUpdater()`

### 3. 修改 `main/ipc-handlers.js` — 注册更新 IPC
- `updater:check` — 手动检查更新
- `updater:download` — 下载更新
- `updater:install` — 安装更新
- `updater:status` — 获取状态
- `updater:get-auto-check` — 获取自动检查设置
- `updater:set-auto-check` — 设置自动检查开关
- `updater:dismiss` — 忽略当前版本更新

### 4. 修改 `preload.js` — 暴露更新 API
- `updaterCheck()`
- `updaterDownload()`
- `updaterInstall()`
- `updaterStatus()`
- `updaterGetAutoCheck()`
- `updaterSetAutoCheck(enabled)`
- `updaterDismiss()`
- `onUpdateAvailable(callback)`
- `onUpdateProgress(callback)`
- `onUpdateDownloaded(callback)`

### 5. 新建 `src/js/modules/updater-ui.js` — 渲染进程更新 UI
- `init()`: 监听 IPC 推送事件
- `showUpdateDialog(releaseInfo)`: 显示更新弹窗（版本号+更新说明+下载按钮）
- `showDownloadProgress(progress)`: 更新下载进度
- `showInstallPrompt()`: 下载完成，提醒安装
- `injectUpdateStyles()`: 注入弹窗 CSS（复用项目主题变量）

### 6. 修改 `src/index.html` — 添加更新 UI 元素
- 在 `#section-about` 中添加：当前版本号（动态）、检查更新按钮、自动检查开关
- 添加更新弹窗容器 `<div id="updateDialog">`
- 引入 `updater-ui.js` 脚本

### 7. 修改 `src/js/modules/settings.js` — 设置页更新区域
- 动态显示当前版本号（从 `app.getVersion()` 获取）
- 检查更新按钮事件
- 自动检查开关事件

## 数据流

### 启动时自动检查
```
app.whenReady() → 延迟5s → updater.checkForUpdate()
  → 有新版本 → mainWin.webContents.send('update-available', releaseInfo)
  → 渲染进程 updater-ui.js 收到 → showUpdateDialog()
```

### 手动检查
```
用户点击"检查更新" → window.electronAPI.updaterCheck()
  → ipcMain 'updater:check' → checkForUpdate()
  → 返回结果 → 渲染进程显示弹窗或"已是最新版本"
```

### 下载+安装
```
用户点击"下载更新" → window.electronAPI.updaterDownload()
  → ipcMain 'updater:download' → downloadRelease()
  → 下载进度 → mainWin.send('update-progress', percent)
  → 下载完成 → mainWin.send('update-downloaded', exePath)
  → 用户点击"安装并重启" → window.electronAPI.updaterInstall()
  → ipcMain 'updater:install' → shell.openPath(exePath) + app.quit()
```

## 配置存储
- 自动检查开关: `%APPDATA%/f-browser/config.json` 中 `autoCheckUpdate: true`
- 忽略的版本: `%APPDATA%/f-browser/config.json` 中 `skippedVersion: ""`
- 下载目录: `%APPDATA%/f-browser/updates/`

## 边界情况
1. **GitHub API 限流**: 未认证 60次/小时，足够使用；失败时静默跳过
2. **网络不可用**: catch 错误，不弹窗，下次启动再试
3. **无 Releases**: 返回"当前已是最新版本"
4. **下载中断**: 保留部分文件，下次重新下载（覆盖）
5. **Portable 版本**: 下载 zip/exe 均支持，打开所在文件夹让用户手动替换
6. **版本号格式不一致**: 兼容 `v2.33.0`、`2.33.0`、`V2.33` 等格式

## 验证步骤
1. 启动应用，5秒后检查控制台是否有 GitHub API 请求日志
2. 设置页"关于"区域显示动态版本号
3. 点击"检查更新"按钮，显示"已是最新版本"（当前无 Releases）
4. 切换自动检查开关，重启后验证设置持久化
5. 手动创建一个 Release 后验证弹窗和下载流程
