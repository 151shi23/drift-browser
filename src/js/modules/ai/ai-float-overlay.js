(function() {
  var C, Api;
  var overlayVisible = false;
  var overlayPosition = { right: 20, bottom: 80 };

  function initModules() {
    C = window.AICore;
    Api = window.AIApi;
  }

  function createOverlay() {
    if (document.getElementById('aiFloatOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'aiFloatOverlay';
    overlay.className = 'ai-float-overlay';
    overlay.innerHTML = '<div class="ai-float-header" id="aiFloatHeader">'
        + '<div class="ai-float-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ai-accent)" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> AI 助手</div>'
        + '<div class="ai-float-actions">'
          + '<button class="ai-float-btn" id="aiFloatOpenChat" title="打开完整对话"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></button>'
          + '<button class="ai-float-btn" id="aiFloatOpenAgent" title="打开Agent"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4z"/><rect x="4" y="8" width="16" height="12" rx="2"/></svg></button>'
          + '<button class="ai-float-btn" id="aiFloatClose" title="关闭"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'
        + '</div>'
      + '</div>'
      + '<div class="ai-float-messages" id="aiFloatMessages"></div>'
      + '<div class="ai-float-input-area">'
        + '<textarea class="ai-float-input" id="aiFloatInput" placeholder="快速提问..." rows="1"></textarea>'
        + '<button class="ai-float-send" id="aiFloatSend"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 8l12-5-5 12z" fill="currentColor"/></svg></button>'
      + '</div>';
    document.body.appendChild(overlay);
    bindEvents();
  }

  function bindEvents() {
    var header = document.getElementById('aiFloatHeader');
    var input = document.getElementById('aiFloatInput');
    var sendBtn = document.getElementById('aiFloatSend');
    var closeBtn = document.getElementById('aiFloatClose');
    var openChatBtn = document.getElementById('aiFloatOpenChat');
    var openAgentBtn = document.getElementById('aiFloatOpenAgent');

    if (header) {
      var dragging = false, startX, startY, startRight, startBottom;
      header.addEventListener('mousedown', function(e) {
        if (e.target.closest('button')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        var overlay = document.getElementById('aiFloatOverlay');
        startRight = parseInt(overlay.style.right) || overlayPosition.right;
        startBottom = parseInt(overlay.style.bottom) || overlayPosition.bottom;
        e.preventDefault();
      });
      document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var dx = startX - e.clientX;
        var dy = e.clientY - startY;
        var overlay = document.getElementById('aiFloatOverlay');
        overlay.style.right = Math.max(0, startRight + dx) + 'px';
        overlay.style.bottom = Math.max(0, startBottom + dy) + 'px';
      });
      document.addEventListener('mouseup', function() { dragging = false; });
    }

    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          var text = input.value.trim();
          if (text) { input.value = ''; input.style.height = 'auto'; sendQuickMessage(text); }
        }
      });
      input.addEventListener('input', function() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', function() {
      var input = document.getElementById('aiFloatInput');
      var text = input.value.trim();
      if (text) { input.value = ''; input.style.height = 'auto'; sendQuickMessage(text); }
    });

    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (openChatBtn) openChatBtn.addEventListener('click', function() { hide(); if (window.FBrowser && window.FBrowser.aiChat) window.FBrowser.aiChat.open(); });
    if (openAgentBtn) openAgentBtn.addEventListener('click', function() { hide(); if (window.FBrowser && window.FBrowser.aiAgent) window.FBrowser.aiAgent.open(); });
  }

  async function sendQuickMessage(text) {
    if (!C) initModules();
    if (!C || !Api) return;
    if (C.state.isGenerating) return;

    var messagesContainer = document.getElementById('aiFloatMessages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML += '<div class="ai-float-msg ai-float-msg-user">' + C.escHtml(text) + '</div>';
    messagesContainer.innerHTML += '<div class="ai-float-msg ai-float-msg-ai" id="aiFloatStreaming"><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span></div>';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    C.state.isGenerating = true;
    C.state.streamingContent = '';

    var tempChat = { id: C.generateId(), title: text.substring(0, 30), messages: [{ id: C.generateId(), role: 'user', content: text, timestamp: Date.now() }] };

    try {
      var onChunk = function(chunk) {
        C.state.streamingContent += chunk;
        var el = document.getElementById('aiFloatStreaming');
        if (el) {
          el.innerHTML = (window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(C.state.streamingContent) : C.escHtml(C.state.streamingContent)) + '<span class="ai-stream-cursor"></span>';
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      };

      var result = await Api.sendRequest(tempChat, C.generateId(), onChunk, 'instant', 'chat');
      var el = document.getElementById('aiFloatStreaming');
      if (el) {
        if (result.success) {
          el.innerHTML = window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(result.content || C.state.streamingContent) : C.escHtml(result.content || C.state.streamingContent);
        } else {
          el.innerHTML = '<span class="ai-float-error">' + C.escHtml(result.error || '请求失败') + '</span>';
        }
        el.removeAttribute('id');
      }
    } catch(e) {
      var el2 = document.getElementById('aiFloatStreaming');
      if (el2) { el2.innerHTML = '<span class="ai-float-error">' + C.escHtml(e.message) + '</span>'; el2.removeAttribute('id'); }
    }

    C.state.isGenerating = false;
    C.state.streamingContent = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function show() {
    createOverlay();
    var overlay = document.getElementById('aiFloatOverlay');
    if (overlay) { overlay.style.display = ''; overlayVisible = true; }
  }

  function hide() {
    var overlay = document.getElementById('aiFloatOverlay');
    if (overlay) { overlay.style.display = 'none'; overlayVisible = false; }
  }

  function toggle() { overlayVisible ? hide() : show(); }
  function isVisible() { return overlayVisible; }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.aiFloat = {
    show: show,
    hide: hide,
    toggle: toggle,
    isVisible: isVisible,
    sendMessage: sendQuickMessage
  };
})();
