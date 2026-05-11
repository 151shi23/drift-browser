/**
 * DocForge Electron Plugin - 离线存储 Hook
 * IndexedDB + 自动同步
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getDocForgeAPI } from '../lib/ipc-client';
import type { SyncStatus } from '../../shared/types';

export interface OfflineDoc {
  id: string;
  name: string;
  content: string;
  format: string;
  syncStatus: string;
  lastModified: number;
  metadata?: Record<string, unknown>;
}

export function useOffline() {
  const [docs, setDocs] = useState<OfflineDoc[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    totalDocs: 0,
    synced: 0,
    pending: 0,
    conflicts: 0,
    lastSync: 0,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const apiRef = useRef(getDocForgeAPI());

  /** 加载离线文档列表 */
  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiRef.current.getOfflineDocs();
      setDocs(list as OfflineDoc[]);
      const status = await apiRef.current.getSyncStatus();
      setSyncStatus(status);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** 保存文档到离线存储 */
  const saveDoc = useCallback(async (doc: {
    id: string;
    name: string;
    content: string;
    format: string;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await apiRef.current.saveOfflineDoc(doc);
      await loadDocs();
    } catch {
      // ignore
    }
  }, [loadDocs]);

  /** 获取离线文档内容 */
  const getDoc = useCallback(async (id: string) => {
    try {
      return await apiRef.current.getOfflineDoc(id);
    } catch {
      return null;
    }
  }, []);

  /** 删除离线文档 */
  const deleteDoc = useCallback(async (id: string) => {
    try {
      await apiRef.current.deleteOfflineDoc(id);
      await loadDocs();
    } catch {
      // ignore
    }
  }, [loadDocs]);

  /** 触发同步 */
  const syncNow = useCallback(async () => {
    try {
      const status = await apiRef.current.getSyncStatus();
      setSyncStatus(status);
    } catch {
      // ignore
    }
  }, []);

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, online: true }));
      syncNow();
    };
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, online: false }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [syncNow]);

  // 初始加载
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  return {
    docs,
    syncStatus,
    isLoading,
    loadDocs,
    saveDoc,
    getDoc,
    deleteDoc,
    syncNow,
  };
}
