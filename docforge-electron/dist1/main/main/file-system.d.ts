/**
 * DocForge Electron Plugin - 文件系统操作
 * 原生文件对话框、读写、监视
 */
import type { DocForgePluginOptions, DocFormat, OpenFileResult, SaveFileResult } from '../shared/types';
export declare class FileSystem {
    private options;
    private watchers;
    constructor(options: Required<DocForgePluginOptions>);
    /** 打开文件对话框 */
    openFileDialog(): Promise<OpenFileResult | null>;
    /** 读取文件 */
    readFile(filePath: string): Promise<OpenFileResult | null>;
    /** 保存文件 (已知路径直接保存，否则另存为) */
    saveFile(content: string, filePath?: string, filename?: string, format?: DocFormat): Promise<SaveFileResult>;
    /** 另存为 */
    saveFileAs(content: string, filename?: string, format?: DocFormat): Promise<SaveFileResult>;
    /** 删除文件 */
    deleteFile(filePath: string): Promise<boolean>;
    /** 监视文件变更 */
    watchFile(filePath: string, callback: (event: string, path: string) => void): void;
    /** 停止监视 */
    unwatchFile(filePath: string): void;
    /** 构建文件过滤器 */
    private buildFilters;
}
//# sourceMappingURL=file-system.d.ts.map