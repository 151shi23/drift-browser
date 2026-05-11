/**
 * DocForge Electron Plugin - IPC 处理器
 * 注册所有主进程 IPC 通道
 */

import { ipcMain, app, nativeTheme, Notification, shell, BrowserWindow } from 'electron';
import { FileSystem } from './file-system';
import { Storage } from './storage';
import type { DocForgePluginOptions, DocMetadata, DocFormat, OpenFileResult, SaveFileResult, SyncStatus } from '../shared/types';

export class IPCHandlers {
  private fileSystem: FileSystem;
  private storage: Storage;
  private options: Required<DocForgePluginOptions>;
  private registeredChannels: string[] = [];

  constructor(fileSystem: FileSystem, storage: Storage, options: Required<DocForgePluginOptions>) {
    this.fileSystem = fileSystem;
    this.storage = storage;
    this.options = options;
  }

  register(ipc: typeof ipcMain): void {
    // ===== 文件操作 =====
    this.handle(ipc, 'docforge:open-file', async () => {
      return this.fileSystem.openFileDialog();
    });

    this.handle(ipc, 'docforge:save-file', async (_, data: { content: string; path?: string; filename?: string; format: DocFormat }) => {
      return this.fileSystem.saveFile(data.content, data.path, data.filename, data.format);
    });

    this.handle(ipc, 'docforge:save-file-as', async (_, data: { content: string; filename?: string; format: DocFormat }) => {
      return this.fileSystem.saveFileAs(data.content, data.filename, data.format);
    });

    this.handle(ipc, 'docforge:read-file', async (_, data: { path: string }) => {
      return this.fileSystem.readFile(data.path);
    });

    this.handle(ipc, 'docforge:watch-file', async (_, data: { path: string }) => {
      this.fileSystem.watchFile(data.path, (event, filePath) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(win => {
          win.webContents.send('docforge:file-changed', { event, path: filePath });
        });
      });
    });

    this.handle(ipc, 'docforge:unwatch-file', async (_, data: { path: string }) => {
      this.fileSystem.unwatchFile(data.path);
    });

    // ===== 文档管理 =====
    this.handle(ipc, 'docforge:get-recent-files', async () => {
      return this.storage.getRecentFiles();
    });

    this.handle(ipc, 'docforge:add-recent-file', async (_, data: { file: DocMetadata }) => {
      this.storage.addRecentFile(data.file);
    });

    this.handle(ipc, 'docforge:clear-recent-files', async () => {
      this.storage.clearRecentFiles();
    });

    this.handle(ipc, 'docforge:delete-file', async (_, data: { path: string }) => {
      return this.fileSystem.deleteFile(data.path);
    });

    // ===== 本地存储 =====
    this.handle(ipc, 'docforge:get-setting', async (_, data: { key: string }) => {
      return this.storage.getSetting(data.key);
    });

    this.handle(ipc, 'docforge:set-setting', async (_, data: { key: string; value: unknown }) => {
      this.storage.setSetting(data.key, data.value);
    });

    this.handle(ipc, 'docforge:get-all-settings', async () => {
      return this.storage.getAllSettings();
    });

    this.handle(ipc, 'docforge:delete-setting', async (_, data: { key: string }) => {
      this.storage.deleteSetting(data.key);
    });

    // ===== 离线存储 =====
    this.handle(ipc, 'docforge:save-offline-doc', async (_, data) => {
      this.storage.saveOfflineDoc(data.doc);
    });

    this.handle(ipc, 'docforge:get-offline-docs', async () => {
      return this.storage.getOfflineDocs();
    });

    this.handle(ipc, 'docforge:get-offline-doc', async (_, data: { id: string }) => {
      return this.storage.getOfflineDoc(data.id);
    });

    this.handle(ipc, 'docforge:delete-offline-doc', async (_, data: { id: string }) => {
      this.storage.deleteOfflineDoc(data.id);
    });

    this.handle(ipc, 'docforge:sync-status', async () => {
      return this.storage.getSyncStatus();
    });

    // ===== 协作 =====
    this.handle(ipc, 'docforge:create-room', async (_, data: { docId: string; content: string; userName: string }) => {
      const serverUrl = this.options.serverUrl;
      const wsUrl = this.options.collabWsUrl || serverUrl.replace(/^http/, 'ws') + '/ws/collab';
      try {
        const resp = await fetch(serverUrl + '/api/collab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            userId: 'electron-' + Date.now(),
            userName: data.userName,
            content: data.content,
          }),
        });
        const result = await resp.json() as { success?: boolean; code?: string; content?: string };
        if (result.success) {
          return { code: result.code || '', wsUrl };
        }
        return { code: '', wsUrl: '' };
      } catch {
        return { code: '', wsUrl: '' };
      }
    });

    this.handle(ipc, 'docforge:join-room', async (_, data: { code: string; userId: string; userName: string }) => {
      const serverUrl = this.options.serverUrl;
      const wsUrl = this.options.collabWsUrl || serverUrl.replace(/^http/, 'ws') + '/ws/collab';
      try {
        const resp = await fetch(serverUrl + '/api/collab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'join',
            code: data.code,
            userId: data.userId,
            userName: data.userName,
          }),
        });
        const result = await resp.json() as { success?: boolean; code?: string; content?: string };
        if (result.success) {
          return { success: true, wsUrl, content: result.content || '' };
        }
        return { success: false, wsUrl: '', content: '' };
      } catch {
        return { success: false, wsUrl: '', content: '' };
      }
    });

    this.handle(ipc, 'docforge:leave-room', async (_, data: { code: string; userId: string }) => {
      try {
        await fetch(this.options.serverUrl + '/api/collab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'leave',
            code: data.code,
            userId: data.userId,
          }),
        });
      } catch {
        // ignore
      }
    });

    // ===== 系统 =====
    this.handle(ipc, 'docforge:get-system-locale', async () => {
      return app.getLocale();
    });

    this.handle(ipc, 'docforge:get-system-theme', async () => {
      return nativeTheme.shouldUseDarkColors ? 'dark' as const : 'light' as const;
    });

    this.handle(ipc, 'docforge:show-notification', async (_, data: { title: string; body: string }) => {
      if (Notification.isSupported()) {
        new Notification({ title: data.title, body: data.body }).show();
      }
    });

    this.handle(ipc, 'docforge:open-external', async (_, data: { url: string }) => {
      shell.openExternal(data.url);
    });

    this.handle(ipc, 'docforge:get-app-version', async () => {
      return app.getVersion();
    });

    this.handle(ipc, 'docforge:is-electron', async () => {
      return true;
    });

    this.handle(ipc, 'docforge:get-platform', async () => {
      return process.platform as 'win32' | 'darwin' | 'linux';
    });

    // ===== 窗口操作 =====
    this.handle(ipc, 'docforge:set-title', async (_, data: { title: string }) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.setTitle(data.title);
    });

    this.handle(ipc, 'docforge:toggle-fullscreen', async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.setFullScreen(!win.isFullScreen());
    });

    this.handle(ipc, 'docforge:minimize', async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.minimize();
    });

    this.handle(ipc, 'docforge:maximize', async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      }
    });

    // ===== 主题变更事件 =====
    nativeTheme.on('updated', () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach(win => {
        win.webContents.send('docforge:theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
      });
    });
  }

  unregister(ipc: typeof ipcMain): void {
    this.registeredChannels.forEach(channel => {
      ipc.removeHandler(channel);
    });
    this.registeredChannels = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(ipc: typeof ipcMain, channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>): void {
    ipc.handle(channel, handler);
    this.registeredChannels.push(channel);
  }
}
