(function() {
  var C, R, T, Api, S;
  var chatIsUserScrolling = false;
  var sidebarCollapsed = false;
  var pendingImage = null;

  function initModules() {
    C = window.AICore;
    R = window.AIRender;
    T = window.AITools;
    Api = window.AIApi;
    S = window.AISettings;
  }

  function init() {
    initModules();
    var page = document.getElementById('aiChatPage');
    if (!page) return;
    if (page.hasChildNodes()) return;

    page.innerHTML = '<div class="ai-layout">'
      + '<div class="ai-sidebar" id="aiSidebar">'
        + '<div class="ai-sidebar-header">'
          + '<div class="ai-sidebar-brand"><span class="ai-sidebar-brand-dot"></span>AI Chat</div>'
          + '<button class="ai-new-btn" id="aiNewChatBtn">+ 新对话</button>'
        + '</div>'
        + '<div class="ai-sidebar-search"><input class="ai-search-input" id="aiSearchInput" placeholder="搜索对话..."></div>'
        + '<div class="ai-list" id="aiChatList"></div>'
        + '<div class="ai-sidebar-footer">'
          + '<div class="ai-model-row">'
            + '<select class="ai-model-select" id="aiProviderSelect"></select>'
            + '<span class="ai-provider-badge" id="aiProviderBadge"></span>'
          + '</div>'
          + '<div class="ai-model-row">'
            + '<input class="ai-provider-input" id="aiModelInput" list="aiModelDatalist" placeholder="选择模型" autocomplete="off">'
            + '<datalist id="aiModelDatalist"></datalist>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="ai-main">'
        + '<div class="ai-header">'
          + '<div class="ai-header-title">'
            + '<button class="ai-header-btn" id="aiToggleSidebar" title="切换侧边栏"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg></button>'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
            + '<span id="aiChatTitle">新对话</span>'
          + '</div>'
          + '<div class="ai-header-actions">'
            + '<div class="ai-status-indicator" id="aiStatusIndicator"><span class="ai-status-dot status-off"></span>离线</div>'
            + '<button class="ai-header-btn" id="aiSwitchAgent" title="切换到Agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4z"/><rect x="4" y="8" width="16" height="12" rx="2"/></svg></button>'
            + '<button class="ai-header-btn" id="aiOpenSettings" title="设置"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></button>'
          + '</div>'
        + '</div>'
        + '<div class="ai-messages" id="aiMessages"></div>'
        + '<div class="ai-scroll-hint" id="aiScrollHint" style="display:none">↓ 新消息</div>'
        + '<div class="ai-input-area" id="aiInputArea">'
          + '<div class="ai-input-wrap" id="aiInputWrap">'
            + '<div class="ai-image-preview" id="aiImagePreview" style="display:none"><img id="aiImagePreviewImg" src=""><span class="ai-image-preview-name" id="aiImagePreviewName"></span><button class="ai-image-preview-remove" id="aiImagePreviewRemove">×</button></div>'
            + '<textarea class="ai-input" id="aiInput" placeholder="输入消息... (Shift+Enter换行)" rows="1"></textarea>'
            + '<span class="ai-input-count" id="aiInputCount"></span>'
            + '<button class="ai-icon-btn" id="aiStopBtn" title="停止生成" style="display:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>'
            + '<button class="ai-send-btn" id="aiSendBtn"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8l12-5-5 12z" fill="currentColor"/></svg></button>'
          + '</div>'
          + '<div class="ai-input-hint">按 Enter 发送 · Shift+Enter 换行 · Ctrl+V 粘贴图片</div>'
        + '</div>'
      + '</div>'
    + '</div>';

    bindEvents();
    C.loadChats();
    renderChatList();
    renderMessages();
    updateModelUI();
    updateStatusIndicator();
  }

  function bindEvents() {
    var input = document.getElementById('aiInput');
    var sendBtn = document.getElementById('aiSendBtn');
    var stopBtn = document.getElementById('aiStopBtn');
    var newChatBtn = document.getElementById('aiNewChatBtn');
    var providerSelect = document.getElementById('aiProviderSelect');
    var modelInput = document.getElementById('aiModelInput');
    var searchInput = document.getElementById('aiSearchInput');
    var toggleSidebar = document.getElementById('aiToggleSidebar');
    var switchAgent = document.getElementById('aiSwitchAgent');
    var openSettings = document.getElementById('aiOpenSettings');
    var imagePreviewRemove = document.getElementById('aiImagePreviewRemove');

    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          var text = input.value.trim();
          if (text || pendingImage) { input.value = ''; input.style.height = 'auto'; sendMessage(text, pendingImage); pendingImage = null; hideImagePreview(); updateInputCount(); }
        }
      });
      input.addEventListener('input', function() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        updateInputCount();
      });
      input.addEventListener('paste', function(e) {
        var items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            var file = items[i].getAsFile();
            var reader = new FileReader();
            reader.onload = function(ev) {
              pendingImage = ev.target.result;
              showImagePreview(pendingImage, '粘贴的图片');
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', function() {
      var input = document.getElementById('aiInput');
      var text = input.value.trim();
      if (text || pendingImage) { input.value = ''; input.style.height = 'auto'; sendMessage(text, pendingImage); pendingImage = null; hideImagePreview(); updateInputCount(); }
    });

    if (stopBtn) stopBtn.addEventListener('click', function() {
      if (Api && Api.abortActiveRequest) Api.abortActiveRequest();
      C.state.isGenerating = false;
      C.state.streamingContent = '';
      updateSendButton();
      updateStatusIndicator();
    });

    if (newChatBtn) newChatBtn.addEventListener('click', function() {
      C.createChat('新对话');
      renderChatList();
      renderMessages();
      focusInput();
    });

    if (providerSelect) providerSelect.addEventListener('change', function() {
      var config = C.loadConfig();
      config.provider = providerSelect.value;
      C.saveConfig(config);
      updateModelUI();
      updateStatusIndicator();
    });

    if (modelInput) modelInput.addEventListener('change', function() {
      var config = C.loadConfig();
      config.modelId = modelInput.value;
      C.saveConfig(config);
    });

    if (searchInput) searchInput.addEventListener('input', function() { renderChatList(searchInput.value.trim()); });

    if (toggleSidebar) toggleSidebar.addEventListener('click', function() {
      sidebarCollapsed = !sidebarCollapsed;
      var sb = document.getElementById('aiSidebar');
      if (sb) sb.classList.toggle('collapsed', sidebarCollapsed);
    });

    if (switchAgent) switchAgent.addEventListener('click', function() {
      if (window.FBrowser && window.FBrowser.aiAgent) window.FBrowser.aiAgent.open();
    });

    if (openSettings) openSettings.addEventListener('click', function() {
      if (window.AISettings) window.AISettings.open();
    });

    if (imagePreviewRemove) imagePreviewRemove.addEventListener('click', function() {
      pendingImage = null;
      hideImagePreview();
    });

    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        C.createChat('新对话');
        renderChatList();
        renderMessages();
        focusInput();
      }
    });
  }

  function showImagePreview(dataUrl, name) {
    var preview = document.getElementById('aiImagePreview');
    var img = document.getElementById('aiImagePreviewImg');
    var nameEl = document.getElementById('aiImagePreviewName');
    if (preview && img && nameEl) {
      img.src = dataUrl;
      nameEl.textContent = name || '图片';
      preview.style.display = 'inline-flex';
    }
  }

  function hideImagePreview() {
    var preview = document.getElementById('aiImagePreview');
    if (preview) preview.style.display = 'none';
  }

  function updateInputCount() {
    var input = document.getElementById('aiInput');
    var countEl = document.getElementById('aiInputCount');
    if (!input || !countEl) return;
    var len = input.value.length;
    countEl.textContent = len > 0 ? len : '';
  }

  function focusInput() {
    var input = document.getElementById('aiInput');
    if (input) setTimeout(function() { input.focus(); }, 100);
  }

  async function sendMessage(text, image) {
    if (!text.trim() && !image) return;
    if (C.state.isGenerating) return;

    var chat = C.getActiveChat();
    if (!chat) { chat = C.createChat('新对话'); renderChatList(); }

    chat.messages.push({ id: C.generateId(), role: 'user', content: text, image: image || null, timestamp: Date.now() });
    if (chat.messages.filter(function(m) { return m.role === 'user'; }).length === 1) {
      chat.title = text.substring(0, 30);
      renderChatList();
      updateChatTitle();
    }

    var assistantMsg = { id: C.generateId(), role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() };
    chat.messages.push(assistantMsg);
    renderMessages();

    C.state.isGenerating = true;
    C.state.streamingContent = '';
    updateSendButton();
    updateStatusIndicator();

    try {
      var onChunk = function(chunk) {
        C.state.streamingContent += chunk;
        var currentChat = C.getActiveChat();
        if (!currentChat || currentChat.id !== chat.id) return;
        var msg = currentChat.messages.find(function(m) { return m.id === assistantMsg.id; });
        if (msg) {
          msg.content = C.state.streamingContent;
          var msgEl = document.querySelector('.ai-msg[data-id="' + assistantMsg.id + '"]');
          if (msgEl) {
            var contentEl = msgEl.querySelector('.ai-msg-content');
            if (contentEl) {
              if (window.AIRenderV2) {
                if (window.AIRenderV2.renderMessage) {
                  window.AIRenderV2.renderMessage(msgEl, assistantMsg.id, C.state.streamingContent, true);
                } else {
                  contentEl.innerHTML = window.AIRenderV2.parseMarkdown(C.state.streamingContent) + '<span class="ai-stream-cursor"></span>';
                }
              } else {
                contentEl.innerHTML = C.escHtml(C.state.streamingContent) + '<span class="ai-stream-cursor"></span>';
              }
            }
            var container = document.getElementById('aiMessages');
            if (container && !chatIsUserScrolling) container.scrollTop = container.scrollHeight;
          }
        }
      };

      var result = await Api.sendRequest(chat, assistantMsg.id, onChunk, 'instant', 'chat');

      assistantMsg.isStreaming = false;
      if (window.AIRenderV2 && window.AIRenderV2.clearRenderState) window.AIRenderV2.clearRenderState(assistantMsg.id);

      if (result.success) {
        assistantMsg.content = result.content || C.state.streamingContent || '（AI 未返回内容）';
        var toolCalls = T.parseToolCalls(assistantMsg.content);
        if (toolCalls.length > 0) {
          var agentConfig = C.loadAgentConfig();
          for (var i = 0; i < toolCalls.length; i++) {
            var call = toolCalls[i];
            var toolResult = await T.executeToolCall(call, agentConfig);
            var toolName = call.skill ? call.skill : (call.mcp ? call.mcp + '/' + call.tool : call.tool);
            chat.messages.push({ id: C.generateId(), role: 'tool', toolName: toolName, toolSuccess: toolResult.success, content: toolResult.success ? (typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data)) : '错误: ' + toolResult.error, timestamp: Date.now() });
          }
          var toolContent = assistantMsg.content.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '').trim();
          assistantMsg.content = toolContent || '已调用工具';
        }
      } else {
        assistantMsg.error = result.error || '请求失败';
        assistantMsg.content = '';
      }
    } catch(e) {
      assistantMsg.isStreaming = false;
      assistantMsg.error = e.message;
      assistantMsg.content = '';
    }

    chat.updatedAt = Date.now();
    C.state.isGenerating = false;
    C.state.streamingContent = '';
    C.saveChats();
    renderMessages();
    renderChatList();
    updateSendButton();
    updateStatusIndicator();
  }

  function retryLastMessage() {
    var chat = C.getActiveChat();
    if (!chat) return;
    var lastUserIdx = -1;
    for (var i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    var lastUserMsg = chat.messages[lastUserIdx];
    while (chat.messages.length > lastUserIdx) chat.messages.pop();
    C.saveChats();
    renderMessages();
    sendMessage(lastUserMsg.content, lastUserMsg.image);
  }

  function copyMessageContent(msgId) {
    var chat = C.getActiveChat();
    if (!chat) return;
    var msg = chat.messages.find(function(m) { return m.id === msgId; });
    if (!msg || !msg.content) return;
    navigator.clipboard.writeText(msg.content).then(function() {
      C.showNotification('已复制到剪贴板', 'success');
    });
  }

  function deleteMessage(msgId) {
    var chat = C.getActiveChat();
    if (!chat) return;
    chat.messages = chat.messages.filter(function(m) { return m.id !== msgId; });
    C.saveChats();
    renderMessages();
  }

  function renameChat(chatId) {
    var chat = C.state.chats.find(function(c) { return c.id === chatId; });
    if (!chat) return;
    var title = prompt('重命名对话', chat.title);
    if (title && title.trim()) { chat.title = title.trim(); C.saveChats(); renderChatList(); updateChatTitle(); }
  }

  function exportChat(chatId) {
    var chat = C.state.chats.find(function(c) { return c.id === chatId; });
    if (!chat) return;
    var data = JSON.stringify(chat, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'chat-' + (chat.title || chat.id) + '-' + Date.now() + '.json'; a.click();
    URL.revokeObjectURL(url);
    C.showNotification('对话已导出', 'success');
  }

  function renderChatList(searchQuery) {
    var list = document.getElementById('aiChatList');
    if (!list) return;
    var chats = C.state.chats.filter(function(c) { return c.type !== 'agent'; });
    var activeId = C.state.activeChatId;

    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      chats = chats.filter(function(c) { return c.title.toLowerCase().indexOf(q) !== -1; });
    }

    var html = '';
    chats.forEach(function(chat) {
      var isActive = chat.id === activeId;
      var timeStr = '';
      if (chat.updatedAt) {
        var d = new Date(chat.updatedAt);
        timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      }
      html += '<div class="ai-list-item' + (isActive ? ' active' : '') + '" data-id="' + chat.id + '">'
        + '<svg class="ai-list-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
        + '<span class="ai-list-item-title">' + C.escHtml(chat.title) + '</span>'
        + '<span class="ai-list-item-time">' + timeStr + '</span>'
        + '<span class="ai-list-item-del" data-id="' + chat.id + '" title="删除">×</span>'
      + '</div>';
    });
    list.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--ai-fg-3);font-size:12px">' + (searchQuery ? '未找到匹配的对话' : '暂无对话') + '</div>';

    list.querySelectorAll('.ai-list-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.ai-list-item-del')) return;
        C.state.activeChatId = el.getAttribute('data-id');
        renderChatList();
        renderMessages();
        updateChatTitle();
      });
      el.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        var chatId = el.getAttribute('data-id');
        var menu = [{ label: '重命名', action: function() { renameChat(chatId); } }, { label: '导出', action: function() { exportChat(chatId); } }, { label: '删除', action: function() { deleteChat(chatId); } }];
        showContextMenu(e.clientX, e.clientY, menu);
      });
    });

    list.querySelectorAll('.ai-list-item-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteChat(btn.getAttribute('data-id'));
      });
    });
  }

  function deleteChat(chatId) {
    var chats = C.state.chats;
    var idx = chats.findIndex(function(c) { return c.id === chatId; });
    if (idx !== -1) {
      chats.splice(idx, 1);
      if (C.state.activeChatId === chatId) {
        var nonAgentChats = chats.filter(function(c) { return c.type !== 'agent'; });
        C.state.activeChatId = (nonAgentChats.length > 0 ? nonAgentChats[0].id : null);
      }
      C.saveChats();
      renderChatList();
      renderMessages();
      updateChatTitle();
    }
  }

  function showContextMenu(x, y, items) {
    var existing = document.getElementById('aiContextMenu');
    if (existing) existing.remove();
    var menu = document.createElement('div');
    menu.id = 'aiContextMenu';
    menu.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:9999;background:var(--ai-bg-2);border:1px solid var(--ai-border);border-radius:var(--ai-radius-sm);padding:4px;min-width:120px;box-shadow:var(--ai-shadow-md)';
    items.forEach(function(item) {
      var btn = document.createElement('button');
      btn.textContent = item.label;
      btn.style.cssText = 'display:block;width:100%;padding:6px 12px;border:none;background:transparent;color:var(--ai-fg-1);font-size:12px;cursor:pointer;text-align:left;border-radius:4px;font-family:var(--ai-font-body)';
      btn.addEventListener('mouseenter', function() { btn.style.background = 'var(--ai-accent-dim)'; btn.style.color = 'var(--ai-accent)'; });
      btn.addEventListener('mouseleave', function() { btn.style.background = 'transparent'; btn.style.color = 'var(--ai-fg-1)'; });
      btn.addEventListener('click', function() { item.action(); menu.remove(); });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    setTimeout(function() {
      document.addEventListener('click', function handler() { menu.remove(); document.removeEventListener('click', handler); });
    }, 10);
  }

  function renderMessages() {
    var container = document.getElementById('aiMessages');
    if (!container) return;
    var chat = C.getActiveChat();
    if (!chat || !chat.messages || chat.messages.length === 0) {
      container.innerHTML = '<div class="ai-welcome">'
        + '<div class="ai-welcome-logo">✦</div>'
        + '<div class="ai-welcome-title">开始对话</div>'
        + '<div class="ai-welcome-sub">输入任何问题，AI 将直接回答。需要执行操作时请切换到 Agent 模式。</div>'
        + '<div class="ai-welcome-prompts">'
          + '<div class="ai-prompt-card" data-prompt="帮我写一个Python快速排序算法"><div class="ai-prompt-card-title">📝 写代码</div><div class="ai-prompt-card-desc">Python快速排序算法</div></div>'
          + '<div class="ai-prompt-card" data-prompt="解释量子计算的基本原理"><div class="ai-prompt-card-title">🔬 解释概念</div><div class="ai-prompt-card-desc">量子计算基本原理</div></div>'
          + '<div class="ai-prompt-card" data-prompt="帮我翻译一段英文：The future belongs to those who believe in the beauty of their dreams."><div class="ai-prompt-card-title">🌐 翻译文本</div><div class="ai-prompt-card-desc">英译中翻译</div></div>'
          + '<div class="ai-prompt-card" data-prompt="帮我总结以下内容的要点"><div class="ai-prompt-card-title">📊 总结要点</div><div class="ai-prompt-card-desc">提取核心信息</div></div>'
        + '</div>'
      + '</div>';
      bindPromptCards();
      return;
    }

    var html = '';
    chat.messages.forEach(function(msg, idx) {
      var delayIdx = Math.min(idx, 10);
      var timeStr = msg.timestamp ? formatTime(msg.timestamp) : '';

      if (msg.role === 'user') {
        html += '<div class="ai-msg ai-msg-user" data-id="' + msg.id + '" style="animation-delay:' + (delayIdx * 40) + 'ms">'
          + '<div class="ai-msg-inner">'
            + '<div class="ai-msg-body">'
              + '<div class="ai-msg-name">你</div>'
              + '<div class="ai-msg-content">' + C.escHtml(msg.content) + '</div>'
              + (msg.image ? '<div class="ai-image-preview"><img src="' + msg.image + '" style="max-width:120px;max-height:80px;border-radius:6px;margin-top:4px"></div>' : '')
              + '<div class="ai-msg-time">' + timeStr + '</div>'
            + '</div>'
            + '<div class="ai-msg-avatar">U</div>'
          + '</div>'
        + '</div>';
      } else if (msg.role === 'assistant') {
        var content = msg.isStreaming ? (C.state.streamingContent || '') : (msg.content || '');
        html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '" style="animation-delay:' + (delayIdx * 40) + 'ms">'
          + '<div class="ai-msg-inner">'
            + '<div class="ai-msg-avatar">AI</div>'
            + '<div class="ai-msg-body">'
              + '<div class="ai-msg-name">AI</div>'
              + '<div class="ai-msg-content" data-msg-id="' + msg.id + '">';

        if (msg.error) {
          html += '<div class="ai-msg-error"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>' + C.escHtml(msg.error) + '<button class="ai-retry-btn" onclick="window.FBrowser.aiChat.retry()">重试</button></div>';
        } else if (msg.isStreaming) {
          if (content) {
            html += (window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(content) : C.escHtml(content));
          }
          html += '<span class="ai-stream-cursor"></span>';
        } else if (!content) {
          html += '<div class="ai-thinking-indicator"><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span></div>';
        } else {
          html += (window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(content) : C.escHtml(content));
        }

        html += '</div>';

        if (!msg.isStreaming && !msg.error && content) {
          html += '<div class="ai-msg-actions">'
            + '<button class="ai-msg-action" title="复制" onclick="window.FBrowser.aiChat.copyMsg(\'' + msg.id + '\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>'
            + '<button class="ai-msg-action" title="重新生成" onclick="window.FBrowser.aiChat.retry()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg></button>'
            + '<button class="ai-msg-action" title="点赞" onclick="this.classList.toggle(\'liked\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg></button>'
            + '<button class="ai-msg-action" title="点踩" onclick="this.classList.toggle(\'disliked\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg></button>'
          + '</div>';
        }

        html += '<div class="ai-msg-time">' + timeStr + '</div>';
        html += '</div></div></div>';
      } else if (msg.role === 'tool') {
        var toolStatus = msg.toolSuccess ? 'ok' : 'error';
        if (window.AIRenderV2) {
          html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '">'
            + '<div class="ai-msg-inner">'
              + '<div class="ai-msg-avatar">⚙</div>'
              + '<div class="ai-msg-body">'
                + '<div class="ai-msg-name">工具</div>'
                + '<div class="ai-msg-content">' + window.AIRenderV2.renderToolCall({ name: msg.toolName, input: '', result: msg.content, status: toolStatus }) + '</div>'
                + '<div class="ai-msg-time">' + timeStr + '</div>'
              + '</div>'
            + '</div>'
          + '</div>';
        } else {
          html += '<div class="ai-msg ai-msg-assistant" data-id="' + msg.id + '">'
            + '<div class="ai-msg-inner">'
              + '<div class="ai-msg-avatar">⚙</div>'
              + '<div class="ai-msg-body">'
                + '<div class="ai-msg-name">工具</div>'
                + '<div class="ai-msg-content"><div class="ai-tool-name">' + C.escHtml(msg.toolName) + (msg.toolSuccess ? ' ✓' : ' ✕') + '</div><pre>' + C.escHtml((msg.content || '').substring(0, 300)) + '</pre></div>'
              + '</div>'
            + '</div>'
          + '</div>';
        }
      }
    });

    container.innerHTML = html;
    if (!chatIsUserScrolling) container.scrollTop = container.scrollHeight;

    var scrollHandler = container._chatScrollHandler;
    if (!scrollHandler) {
      scrollHandler = function() {
        var distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        chatIsUserScrolling = distFromBottom > 100;
        var hint = document.getElementById('aiScrollHint');
        if (hint) hint.style.display = chatIsUserScrolling ? '' : 'none';
      };
      container._chatScrollHandler = scrollHandler;
      container.addEventListener('scroll', scrollHandler);
    }

    var scrollHint = document.getElementById('aiScrollHint');
    if (scrollHint) {
      scrollHint.onclick = function() {
        container.scrollTop = container.scrollHeight;
        chatIsUserScrolling = false;
        scrollHint.style.display = 'none';
      };
    }
  }

  function bindPromptCards() {
    document.querySelectorAll('.ai-prompt-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var prompt = card.getAttribute('data-prompt');
        if (prompt) {
          var input = document.getElementById('aiInput');
          if (input) input.value = prompt;
          sendMessage(prompt);
        }
      });
    });
  }

  function formatTime(ts) {
    var d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  function updateSendButton() {
    var btn = document.getElementById('aiSendBtn');
    var stopBtn = document.getElementById('aiStopBtn');
    if (!btn) return;
    var generating = C.state.isGenerating;
    btn.disabled = generating;
    btn.style.display = generating ? 'none' : '';
    if (stopBtn) stopBtn.style.display = generating ? '' : 'none';
  }

  function updateStatusIndicator() {
    var indicator = document.getElementById('aiStatusIndicator');
    if (!indicator) return;
    var config = C.loadConfig();
    var hasKey = false;
    var provider = C.PROVIDERS[config.provider];
    if (provider) {
      var keyField = provider.keyField;
      hasKey = keyField ? !!config[keyField] : (config.provider === 'ollama');
    }
    if (C.state.isGenerating) {
      indicator.innerHTML = '<span class="ai-status-dot status-busy"></span>生成中';
    } else if (hasKey) {
      indicator.innerHTML = '<span class="ai-status-dot status-ok"></span>就绪';
    } else {
      indicator.innerHTML = '<span class="ai-status-dot status-off"></span>未配置';
    }
  }

  function updateChatTitle() {
    var chat = C.getActiveChat();
    var el = document.getElementById('aiChatTitle');
    if (el && chat) el.textContent = chat.title;
  }

  function updateModelUI() {
    var providerSelect = document.getElementById('aiProviderSelect');
    var modelInput = document.getElementById('aiModelInput');
    var badge = document.getElementById('aiProviderBadge');
    if (!providerSelect || !modelInput) return;

    var config = C.loadConfig();
    var html = '';
    Object.keys(C.PROVIDERS).forEach(function(key) {
      var p = C.PROVIDERS[key];
      html += '<option value="' + key + '"' + (config.provider === key ? ' selected' : '') + '>' + p.name + '</option>';
    });
    providerSelect.innerHTML = html;

    modelInput.value = config.modelId || '';
    if (badge) badge.textContent = (C.PROVIDERS[config.provider] || {}).name || '';

    if (R && R.updateModelDatalist) R.updateModelDatalist();
  }

  function activate() {
    initModules();
    var page = document.getElementById('aiChatPage');
    if (!page) return;
    if (!page.hasChildNodes()) init();
    if (C.initFromAIState) C.initFromAIState();
    C.loadChats();
    renderChatList();
    renderMessages();
    updateModelUI();
    updateChatTitle();
    updateStatusIndicator();
  }

  function openAsTab() {
    if (window.FBrowser && window.FBrowser.tabs) {
      var existing = (window.FBrowser.tabs.tabs || []).find(function(t) { return t.isAiChat; });
      if (existing) { window.FBrowser.tabs.switchTab(existing.id); return; }
      window.FBrowser.tabs.createTab('f://ai-chat');
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.aiChat = {
    open: openAsTab,
    activate: activate,
    sendMessage: sendMessage,
    renderMessages: renderMessages,
    renderChatList: renderChatList,
    updateModelUI: updateModelUI,
    retry: retryLastMessage,
    copyMsg: copyMessageContent,
    deleteMsg: deleteMessage,
    renameChat: renameChat,
    exportChat: exportChat
  };
})();
