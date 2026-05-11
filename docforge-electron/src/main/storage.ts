/**
 * DocForge Electron Plugin - 本地存储
 * 基于 JSON 文件的轻量级存储（不依赖 electron-store）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DocMetadata, SyncStatus } from '../shared/types';

export class Storage {
  private dataDir: string;
  private settingsPath: string;
  private recentFilesPath: string;
  private offlineDir: string;
  private settings: Record<string, unknown> = {};
  private recentFiles: DocMetadata[] = [];
  private initialized = false;

  constructor(userDataPath: string) {
    this.dataDir = path.join(userDataPath, 'docforge');
    this.settingsPath = path.join(this.dataDir, 'settings.json');
    this.recentFilesPath = path.join(this.dataDir, 'recent-files.json');
    this.offlineDir = path.join(this.dataDir, 'offline');
  }

  /** 初始化存储目录和文件 */
  private init(): void {
    if (this.initialized) return;
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.mkdirSync(this.offlineDir, { recursive: true });
    } catch {
      // 目录可能已存在
    }
    this.loadSettings();
    this.loadRecentFiles();
    this.initialized = true;
  }

  // ===== 设置 =====

  getSetting(key: string): unknown {
    this.init();
    return this.settings[key];
  }

  setSetting(key: string, value: unknown): void {
    this.init();
    this.settings[key] = value;
    this.saveSettings();
  }

  getAllSettings(): Record<string, unknown> {
    this.init();
    return { ...this.settings };
  }

  deleteSetting(key: string): void {
    this.init();
    delete this.settings[key];
    this.saveSettings();
  }

  // ===== 最近文件 =====

  getRecentFiles(): DocMetadata[] {
    this.init();
    return [...this.recentFiles];
  }

  addRecentFile(file: DocMetadata): void {
    this.init();
    // 移除重复项
    this.recentFiles = this.recentFiles.filter(f => f.path !== file.path);
    // 添加到头部
    this.recentFiles.unshift(file);
    // 最多保留 50 个
    if (this.recentFiles.length > 50) {
      this.recentFiles = this.recentFiles.slice(0, 50);
    }
    this.saveRecentFiles();
  }

  clearRecentFiles(): void {
    this.init();
    this.recentFiles = [];
    this.saveRecentFiles();
  }

  // ===== 离线文档 =====

  saveOfflineDoc(doc: { id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> }): void {
    this.init();
    const docPath = path.join(this.offlineDir, `${doc.id}.json`);
    try {
      const data = {
        ...doc,
        lastModified: Date.now(),
        syncStatus: 'pending' as const,
      };
      fs.writeFileSync(docPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save offline doc:', err);
    }
  }

  getOfflineDocs(): Array<{ id: string; name: string; format: string; syncStatus: string; lastModified: number }> {
    this.init();
    try {
      const files = fs.readdirSync(this.offlineDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.offlineDir, f), 'utf-8'));
          return {
            id: data.id,
            name: data.name,
            format: data.format,
            syncStatus: data.syncStatus || 'pending',
            lastModified: data.lastModified || 0,
          };
        } catch {
          return { id: f.replace('.json', ''), name: 'Unknown', format: 'txt', syncStatus: 'error', lastModified: 0 };
        }
      });
    } catch {
      return [];
    }
  }

  getOfflineDoc(id: string): { id: string; name: string; content: string; format: string; metadata?: Record<string, unknown> } | null {
    this.init();
    const docPath = path.join(this.offlineDir, `${id}.json`);
    try {
      return JSON.parse(fs.readFileSync(docPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  deleteOfflineDoc(id: string): void {
    this.init();
    const docPath = path.join(this.offlineDir, `${id}.json`);
    try {
      fs.unlinkSync(docPath);
    } catch {
      // ignore
    }
  }

  getSyncStatus(): SyncStatus {
    this.init();
    const docs = this.getOfflineDocs();
    const pending = docs.filter(d => d.syncStatus === 'pending').length;
    const synced = docs.filter(d => d.syncStatus === 'synced').length;
    const conflicts = docs.filter(d => d.syncStatus === 'conflict').length;

    return {
      online: true, // 主进程始终认为在线，渲染器自行检测
      totalDocs: docs.length,
      synced,
      pending,
      conflicts,
      lastSync: (this.getSetting('lastSyncTime') as number) || 0,
    };
  }

  // ===== 内部方法 =====

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        this.settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
      }
    } catch {
      this.settings = {};
    }
  }

  private saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  private loadRecentFiles(): void {
    try {
      if (fs.existsSync(this.recentFilesPath)) {
        this.recentFiles = JSON.parse(fs.readFileSync(this.recentFilesPath, 'utf-8'));
      }
    } catch {
      this.recentFiles = [];
    }
  }

  private saveRecentFiles(): void {
    try {
      fs.writeFileSync(this.recentFilesPath, JSON.stringify(this.recentFiles, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }
}
