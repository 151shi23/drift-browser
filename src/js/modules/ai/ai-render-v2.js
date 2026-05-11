(function() {
  'use strict';

  var _lastRenderedContent = {};
  var _renderRAF = null;
  var _pendingRenders = {};

  function parseMarkdown(text) {
    if (!text) return '';
    var html = text;

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
      var l = lang || 'text';
      var highlighted = highlightCode(code.trim(), l);
      return '<div class="ai-code-block"><div class="ai-code-header"><span class="ai-code-lang">' + l + '</span><button class="ai-copy-btn" onclick="window.AIRenderV2.copyCode(this)">Copy</button></div><pre><code>' + highlighted + '</code></pre></div>';
    });

    html = html.replace(/`([^`]+)`/g, '<code class="ai-md-inline-code">$1</code>');

    html = html.replace(/^### (.+)$/gm, '<h3 class="ai-md-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="ai-md-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="ai-md-h1">$1</h1>');

    html = html.replace(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/g, function(_, content) {
      return '<div class="ai-special-block ai-special-plan"><div class="ai-special-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Execution Plan</div><div class="ai-special-body">' + content.trim() + '</div></div>';
    });

    html = html.replace(/\[THINK\]([\s\S]*?)\[\/THINK\]/g, function(_, content) {
      var id = 'think-' + Math.random().toString(36).substr(2, 6);
      return '<div class="ai-special-block ai-special-think"><div class="ai-special-header" onclick="this.parentElement.querySelector(\'.ai-special-body\').style.display=this.parentElement.querySelector(\'.ai-special-body\').style.display===\'none\'?\'block\':\'none\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg> Thinking Process <span style="margin-left:auto;font-size:9px;opacity:.5">click to toggle</span></div><div class="ai-special-body" style="display:none">' + content.trim() + '</div></div>';
    });

    html = html.replace(/\[DONE\]([\s\S]*?)\[\/DONE\]/g, function(_, content) {
      return '<div class="ai-special-block ai-special-done"><div class="ai-special-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Completed</div><div class="ai-special-body">' + content.trim() + '</div></div>';
    });

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="ai-md-link" href="$2" target="_blank" rel="noopener">$1</a>');

    html = html.replace(/^> (.+)$/gm, '<div class="ai-md-blockquote">$1</div>');

    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ai-md-ol-item">$2</li>');

    html = html.replace(/^[-*] (.+)$/gm, '<li class="ai-md-ul-item">$1</li>');

    html = html.replace(/((?:<li class="ai-md-ol-item">[\s\S]*?<\/li>\n?)+)/g, '<ol class="ai-md-list ai-md-list-ol">$1</ol>');
    html = html.replace(/((?:<li class="ai-md-ul-item">[\s\S]*?<\/li>\n?)+)/g, '<ul class="ai-md-list ai-md-list-ul">$1</ul>');

    html = html.replace(/^---$/gm, '<hr class="ai-md-hr">');

    html = html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, function(_, header, body) {
      var hCells = header.split('|').filter(function(c) { return c.trim(); });
      var rows = body.trim().split('\n');
      var out = '<table class="ai-md-table"><thead><tr>';
      hCells.forEach(function(c) { out += '<th>' + c.trim() + '</th>'; });
      out += '</tr></thead><tbody>';
      rows.forEach(function(row) {
        var cells = row.split('|').filter(function(c) { return c.trim(); });
        out += '<tr>';
        cells.forEach(function(c) { out += '<td>' + c.trim() + '</td>'; });
        out += '</tr>';
      });
      out += '</tbody></table>';
      return out;
    });

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="ai-msg-image" src="$2" alt="$1" loading="lazy">');

    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<(h[1-3]|div|table|hr|ul|ol|pre)/g, '<$1');
    html = html.replace(/<\/(h[1-3]|div|table|hr|ul|ol|pre)>\s*<\/p>/g, '</$1>');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightCode(code, lang) {
    if (!lang || lang === 'text') return escapeHtml(code);
    var keywords = {
      js: ['function','const','let','var','return','if','else','for','while','class','import','export','default','new','this','async','await','try','catch','throw','typeof','instanceof','switch','case','break','continue','null','undefined','true','false','of','in','from','yield'],
      python: ['def','class','import','from','return','if','elif','else','for','while','try','except','finally','with','as','lambda','yield','pass','break','continue','raise','None','True','False','and','or','not','in','is'],
      css: ['display','position','margin','padding','border','background','color','font','width','height','flex','grid','transition','animation','transform','opacity','overflow','z-index','box-shadow','border-radius'],
      html: ['div','span','class','id','style','src','href','type','data','input','button','form','table','img','a','p','h1','h2','h3','ul','ol','li','script','link','meta'],
      json: ['true','false','null'],
      typescript: ['interface','type','enum','implements','extends','namespace','declare','abstract','readonly','as','keyof','infer','never','unknown','any','void','string','number','boolean','object','symbol','bigint']
    };
    var kw = keywords[lang] || keywords.js;

    var escaped = escapeHtml(code);

    kw.forEach(function(k) {
      var escapedKw = escapeHtml(k);
      var re = new RegExp('\\b(' + escapedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'g');
      escaped = escaped.replace(re, '<span class="hl-kw">$1</span>');
    });

    escaped = escaped.replace(/(&quot;|&#39;|`)(?:(?!\1).)*?\1/g, '<span class="hl-str">$&</span>');
    escaped = escaped.replace(/\/\/.*$/gm, '<span class="hl-cmt">$&</span>');
    escaped = escaped.replace(/\/\*[\s\S]*?\*\//g, '<span class="hl-cmt">$&</span>');
    escaped = escaped.replace(/#\s.*$/gm, '<span class="hl-cmt">$&</span>');
    escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');

    return escaped;
  }

  function renderMessage(container, msgId, content, isStreaming) {
    if (!container) return;

    var msgEl = container.querySelector('[data-msg-id="' + msgId + '"]');
    if (!msgEl) return;

    var contentEl = msgEl.querySelector('.ai-msg-content') || msgEl.querySelector('.ai-msg-bubble .ai-msg-content');
    if (!contentEl) return;

    if (isStreaming) {
      var lastContent = _lastRenderedContent[msgId] || '';
      if (content === lastContent) return;

      _lastRenderedContent[msgId] = content;

      if (!_pendingRenders[msgId]) {
        _pendingRenders[msgId] = { content: content, container: contentEl };
        scheduleRender();
      } else {
        _pendingRenders[msgId].content = content;
      }
    } else {
      delete _lastRenderedContent[msgId];
      contentEl.innerHTML = parseMarkdown(content);
    }
  }

  function scheduleRender() {
    if (_renderRAF) return;
    _renderRAF = requestAnimationFrame(flushRenders);
  }

  function flushRenders() {
    _renderRAF = null;
    var keys = Object.keys(_pendingRenders);
    for (var i = 0; i < keys.length; i++) {
      var item = _pendingRenders[keys[i]];
      if (item && item.container) {
        var html = parseMarkdown(item.content);
        html += '<span class="ai-stream-cursor"></span>';
        item.container.innerHTML = html;
      }
    }
    _pendingRenders = {};
  }

  function removeCursor(container) {
    if (!container) return;
    var cursors = container.querySelectorAll('.ai-stream-cursor');
    for (var i = 0; i < cursors.length; i++) {
      cursors[i].remove();
    }
  }

  function renderToolCall(toolCall) {
    var statusClass = toolCall.status === 'error' ? 'ai-tool-fail' : 'ai-tool-ok';
    var statusLabel = toolCall.status === 'error' ? 'FAIL' : 'OK';
    var statusBadge = toolCall.status === 'error' ? 'fail' : 'ok';

    var resultHtml = '';
    if (toolCall.result) {
      var truncated = toolCall.result;
      if (truncated.length > 500) {
        truncated = truncated.substring(0, 500) + '...';
      }
      resultHtml = '<div class="ai-tool-call-result"><pre>' + escapeHtml(truncated) + '</pre></div>';
    }

    var inputHtml = '';
    if (toolCall.input) {
      var inputStr = typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input, null, 2);
      if (inputStr.length > 300) inputStr = inputStr.substring(0, 300) + '...';
      inputHtml = '<div class="ai-tool-call-input" style="margin-bottom:4px"><pre style="margin:0;padding:6px 8px;background:var(--ai-bg-2);border-radius:var(--ai-radius-sm);font-size:10px;color:var(--ai-fg-2);max-height:80px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;font-family:var(--ai-font-mono)">' + escapeHtml(inputStr) + '</pre></div>';
    }

    return '<div class="ai-tool-call ' + statusClass + '">' +
      '<div class="ai-tool-call-bar"></div>' +
      '<div class="ai-tool-call-body">' +
        '<div class="ai-tool-call-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
          '<span class="ai-tool-call-type">TOOL</span>' +
          '<span class="ai-tool-call-name">' + escapeHtml(toolCall.name || 'unknown') + '</span>' +
          '<span class="ai-tool-call-status ' + statusBadge + '">' + statusLabel + '</span>' +
          '<span class="ai-tool-call-chevron">\u25B6</span>' +
        '</div>' +
        '<div class="ai-tool-call-result" style="display:none">' +
          inputHtml +
          resultHtml +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderAgentToolCard(toolCall) {
    var inputStr = '';
    if (toolCall.input) {
      inputStr = typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input, null, 2);
      if (inputStr.length > 400) inputStr = inputStr.substring(0, 400) + '...';
    }
    var outputStr = '';
    if (toolCall.result) {
      outputStr = typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2);
      if (outputStr.length > 400) outputStr = outputStr.substring(0, 400) + '...';
    }

    var cardId = 'tool-' + Math.random().toString(36).substr(2, 6);

    return '<div class="agent-tool-card" id="' + cardId + '">' +
      '<div class="agent-tool-card-header" onclick="document.getElementById(\'' + cardId + '\').classList.toggle(\'expanded\')">' +
        '<div class="agent-tool-card-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>' +
        '<span class="agent-tool-card-name">' + escapeHtml(toolCall.name || 'unknown') + '</span>' +
        '<span class="agent-tool-card-chevron">\u25B6</span>' +
      '</div>' +
      '<div class="agent-tool-card-body">' +
        (inputStr ? '<div class="agent-tool-card-input"><div class="agent-tool-card-input-label">Input</div><pre>' + escapeHtml(inputStr) + '</pre></div>' : '') +
        (outputStr ? '<div class="agent-tool-card-output"><div class="agent-tool-card-output-label">Output</div><pre>' + escapeHtml(outputStr) + '</pre></div>' : '') +
      '</div>' +
    '</div>';
  }

  function copyCode(btn) {
    var block = btn.closest('.ai-code-block');
    if (!block) return;
    var code = block.querySelector('code');
    if (!code) return;
    var text = code.textContent;
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  }

  function clearRenderState(msgId) {
    delete _lastRenderedContent[msgId];
    delete _pendingRenders[msgId];
  }

  window.AIRenderV2 = {
    parseMarkdown: parseMarkdown,
    renderMessage: renderMessage,
    removeCursor: removeCursor,
    renderToolCall: renderToolCall,
    renderAgentToolCard: renderAgentToolCard,
    copyCode: copyCode,
    clearRenderState: clearRenderState,
    escapeHtml: escapeHtml
  };
})();
