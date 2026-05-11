/**
 * DocForge Electron Plugin - 本地存储
 * 基于 JSON 文件的轻量级存储（不依赖 electron-store）
 */
import type { DocMetadata, SyncStatus } from '../shared/types';
export declare class Storage {
    private dataDir;
    private settingsPath;
    private recentFilesPath;
    private offlineDir;
    private settings;
    private recentFiles;
    private initialized;
    constructor(userDataPath: string);
    /** 初始化存储目录和文件 */
    private init;
    getSetting(key: string): unknown;
    setSetting(key: string, value: unknown): void;
    getAllSettings(): Record<string, unknown>;
    deleteSetting(key: string): void;
    getRecentFiles(): DocMetadata[];
    addRecentFile(file: DocMetadata): void;
    clearRecentFiles(): void;
    saveOfflineDoc(doc: {
        id: string;
        name: string;
        content: string;
        format: string;
        metadata?: Record<string, unknown>;
    }): void;
    getOfflineDocs(): Array<{
        id: string;
        name: string;
        format: string;
        syncStatus: string;
        lastModified: number;
    }>;
    getOfflineDoc(id: string): {
        id: string;
        name: string;
        content: string;
        format: string;
        metadata?: Record<string, unknown>;
    } | null;
    deleteOfflineDoc(id: string): void;
    getSyncStatus(): SyncStatus;
    private loadSettings;
    private saveSettings;
    private loadRecentFiles;
    private saveRecentFiles;
}
//# sourceMappingURL=storage.d.ts.map