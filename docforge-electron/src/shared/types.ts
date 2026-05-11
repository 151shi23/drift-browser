/**
 * DocForge Electron Plugin - Shared Types
 * 主进程与渲染进程共享的类型定义
 */

// ========== 文档类型 ==========

export type DocFormat = 'docx' | 'pdf' | 'md' | 'txt' | 'html' | 'xlsx' | 'pptx';

export interface DocFile {
  id: string;
  name: string;
  format: DocFormat;
  content: string; // base64 encoded
  textContent?: string; // 纯文本内容
  path?: string; // 本地文件路径
  lastModified: number;
  size: number;
  synced: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DocMetadata {
  id: string;
  name: string;
  format: DocFormat;
  path?: string;
  size?: number;
  lastModified?: number;
  lastOpened: number;
  starred?: boolean;
  tags?: string[];
}

// ========== 协作类型 ==========

export type CollabRole = 'owner' | 'editor' | 'viewer';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  role: CollabRole;
  lastSeen: number;
  cursorPos?: { line: number; column: number };
}

export interface CollabRoom {
  code: string;
  docId: string;
  createdAt: number;
  users: CollabUser[];
  content: string;
  history: CollabEvent[];
}

export interface CollabEvent {
  type: 'join' | 'leave' | 'update' | 'cursor' | 'chat';
  userId: string;
  userName: string;
  timestamp: number;
  data?: unknown;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system';
}

// ========== IPC 通道类型 ==========

export type IPCChannelMap = {
  // 文件操作
  'docforge:open-file': { args: void; result: OpenFileResult | null };
  'docforge:save-file': { args: { content: string; path?: string; filename?: string; format: DocFormat }; result: SaveFileResult };
  'docforge:save-file-as': { args: { content: string; filename?: string; format: DocFormat }; result: SaveFileResult };
  'docforge:read-file': { args: { path: string }; result: OpenFileResult | null };
  'docforge:watch-file': { args: { path: string }; result: void };
  'docforge:unwatch-file': { args: { path: string }; result: void };

  // 文档管理
  'docforge:get-recent-files': { args: void; result: DocMetadata[] };
  'docforge:add-recent-file': { args: { file: DocMetadata }; result: void };
  'docforge:clear-recent-files': { args: void; result: void };
  'docforge:delete-file': { args: { path: string }; result: boolean };

  // 本地存储
  'docforge:get-setting': { args: { key: string }; result: unknown };
  'docforge:set-setting': { args: { key: string; value: unknown }; result: void };
  'docforge:get-all-settings': { args: void; result: Record<string, unknown> };
  'docforge:delete-setting': { args: { key: string }; result: void };

  // 离线存储
  'docforge:save-offline-doc': { args: { doc: DocFile }; result: void };
  'docforge:get-offline-docs': { args: void; result: DocFile[] };
  'docforge:get-offline-doc': { args: { id: string }; result: DocFile | null };
  'docforge:delete-offline-doc': { args: { id: string }; result: void };
  'docforge:sync-status': { args: void; result: SyncStatus };

  // 协作
  'docforge:create-room': { args: { docId: string; content: string; userName: string }; result: { code: string; wsUrl: string } };
  'docforge:join-room': { args: { code: string; userId: string; userName: string }; result: { success: boolean; wsUrl: string; content: string } };
  'docforge:leave-room': { args: { code: string; userId: string }; result: void };

  // 系统
  'docforge:get-system-locale': { args: void; result: string };
  'docforge:get-system-theme': { args: void; result: 'dark' | 'light' };
  'docforge:show-notification': { args: { title: string; body: string }; result: void };
  'docforge:open-external': { args: { url: string }; result: void };
  'docforge:get-app-version': { args: void; result: string };
  'docforge:is-electron': { args: void; result: boolean };
  'docforge:get-platform': { args: void; result: 'win32' | 'darwin' | 'linux' };

  // 窗口操作
  'docforge:set-title': { args: { title: string }; result: void };
  'docforge:toggle-fullscreen': { args: void; result: void };
  'docforge:minimize': { args: void; result: void };
  'docforge:maximize': { args: void; result: void };
};

export type IPCChannel = keyof IPCChannelMap;

export interface OpenFileResult {
  path: string;
  name: string;
  format: DocFormat;
  content: string; // base64
  textContent?: string;
  size: number;
  lastModified: number;
}

export interface SaveFileResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface SyncStatus {
  online: boolean;
  totalDocs: number;
  synced: number;
  pending: number;
  conflicts: number;
  lastSync: number;
}

// ========== 编辑器类型 ==========

export type EditorMode = 'edit' | 'review' | 'readonly';

export type RightPanel = 'comments' | 'versions' | 'collaboration' | 'trackChanges' | 'outline';

export interface PageSettings {
  size: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

export interface ExportOptions {
  format: 'html' | 'txt' | 'docx' | 'pdf' | 'markdown' | 'csv';
  includeStyles?: boolean;
  includeImages?: boolean;
  quality?: number;
}

// ========== 插件配置 ==========

export interface DocForgePluginOptions {
  /** 用户数据目录路径 */
  userDataPath: string;
  /** DocForge 服务器地址 (用于云协作) */
  serverUrl?: string;
  /** 是否启用自动更新 */
  autoUpdate?: boolean;
  /** 是否启用系统托盘 */
  enableTray?: boolean;
  /** 是否启用离线模式 */
  enableOffline?: boolean;
  /** 支持的文件格式 */
  supportedFormats?: DocFormat[];
  /** 自定义文件过滤器 */
  fileFilters?: FileFilter[];
  /** 最大离线缓存大小 (MB) */
  maxCacheSize?: number;
  /** 协作服务器 WebSocket URL */
  collabWsUrl?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}
