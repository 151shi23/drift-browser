/**
 * DocForge Electron Plugin - 预加载脚本
 * 在渲染进程中暴露安全的 API
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface DocForgeAPI {
  // 文件操作
  openFile: () => Promise<import('../shared/types').OpenFileResult | null>;
  saveFile: (content: string, path?: string, filename?: string, format?: import('../shared/types').DocFormat) => Promise<import('../shared/types').SaveFileResult>;
  saveFileAs: (content: string, filename?: string, format?: import('../shared/types').DocFormat) => Promise<import('../shared/types').SaveFileResult>;
  readFile: (path: string) => Promise<import('../shared/types').OpenFileResult | null>;
  watchFile: (path: string) => Promise<void>;
  unwatchFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<boolean>;

  // 文档管理
  getRecentFiles: () => Promise<import('../shared/types').DocMetadata[]>;
  addRecentFile: (file: import('../shared/types').DocMetadata) => Promise<void>;
  clearRecentFiles: () => Promise<void>;

  // 设置
  getSetting: (key: string) => Promise<unknown>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getAllSettings: () => Promise<Record<string, unknown>>;
  deleteSetting: (key: string) => Promise<void>;

  // 离线存储
  saveOfflineDoc: (doc: { id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> }) => Promise<void>;
  getOfflineDocs: () => Promise<Array<{ id: string; name: string; format: string; syncStatus: string; lastModified: number }>>;
  getOfflineDoc: (id: string) => Promise<{ id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> } | null>;
  deleteOfflineDoc: (id: string) => Promise<void>;
  getSyncStatus: () => Promise<import('../shared/types').SyncStatus>;

  // 协作
  createRoom: (docId: string, content: string, userName: string) => Promise<{ code: string; wsUrl: string }>;
  joinRoom: (code: string, userId: string, userName: string) => Promise<{ success: boolean; wsUrl: string; content: string }>;
  leaveRoom: (code: string, userId: string) => Promise<void>;

  // 系统
  getSystemLocale: () => Promise<string>;
  getSystemTheme: () => Promise<'dark' | 'light'>;
  showNotification: (title: string, body: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  isElectron: () => Promise<boolean>;
  getPlatform: () => Promise<'win32' | 'darwin' | 'linux'>;

  // 窗口
  setTitle: (title: string) => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;

  // 事件监听
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

const api: DocForgeAPI = {
  // 文件操作
  openFile: () => ipcRenderer.invoke('docforge:open-file'),
  saveFile: (content, filePath?, filename?, format?) => 
    ipcRenderer.invoke('docforge:save-file', { content, path: filePath, filename, format }),
  saveFileAs: (content, filename?, format?) => 
    ipcRenderer.invoke('docforge:save-file-as', { content, filename, format }),
  readFile: (filePath) => ipcRenderer.invoke('docforge:read-file', { path: filePath }),
  watchFile: (filePath) => ipcRenderer.invoke('docforge:watch-file', { path: filePath }),
  unwatchFile: (filePath) => ipcRenderer.invoke('docforge:unwatch-file', { path: filePath }),
  deleteFile: (filePath) => ipcRenderer.invoke('docforge:delete-file', { path: filePath }),

  // 文档管理
  getRecentFiles: () => ipcRenderer.invoke('docforge:get-recent-files'),
  addRecentFile: (file) => ipcRenderer.invoke('docforge:add-recent-file', { file }),
  clearRecentFiles: () => ipcRenderer.invoke('docforge:clear-recent-files'),

  // 设置
  getSetting: (key) => ipcRenderer.invoke('docforge:get-setting', { key }),
  setSetting: (key, value) => ipcRenderer.invoke('docforge:set-setting', { key, value }),
  getAllSettings: () => ipcRenderer.invoke('docforge:get-all-settings'),
  deleteSetting: (key) => ipcRenderer.invoke('docforge:delete-setting', { key }),

  // 离线存储
  saveOfflineDoc: (doc) => ipcRenderer.invoke('docforge:save-offline-doc', { doc }),
  getOfflineDocs: () => ipcRenderer.invoke('docforge:get-offline-docs'),
  getOfflineDoc: (id) => ipcRenderer.invoke('docforge:get-offline-doc', { id }),
  deleteOfflineDoc: (id) => ipcRenderer.invoke('docforge:delete-offline-doc', { id }),
  getSyncStatus: () => ipcRenderer.invoke('docforge:sync-status'),

  // 协作
  createRoom: (docId, content, userName) => 
    ipcRenderer.invoke('docforge:create-room', { docId, content, userName }),
  joinRoom: (code, userId, userName) => 
    ipcRenderer.invoke('docforge:join-room', { code, userId, userName }),
  leaveRoom: (code, userId) => 
    ipcRenderer.invoke('docforge:leave-room', { code, userId }),

  // 系统
  getSystemLocale: () => ipcRenderer.invoke('docforge:get-system-locale'),
  getSystemTheme: () => ipcRenderer.invoke('docforge:get-system-theme'),
  showNotification: (title, body) => ipcRenderer.invoke('docforge:show-notification', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('docforge:open-external', { url }),
  getAppVersion: () => ipcRenderer.invoke('docforge:get-app-version'),
  isElectron: () => ipcRenderer.invoke('docforge:is-electron'),
  getPlatform: () => ipcRenderer.invoke('docforge:get-platform'),

  // 窗口
  setTitle: (title) => ipcRenderer.invoke('docforge:set-title', { title }),
  toggleFullscreen: () => ipcRenderer.invoke('docforge:toggle-fullscreen'),
  minimize: () => ipcRenderer.invoke('docforge:minimize'),
  maximize: () => ipcRenderer.invoke('docforge:maximize'),

  // 事件监听
  on: (channel, callback) => {
    const fullChannel = channel.startsWith('docforge:') ? channel : `docforge:${channel}`;
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(fullChannel, handler);
    return () => ipcRenderer.removeListener(fullChannel, handler);
  },
};

// 暴露到 window.docforge
contextBridge.exposeInMainWorld('docforge', api);

// 也导出类型供 TypeScript 使用
export { api };
