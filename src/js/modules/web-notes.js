// ==================== 网页笔记/标注模块 ====================
// 在网页上做笔记和标注
(function() {
  'use strict';

  let notes = JSON.parse(localStorage.getItem('f-web-notes') || '{}');
  let isAnnotating = false;
  let overlayEl = null;
  let noteListEl = null;
  let currentUrl = '';
  let mode = 'none'; // 'none' | 'highlight' | 'note' | 'draw'
  let drawCanvas = null;
  let drawCtx = null;
  let isDrawing = false;
  let drawPoints = [];

  function getNotes(url) {
    return notes[url] || [];
  }

  function saveNote(url, note) {
    if (!notes[url]) notes[url] = [];
    note.id = Date.now().toString(36);
    note.time = Date.now();
    notes[url].push(note);
    saveNotesData();
  }

  function deleteNote(url, noteId) {
    if (notes[url]) {
      notes[url] = notes[url].filter(n => n.id !== noteId);
      saveNotesData();
    }
  }

  function clearNotes(url) {
    delete notes[url];
    saveNotesData();
  }

  function saveNotesData() {
    localStorage.setItem('f-web-notes', JSON.stringify(notes));
  }

  function toggle() {
    if (isAnnotating) {
      disable();
    } else {
      enable();
    }
  }

  function enable() {
    isAnnotating = true;
    const tab = window.FBrowser.tabs.getActiveTab();
    currentUrl = tab?.url || '';
    showToolbar();
    injectAnnotationScript();
  }

  function disable() {
    isAnnotating = false;
    mode = 'none';
    hideToolbar();
    removeAnnotationScript();
  }

  function showToolbar() {
    let toolbar = document.getElementById('annotationToolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'annotationToolbar';
      toolbar.className = 'annotation-toolbar';
      toolbar.innerHTML = `
        <button class="at-btn" data-mode="highlight" title="高亮选中文本">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="6" width="12" height="6" rx="1" fill="#fbbf24" opacity="0.6"/><path d="M3 5h10M5 5V3M11 5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          高亮
        </button>
        <button class="at-btn" data-mode="note" title="添加笔记">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1"/><line x1="5" y1="9" x2="9" y2="9" stroke="currentColor" stroke-width="1"/></svg>
          笔记
        </button>
        <button class="at-btn" data-mode="draw" title="画笔标注">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M12 2l2 2-8 8H4v-2z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
          画笔
        </button>
        <div class="at-sep"></div>
        <button class="at-btn" data-action="list" title="笔记列表">
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1"/><line x1="5" y1="10.5" x2="8" y2="10.5" stroke="currentColor" stroke-width="1"/></svg>
        </button>
        <button class="at-btn" data-action="clear" title="清除本页标注">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <div class="at-sep"></div>
        <button class="at-btn at-close" data-action="close" title="关闭标注">
          ✕
        </button>
      `;
      document.body.appendChild(toolbar);

      toolbar.querySelectorAll('.at-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          mode = btn.dataset.mode;
          toolbar.querySelectorAll('.at-btn[data-mode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          setAnnotationMode(mode);
        });
      });

      toolbar.querySelector('[data-action="list"]').addEventListener('click', showNoteList);
      toolbar.querySelector('[data-action="clear"]').addEventListener('click', () => {
        clearNotes(currentUrl);
        const wv = window.FBrowser.tabs.getActiveWebview();
        if (wv) {
          wv.executeJavaScript(`
            document.querySelectorAll('.fb-highlight, .fb-note-marker').forEach(el => el.remove());
            document.querySelectorAll('.fb-annotation-overlay').forEach(el => el.remove());
          `).catch(() => {});
        }
      });
      toolbar.querySelector('[data-action="close"]').addEventListener('click', disable);
    }
    toolbar.classList.add('visible');
  }

  function hideToolbar() {
    const toolbar = document.getElementById('annotationToolbar');
    if (toolbar) toolbar.classList.remove('visible');
  }

  function setAnnotationMode(mode) {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        window.__fbAnnotMode = '${mode}';
        if ('${mode}' === 'highlight') {
          document.body.style.cursor = 'text';
        } else if ('${mode}' === 'note') {
          document.body.style.cursor = 'crosshair';
        } else if ('${mode}' === 'draw') {
          document.body.style.cursor = 'crosshair';
          if (!document.querySelector('.fb-annotation-overlay')) {
            const overlay = document.createElement('canvas');
            overlay.className = 'fb-annotation-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99998;pointer-events:auto;';
            overlay.width = window.innerWidth;
            overlay.height = window.innerHeight;
            document.body.appendChild(overlay);
            const ctx = overlay.getContext('2d');
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            let drawing = false;
            overlay.addEventListener('mousedown', e => {
              drawing = true;
              ctx.beginPath();
              ctx.moveTo(e.clientX, e.clientY);
            });
            overlay.addEventListener('mousemove', e => {
              if (!drawing) return;
              ctx.lineTo(e.clientX, e.clientY);
              ctx.stroke();
            });
            overlay.addEventListener('mouseup', () => { drawing = false; });
          }
        } else {
          document.body.style.cursor = '';
          const overlay = document.querySelector('.fb-annotation-overlay');
          if (overlay) overlay.remove();
        }
      })()
    `).catch(() => {});
  }

  function injectAnnotationScript() {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        if (window.__fbAnnotReady) return;
        window.__fbAnnotReady = true;
        window.__fbAnnotMode = 'none';

        // 高亮选中文本
        document.addEventListener('mouseup', function(e) {
          if (window.__fbAnnotMode !== 'highlight') return;
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.className = 'fb-highlight';
          span.style.cssText = 'background:#fbbf2440;border-radius:2px;padding:0 1px;';
          try {
            range.surroundContents(span);
            window.getSelection().removeAllRanges();
            // 通知渲染进程保存
            window.postMessage({
              type: 'fb-annotation',
              action: 'highlight',
              data: { text: span.textContent, url: window.location.href }
            }, '*');
          } catch(e) {}
        });

        // 添加笔记（点击添加标记）
        document.addEventListener('click', function(e) {
          if (window.__fbAnnotMode !== 'note') return;
          const note = prompt('输入笔记内容:');
          if (!note) return;
          const marker = document.createElement('div');
          marker.className = 'fb-note-marker';
          marker.style.cssText = 'position:absolute;z-index:99997;background:#3b82f6;color:white;padding:4px 8px;border-radius:4px;font-size:12px;max-width:200px;cursor:pointer;';
          marker.textContent = '📝 ' + note;
          marker.style.left = e.pageX + 'px';
          marker.style.top = e.pageY + 'px';
          marker.addEventListener('click', function(ev) {
            ev.stopPropagation();
            if (confirm('删除此笔记？')) marker.remove();
          });
          document.body.appendChild(marker);
          window.postMessage({
            type: 'fb-annotation',
            action: 'note',
            data: { text: note, x: e.pageX, y: e.pageY, url: window.location.href }
          }, '*');
        }, true);
      })()
    `).catch(() => {});
  }

  function removeAnnotationScript() {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      document.body.style.cursor = '';
      document.querySelector('.fb-annotation-overlay')?.remove();
    `).catch(() => {});
  }

  function showNoteList() {
    const urlNotes = getNotes(currentUrl);
    let listEl = document.getElementById('noteListPanel');
    if (!listEl) {
      listEl = document.createElement('div');
      listEl.id = 'noteListPanel';
      listEl.className = 'note-list-panel';
      document.body.appendChild(listEl);
    }

    listEl.innerHTML = `
      <div class="nl-header">
        <span>本页笔记 (${urlNotes.length})</span>
        <button class="nl-close">✕</button>
      </div>
      <div class="nl-list">
        ${urlNotes.length === 0 ? '<div class="nl-empty">暂无笔记</div>' :
          urlNotes.map(n => `
            <div class="nl-item">
              <div class="nl-type">${n.type === 'highlight' ? '🖍️ 高亮' : '📝 笔记'}</div>
              <div class="nl-text">${window.FBrowser.data.escHtml(n.text || '')}</div>
              <div class="nl-time">${new Date(n.time).toLocaleString('zh-CN')}</div>
              <button class="nl-delete" data-id="${n.id}">删除</button>
            </div>
          `).join('')
        }
      </div>
    `;

    listEl.querySelector('.nl-close')?.addEventListener('click', () => listEl.classList.remove('visible'));
    listEl.querySelectorAll('.nl-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteNote(currentUrl, btn.dataset.id);
        showNoteList();
      });
    });

    listEl.classList.add('visible');
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.webNotes = { toggle, enable, disable, getNotes, saveNote, deleteNote, clearNotes };
})();
