// ==================== F 浏览器 - 安全 Preload 脚本 ====================
// 使用 contextBridge 暴露有限的 IPC API 到渲染进程主世界
// 渲染进程通过 window.electronAPI 访问所有主进程能力

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- 窗口控制 ----
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowGetBounds: () => ipcRenderer.invoke('get-window-bounds'),
  windowGetState: () => ipcRenderer.invoke('window-get-state'),
  openWindow: (url) => ipcRenderer.invoke('open-new-window', url),

  // ---- 无痕窗口 ----
  openIncognitoWindow: () => ipcRenderer.invoke('open-incognito-window'),

  // ---- 任务管理器 ----
  openTaskManager: () => ipcRenderer.invoke('open-task-manager'),

  // ---- 性能监视器 ----
  openPerformance: () => ipcRenderer.invoke('open-performance'),

  // ---- 获取主题 ----
  getTheme: () => ipcRenderer.invoke('get-theme'),

  // ---- Edge 数据导入 ----
  importEdgeData: () => ipcRenderer.invoke('import-edge-data'),

  // ---- 扩展管理 ----
  extensionsGetList: () => ipcRenderer.invoke('extensions:get-list'),
  extensionsScanBrowser: (browser) => ipcRenderer.invoke('extensions:scan-browser', browser),
  extensionsImportFromBrowser: (browser) => ipcRenderer.invoke('extensions:import-from-browser', browser),
  extensionsLoadFromFolder: () => ipcRenderer.invoke('extensions:load-from-folder'),
  extensionsToggle: (extId) => ipcRenderer.invoke('extensions:toggle', extId),
  extensionsUnload: (extId) => ipcRenderer.invoke('extensions:unload', extId),
  extensionsOpenPopup: (opts) => ipcRenderer.invoke('extensions:open-popup', opts),
  extensionsClosePopup: () => ipcRenderer.invoke('extensions:close-popup'),
  extensionsInstallFromStore: (input, store) => ipcRenderer.invoke('extensions:install-from-store', input, store),
  extensionsGetNewtabOverride: () => ipcRenderer.invoke('extensions:get-newtab-override'),
  extensionsDelete: (extId) => ipcRenderer.invoke('extensions:delete', extId),
  extensionsOpenFolder: (extId) => ipcRenderer.invoke('extensions:open-folder', extId),
  extensionsGetProxyState: () => ipcRenderer.invoke('extensions:get-proxy-state'),
  extensionsResolveProxy: (url) => ipcRenderer.invoke('extensions:resolve-proxy', url),
  onProxyStateChanged: (cb) => ipcRenderer.on('proxy-state-changed', (_, data) => cb(data)),

  // ---- 下载管理 ----
  downloadsGetList: () => ipcRenderer.invoke('downloads:get-list'),
  downloadsCancel: (id) => ipcRenderer.invoke('downloads:cancel', id),
  downloadsPause: (id) => ipcRenderer.invoke('downloads:pause', id),
  downloadsResume: (id) => ipcRenderer.invoke('downloads:resume', id),
  downloadsClear: () => ipcRenderer.invoke('downloads:clear'),
  downloadsShowInFolder: (id) => ipcRenderer.invoke('downloads:show-in-folder', id),
  downloadsSetPath: (dir) => ipcRenderer.invoke('downloads:set-path', dir),
  downloadsGetPath: () => ipcRenderer.invoke('downloads:get-path'),
  downloadsOpenDialog: () => ipcRenderer.invoke('downloads:open-dialog'),
  downloadsOpenFolder: () => ipcRenderer.invoke('downloads:open-folder'),
  downloadsOpenWindow: () => ipcRenderer.invoke('downloads:open-window'),
  downloadsIdmAvailable: () => ipcRenderer.invoke('downloads:idm-available'),

  // 下载进度监听
  onDownloadStarted: (cb) => ipcRenderer.on('download-started', (_, data) => cb(data)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, data) => cb(data)),
  onDownloadCompleted: (cb) => ipcRenderer.on('download-completed', (_, data) => cb(data)),
  onDownloadFailed: (cb) => ipcRenderer.on('download-failed', (_, data) => cb(data)),

  // ---- 会话恢复 ----
  sessionSave: (tabs) => ipcRenderer.invoke('session:save', tabs),
  sessionRestore: () => ipcRenderer.invoke('session:restore'),

  // ---- 小窗模式 ----
  openMiniWindow: (url) => ipcRenderer.invoke('open-mini-window', url),
  closeMiniWindow: () => ipcRenderer.invoke('close-mini-window'),
  onMiniWindowClosed: (cb) => ipcRenderer.on('mini-window-closed', () => cb()),
  onOpenUrlInMini: (cb) => ipcRenderer.on('open-url', (_, url) => cb(url)),

  // ---- 右键菜单 ----
  contextMenuShow: (params) => ipcRenderer.invoke('context-menu:show', params),
  onContextMenuAction: (cb) => ipcRenderer.on('context-menu:action', (_, data) => cb(data)),

  // ---- 安全 ----
  onCertificateError: (cb) => ipcRenderer.on('certificate-error', (_, data) => cb(data)),
  certificateTrust: (fingerprint, trust) => ipcRenderer.invoke('certificate:trust', { fingerprint, trust }),

  // ---- 缩放 ----
  zoomSetLevel: (tabId, level) => ipcRenderer.invoke('zoom:set-level', tabId, level),
  zoomGetLevel: (tabId) => ipcRenderer.invoke('zoom:get-level', tabId),

  // ---- 打印 ----
  printPage: () => ipcRenderer.invoke('print-page'),

  // ---- 开发工具 ----
  toggleDevTools: () => ipcRenderer.invoke('devtools-toggle'),

  // ---- 全屏切换 ----
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // ---- drift:// 协议调起 ----
  driftInvoke: (command, params) => ipcRenderer.invoke('drift:invoke', command, params),

  // ---- 认证桥接 ----
  authGetToken: (domain) => ipcRenderer.invoke('auth:get-token', domain),
  authClearToken: (domain) => ipcRenderer.invoke('auth:clear-token', domain),
  authListDomains: () => ipcRenderer.invoke('auth:list-domains'),
  onAuthLoginReady: (cb) => ipcRenderer.on('auth-login-ready', (_, data) => cb(data)),

  // ---- 应用控制 ----
  appRestart: () => ipcRenderer.invoke('app:restart'),

  // ---- webview 新窗口拦截 ----
  webviewReady: (webContentsId) => ipcRenderer.invoke('webview-ready', webContentsId),
  onWebviewOpenWindow: (cb) => ipcRenderer.on('webview-open-window', (_, url) => cb(url)),

  // ---- 任务管理器和性能 ----
  getTaskManagerData: () => ipcRenderer.invoke('get-task-manager-data'),
  getPerformanceData: () => ipcRenderer.invoke('get-performance-data'),
  switchToTab: (tabId) => ipcRenderer.send('switch-to-tab', tabId),
  closeTabById: (tabId) => ipcRenderer.send('close-tab', tabId),
  closeAllTabs: () => ipcRenderer.send('close-all-tabs'),

  // ---- 默认浏览器 ----
  isDefaultBrowser: () => ipcRenderer.invoke('is-default-browser'),
  setDefaultBrowser: () => ipcRenderer.invoke('set-default-browser'),
  onOpenExternalUrl: (cb) => ipcRenderer.on('open-external-url', (_, url) => cb(url)),

  // ---- 缓存清理 ----
  clearCache: (options) => ipcRenderer.invoke('clear-cache', options),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),

  // ---- 窗口焦点事件 ----
  onWindowBlur: (cb) => ipcRenderer.on('window-blur', cb),
  onWindowFocus: (cb) => ipcRenderer.on('window-focus', cb),

  // ---- 系统托盘 ----
  onTrayAction: (cb) => ipcRenderer.on('tray-action', (_, action, data) => cb(action, data)),
  updateTrayStatus: (enabled) => ipcRenderer.send('update-tray-status', enabled),

  // ---- AI 对话 ----
  aiChatRequest: (params) => ipcRenderer.invoke('ai-chat-request', params),
  aiGetModels: (params) => ipcRenderer.invoke('ai-get-models', params),
  aiChatStreamStart: (params) => ipcRenderer.send('ai-chat-stream-start', params),
  aiChatStreamStop: (msgId) => ipcRenderer.send('ai-chat-stream-stop', { msgId }),
  onAiStreamChunk: (cb) => ipcRenderer.on('ai-chat-stream-chunk', (_, data) => cb(data)),
  removeAiStreamListener: (cb) => ipcRenderer.removeListener('ai-chat-stream-chunk', cb),

  // ---- AI Agent ----
  aiAgentGetTools: () => ipcRenderer.invoke('ai-agent-get-tools'),
  aiAgentExecute: (params) => ipcRenderer.invoke('ai-agent-execute', params),
  aiAgentGetLog: () => ipcRenderer.invoke('ai-agent-get-log'),
  aiAgentClearLog: () => ipcRenderer.invoke('ai-agent-clear-log'),
  aiAgentMcpCall: (params) => ipcRenderer.invoke('ai-agent-mcp-call', params),
  aiAgentMcpListTools: (mcpConfig) => ipcRenderer.invoke('ai-agent-mcp-list-tools', mcpConfig),
  aiAgentSkillExecute: (params) => ipcRenderer.invoke('ai-agent-skill-execute', params),
  aiAgentSkillScanFolder: () => ipcRenderer.invoke('ai-agent-skill-scan-folder'),
  aiGetRulesFile: () => ipcRenderer.invoke('ai-get-rules-file'),

  // ---- AI 浏览器自动化 ----
  aiBrowserCreateTab: (url, options) => ipcRenderer.invoke('ai-browser-create-tab', url, options),
  aiBrowserCloseTab: (tabId) => ipcRenderer.invoke('ai-browser-close-tab', tabId),
  aiBrowserListTabs: () => ipcRenderer.invoke('ai-browser-list-tabs'),
  aiBrowserNavigate: (tabId, url) => ipcRenderer.invoke('ai-browser-navigate', tabId, url),
  aiBrowserGoBack: (tabId) => ipcRenderer.invoke('ai-browser-go-back', tabId),
  aiBrowserGoForward: (tabId) => ipcRenderer.invoke('ai-browser-go-forward', tabId),
  aiBrowserGetStructure: (tabId) => ipcRenderer.invoke('ai-browser-get-structure', tabId),
  aiBrowserGetText: (tabId) => ipcRenderer.invoke('ai-browser-get-text', tabId),
  aiBrowserClickElement: (tabId, selector) => ipcRenderer.invoke('ai-browser-click-element', tabId, selector),
  aiBrowserInputText: (tabId, selector, text) => ipcRenderer.invoke('ai-browser-input-text', tabId, selector, text),
  aiBrowserSelectOption: (tabId, selector, value) => ipcRenderer.invoke('ai-browser-select-option', tabId, selector, value),
  aiBrowserScreenshot: (tabId, options) => ipcRenderer.invoke('ai-browser-screenshot', tabId, options),
  aiBrowserMouseMove: (tabId, x, y) => ipcRenderer.invoke('ai-browser-mouse-move', tabId, x, y),
  aiBrowserMouseClick: (tabId, x, y, button) => ipcRenderer.invoke('ai-browser-mouse-click', tabId, x, y, button),
  aiBrowserScroll: (tabId, direction, amount) => ipcRenderer.invoke('ai-browser-scroll', tabId, direction, amount),
  aiBrowserSetMode: (mode) => ipcRenderer.invoke('ai-browser-set-mode', mode),
  aiBrowserGetMode: () => ipcRenderer.invoke('ai-browser-get-mode'),

  onAIBrowserScreenshot: (cb) => ipcRenderer.on('ai-browser-screenshot-update', (_, data) => cb(data)),
  onAIBrowserMouseUpdate: (cb) => ipcRenderer.on('ai-browser-mouse-update', (_, data) => cb(data)),

  // ---- DocForge 文档编辑器 ----
  docforgeOpenFile: () => ipcRenderer.invoke('docforge:open-file'),
  docforgeOpenFilePath: (filePath) => ipcRenderer.invoke('docforge:open-file-path', filePath),
  docforgeSaveFile: (opts) => ipcRenderer.invoke('docforge:save-file', opts),
  docforgeSaveFileAs: (opts) => ipcRenderer.invoke('docforge:save-file-as', opts),
  docforgeReadFile: (opts) => ipcRenderer.invoke('docforge:read-file', opts),
  docforgeGetRecentFiles: () => ipcRenderer.invoke('docforge:get-recent-files'),
  docforgeAddRecentFile: (opts) => ipcRenderer.invoke('docforge:add-recent-file', opts),
  docforgeClearRecentFiles: () => ipcRenderer.invoke('docforge:clear-recent-files'),
  docforgeGetSetting: (key) => ipcRenderer.invoke('docforge:get-setting', { key }),
  docforgeSetSetting: (key, value) => ipcRenderer.invoke('docforge:set-setting', { key, value }),
  docforgeGetAllSettings: () => ipcRenderer.invoke('docforge:get-all-settings'),
  docforgeDeleteSetting: (key) => ipcRenderer.invoke('docforge:delete-setting', { key }),
  docforgeSaveOfflineDoc: (opts) => ipcRenderer.invoke('docforge:save-offline-doc', opts),
  docforgeGetOfflineDocs: () => ipcRenderer.invoke('docforge:get-offline-docs'),
  docforgeGetOfflineDoc: (id) => ipcRenderer.invoke('docforge:get-offline-doc', { id }),
  docforgeDeleteOfflineDoc: (id) => ipcRenderer.invoke('docforge:delete-offline-doc', { id }),
  docforgeGetSyncStatus: () => ipcRenderer.invoke('docforge:sync-status'),
  docforgeDeleteFile: (opts) => ipcRenderer.invoke('docforge:delete-file', opts),
  docforgeShowNotification: (title, body) => ipcRenderer.invoke('docforge:show-notification', { title, body }),
  docforgeOnFileChanged: (cb) => ipcRenderer.on('docforge:file-changed', (_, data) => cb(data)),
  docforgeCozeRequest: (opts) => ipcRenderer.invoke('docforge:coze-request', opts),

  // ---- 自适应性能调控 (APG) ----
  onResourceMonitorUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('resource-monitor-update', handler);
    return () => ipcRenderer.removeListener('resource-monitor-update', handler);
  },
  processAdjustLimit: (level) => ipcRenderer.invoke('process-adjust-limit', level),
  processGetPartition: (url, level, tabId) => ipcRenderer.invoke('process-get-partition', url, level, tabId),
  networkSetBlockLevel: (level) => ipcRenderer.invoke('network-set-block-level', level),
  networkGetBlockedCount: () => ipcRenderer.invoke('network-get-blocked-count'),
  networkGetCurrentLevel: () => ipcRenderer.invoke('network-get-current-level'),
  onMemoryPressure: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('memory-pressure', handler);
    return () => ipcRenderer.removeListener('memory-pressure', handler);
  },
  onMemoryCritical: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('memory-critical', handler);
    return () => ipcRenderer.removeListener('memory-critical', handler);
  },
  apgGetResourceData: () => ipcRenderer.invoke('apg-get-resource-data'),
  apgSetEnabled: (enabled) => ipcRenderer.invoke('apg-set-enabled', enabled),
  apgGetStatus: () => ipcRenderer.invoke('apg-get-status'),

  // ---- 远程更新 ----
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  updaterCancelDownload: () => ipcRenderer.invoke('updater:cancel-download'),
  updaterStatus: () => ipcRenderer.invoke('updater:status'),
  updaterGetAutoCheck: () => ipcRenderer.invoke('updater:get-auto-check'),
  updaterSetAutoCheck: (enabled) => ipcRenderer.invoke('updater:set-auto-check', enabled),
  updaterDismiss: () => ipcRenderer.invoke('updater:dismiss'),
  onUpdateAvailable: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  onUpdateDownloaded: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },

  // ---- 插件系统 ----
  pluginGetList: () => ipcRenderer.invoke('plugin:get-list'),
  pluginEnable: (pluginId) => ipcRenderer.invoke('plugin:enable', pluginId),
  pluginDisable: (pluginId) => ipcRenderer.invoke('plugin:disable', pluginId),
  pluginDelete: (pluginId) => ipcRenderer.invoke('plugin:delete', pluginId),
  pluginSendMessage: (fromId, toId, channel, data) => ipcRenderer.invoke('plugin:send-message', fromId, toId, channel, data),
  pluginStorageGet: (pluginId, key) => ipcRenderer.invoke('plugin:storage-get', pluginId, key),
  pluginStorageSet: (pluginId, key, value) => ipcRenderer.invoke('plugin:storage-set', pluginId, key, value),
  pluginGetI18n: (pluginId) => ipcRenderer.invoke('plugin:get-i18n', pluginId),
  pluginOpenFolder: () => ipcRenderer.invoke('plugin:open-folder'),
  onPluginMessage: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('plugin-message', handler);
    return () => ipcRenderer.removeListener('plugin-message', handler);
  },
  onPluginDisabled: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('plugin-disabled', handler);
    return () => ipcRenderer.removeListener('plugin-disabled', handler);
  },

  // ---- 云盘存储 ----
  cloudAuthStatus: () => ipcRenderer.invoke('cloud:auth-status'),
  cloudAuthPat: (token) => ipcRenderer.invoke('cloud:auth-pat', token),
  cloudAuthOAuthStart: () => ipcRenderer.invoke('cloud:auth-oauth-start'),
  cloudAuthOAuthCallback: (code) => ipcRenderer.invoke('cloud:auth-oauth-callback', code),
  cloudLogout: () => ipcRenderer.invoke('cloud:logout'),
  cloudCreateGroup: (name, useNewRepo) => ipcRenderer.invoke('cloud:create-group', name, useNewRepo),
  cloudDeleteGroup: (groupId, deleteRepo) => ipcRenderer.invoke('cloud:delete-group', groupId, deleteRepo),
  cloudListGroups: () => ipcRenderer.invoke('cloud:list-groups'),
  cloudListFiles: (groupId, filePath) => ipcRenderer.invoke('cloud:list-files', groupId, filePath || '/'),
  cloudUpload: (groupId, localPath, remotePath, mode) => ipcRenderer.invoke('cloud:upload', groupId, localPath, remotePath, mode),
  cloudDownload: (groupId, remotePath, localPath) => ipcRenderer.invoke('cloud:download', groupId, remotePath, localPath),
  cloudDeleteFile: (groupId, filePath) => ipcRenderer.invoke('cloud:delete-file', groupId, filePath),
  cloudCreateFolder: (groupId, folderPath) => ipcRenderer.invoke('cloud:create-folder', groupId, folderPath),
  cloudShareFile: (groupId, filePath) => ipcRenderer.invoke('cloud:share-file', groupId, filePath),
  cloudSelectFolder: () => ipcRenderer.invoke('cloud:select-folder'),
  cloudSelectFile: () => ipcRenderer.invoke('cloud:select-file'),
  cloudSyncStart: (syncId) => ipcRenderer.invoke('cloud:sync-start', syncId),
  cloudSyncStatus: () => ipcRenderer.invoke('cloud:sync-status'),
  cloudAddSyncFolder: (groupId, localPath) => ipcRenderer.invoke('cloud:add-sync-folder', groupId, localPath),
  cloudRemoveSyncFolder: (syncId) => ipcRenderer.invoke('cloud:remove-sync-folder', syncId),
  cloudStorageInfo: (groupId) => ipcRenderer.invoke('cloud:storage-info', groupId),
  cloudSearchFiles: (groupId, query) => ipcRenderer.invoke('cloud:search-files', groupId, query),
  cloudFileInfo: (groupId, filePath) => ipcRenderer.invoke('cloud:file-info', groupId, filePath),
  cloudFileContent: (groupId, filePath) => ipcRenderer.invoke('cloud:file-content', groupId, filePath),
  cloudPreviewUrl: (groupId, filePath) => ipcRenderer.invoke('cloud:preview-url', groupId, filePath),

  onCloudUploadProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('cloud:upload-progress', handler);
    return () => ipcRenderer.removeListener('cloud:upload-progress', handler);
  },
  onCloudDownloadProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('cloud:download-progress', handler);
    return () => ipcRenderer.removeListener('cloud:download-progress', handler);
  },
  onCloudSyncProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('cloud:sync-progress', handler);
    return () => ipcRenderer.removeListener('cloud:sync-progress', handler);
  },
});
