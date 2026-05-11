/**
 * DocForge Electron Plugin - 协作 Hook
 * WebSocket 实时协作 + 离线降级
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getDocForgeAPI } from '../lib/ipc-client';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
}

export interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  roomCode: string | null;
  userId: string;
  userName: string;
  users: CollabUser[];
  chatMessages: ChatMessage[];
  error: string | null;
}

export function useCollab() {
  const [state, setState] = useState<CollabState>({
    isConnected: false,
    isConnecting: false,
    roomCode: null,
    userId: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userName: '用户',
    users: [],
    chatMessages: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiRef = useRef(getDocForgeAPI());
  const roomCodeRef = useRef<string | null>(null);

  /** 连接 WebSocket */
  const connectWS = useCallback((wsUrl: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'pong':
            break;
          case 'user-joined':
            setState(prev => ({
              ...prev,
              users: [...prev.users.filter((u: CollabUser) => u.id !== msg.user.id), msg.user],
            }));
            break;
          case 'user-left':
            setState(prev => ({
              ...prev,
              users: prev.users.filter((u: CollabUser) => u.id !== msg.userId),
            }));
            break;
          case 'users-list':
            setState(prev => ({ ...prev, users: msg.users }));
            break;
          case 'content-update':
            apiRef.current.showNotification('文档更新', `${msg.userName || '协作者'} 更新了文档`);
            break;
          case 'cursor-move':
            setState(prev => ({
              ...prev,
              users: prev.users.map((u: CollabUser) =>
                u.id === msg.userId ? { ...u, cursor: msg.cursor } : u
              ),
            }));
            break;
          case 'chat-message':
            setState(prev => ({
              ...prev,
              chatMessages: [...prev.chatMessages, {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: msg.userId,
                userName: msg.userName,
                content: msg.content,
                timestamp: msg.timestamp || Date.now(),
              }],
            }));
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      reconnectTimerRef.current = setTimeout(() => {
        if (roomCodeRef.current) {
          connectWS(wsUrl);
        }
      }, 3000);
    };

    ws.onerror = () => {
      setState(prev => ({ ...prev, error: '连接错误', isConnecting: false }));
    };

    wsRef.current = ws;
  }, []);

  /** 创建协作房间 */
  const createRoom = useCallback(async (docId: string, content: string, userName: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null, userName }));
    try {
      const result = await apiRef.current.createRoom(docId, content, userName);
      if (result.code && result.wsUrl) {
        roomCodeRef.current = result.code;
        setState(prev => ({ ...prev, roomCode: result.code }));
        connectWS(result.wsUrl);
        return result.code;
      }
      return null;
    } catch (err) {
      setState(prev => ({ ...prev, isConnecting: false, error: String(err) }));
      return null;
    }
  }, [connectWS]);

  /** 加入协作房间 */
  const joinRoom = useCallback(async (code: string, userName: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null, userName }));
    try {
      const userId = state.userId;
      const result = await apiRef.current.joinRoom(code, userId, userName);
      if (result.success && result.wsUrl) {
        roomCodeRef.current = code;
        setState(prev => ({ ...prev, roomCode: code }));
        connectWS(result.wsUrl);
        return result.content;
      }
      setState(prev => ({ ...prev, isConnecting: false, error: '加入失败' }));
      return null;
    } catch (err) {
      setState(prev => ({ ...prev, isConnecting: false, error: String(err) }));
      return null;
    }
  }, [state.userId, connectWS]);

  /** 离开房间 */
  const leaveRoom = useCallback(async () => {
    const code = roomCodeRef.current;
    const userId = state.userId;
    if (code) {
      try {
        await apiRef.current.leaveRoom(code, userId);
      } catch {
        // ignore
      }
      roomCodeRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      roomCode: null,
      users: [],
      chatMessages: [],
    }));
  }, [state.userId]);

  /** 发送文档更新 */
  const sendUpdate = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'content-update',
        content,
        userId: state.userId,
        userName: state.userName,
        timestamp: Date.now(),
      }));
    }
  }, [state.userId, state.userName]);

  /** 发送光标位置 */
  const sendCursor = useCallback((cursor: { line: number; column: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor-move',
        userId: state.userId,
        cursor,
        timestamp: Date.now(),
      }));
    }
  }, [state.userId]);

  /** 发送聊天消息 */
  const sendChat = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        userId: state.userId,
        userName: state.userName,
        content,
        timestamp: Date.now(),
      }));
    }
  }, [state.userId, state.userName]);

  // 清理
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    leaveRoom,
    sendUpdate,
    sendCursor,
    sendChat,
  };
}
