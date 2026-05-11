(function() {
  var isUserScrolling = false;

  var RANDOM_TIPS = [
    '如何用一行 Python 实现斐波那契？',
    'JavaScript 的 Promise 和 async/await 有什么区别？',
    '怎样写出让面试官眼前一亮的自我介绍？',
    'RESTful API 设计的最佳实践有哪些？',
    '如何优雅地处理 JavaScript 的异步错误？',
    'Docker 和虚拟机有什么本质区别？',
    '写一个高效的正则表达式验证邮箱格式',
    '前端性能优化的 10 个关键指标',
    '什么是微服务架构，它解决了什么问题？',
    '如何设计一个高并发的秒杀系统？',
    'TypeScript 相比 JavaScript 有哪些优势？',
    'GraphQL 和 REST API 该怎么选？',
    '如何写出可维护性高的代码？',
    'WebSocket 和 HTTP 轮询有什么区别？',
    '什么是事件驱动架构？',
    '如何用 Git 高效管理多人协作开发？',
    '容器编排 Kubernetes 核心概念有哪些？',
    '数据库索引的工作原理是什么？',
    '前端模块化演进：CommonJS → ESM → Bundler',
    '如何构建一个实时协作编辑系统？'
  ];

  function getRandomTip() {
    return RANDOM_TIPS[Math.floor(Math.random() * RANDOM_TIPS.length)];
  }

  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours().toString().padStart(2, '0');
    var m = d.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  }

  function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function formatMarkdown(text) {
    if (window.AIRenderV2) {
      return window.AIRenderV2.parseMarkdown(text);
    }
    return escHtml(text || '');
  }

  function copyCode(btn) {
    if (window.AIRenderV2) {
      return window.AIRenderV2.copyCode(btn);
    }
    var codeBlock = btn.closest('.code-block') || btn.closest('.ai-code-block');
    if (!codeBlock) return;
    var code = codeBlock.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  }

  function buildWelcomeHTML() {
    var tip = getRandomTip();
    return '<div class="ai-welcome">'
      + '<div class="ai-welcome-logo">AI</div>'
      + '<div class="ai-welcome-title">Drift AI</div>'
      + '<div class="ai-welcome-sub">随时待命，为你解答</div>'
      + '<div class="ai-welcome-prompts">'
      + '<div class="ai-prompt-card" data-prompt="帮我写一个Python爬虫"><div class="ai-prompt-card-title">Write Code</div><div class="ai-prompt-card-desc">Python, JS, Java</div></div>'
      + '<div class="ai-prompt-card" data-prompt="解释这段代码的工作原理"><div class="ai-prompt-card-title">Research</div><div class="ai-prompt-card-desc">Docs, APIs, more</div></div>'
      + '<div class="ai-prompt-card" data-prompt="帮我优化这段代码的性能"><div class="ai-prompt-card-title">Optimize</div><div class="ai-prompt-card-desc">Algo, bottleneck</div></div>'
      + '<div class="ai-prompt-card" data-prompt="帮我审查这段代码的安全性"><div class="ai-prompt-card-title">Security</div><div class="ai-prompt-card-desc">Audit, best practice</div></div>'
      + '</div>'
      + '</div>';
  }

  function renderMessages() {
    var C = window.AICore;
    var container = document.getElementById('aiMessages');
    if (!container) return;
    var chat = C.getActiveChat();
    if (!chat) { container.innerHTML = buildWelcomeHTML(); return; }
    if (chat.messages.length === 0) { container.innerHTML = buildWelcomeHTML(); return; }

    var html = '';
    var delayIdx = 0;
    chat.messages.forEach(function(msg) {
      var timeStr = formatTime(msg.timestamp);
      var delay = Math.min(delayIdx * 40, 400);
      delayIdx++;

      if (msg.role === 'user') {
        html += '<div class="ai-msg ai-msg-user" data-id="' + msg.id + '" style="animation-delay:' + delay + 'ms">'
          + '<div class="ai-msg-inner">'
          + '<div class="ai-msg-avatar">U</div>'
          + '<div class="ai-msg-bubble">'
          + '<div class="ai-msg-name">You</div>'
          + '<div class="ai-msg-content">' + escHtml(msg.content) + '</div>'
          + '</div>'
          + '</div>'
          + '</div>';
      } else if (msg.role === 'assistant') {
        var content = msg.isStreaming ? (C.state.streamingContent || '') : (msg.content || '');
        if (msg.error) {
          html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" style="animation-delay:' + delay + 'ms">'
            + '<div class="ai-msg-inner">'
            + '<div class="ai-msg-avatar">AI</div>'
            + '<div class="ai-msg-bubble">'
            + '<div class="ai-msg-name">Assistant</div>'
            + '<div class="ai-msg-content"><div class="ai-msg-error">' + escHtml(msg.error) + '<button class="ai-retry-btn" onclick="window.FBrowser.aiChat.retry()">重试</button></div></div>'
            + '</div>'
            + '</div>'
            + '</div>';
        } else if (msg.isStreaming) {
          var streamContent = content || '';
          if (!streamContent) {
            html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" data-msg-id="' + msg.id + '">'
              + '<div class="ai-msg-inner">'
              + '<div class="ai-msg-avatar">AI</div>'
              + '<div class="ai-msg-bubble">'
              + '<div class="ai-msg-name">Assistant</div>'
              + '<div class="ai-msg-content"><div class="ai-thinking-indicator"><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div></div></div>'
              + '</div>'
              + '</div>'
              + '</div>';
          } else {
            html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" data-msg-id="' + msg.id + '">'
              + '<div class="ai-msg-inner">'
              + '<div class="ai-msg-avatar">AI</div>'
              + '<div class="ai-msg-bubble">'
              + '<div class="ai-msg-name">Assistant</div>'
              + '<div class="ai-msg-content">' + formatMarkdown(streamContent) + '<span class="ai-stream-cursor"></span></div>'
              + '</div>'
              + '</div>'
              + '</div>';
          }
        } else {
          html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" data-msg-id="' + msg.id + '" style="animation-delay:' + delay + 'ms">'
            + '<div class="ai-msg-inner">'
            + '<div class="ai-msg-avatar">AI</div>'
            + '<div class="ai-msg-bubble">'
            + '<div class="ai-msg-name">Assistant</div>'
            + '<div class="ai-msg-content">' + formatMarkdown(content) + '</div>'
            + '<div class="ai-msg-time">' + timeStr + '</div>'
            + '<div class="ai-msg-actions">'
            + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.copyMsg(\'' + msg.id + '\')" title="Copy"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>'
            + '<button class="ai-msg-action" onclick="window.FBrowser.aiChat.retry()" title="Regenerate"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
        }
      } else if (msg.role === 'tool') {
        var toolHtml = '';
        if (window.AIRenderV2) {
          toolHtml = window.AIRenderV2.renderToolCall({
            name: window.AITools ? window.AITools.getBrowserToolDisplayName(msg.toolName) : msg.toolName,
            input: msg.toolInput || '',
            result: msg.content,
            status: msg.toolSuccess ? 'ok' : 'error'
          });
        } else {
          var statusIcon = msg.toolSuccess ? '\u2713' : '\u2715';
          var statusClass = msg.toolSuccess ? 'ai-tool-ok' : 'ai-tool-fail';
          toolHtml = '<div class="ai-tool-call ' + statusClass + '"><div class="ai-tool-call-bar"></div><div class="ai-tool-call-body"><div class="ai-tool-call-header"><span class="ai-tool-call-type">TOOL</span><span class="ai-tool-call-name">' + escHtml(msg.toolName) + '</span><span class="ai-tool-call-status ' + (msg.toolSuccess ? 'ok' : 'fail') + '">' + statusIcon + '</span></div></div></div>';
        }
        html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" style="animation-delay:' + delay + 'ms">'
          + '<div class="ai-msg-inner">'
          + '<div class="ai-msg-avatar">AI</div>'
          + '<div class="ai-msg-bubble">'
          + toolHtml
          + '</div>'
          + '</div>'
          + '</div>';
      }
    });
    container.innerHTML = html;
    if (!isUserScrolling) container.scrollTop = container.scrollHeight;

    var scrollHint = document.getElementById('aiScrollHint');
    if (!scrollHint) {
      scrollHint = document.createElement('div');
      scrollHint.id = 'aiScrollHint';
      scrollHint.className = 'ai-scroll-hint';
      scrollHint.textContent = '\u2193 Scroll to bottom';
      scrollHint.onclick = function() { var c = document.getElementById('aiMessages'); if (c) c.scrollTop = c.scrollHeight; };
      container.parentElement.appendChild(scrollHint);
    }
    scrollHint.style.display = isUserScrolling ? 'block' : 'none';

    var scrollHandler = container._aiScrollHandler;
    if (!scrollHandler) {
      scrollHandler = function() {
        var distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        isUserScrolling = distFromBottom > 100;
        var sh = document.getElementById('aiScrollHint');
        if (sh) sh.style.display = isUserScrolling ? 'block' : 'none';
      };
      container._aiScrollHandler = scrollHandler;
      container.addEventListener('scroll', scrollHandler);
    }
  }

  function renderChatList() {
    var C = window.AICore;
    var list = document.getElementById('aiChatList');
    if (!list) return;
    var searchVal = (list._searchValue || '').toLowerCase();
    var filteredChats = C.state.chats.filter(function(chat) {
      if (!searchVal) return true;
      return chat.title.toLowerCase().indexOf(searchVal) !== -1;
    });
    var html = '';
    filteredChats.forEach(function(chat) {
      var isActive = chat.id === C.state.activeChatId;
      html += '<div class="ai-list-item' + (isActive ? ' active' : '') + '" data-id="' + chat.id + '">'
        + '<svg class="ai-list-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
        + '<span class="ai-list-item-title">' + C.escHtml(chat.title) + '</span>'
        + '<span class="ai-list-item-del" data-id="' + chat.id + '">&times;</span>'
        + '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.ai-list-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.classList.contains('ai-list-item-del')) {
          var delId = e.target.getAttribute('data-id');
          C.state.chats = C.state.chats.filter(function(c) { return c.id !== delId; });
          if (C.state.activeChatId === delId) C.state.activeChatId = C.state.chats.length > 0 ? C.state.chats[0].id : null;
          C.saveChats(); renderChatList(); renderMessages();
          return;
        }
        C.state.activeChatId = el.getAttribute('data-id');
        C.saveChats(); renderChatList(); renderMessages();
      });
    });
  }

  function updateSidebarModel() {
    var C = window.AICore;
    var config = C.loadConfig();
    var modelInput = document.getElementById('aiModelInput');
    var providerSpan = document.getElementById('aiModelProvider');
    if (modelInput) modelInput.value = config.modelId || '';
    if (providerSpan && C.PROVIDERS[config.provider]) providerSpan.textContent = C.PROVIDERS[config.provider].name;
  }

  function updateModelDatalist() {
    var C = window.AICore;
    var config = C.loadConfig();
    var dl = document.getElementById('aiModelDatalist');
    if (!dl) return;
    var models = C.getModelsForProvider(config.provider);
    dl.innerHTML = models.map(function(id) { return '<option value="' + C.escHtml(id) + '">'; }).join('');
  }

  function updateSendButton() {
    var C = window.AICore;
    var btn = document.getElementById('aiSendBtn');
    if (!btn) return;
    btn.disabled = C.state.isGenerating;
    if (C.state.isGenerating) {
      btn.classList.add('loading');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    } else {
      btn.classList.remove('loading');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    }
  }

  window.AIRender = {
    formatMarkdown: formatMarkdown,
    copyCode: copyCode,
    renderMessages: renderMessages,
    renderChatList: renderChatList,
    updateSidebarModel: updateSidebarModel,
    updateModelDatalist: updateModelDatalist,
    updateSendButton: updateSendButton,
    _isUserScrolling: function() { return isUserScrolling; },
    getRandomTip: getRandomTip,
    buildWelcomeHTML: buildWelcomeHTML
  };
})();
