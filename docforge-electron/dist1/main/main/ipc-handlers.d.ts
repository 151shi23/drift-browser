/**
 * DocForge Electron Plugin - IPC 处理器
 * 注册所有主进程 IPC 通道
 */
import { ipcMain } from 'electron';
import { FileSystem } from './file-system';
import { Storage } from './storage';
import type { DocForgePluginOptions } from '../shared/types';
export declare class IPCHandlers {
    private fileSystem;
    private storage;
    private options;
    private registeredChannels;
    constructor(fileSystem: FileSystem, storage: Storage, options: Required<DocForgePluginOptions>);
    register(ipc: typeof ipcMain): void;
    unregister(ipc: typeof ipcMain): void;
    private handle;
}
//# sourceMappingURL=ipc-handlers.d.ts.map