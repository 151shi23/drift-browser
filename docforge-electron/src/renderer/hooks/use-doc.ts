/**
 * DocForge Electron Plugin - 文档 Hook
 * 管理文件打开/保存/编辑状态
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getDocForgeAPI, isElectron } from '../lib/ipc-client';
import type { DocFormat, DocMetadata } from '../../shared/types';

export interface DocState {
  /** 当前文件路径 */
  filePath: string | null;
  /** 当前文件名 */
  fileName: string | null;
  /** 当前文档格式 */
  format: DocFormat | null;
  /** 文档内容 */
  content: string;
  /** 是否已修改 */
  isDirty: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 错误信息 */
  error: string | null;
}

const initialState: DocState = {
  filePath: null,
  fileName: null,
  format: null,
  content: '',
  isDirty: false,
  isLoading: false,
  isSaving: false,
  error: null,
};

export function useDoc() {
  const [state, setState] = useState<DocState>(initialState);
  const [recentFiles, setRecentFiles] = useState<DocMetadata[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = getDocForgeAPI();

  /** 加载最近文件列表 */
  const loadRecentFiles = useCallback(async () => {
    try {
      const files = await api.getRecentFiles();
      setRecentFiles(files);
    } catch {
      // ignore
    }
  }, [api]);

  /** 打开文件 */
  const openFile = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await api.openFile();
      if (result) {
        setState({
          filePath: result.path,
          fileName: result.name,
          format: result.format as DocFormat,
          content: result.content,
          isDirty: false,
          isLoading: false,
          isSaving: false,
          error: null,
        });
        // 添加到最近文件
        await api.addRecentFile({
          id: result.path,
          path: result.path,
          name: result.name,
          format: result.format as DocFormat,
          lastOpened: Date.now(),
        });
        await loadRecentFiles();
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: String(err) }));
    }
  }, [api, loadRecentFiles]);

  /** 从路径读取文件 */
  const openFilePath = useCallback(async (path: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await api.readFile(path);
      if (result) {
        setState({
          filePath: result.path,
          fileName: result.name,
          format: result.format as DocFormat,
          content: result.content,
          isDirty: false,
          isLoading: false,
          isSaving: false,
          error: null,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false, error: '无法读取文件' }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: String(err) }));
    }
  }, [api]);

  /** 保存文件 */
  const saveFile = useCallback(async (content?: string) => {
    const saveContent = content ?? state.content;
    if (!state.filePath && !state.fileName) {
      return saveFileAs(saveContent);
    }
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      const result = await api.saveFile(saveContent, state.filePath ?? undefined, state.fileName ?? undefined, state.format ?? undefined);
      if (result.success) {
        setState(prev => ({
          ...prev,
          filePath: result.path ?? prev.filePath,
          isDirty: false,
          isSaving: false,
        }));
        // 更新窗口标题
        if (state.fileName) {
          await api.setTitle(`${state.fileName} - DocForge`);
        }
      } else {
        setState(prev => ({ ...prev, isSaving: false, error: '保存失败' }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, isSaving: false, error: String(err) }));
    }
  }, [api, state.filePath, state.fileName, state.format, state.content]);

  /** 另存为 */
  const saveFileAs = useCallback(async (content?: string) => {
    const saveContent = content ?? state.content;
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    try {
      const result = await api.saveFileAs(saveContent, state.fileName ?? undefined, state.format ?? undefined);
      if (result.success) {
        setState(prev => ({
          ...prev,
          filePath: result.path ?? prev.filePath,
          isDirty: false,
          isSaving: false,
        }));
        await loadRecentFiles();
      } else {
        setState(prev => ({ ...prev, isSaving: false }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, isSaving: false, error: String(err) }));
    }
  }, [api, state.fileName, state.format, state.content, loadRecentFiles]);

  /** 更新内容 */
  const updateContent = useCallback((newContent: string) => {
    setState(prev => ({ ...prev, content: newContent, isDirty: true }));

    // 自动保存（3秒后）
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      const settings = await api.getSetting('autoSave');
      if (settings && state.filePath) {
        await saveFile(newContent);
      }
    }, 3000);
  }, [api, state.filePath, saveFile]);

  /** 创建新文档 */
  const newDoc = useCallback((format: DocFormat = 'docx') => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setState({
      filePath: null,
      fileName: null,
      format,
      content: '',
      isDirty: false,
      isLoading: false,
      isSaving: false,
      error: null,
    });
    api.setTitle('未命名文档 - DocForge');
  }, [api]);

  /** 清除错误 */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 初始加载最近文件
  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    recentFiles,
    isElectron: isElectron(),
    openFile,
    openFilePath,
    saveFile,
    saveFileAs,
    updateContent,
    newDoc,
    loadRecentFiles,
    clearError,
  };
}
