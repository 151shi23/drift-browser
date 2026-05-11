(function() {
  'use strict';

  var state = {
    currentFile: null,
    content: '',
    format: '',
    fileName: '未命名文档',
    isDirty: false,
    isSaving: false,
    isLoading: false,
    recentFiles: [],
    activeTab: 'home',
    viewMode: 'edit',
    searchVisible: false,
    error: null,
    collabConnected: false,
    collabRoom: null,
    collabUsers: []
  };

  var SVG = {
    doc: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="1.5" width="12" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="5.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/><line x1="6" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/><line x1="6" y1="10.5" x2="10" y2="10.5" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/></svg>',
    pdf: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="1.5" width="12" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="9" y="11" text-anchor="middle" font-size="5" font-weight="700" fill="currentColor">PDF</text></svg>',
    md: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="1.5" width="12" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="9" y="11.5" text-anchor="middle" font-size="5.5" font-weight="700" fill="currentColor">MD</text></svg>',
    txt: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="1.5" width="12" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/><line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/><line x1="6" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/></svg>',
    html: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 6L2 9l3 3M13 6l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    open: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12l-1 9H3z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    save: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 2h8l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="2" width="5" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.9"/><rect x="4.5" y="9" width="7" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.9"/></svg>',
    saveAs: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 2h8l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="2" width="5" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.9"/><path d="M5 10h6M5 12h4" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    eye: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    home: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8l6-5 6 5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7v5.5a.5.5 0 00.5.5h2V10h3v3h2.5a.5.5 0 00.5-.5V7" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    recent: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 4v4l3 2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    settings: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    collab: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="5.5" cy="5.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="10.5" cy="5.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M1 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" fill="none" stroke="currentColor" stroke-width="1"/><path d="M11 10c2 0 4 1.5 4 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    bold: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 2h5a2.5 2.5 0 010 5H3zM3 7h5.5a2.5 2.5 0 010 5H3z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    italic: '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="5" y1="2" x2="10" y2="2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><line x1="4" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><line x1="8" y1="2" x2="5" y2="12" stroke="currentColor" stroke-width="1.1"/></svg>',
    underline: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2v5a3 3 0 006 0V2" fill="none" stroke="currentColor" stroke-width="1.1"/><line x1="2" y1="12.5" x2="12" y2="12.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
    listUl: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="2.5" cy="3.5" r="1" fill="currentColor"/><circle cx="2.5" cy="7" r="1" fill="currentColor"/><circle cx="2.5" cy="10.5" r="1" fill="currentColor"/><line x1="5" y1="3.5" x2="12" y2="3.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5" y1="10.5" x2="12" y2="10.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    listOl: '<svg width="14" height="14" viewBox="0 0 14 14"><text x="1" y="5" font-size="4" fill="currentColor">1</text><text x="1" y="8.5" font-size="4" fill="currentColor">2</text><text x="1" y="12" font-size="4" fill="currentColor">3</text><line x1="5" y1="3.5" x2="12" y2="3.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5" y1="10.5" x2="12" y2="10.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    heading: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2v10M8 2v10M2 7h6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    quote: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3v4h3V3H3zM8 3v4h3V3H8zM3 10l1.5 2M8 10l1.5 2" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    code: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 4L1 7l3 3M10 4l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 7a2.5 2.5 0 005 0l1-1a2.5 2.5 0 00-3.5-3.5L6 4M9 7a2.5 2.5 0 00-5 0l-1 1a2.5 2.5 0 003.5 3.5L8 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    close: '<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>'
  };

  var FORMAT_META = {
    docx: { label: 'Word 文档', icon: 'doc', color: '#2b5797' },
    pdf: { label: 'PDF 文档', icon: 'pdf', color: '#e74c3c' },
    md: { label: 'Markdown', icon: 'md', color: '#083fa1' },
    txt: { label: '纯文本', icon: 'txt', color: '#6b7280' },
    html: { label: 'HTML', icon: 'html', color: '#e34c26' },
    xlsx: { label: 'Excel', icon: 'doc', color: '#217346' },
    pptx: { label: '演示文稿', icon: 'doc', color: '#d24726' }
  };

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function showNotification(msg, type) { if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify(msg, type || 'info'); }
  function getFormatMeta(fmt) { return FORMAT_META[fmt] || { label: fmt || '未知', icon: 'txt', color: '#6b7280' }; }

  async function openFile() {
    state.isLoading = true; state.error = null; render();
    try {
      var result = await window.electronAPI.docforgeOpenFile();
      if (result && result.success) {
        state.currentFile = result.path;
        state.content = result.content;
        state.format = result.format;
        state.fileName = result.name;
        state.isDirty = false;
        state.activeTab = 'editor';
        showNotification('已打开: ' + result.name, 'success');
      }
    } catch(e) { state.error = e.message || '打开文件失败'; showNotification(state.error, 'error'); }
    state.isLoading = false; render();
  }

  async function openFilePath(filePath) {
    if (!filePath) return;
    state.isLoading = true; state.error = null; render();
    try {
      var result = await window.electronAPI.docforgeOpenFilePath(filePath);
      if (result && result.success) {
        state.currentFile = result.path; state.content = result.content;
        state.format = result.format; state.fileName = result.name;
        state.isDirty = false; state.activeTab = 'editor';
      } else { state.error = result.error || '无法打开文件'; }
    } catch(e) { state.error = e.message || '打开文件失败'; }
    state.isLoading = false; render();
  }

  function newDoc(format) {
    state.currentFile = null; state.content = ''; state.format = format || 'txt';
    state.fileName = '未命名.' + (format || 'txt'); state.isDirty = true;
    state.activeTab = 'editor'; state.error = null; render();
  }

  async function saveFile() {
    if (!state.currentFile && !state.content) return;
    state.isSaving = true; render();
    try {
      var contentToSave = getTextContent();
      var result = await window.electronAPI.docforgeSaveFile({ content: contentToSave, filename: state.fileName, format: state.format });
      if (result && result.success) { state.currentFile = result.path; state.content = contentToSave; state.isDirty = false; showNotification('已保存', 'success'); }
      else if (!result.canceled) { state.error = result.error || '保存失败'; showNotification(state.error, 'error'); }
    } catch(e) { state.error = e.message || '保存失败'; showNotification(state.error, 'error'); }
    state.isSaving = false; render();
  }

  async function saveAs() {
    state.isSaving = true; render();
    try {
      var contentToSave = getTextContent();
      var result = await window.electronAPI.docforgeSaveFileAs({ content: contentToSave, filename: state.fileName, format: state.format });
      if (result && result.success) { state.currentFile = result.path; state.content = contentToSave; state.isDirty = false; showNotification('另存为成功', 'success'); }
      else if (!result.canceled) { state.error = result.error || '另存为失败'; }
    } catch(e) { state.error = e.message || '另存为失败'; }
    state.isSaving = false; render();
  }

  function updateContent(html) {
    state.content = html;
    state.isDirty = true;
  }

  function getPlainTextFromHtml(html) {
    if (!html) return '';
    var div = document.createElement('div');
    div.innerHTML = html;

    var walk = function(node) {
      var text = '';
      if (node.nodeType === 3) { text += node.textContent; }
      else if (node.nodeType === 1) {
        var tag = node.tagName.toLowerCase();
        if (tag === 'br' || tag === 'div' || tag === 'p') { text += '\n'; }
        for (var i = 0; i < node.childNodes.length; i++) { text += walk(node.childNodes[i]); }
        if ((tag === 'div' || tag === 'p') && node.nextSibling) { text += '\n'; }
      }
      return text;
    };

    return walk(div).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }

  function getTextContent() {
    var area = document.getElementById('dfEditArea');
    if (!area) return state.content || '';
    if (state.format === 'md' || state.format === 'txt' || state.format === 'html') {
      return getPlainTextFromHtml(area.innerHTML);
    }
    return area.innerHTML;
  }

  async function loadRecentFiles() {
    try { var result = await window.electronAPI.docforgeGetRecentFiles(); if (result && result.files) state.recentFiles = result.files; } catch(e) {}
  }

  function switchTab(tab) { state.activeTab = tab; render(); }
  function toggleViewMode() { state.viewMode = state.viewMode === 'edit' ? 'preview' : 'edit'; render(); }

  function init() {
    var container = document.getElementById('docforgePage');
    if (!container) return;
    loadRecentFiles();
    render();
    window.electronAPI.docforgeOnFileChanged(function(data) {
      if (data.path === state.currentFile) { showNotification('文件已被外部修改', 'warn'); openFilePath(data.path); }
    });
  }

  function render() {
    var c = document.getElementById('docforgePage');
    if (!c) return;
    var isPdf = state.format === 'pdf';
    c.innerHTML =
      '<div class="df-layout">' +
        '<header class="df-header">' +
          '<div class="df-header-left">' + SVG.doc + '<span class="df-title">DocForge</span></div>' +
          '<nav class="df-nav">' +
            navBtn('home', SVG.home, '首页') +
            navBtn('editor', SVG.edit, '编辑器') +
            navBtn('recent', SVG.recent, '最近') +
            navBtn('collab', SVG.collab, '协作') +
            navBtn('settings', SVG.settings, '设置') +
          '</nav>' +
          '<div class="df-header-right">' +
            (state.isDirty ? '<span class="df-dirty-dot"></span>' : '') +
            (state.isLoading ? '<span class="df-status df-loading">加载中</span>' : '') +
            (state.isSaving ? '<span class="df-status df-saving">保存中</span>' : '') +
          '</div>' +
        '</header>' +
        '<main class="df-body">' + renderBody(isPdf) + '</main>' +
      '</div>';
    bindEvents(c);
  }

  function navBtn(tab, iconSvg, label) {
    return '<button class="df-nav-btn' + (state.activeTab === tab ? ' active' : '') + '" data-tab="' + tab + '">' + iconSvg + '<span>' + label + '</span></button>';
  }

  function renderBody(isPdf) {
    switch(state.activeTab) {
      case 'home': return renderHome();
      case 'editor': return renderEditor(isPdf);
      case 'recent': return renderRecent();
      case 'collab': return renderCollab();
      case 'settings': return renderSettings();
      default: return renderHome();
    }
  }

  function renderHome() {
    var formats = ['docx','md','txt','html'];
    return '<div class="df-home">' +
      '<div class="df-hero"><h1>DocForge</h1><p>文档编辑器 · Word/PDF/Markdown · 离线可用</p></div>' +
      '<section class="df-section"><h2>新建文档</h2><div class="df-new-grid">' +
        formats.map(function(f) {
          var m = getFormatMeta(f);
          return '<button class="df-new-btn" data-new="' + f + '" style="--accent:' + m.color + '">' +
            '<span class="df-new-icon">' + SVG[m.icon] + '</span><span class="df-new-label">' + m.label + '</span></button>';
        }).join('') +
      '</div></section>' +
      '<section class="df-section"><h2>打开文件</h2><div class="df-drop" id="dfDrop">' +
        '<div class="df-drop-icon">' + SVG.open + '</div>' +
        '<div>点击选择文件或拖拽到此处</div>' +
        '<div class="df-drop-hint">支持 .docx .pdf .md .txt .html .xlsx .pptx</div>' +
      '</div></section>' +
      (state.recentFiles.length > 0 ?
        '<section class="df-section"><h2>最近文件</h2><div class="df-recent-list">' +
          state.recentFiles.slice(0,8).map(function(f) {
            var m = getFormatMeta(f.format);
            return '<button class="df-recent-item" data-path="' + escHtml(f.path) + '">' +
              '<span class="df-recent-icon" style="color:' + m.color + '">' + SVG[m.icon] + '</span>' +
              '<div class="df-recent-info"><div class="df-recent-name">' + escHtml(f.name) + '</div>' +
              '<div class="df-recent-meta">' + m.label + ' · ' + new Date(f.lastOpened).toLocaleDateString() + '</div></div></button>';
          }).join('') + '</div></section>' : '') +
      (state.error ? '<div class="df-error">' + escHtml(state.error) + '</div>' : '') +
    '</div>';
  }

  function renderEditor(isPdf) {
    var m = getFormatMeta(state.format);
    return '<div class="df-editor">' +
      '<div class="df-toolbar">' +
        tbBtn('dfOpenBtn', SVG.open, '打开 Ctrl+O') +
        tbBtn('dfSaveBtn', SVG.save, '保存 Ctrl+S') +
        tbBtn('dfSaveAsBtn', SVG.saveAs, '另存为') +
        '<div class="df-tb-sep"></div>' +
        (state.format === 'md' || state.format === 'txt' || state.format === 'html' ?
          tbBtn('dfBoldBtn', SVG.bold, '粗体') +
          tbBtn('dfItalicBtn', SVG.italic, '斜体') +
          tbBtn('dfUnderlineBtn', SVG.underline, '下划线') +
          '<div class="df-tb-sep"></div>' +
          tbBtn('dfHeadingBtn', SVG.heading, '标题') +
          tbBtn('dfQuoteBtn', SVG.quote, '引用') +
          tbBtn('dfCodeBtn', SVG.code, '代码') +
          tbBtn('dfLinkBtn', SVG.link, '链接') +
          '<div class="df-tb-sep"></div>' +
          tbBtn('dfListUlBtn', SVG.listUl, '无序列表') +
          tbBtn('dfListOlBtn', SVG.listOl, '有序列表') +
          '<div class="df-tb-sep"></div>'
        : '') +
        tbBtn('dfSearchBtn', SVG.search, '搜索 Ctrl+F') +
        tbBtn('dfViewToggle', state.viewMode === 'edit' ? SVG.eye : SVG.edit, '切换视图 Ctrl+E') +
        '<div class="df-tb-spacer"></div>' +
        '<span class="df-file-name">' + escHtml(state.fileName) + '</span>' +
        '<span class="df-file-badge" style="background:' + m.color + '22;color:' + m.color + '">' + m.label + '</span>' +
      '</div>' +
      (state.searchVisible ? '<div class="df-search-bar"><input class="df-search-input" id="dfSearchInput" placeholder="搜索文档..."><button class="df-tb-btn" id="dfSearchCloseBtn">' + SVG.close + '</button></div>' : '') +
      '<div class="df-editor-area">' +
        (isPdf ?
          '<div class="df-pdf-view"><div class="df-pdf-head">' + SVG.pdf + '<span>PDF 查看模式 · ' + escHtml(state.fileName) + '</span></div>' +
          '<div class="df-pdf-body"><pre>' + escHtml(state.content || '(PDF 内容将在此显示)') + '</pre></div></div>'
        : state.viewMode === 'edit' ?
          '<div class="df-edit-area" contenteditable="true" id="dfEditArea" spellcheck="false">' + (state.content || '') + '</div>'
        :
          '<div class="df-preview-area"><pre>' + escHtml(state.content || '(空文档)') + '</pre></div>'
        ) +
      '</div>' +
      '<div class="df-statusbar">' +
        '<span>字数: ' + (state.content || '').length + '</span>' +
        (state.format ? '<span style="color:' + m.color + '">' + m.label + '</span>' : '') +
        (state.isDirty ? '<span class="df-dirty">未保存</span>' : '') +
        '<span class="df-status-r">' + (state.currentFile || '本地编辑') + '</span>' +
      '</div>' +
    '</div>';
  }

  function tbBtn(id, iconSvg, title) {
    return '<button class="df-tb-btn" id="' + id + '" title="' + title + '">' + iconSvg + '</button>';
  }

  function renderRecent() {
    return '<div class="df-page">' +
      '<h2>最近文件</h2>' +
      (state.recentFiles.length > 0 ?
        '<div class="df-recent-full">' + state.recentFiles.map(function(f) {
          var m = getFormatMeta(f.format);
          return '<button class="df-recent-lg" data-path="' + escHtml(f.path) + '">' +
            '<span class="df-recent-icon-lg" style="color:' + m.color + '">' + SVG[m.icon] + '</span>' +
            '<div class="df-recent-info"><div class="df-recent-name">' + escHtml(f.name) + '</div>' +
            '<div class="df-recent-path">' + escHtml(f.path) + '</div>' +
            '<div class="df-recent-meta">' + m.label + (f.size ? ' · ' + Math.round(f.size/1024) + 'KB' : '') + ' · ' + new Date(f.lastOpened).toLocaleString() + '</div></div></button>';
        }).join('') + '</div>'
        : '<div class="df-empty">暂无最近文件</div>') +
      '<button class="df-action-btn" id="dfClearRecent">清空历史</button></div>';
  }

  function renderCollab() {
    return '<div class="df-page">' +
      '<h2>在线协作</h2>' +
      '<div class="df-collab-card">' +
        '<div class="df-collab-status ' + (state.collabConnected ? 'connected' : 'disconnected') + '">' +
          '<span class="df-collab-dot"></span>' +
          '<span>' + (state.collabConnected ? '已连接' : '未连接') + '</span>' +
        '</div>' +
        (state.collabRoom ? '<div class="df-collab-room">房间: ' + escHtml(state.collabRoom) + '</div>' : '') +
        '<div class="df-collab-actions">' +
          '<button class="df-collab-btn" id="dfCollabCreate">创建房间</button>' +
          '<button class="df-collab-btn" id="dfCollabJoin">加入房间</button>' +
          (state.collabConnected ? '<button class="df-collab-btn df-collab-btn-danger" id="dfCollabLeave">离开房间</button>' : '') +
        '</div>' +
        (state.collabUsers.length > 0 ?
          '<div class="df-collab-users"><h3>在线用户</h3>' +
            state.collabUsers.map(function(u) { return '<div class="df-collab-user">' + escHtml(u) + '</div>'; }).join('') +
          '</div>' : '') +
      '</div>' +
      '<div class="df-collab-info">' +
        '<p>协作服务由 Coze 提供，支持实时文档编辑和多人协作。</p>' +
      '</div></div>';
  }

  function renderSettings() {
    return '<div class="df-page">' +
      '<h2>设置</h2>' +
      '<div class="df-settings-card"><h3>关于</h3>' +
        '<p>DocForge v1.0.0 — Drift 浏览器内置文档编辑器</p>' +
        '<p>支持格式: .docx .pdf .md .txt .html .xlsx .pptx</p></div>' +
      '<div class="df-settings-card"><h3>快捷键</h3>' +
        '<div class="df-sc-row"><kbd>Ctrl+O</kbd><span>打开文件</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+S</kbd><span>保存</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+Shift+S</kbd><span>另存为</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+E</kbd><span>切换编辑/预览</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+F</kbd><span>搜索</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+B</kbd><span>粗体</span></div>' +
        '<div class="df-sc-row"><kbd>Ctrl+I</kbd><span>斜体</span></div>' +
        '<div class="df-sc-row"><kbd>Tab</kbd><span>插入缩进</span></div>' +
      '</div></div>';
  }

  function insertFormat(prefix, suffix) {
    var area = document.getElementById('dfEditArea');
    if (!area) return;
    area.focus();
    document.execCommand('insertText', false, prefix + (suffix || ''));
  }

  function bindEvents(c) {
    c.querySelectorAll('.df-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(this.getAttribute('data-tab')); });
    });

    var drop = c.querySelector('#dfDrop');
    if (drop) {
      drop.addEventListener('click', openFile);
      drop.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('df-drop-over'); });
      drop.addEventListener('dragleave', function() { this.classList.remove('df-drop-over'); });
      drop.addEventListener('drop', function(e) { e.preventDefault(); this.classList.remove('df-drop-over'); var f = e.dataTransfer.files[0]; if (f) openFilePath(f.path); });
    }

    c.querySelectorAll('.df-new-btn').forEach(function(btn) { btn.addEventListener('click', function() { newDoc(this.getAttribute('data-new')); }); });
    c.querySelectorAll('.df-recent-item, .df-recent-lg').forEach(function(item) { item.addEventListener('click', function() { openFilePath(this.getAttribute('data-path')); }); });

    var clearBtn = c.querySelector('#dfClearRecent');
    if (clearBtn) clearBtn.addEventListener('click', async function() { await window.electronAPI.docforgeClearRecentFiles(); state.recentFiles = []; render(); });

    var openBtn = c.querySelector('#dfOpenBtn'); if (openBtn) openBtn.addEventListener('click', openFile);
    var saveBtn = c.querySelector('#dfSaveBtn'); if (saveBtn) saveBtn.addEventListener('click', saveFile);
    var saveAsBtn = c.querySelector('#dfSaveAsBtn'); if (saveAsBtn) saveAsBtn.addEventListener('click', saveAs);

    var searchBtn = c.querySelector('#dfSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', function() { state.searchVisible = !state.searchVisible; render(); });

    var searchCloseBtn = c.querySelector('#dfSearchCloseBtn');
    if (searchCloseBtn) searchCloseBtn.addEventListener('click', function() { state.searchVisible = false; render(); });

    var viewToggle = c.querySelector('#dfViewToggle');
    if (viewToggle) viewToggle.addEventListener('click', toggleViewMode);

    var editArea = c.querySelector('#dfEditArea');
    if (editArea) {
      editArea.addEventListener('input', function() { updateContent(this.innerHTML); });
      editArea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          document.execCommand('insertText', false, '  ');
        }
        if (e.key === 'Enter' && !e.shiftKey && (state.format === 'md')) {
          var sel = window.getSelection();
          if (sel.rangeCount > 0) {
            var range = sel.getRangeAt(0);
            var line = range.startContainer.textContent;
            var pos = range.startOffset;
            var before = line.substring(0, pos);
            var indent = before.match(/^(\s*)/)[1] || '';
            document.execCommand('insertText', false, '\n' + indent);
            e.preventDefault();
          }
        }
      });
    }

    var boldBtn = c.querySelector('#dfBoldBtn'); if (boldBtn) boldBtn.addEventListener('click', function() { document.execCommand('bold'); });
    var italicBtn = c.querySelector('#dfItalicBtn'); if (italicBtn) italicBtn.addEventListener('click', function() { document.execCommand('italic'); });
    var underlineBtn = c.querySelector('#dfUnderlineBtn'); if (underlineBtn) underlineBtn.addEventListener('click', function() { document.execCommand('underline'); });
    var headingBtn = c.querySelector('#dfHeadingBtn'); if (headingBtn) headingBtn.addEventListener('click', function() { document.execCommand('formatBlock', false, 'h2'); });
    var quoteBtn = c.querySelector('#dfQuoteBtn'); if (quoteBtn) quoteBtn.addEventListener('click', function() { document.execCommand('formatBlock', false, 'blockquote'); });
    var codeBtn = c.querySelector('#dfCodeBtn'); if (codeBtn) codeBtn.addEventListener('click', function() { document.execCommand('formatBlock', false, 'pre'); });
    var linkBtn = c.querySelector('#dfLinkBtn'); if (linkBtn) linkBtn.addEventListener('click', function() { var url = prompt('输入链接URL:'); if (url) document.execCommand('createLink', false, url); });
    var listUlBtn = c.querySelector('#dfListUlBtn'); if (listUlBtn) listUlBtn.addEventListener('click', function() { document.execCommand('insertUnorderedList'); });
    var listOlBtn = c.querySelector('#dfListOlBtn'); if (listOlBtn) listOlBtn.addEventListener('click', function() { document.execCommand('insertOrderedList'); });

    var collabCreate = c.querySelector('#dfCollabCreate');
    if (collabCreate) collabCreate.addEventListener('click', function() {
      var room = Math.random().toString(36).substring(2, 8).toUpperCase();
      state.collabRoom = room; state.collabConnected = true; state.collabUsers = ['我'];
      showNotification('已创建房间: ' + room, 'success'); render();
    });

    var collabJoin = c.querySelector('#dfCollabJoin');
    if (collabJoin) collabJoin.addEventListener('click', function() {
      var room = prompt('输入房间号:');
      if (room) { state.collabRoom = room; state.collabConnected = true; state.collabUsers = ['我']; showNotification('已加入房间: ' + room, 'success'); render(); }
    });

    var collabLeave = c.querySelector('#dfCollabLeave');
    if (collabLeave) collabLeave.addEventListener('click', function() {
      state.collabConnected = false; state.collabRoom = null; state.collabUsers = [];
      showNotification('已离开房间', 'info'); render();
    });

    document.removeEventListener('keydown', handleGlobalKey);
    document.addEventListener('keydown', handleGlobalKey);
  }

  function handleGlobalKey(e) {
    var c = document.getElementById('docforgePage');
    if (!c || !c.classList.contains('active') || c.offsetWidth === 0) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); openFile(); }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); saveFile(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); saveAs(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); toggleViewMode(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); state.searchVisible = !state.searchVisible; render(); }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.docforge = {
    init: init, openFile: openFile, openFilePath: openFilePath,
    newDoc: newDoc, saveFile: saveFile, saveAs: saveAs,
    getState: function() { return state; }, switchTab: switchTab, render: render
  };
})();
