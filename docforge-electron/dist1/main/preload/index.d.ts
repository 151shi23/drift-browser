/**
 * DocForge Electron Plugin - 预加载脚本
 * 在渲染进程中暴露安全的 API
 */
export interface DocForgeAPI {
    openFile: () => Promise<import('../shared/types').OpenFileResult | null>;
    saveFile: (content: string, path?: string, filename?: string, format?: import('../shared/types').DocFormat) => Promise<import('../shared/types').SaveFileResult>;
    saveFileAs: (content: string, filename?: string, format?: import('../shared/types').DocFormat) => Promise<import('../shared/types').SaveFileResult>;
    readFile: (path: string) => Promise<import('../shared/types').OpenFileResult | null>;
    watchFile: (path: string) => Promise<void>;
    unwatchFile: (path: string) => Promise<void>;
    deleteFile: (path: string) => Promise<boolean>;
    getRecentFiles: () => Promise<import('../shared/types').DocMetadata[]>;
    addRecentFile: (file: import('../shared/types').DocMetadata) => Promise<void>;
    clearRecentFiles: () => Promise<void>;
    getSetting: (key: string) => Promise<unknown>;
    setSetting: (key: string, value: unknown) => Promise<void>;
    getAllSettings: () => Promise<Record<string, unknown>>;
    deleteSetting: (key: string) => Promise<void>;
    saveOfflineDoc: (doc: {
        id: string;
        name: string;
        content: string;
        format: string;
        metadata?: Record<string, unknown>;
    }) => Promise<void>;
    getOfflineDocs: () => Promise<Array<{
        id: string;
        name: string;
        format: string;
        syncStatus: string;
        lastModified: number;
    }>>;
    getOfflineDoc: (id: string) => Promise<{
        id: string;
        name: string;
        content: string;
        format: string;
        metadata?: Record<string, unknown>;
    } | null>;
    deleteOfflineDoc: (id: string) => Promise<void>;
    getSyncStatus: () => Promise<import('../shared/types').SyncStatus>;
    createRoom: (docId: string, content: string, userName: string) => Promise<{
        code: string;
        wsUrl: string;
    }>;
    joinRoom: (code: string, userId: string, userName: string) => Promise<{
        success: boolean;
        wsUrl: string;
        content: string;
    }>;
    leaveRoom: (code: string, userId: string) => Promise<void>;
    getSystemLocale: () => Promise<string>;
    getSystemTheme: () => Promise<'dark' | 'light'>;
    showNotification: (title: string, body: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    getAppVersion: () => Promise<string>;
    isElectron: () => Promise<boolean>;
    getPlatform: () => Promise<'win32' | 'darwin' | 'linux'>;
    setTitle: (title: string) => Promise<void>;
    toggleFullscreen: () => Promise<void>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}
declare const api: DocForgeAPI;
export { api };
//# sourceMappingURL=index.d.ts.map