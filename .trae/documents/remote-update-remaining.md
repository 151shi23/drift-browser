# 远程更新功能 - 完成剩余实现计划

## 当前状态

已完成步骤1-6：
- ✅ `main/updater.js` - 主进程更新模块
- ✅ `main.js` - 添加 initUpdater 调用
- ✅ `main/ipc-handlers.js` - 添加 8 个 updater IPC handlers
- ✅ `preload.js` - 添加 10 个 updater API + 3 个事件监听
- ✅ `src/js/modules/updater-ui.js` - 渲染进程更新 UI 模块
- ✅ `src/index.html` - 添加 updater-ui.js 脚本 + 更新 UI 元素

## 剩余步骤7：修改 settings.js 连接更新 UI

### 问题分析
1. **缺少获取版本号的 IPC**：`preload.js` 中没有 `getAppVersion` API，`ipc-handlers.js` 中也没有 `app:get-version` handler。`#aboutVersion` 元素当前显示 "版本 --"
2. **settings.js 未绑定更新 UI**：`#checkUpdateBtn`、`#autoCheckUpdateToggle`、`#updateStatusText` 均未绑定事件
3. **updater-ui.js 未初始化**：`window.FBrowser.updater.init()` 未被调用

### 具体修改

#### 1. `main/ipc-handlers.js` - 添加版本号 IPC handler
在 `registerUpdaterHandlers()` 函数中添加：
```js
ipcMain.handle('app:get-version', async () => {
  return app.getVersion();
});
```

#### 2. `preload.js` - 添加 getAppVersion API
在 `// ---- 远程更新 ----` 区域添加：
```js
getAppVersion: () => ipcRenderer.invoke('app:get-version'),
```

#### 3. `src/js/modules/settings.js` - 绑定更新 UI
在文件末尾（`initPowerModeSettings()` 调用之后，`window.FBrowser.settings` 赋值之前）添加：

```js
// ---- 远程更新设置 ----
(function initUpdaterSettings() {
  // 获取并显示版本号
  var aboutVersionEl = document.getElementById('aboutVersion');
  if (aboutVersionEl && window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then(function(ver) {
      aboutVersionEl.textContent = '版本 ' + ver;
    }).catch(function() {
      aboutVersionEl.textContent = '版本 --';
    });
  }

  // 初始化 updater UI（监听 IPC 推送事件）
  if (window.FBrowser && window.FBrowser.updater && window.FBrowser.updater.init) {
    window.FBrowser.updater.init();
  }

  // 检查更新按钮
  var checkUpdateBtn = document.getElementById('checkUpdateBtn');
  var updateStatusText = document.getElementById('updateStatusText');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async function() {
      checkUpdateBtn.disabled = true;
      checkUpdateBtn.textContent = '检查中...';
      if (updateStatusText) updateStatusText.textContent = '正在检查更新...';

      var result = await window.FBrowser.updater.manualCheck();

      checkUpdateBtn.disabled = false;
      checkUpdateBtn.textContent = '检查更新';
      if (updateStatusText) {
        if (result && result.success && !result.hasUpdate) {
          updateStatusText.textContent = result.message || '当前已是最新版本';
        } else if (result && !result.success) {
          updateStatusText.textContent = result.error || '检查更新失败';
        } else if (result && result.hasUpdate) {
          updateStatusText.textContent = '发现新版本 v' + result.release.version;
        }
      }
    });
  }

  // 自动检查开关
  var autoCheckToggle = document.getElementById('autoCheckUpdateToggle');
  if (autoCheckToggle && window.electronAPI) {
    // 加载初始状态
    if (window.electronAPI.updaterGetAutoCheck) {
      window.electronAPI.updaterGetAutoCheck().then(function(enabled) {
        autoCheckToggle.checked = !!enabled;
      });
    }
    // 切换事件
    autoCheckToggle.addEventListener('change', function() {
      if (window.electronAPI && window.electronAPI.updaterSetAutoCheck) {
        window.electronAPI.updaterSetAutoCheck(autoCheckToggle.checked);
      }
    });
  }
})();
```

### 验证步骤
1. 启动应用，进入设置 → 关于页面
2. 确认版本号正确显示（"版本 2.33.0"）
3. 点击"检查更新"按钮，确认状态文本变化
4. 切换"启动时自动检查"开关，确认状态持久化
5. 重启应用，确认自动检查开关状态保持
