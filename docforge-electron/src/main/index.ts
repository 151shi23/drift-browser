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

import { ipcMain, app, BrowserWindow, Tray, Menu, nativeTheme, Notification, shell } from 'electron';
import * as path from 'path';
import { IPCHandlers } from './ipc-handlers';
import { FileSystem } from './file-system';
import { Storage } from './storage';
import { DocForgeTray } from './tray';
import type { DocForgePluginOptions, DocFormat } from '../shared/types';

export class DocForgePlugin {
  private options: Required<DocForgePluginOptions>;
  private fileSystem: FileSystem;
  private storage: Storage;
  private ipcHandlers: IPCHandlers;
  private tray: DocForgeTray | null = null;

  constructor(options: DocForgePluginOptions) {
    this.options = {
      userDataPath: options.userDataPath,
      serverUrl: options.serverUrl || 'http://localhost:5000',
      autoUpdate: options.autoUpdate ?? false,
      enableTray: options.enableTray ?? true,
      enableOffline: options.enableOffline ?? true,
      supportedFormats: options.supportedFormats || ['docx', 'pdf', 'md', 'txt', 'html', 'xlsx', 'pptx'],
      fileFilters: options.fileFilters || [],
      maxCacheSize: options.maxCacheSize ?? 500,
      collabWsUrl: options.collabWsUrl || '',
    };

    this.fileSystem = new FileSystem(this.options);
    this.storage = new Storage(this.options.userDataPath);
    this.ipcHandlers = new IPCHandlers(this.fileSystem, this.storage, this.options);
  }

  /** 注册所有 IPC 处理器到 Electron 主进程 */
  register(ipc: typeof ipcMain): void {
    this.ipcHandlers.register(ipc);

    if (this.options.enableTray) {
      this.tray = new DocForgeTray();
      this.tray.create('', BrowserWindow.getAllWindows()[0]!);
    }
  }

  /** 注销所有 IPC 处理器 */
  unregister(ipc: typeof ipcMain): void {
    this.ipcHandlers.unregister(ipc);
    if (this.tray) {
      this.tray.destroy();
    }
  }

  /** 创建 DocForge 窗口 */
  createWindow(parentWindow?: BrowserWindow): BrowserWindow {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'DocForge',
      icon: this.getIconPath(),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
      parent: parentWindow || undefined,
      show: false,
    });

    // 加载渲染器
    const rendererPath = this.getRendererPath();
    win.loadFile(rendererPath);

    win.once('ready-to-show', () => {
      win.show();
    });

    // 注入配置到渲染器
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('docforge:config', {
        serverUrl: this.options.serverUrl,
        enableOffline: this.options.enableOffline,
        supportedFormats: this.options.supportedFormats,
        collabWsUrl: this.options.collabWsUrl,
        platform: process.platform,
        version: app.getVersion(),
      });
    });

    return win;
  }

  /** 创建用于嵌入到 BrowserView 的配置 */
  createBrowserViewOptions(): Electron.BrowserViewConstructorOptions {
    return {
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    };
  }

  /** 获取预加载脚本路径 */
  getPreloadPath(): string {
    return path.join(__dirname, '..', 'preload', 'index.js');
  }

  /** 获取渲染器入口路径 */
  private getRendererPath(): string {
    return path.join(__dirname, '..', 'renderer', 'index.html');
  }

  /** 获取图标路径 */
  private getIconPath(): string {
    const ext = process.platform === 'win32' ? '.ico' : '.png';
    return path.join(__dirname, '..', 'icons', `icon256${ext}`);
  }

  /** 获取存储实例 (用于外部访问) */
  getStorage(): Storage {
    return this.storage;
  }

  /** 获取文件系统实例 */
  getFileSystem(): FileSystem {
    return this.fileSystem;
  }
}

// 导出类型
export type { DocForgePluginOptions, DocFormat } from '../shared/types';
export type { DocFile, DocMetadata, CollabUser, CollabRoom, OpenFileResult, SaveFileResult, SyncStatus } from '../shared/types';
