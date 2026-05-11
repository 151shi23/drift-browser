/**
 * DocForge Electron Plugin - 主进程入口
 *
 * 使用方式:
 * ```js
 * const { DocForgePlugin } = require('docforge-electron');
 * const docforge = new DocForgePlugin({ userDataPath: app.getPath('userData') });
 * docforge.register(ipcMain);
 * ```
 */
import { ipcMain, BrowserWindow } from 'electron';
import { FileSystem } from './file-system';
import { Storage } from './storage';
import type { DocForgePluginOptions } from '../shared/types';
export declare class DocForgePlugin {
    private options;
    private fileSystem;
    private storage;
    private ipcHandlers;
    private tray;
    constructor(options: DocForgePluginOptions);
    /** 注册所有 IPC 处理器到 Electron 主进程 */
    register(ipc: typeof ipcMain): void;
    /** 注销所有 IPC 处理器 */
    unregister(ipc: typeof ipcMain): void;
    /** 创建 DocForge 窗口 */
    createWindow(parentWindow?: BrowserWindow): BrowserWindow;
    /** 创建用于嵌入到 BrowserView 的配置 */
    createBrowserViewOptions(): Electron.BrowserViewConstructorOptions;
    /** 获取预加载脚本路径 */
    getPreloadPath(): string;
    /** 获取渲染器入口路径 */
    private getRendererPath;
    /** 获取图标路径 */
    private getIconPath;
    /** 获取存储实例 (用于外部访问) */
    getStorage(): Storage;
    /** 获取文件系统实例 */
    getFileSystem(): FileSystem;
}
export type { DocForgePluginOptions, DocFormat } from '../shared/types';
export type { DocFile, DocMetadata, CollabUser, CollabRoom, OpenFileResult, SaveFileResult, SyncStatus } from '../shared/types';
//# sourceMappingURL=index.d.ts.map