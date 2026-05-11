/**
 * DocForge Electron Plugin - 文件系统操作
 * 原生文件对话框、读写、监视
 */

import { dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { DocForgePluginOptions, DocFormat, OpenFileResult, SaveFileResult } from '../shared/types';

const FORMAT_EXTENSIONS: Record<DocFormat, string[]> = {
  docx: ['docx', 'doc'],
  pdf: ['pdf'],
  md: ['md', 'markdown', 'mdown'],
  txt: ['txt', 'text'],
  html: ['html', 'htm'],
  xlsx: ['xlsx', 'xls', 'csv'],
  pptx: ['pptx', 'ppt'],
};

const EXT_TO_FORMAT: Record<string, DocFormat> = {
  docx: 'docx', doc: 'docx',
  pdf: 'pdf',
  md: 'md', markdown: 'md', mdown: 'md',
  txt: 'txt', text: 'txt',
  html: 'html', htm: 'html',
  xlsx: 'xlsx', xls: 'xlsx', csv: 'xlsx',
  pptx: 'pptx', ppt: 'pptx',
};

export class FileSystem {
  private options: Required<DocForgePluginOptions>;
  private watchers: Map<string, fs.FSWatcher> = new Map();

  constructor(options: Required<DocForgePluginOptions>) {
    this.options = options;
  }

  /** 打开文件对话框 */
  async openFileDialog(): Promise<OpenFileResult | null> {
    const filters = this.buildFilters();
    const focusedWin = BrowserWindow.getFocusedWindow();
    const dialogOpts: Electron.OpenDialogOptions = {
      title: '打开文档 - DocForge',
      properties: ['openFile'],
      filters: [...filters, { name: '所有文件', extensions: ['*'] }],
    };
    const result = focusedWin
      ? await dialog.showOpenDialog(focusedWin, dialogOpts)
      : await dialog.showOpenDialog(dialogOpts);

    if (result.canceled || !result.filePaths[0]) return null;
    return this.readFile(result.filePaths[0]);
  }

  /** 读取文件 */
  async readFile(filePath: string): Promise<OpenFileResult | null> {
    try {
      const stat = fs.statSync(filePath);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const format = EXT_TO_FORMAT[ext] || 'txt';
      const name = path.basename(filePath);
      
      // 尝试提取文本内容
      let textContent: string | undefined;
      if (['md', 'txt', 'html', 'csv'].includes(ext)) {
        textContent = buffer.toString('utf-8');
      }

      return {
        path: filePath,
        name,
        format,
        content: buffer.toString('base64'),
        textContent,
        size: stat.size,
        lastModified: stat.mtimeMs,
      };
    } catch (err) {
      console.error('Failed to read file:', err);
      return null;
    }
  }

  /** 保存文件 (已知路径直接保存，否则另存为) */
  async saveFile(content: string, filePath?: string, filename?: string, format: DocFormat = 'docx'): Promise<SaveFileResult> {
    if (filePath) {
      try {
        const buffer = Buffer.from(content, 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
    return this.saveFileAs(content, filename, format);
  }

  /** 另存为 */
  async saveFileAs(content: string, filename?: string, format: DocFormat = 'docx'): Promise<SaveFileResult> {
    const filters = this.buildFilters().filter(f => 
      FORMAT_EXTENSIONS[format]?.some(ext => f.extensions.includes(ext)) || f.name === '所有文件'
    );
    
    // 如果过滤后没有匹配的，使用默认
    const saveFilters = filters.length > 1 ? filters : this.buildFilters();

    const saveOpts: Electron.SaveDialogOptions = {
      title: '保存文档 - DocForge',
      defaultPath: filename || `untitled.${FORMAT_EXTENSIONS[format]?.[0] || format}`,
      filters: saveFilters,
    };
    const focusedWin = BrowserWindow.getFocusedWindow();
    const result = focusedWin
      ? await dialog.showSaveDialog(focusedWin, saveOpts)
      : await dialog.showSaveDialog(saveOpts);

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    try {
      const buffer = Buffer.from(content, 'base64');
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** 删除文件 */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** 监视文件变更 */
  watchFile(filePath: string, callback: (event: string, path: string) => void): void {
    if (this.watchers.has(filePath)) return;
    try {
      const watcher = fs.watch(filePath, { persistent: false }, (event, filename) => {
        callback(event, filename || filePath);
      });
      this.watchers.set(filePath, watcher);
    } catch {
      // 文件可能不存在
    }
  }

  /** 停止监视 */
  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  /** 构建文件过滤器 */
  private buildFilters(): { name: string; extensions: string[] }[] {
    const filters = [
      { name: 'Word 文档', extensions: ['docx', 'doc'] },
      { name: 'PDF 文档', extensions: ['pdf'] },
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '纯文本', extensions: ['txt'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
      { name: 'Excel 表格', extensions: ['xlsx', 'xls', 'csv'] },
      { name: '演示文稿', extensions: ['pptx', 'ppt'] },
    ];

    // 只保留支持的格式
    const supportedExts = this.options.supportedFormats.flatMap(f => FORMAT_EXTENSIONS[f] || []);
    return filters.filter(f => f.extensions.some(ext => supportedExts.includes(ext)));
  }
}
