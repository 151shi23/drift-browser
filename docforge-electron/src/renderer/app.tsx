/**
 * DocForge Electron Plugin - 渲染器主应用
 * Word/PDF编辑 + 云协作 + 离线支持
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useDoc } from './hooks/use-doc';
import { useCollab } from './hooks/use-collab';
import { useOffline } from './hooks/use-offline';
import { isElectron } from './lib/ipc-client';
import type { DocFormat, DocMetadata } from '../shared/types';

// ==================== 格式图标映射 ====================
const FORMAT_ICONS: Record<string, string> = {
  docx: '📝',
  pdf: '📄',
  md: '📋',
  txt: '📃',
  html: '🌐',
  xlsx: '📊',
  pptx: '📽️',
};

const FORMAT_LABELS: Record<string, string> = {
  docx: 'Word 文档',
  pdf: 'PDF 文档',
  md: 'Markdown',
  txt: '纯文本',
  html: 'HTML',
  xlsx: 'Excel 表格',
  pptx: '演示文稿',
};

// ==================== 主应用组件 ====================
function DocForgeApp() {
  const doc = useDoc();
  const collab = useCollab();
  const offline = useOffline();

  const [activeTab, setActiveTab] = useState<'home' | 'editor' | 'collab' | 'settings'>('home');
  const [collabCode, setCollabCode] = useState('');
  const [collabUserName, setCollabUserName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [pdfScale, setPdfScale] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ==================== 文件操作 ====================
  const handleOpenFile = useCallback(async () => {
    await doc.openFile();
    if (doc.format) {
      setActiveTab('editor');
    }
  }, [doc]);

  const handleNewDoc = useCallback((format: DocFormat) => {
    doc.newDoc(format);
    setActiveTab('editor');
  }, [doc]);

  const handleSave = useCallback(async () => {
    await doc.saveFile();
  }, [doc]);

  const handleSaveAs = useCallback(async () => {
    await doc.saveFileAs();
  }, [doc]);

  const handleExport = useCallback(async (format: string) => {
    if (!doc.content) return;
    try {
      const filename = (doc.fileName ?? '未命名') + '.' + format;
      const result = await doc.saveFileAs();
      setShowExport(false);
    } catch (err) {
      console.error('导出失败:', err);
    }
  }, [doc]);

  // ==================== 协作操作 ====================
  const handleCreateRoom = useCallback(async () => {
    const userName = collabUserName || '用户' + Math.floor(Math.random() * 1000);
    await collab.createRoom(doc.filePath || doc.fileName || 'untitled', doc.content, userName);
  }, [collab, doc.filePath, doc.fileName, doc.content, collabUserName]);

  const handleJoinRoom = useCallback(async () => {
    if (!collabCode.trim()) return;
    const userName = collabUserName || '用户' + Math.floor(Math.random() * 1000);
    await collab.joinRoom(collabCode.trim().toUpperCase(), userName);
  }, [collab, collabCode, collabUserName]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    collab.sendChat(chatInput.trim());
    setChatInput('');
  }, [collab, chatInput]);

  const handleLeaveRoom = useCallback(async () => {
    await collab.leaveRoom();
    setCollabCode('');
  }, [collab]);

  // ==================== 文件拖拽 ====================
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() as DocFormat;
      if (ext && FORMAT_ICONS[ext]) {
        const text = await file.text();
        doc.updateContent(text);
        setActiveTab('editor');
      }
    };
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [doc]);

  // ==================== 快捷键 ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSaveAs();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setViewMode(prev => prev === 'edit' ? 'preview' : 'edit');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenFile, handleSave, handleSaveAs]);

  // ==================== 自动滚动聊天 ====================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [collab.chatMessages]);

  // ==================== 渲染 ====================
  const isPdf = doc.format === 'pdf';
  const isOnline = offline.syncStatus?.online ?? navigator.onLine;
  const pendingCount = offline.syncStatus?.pending ?? 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0a0a',
      color: '#e5e5e5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 14,
    }}>
      {/* ========== 顶部导航栏 ========== */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        height: 48,
        padding: '0 16px',
        background: '#171717',
        borderBottom: '1px solid #262626',
        gap: 12,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <span style={{ fontSize: 20 }}>📝</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>DocForge</span>
        </div>

        {/* 导航标签 */}
        <nav style={{ display: 'flex', gap: 4 }}>
          {(['home', 'editor', 'collab', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 6,
                background: activeTab === tab ? '#3b82f6' : 'transparent',
                color: activeTab === tab ? '#fff' : '#a3a3a3',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {{ home: '首页', editor: '编辑器', collab: '协作', settings: '设置' }[tab]}
            </button>
          ))}
        </nav>

        {/* 右侧状态 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 网络状态 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: isOnline ? '#22c55e' : '#ef4444',
            fontSize: 12,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
            }} />
            {isOnline ? '在线' : '离线'}
          </div>
          {pendingCount > 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>
              {pendingCount} 待同步
            </span>
          )}
          {/* Electron标识 */}
          {doc.isElectron && (
            <span style={{ fontSize: 11, color: '#6b7280', background: '#1f2937', padding: '2px 8px', borderRadius: 4 }}>
              Electron
            </span>
          )}
        </div>
      </header>

      {/* ========== 内容区域 ========== */}
      <main style={{ flex: 1, overflow: 'hidden' }}>

        {/* ========== 首页 ========== */}
        {activeTab === 'home' && (
          <div style={{
            maxWidth: 800, margin: '0 auto', padding: '48px 24px',
            overflowY: 'auto', height: '100%',
          }}>
            {/* 快速操作 */}
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f5f5f5' }}>
                DocForge 文档编辑器
              </h1>
              <p style={{ color: '#737373', fontSize: 15 }}>
                Word/PDF 编辑 · 云协作 · 离线可用
              </p>
            </div>

            {/* 新建文档 */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#a3a3a3' }}>
                新建文档
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                {(['docx', 'md', 'txt', 'html'] as DocFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleNewDoc(fmt)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: 20, border: '1px solid #262626', borderRadius: 12,
                      background: '#171717', cursor: 'pointer', color: '#e5e5e5',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#1a1a2e'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.background = '#171717'; }}
                  >
                    <span style={{ fontSize: 28 }}>{FORMAT_ICONS[fmt]}</span>
                    <span style={{ fontSize: 13 }}>{FORMAT_LABELS[fmt]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 打开文件 */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#a3a3a3' }}>
                打开文件
              </h2>
              <div style={{
                border: '2px dashed #262626', borderRadius: 12, padding: 32,
                textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onClick={handleOpenFile}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626'; }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 14, color: '#a3a3a3' }}>
                  点击选择文件或拖拽文件到此处
                </div>
                <div style={{ fontSize: 12, color: '#525252', marginTop: 4 }}>
                  支持 .docx .pdf .md .txt .html .xlsx .pptx
                </div>
              </div>
            </div>

            {/* 最近文件 */}
            {doc.recentFiles.length > 0 && (
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#a3a3a3' }}>
                  最近文件
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {doc.recentFiles.map((file, i) => (
                    <button
                      key={i}
                      onClick={() => { if (file.path) doc.openFilePath(file.path); setActiveTab('editor'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', border: 'none', borderRadius: 8,
                        background: 'transparent', cursor: 'pointer', color: '#e5e5e5',
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#171717'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 20 }}>{FORMAT_ICONS[file.format] ?? '📄'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</div>
                        <div style={{ fontSize: 11, color: '#525252' }}>{file.path}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#525252' }}>
                        {new Date(file.lastOpened).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== 编辑器 ========== */}
        {activeTab === 'editor' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 编辑器工具栏 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', background: '#171717',
              borderBottom: '1px solid #262626', flexShrink: 0,
            }}>
              <button onClick={handleOpenFile} style={toolbarBtnStyle} title="打开 (Ctrl+O)">📂</button>
              <button onClick={handleSave} style={toolbarBtnStyle} title="保存 (Ctrl+S)">💾</button>
              <button onClick={handleSaveAs} style={toolbarBtnStyle} title="另存为">📋</button>
              <div style={{ width: 1, height: 20, background: '#262626' }} />
              <button onClick={() => setShowSearch(!showSearch)} style={toolbarBtnStyle} title="查找替换 (Ctrl+F)">🔍</button>
              <button onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')} style={toolbarBtnStyle} title="切换视图 (Ctrl+E)">
                {viewMode === 'edit' ? '👁️' : '✏️'}
              </button>
              <div style={{ width: 1, height: 20, background: '#262626' }} />
              <button onClick={() => setShowExport(!showExport)} style={toolbarBtnStyle} title="导出">📤</button>
              <button onClick={() => window.print()} style={toolbarBtnStyle} title="打印">🖨️</button>

              {/* 文件名 */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {doc.isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} title="未保存" />}
                <span style={{ fontSize: 13, color: '#a3a3a3' }}>
                  {doc.fileName ?? '未命名文档'}
                </span>
                {doc.format && (
                  <span style={{ fontSize: 11, color: '#525252', background: '#1f2937', padding: '2px 6px', borderRadius: 3 }}>
                    {FORMAT_LABELS[doc.format] ?? doc.format}
                  </span>
                )}
              </div>
            </div>

            {/* 搜索栏 */}
            {showSearch && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: '#111', borderBottom: '1px solid #262626',
              }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索文档内容..."
                  style={{
                    flex: 1, padding: '6px 12px', border: '1px solid #262626',
                    borderRadius: 6, background: '#0a0a0a', color: '#e5e5e5',
                    fontSize: 13, outline: 'none',
                  }}
                />
                <button onClick={() => setShowSearch(false)} style={toolbarBtnStyle}>✕</button>
              </div>
            )}

            {/* 导出菜单 */}
            {showExport && (
              <div style={{
                position: 'absolute', right: 16, top: 56, zIndex: 100,
                background: '#171717', border: '1px solid #262626', borderRadius: 8,
                padding: 8, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {['docx', 'pdf', 'md', 'txt', 'html'].map(fmt => (
                  <button key={fmt} onClick={() => handleExport(fmt)} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px', border: 'none', borderRadius: 6,
                    background: 'transparent', cursor: 'pointer', color: '#e5e5e5',
                    fontSize: 13, textAlign: 'left',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#262626'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {FORMAT_ICONS[fmt]} 导出为 {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>
            )}

            {/* 编辑区域 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {isPdf ? (
                /* PDF 查看器 */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    background: '#1f2937', borderRadius: 8, padding: '32px 24px',
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>📄</div>
                    <div style={{ color: '#a3a3a3', fontSize: 13 }}>
                      PDF 查看模式 · {doc.fileName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                    <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))} style={toolbarBtnStyle}>➖</button>
                    <span style={{ color: '#a3a3a3', fontSize: 12, lineHeight: '32px' }}>
                      {Math.round(pdfScale * 100)}%
                    </span>
                    <button onClick={() => setPdfScale(s => Math.min(3, s + 0.25))} style={toolbarBtnStyle}>➕</button>
                  </div>
                  <div style={{
                    background: '#fff', color: '#000', padding: 40,
                    borderRadius: 4, minHeight: 600, transform: `scale(${pdfScale})`,
                    transformOrigin: 'top center', whiteSpace: 'pre-wrap', fontSize: 14,
                    lineHeight: 1.8, textAlign: 'left',
                    maxWidth: 800, margin: '0 auto',
                  }}>
                    {doc.content || '(PDF 内容将在此显示)'}
                  </div>
                </div>
              ) : viewMode === 'edit' ? (
                /* Word 编辑器 */
                <div style={{
                  background: '#fff', color: '#000', padding: 40,
                  borderRadius: 4, minHeight: 600, maxWidth: 800, margin: '0 auto',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => doc.updateContent(e.currentTarget.textContent ?? '')}
                    style={{
                      outline: 'none', fontSize: 14, lineHeight: 1.8,
                      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}
                  >
                    {doc.content || '开始输入...'}
                  </div>
                </div>
              ) : (
                /* 预览模式 */
                <div style={{
                  background: '#fff', color: '#000', padding: 40,
                  borderRadius: 4, minHeight: 600, maxWidth: 800, margin: '0 auto',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8,
                  fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
                }}>
                  {doc.content || '(空文档)'}
                </div>
              )}
            </div>

            {/* 状态栏 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '4px 16px', background: '#0f0f0f',
              borderTop: '1px solid #262626', fontSize: 11, color: '#525252',
            }}>
              <span>字数: {doc.content?.length ?? 0}</span>
              {doc.format && <span>{FORMAT_LABELS[doc.format]}</span>}
              {doc.isDirty && <span style={{ color: '#f59e0b' }}>未保存</span>}
              {doc.isSaving && <span style={{ color: '#3b82f6' }}>保存中...</span>}
              {doc.isLoading && <span style={{ color: '#3b82f6' }}>加载中...</span>}
              {doc.error && <span style={{ color: '#ef4444' }}>{doc.error}</span>}
              <span style={{ marginLeft: 'auto' }}>
                {collab.isConnected && collab.roomCode ? `协作码: ${collab.roomCode}` : '本地编辑'}
              </span>
            </div>
          </div>
        )}

        {/* ========== 协作面板 ========== */}
        {activeTab === 'collab' && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* 左侧: 协作控制 */}
            <div style={{
              width: 320, borderRight: '1px solid #262626', padding: 24,
              overflowY: 'auto', flexShrink: 0,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>云协作</h2>

              {/* 用户名 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#737373', display: 'block', marginBottom: 4 }}>
                  你的昵称
                </label>
                <input
                  type="text"
                  value={collabUserName}
                  onChange={e => setCollabUserName(e.target.value)}
                  placeholder="输入昵称"
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #262626',
                    borderRadius: 6, background: '#0a0a0a', color: '#e5e5e5',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 创建房间 */}
              {!collab.isConnected && (
                <>
                  <button onClick={handleCreateRoom} style={{
                    width: '100%', padding: 12, border: 'none', borderRadius: 8,
                    background: '#3b82f6', color: '#fff', cursor: 'pointer',
                    fontSize: 14, fontWeight: 600, marginBottom: 16,
                  }}>
                    创建协作房间
                  </button>

                  <div style={{ textAlign: 'center', color: '#525252', margin: '8px 0' }}>或</div>

                  {/* 加入房间 */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#737373', display: 'block', marginBottom: 4 }}>
                      输入 6 位协作码
                    </label>
                    <input
                      type="text"
                      value={collabCode}
                      onChange={e => setCollabCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="例如: ABC123"
                      maxLength={6}
                      style={{
                        width: '100%', padding: '8px 12px', border: '1px solid #262626',
                        borderRadius: 6, background: '#0a0a0a', color: '#e5e5e5',
                        fontSize: 16, letterSpacing: 4, textAlign: 'center',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button onClick={handleJoinRoom} disabled={collabCode.length < 6} style={{
                    width: '100%', padding: 10, border: 'none', borderRadius: 8,
                    background: collabCode.length >= 6 ? '#8b5cf6' : '#374151',
                    color: collabCode.length >= 6 ? '#fff' : '#6b7280',
                    cursor: collabCode.length >= 6 ? 'pointer' : 'not-allowed',
                    fontSize: 14, fontWeight: 600,
                  }}>
                    加入协作
                  </button>
                </>
              )}

              {/* 已连接状态 */}
              {collab.isConnected && (
                <>
                  {/* 协作码显示 */}
                  <div style={{
                    background: '#1f2937', borderRadius: 8, padding: 16,
                    marginBottom: 16, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: '#737373', marginBottom: 4 }}>协作码</div>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: '#3b82f6' }}>
                      {collab.roomCode}
                    </div>
                    <div style={{ fontSize: 11, color: '#525252', marginTop: 4 }}>
                      分享此码给协作者
                    </div>
                  </div>

                  {/* 在线用户 */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>
                      在线用户 ({collab.users.length})
                    </div>
                    {collab.users.map((user, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', fontSize: 13,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: user.color ?? '#3b82f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 11, fontWeight: 600,
                        }}>
                          {(user.name ?? '?')[0]}
                        </span>
                        <span>{user.name}</span>
                        {user.id === collab.userId && (
                          <span style={{ fontSize: 10, color: '#525252' }}>(你)</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 离开房间 */}
                  <button onClick={handleLeaveRoom} style={{
                    width: '100%', padding: 10, border: '1px solid #ef4444',
                    borderRadius: 8, background: 'transparent',
                    color: '#ef4444', cursor: 'pointer', fontSize: 13,
                  }}>
                    离开协作
                  </button>
                </>
              )}
            </div>

            {/* 右侧: 聊天 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #262626',
                fontSize: 14, fontWeight: 600,
              }}>
                实时聊天
              </div>
              <div style={{
                flex: 1, overflowY: 'auto', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {collab.chatMessages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#525252', marginTop: 40 }}>
                    {collab.isConnected ? '暂无消息，发送第一条消息吧' : '加入协作房间后可开始聊天'}
                  </div>
                )}
                {collab.chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8,
                    justifyContent: msg.userId === collab.userId ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px',
                      borderRadius: 12,
                      background: msg.userId === collab.userId ? '#3b82f6' : '#1f2937',
                      color: '#e5e5e5',
                      fontSize: 13,
                    }}>
                      <div style={{ fontSize: 10, color: msg.userId === collab.userId ? '#93c5fd' : '#737373', marginBottom: 2 }}>
                        {msg.userName}
                      </div>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {/* 聊天输入 */}
              {collab.isConnected && (
                <div style={{
                  display: 'flex', gap: 8, padding: '12px 16px',
                  borderTop: '1px solid #262626',
                }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                    placeholder="输入消息..."
                    style={{
                      flex: 1, padding: '8px 12px', border: '1px solid #262626',
                      borderRadius: 6, background: '#0a0a0a', color: '#e5e5e5',
                      fontSize: 13, outline: 'none',
                    }}
                  />
                  <button onClick={handleSendChat} disabled={!chatInput.trim()} style={{
                    padding: '8px 16px', border: 'none', borderRadius: 6,
                    background: chatInput.trim() ? '#3b82f6' : '#374151',
                    color: chatInput.trim() ? '#fff' : '#6b7280',
                    cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                  }}>
                    发送
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== 设置 ========== */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: 32, overflowY: 'auto', height: '100%' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>设置</h2>

            {/* 离线存储 */}
            <div style={{
              background: '#171717', borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>离线存储</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a3a3a3' }}>离线文档数</span>
                <span>{offline.docs.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a3a3a3' }}>待同步</span>
                <span style={{ color: pendingCount > 0 ? '#f59e0b' : '#22c55e' }}>{pendingCount}</span>
              </div>
              <button onClick={() => offline.syncNow()} disabled={!isOnline} style={{
                marginTop: 8, padding: '8px 16px', border: 'none', borderRadius: 6,
                background: isOnline ? '#3b82f6' : '#374151', color: isOnline ? '#fff' : '#6b7280',
                cursor: isOnline ? 'pointer' : 'not-allowed', fontSize: 13,
              }}>
                立即同步
              </button>
            </div>

            {/* 快捷键 */}
            <div style={{
              background: '#171717', borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>快捷键</h3>
              {[
                ['Ctrl+O', '打开文件'],
                ['Ctrl+S', '保存文件'],
                ['Ctrl+Shift+S', '另存为'],
                ['Ctrl+F', '查找替换'],
                ['Ctrl+E', '切换编辑/预览'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#a3a3a3' }}>{desc}</span>
                  <kbd style={{
                    background: '#262626', padding: '2px 8px', borderRadius: 4,
                    fontSize: 12, fontFamily: 'monospace',
                  }}>{key}</kbd>
                </div>
              ))}
            </div>

            {/* 关于 */}
            <div style={{
              background: '#171717', borderRadius: 12, padding: 20,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>关于</h3>
              <p style={{ color: '#737373', fontSize: 13, lineHeight: 1.6 }}>
                DocForge Electron Plugin v1.0.0<br />
                Word/PDF 编辑 · 云协作 · 离线可用<br />
                支持格式: .docx .pdf .md .txt .html .xlsx .pptx
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ==================== 工具栏按钮样式 ====================
const toolbarBtnStyle: React.CSSProperties = {
  width: 32, height: 32, border: 'none', borderRadius: 6,
  background: 'transparent', cursor: 'pointer', fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#a3a3a3', transition: 'all 0.15s',
};

// ==================== 挂载应用 ====================
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<DocForgeApp />);
}
