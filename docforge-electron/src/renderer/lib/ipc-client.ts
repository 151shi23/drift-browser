/**
 * DocForge Electron Plugin - 渲染器 IPC 客户端
 * 在 React 应用中使用的 API 封装
 */

import type { DocFormat, OpenFileResult, SaveFileResult, DocMetadata, SyncStatus } from '../../shared/types';

/** 获取 DocForge API (从 window.docforge) */
function getAPI(): DocForgeClientAPI {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).docforge) {
    return (window as unknown as { docforge: DocForgeClientAPI }).docforge;
  }
  // 非Electron环境返回空实现
  return createFallbackAPI();
}

/** DocForge 客户端 API 接口 */
export interface DocForgeClientAPI {
  // 文件操作
  openFile(): Promise<OpenFileResult | null>;
  saveFile(content: string, path?: string, filename?: string, format?: DocFormat): Promise<SaveFileResult>;
  saveFileAs(content: string, filename?: string, format?: DocFormat): Promise<SaveFileResult>;
  readFile(path: string): Promise<OpenFileResult | null>;
  watchFile(path: string): Promise<void>;
  unwatchFile(path: string): Promise<void>;
  deleteFile(path: string): Promise<boolean>;

  // 文档管理
  getRecentFiles(): Promise<DocMetadata[]>;
  addRecentFile(file: DocMetadata): Promise<void>;
  clearRecentFiles(): Promise<void>;

  // 设置
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;
  getAllSettings(): Promise<Record<string, unknown>>;
  deleteSetting(key: string): Promise<void>;

  // 离线存储
  saveOfflineDoc(doc: { id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> }): Promise<void>;
  getOfflineDocs(): Promise<Array<{ id: string; name: string; format: string; syncStatus: string; lastModified: number }>>;
  getOfflineDoc(id: string): Promise<{ id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> } | null>;
  deleteOfflineDoc(id: string): Promise<void>;
  getSyncStatus(): Promise<SyncStatus>;

  // 协作
  createRoom(docId: string, content: string, userName: string): Promise<{ code: string; wsUrl: string }>;
  joinRoom(code: string, userId: string, userName: string): Promise<{ success: boolean; wsUrl: string; content: string }>;
  leaveRoom(code: string, userId: string): Promise<void>;

  // 系统
  getSystemLocale(): Promise<string>;
  getSystemTheme(): Promise<'dark' | 'light'>;
  showNotification(title: string, body: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  getAppVersion(): Promise<string>;
  isElectron(): Promise<boolean>;
  getPlatform(): Promise<'win32' | 'darwin' | 'linux'>;

  // 窗口
  setTitle(title: string): Promise<void>;
  toggleFullscreen(): Promise<void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;

  // 事件监听
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
}

/** 非Electron环境的回退实现 */
function createFallbackAPI(): DocForgeClientAPI {
  return {
    openFile: async () => null,
    saveFile: async () => ({ success: false }),
    saveFileAs: async () => ({ success: false }),
    readFile: async () => null,
    watchFile: async () => {},
    unwatchFile: async () => {},
    deleteFile: async () => false,
    getRecentFiles: async () => [],
    addRecentFile: async () => {},
    clearRecentFiles: async () => {},
    getSetting: async () => null,
    setSetting: async () => {},
    getAllSettings: async () => ({}),
    deleteSetting: async () => {},
    saveOfflineDoc: async () => {},
    getOfflineDocs: async () => [],
    getOfflineDoc: async () => null,
    deleteOfflineDoc: async () => {},
    getSyncStatus: async () => ({
      totalDocs: 0, synced: 0, pending: 0, conflicts: 0, lastSync: 0, online: navigator.onLine,
    }),
    createRoom: async () => ({ code: '', wsUrl: '' }),
    joinRoom: async () => ({ success: false, wsUrl: '', content: '' }),
    leaveRoom: async () => {},
    getSystemLocale: async () => navigator.language || 'zh-CN',
    getSystemTheme: async () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    showNotification: async (title: string, body: string) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    },
    openExternal: async (url: string) => { window.open(url, '_blank'); },
    getAppVersion: async () => '1.0.0',
    isElectron: async () => false,
    getPlatform: async () => 'win32',
    setTitle: async () => {},
    toggleFullscreen: async () => {},
    minimize: async () => {},
    maximize: async () => {},
    on: () => () => {},
  };
}

/** 检测是否在 Electron 环境中 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).docforge;
}

/** 获取 DocForge API 实例 */
export function getDocForgeAPI(): DocForgeClientAPI {
  return getAPI();
}

/** 默认导出 API 实例 */
const docforge = getAPI();
export default docforge;
