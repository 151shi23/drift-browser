(function() {
  var state = {
    visible: false,
    mode: 'standard',
    screenshot: null,
    mousePosition: { x: 0, y: 0 },
    tabs: [],
    activeTabId: null,
    logs: [],
    maxLogs: 100,
    currentUrl: '',
    siteSupportsStandard: false,
    detectedAt: 0,
    isExecuting: false,
    activeTabInfo: null
  };

  var DETECT_COOLDOWN = 30000;
  var STANDARD_DETECT_SCRIPT = [
    '(function() {',
    '  var interactives = document.querySelectorAll("button, a, input, select, textarea, [onclick], [role=button], [tabindex]");',
    '  var visibleCount = 0;',
    '  interactives.forEach(function(el) {',
    '    var r = el.getBoundingClientRect();',
    '    if (r.width > 0 && r.height > 0) visibleCount++;',
    '  });',
    '  var forms = document.querySelectorAll("form");',
    '  var hasSearch = !!document.querySelector("input[type=search], input[name=q], input[name=query], input[name=search], input[placeholder*=search i], input[placeholder*=搜索 i]");',
    '  return JSON.stringify({',
    '    interactiveCount: visibleCount,',
    '    formCount: forms.length,',
    '    hasSearch: hasSearch,',
    '    title: document.title,',
    '    url: location.href',
    '  });',
    '})()'
  ].join('\n');

  function log(msg, type) {
    state.logs.unshift({ msg: msg, type: type || 'info', time: Date.now() });
    if (state.logs.length > state.maxLogs) state.logs.length = state.maxLogs;
    renderLogs();
    updateStatusIndicator();
  }

  function renderLogs() {
    var container = document.getElementById('aiBrowserLogs');
    if (!container) return;
    container.innerHTML = state.logs.slice(0, 30).map(function(l) {
      var cls = l.type === 'error' ? 'ai-br-log-err' : (l.type === 'success' ? 'ai-br-log-ok' : (l.type === 'warn' ? 'ai-br-log-warn' : 'ai-br-log-info'));
      var time = new Date(l.time);
      var ts = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0') + ':' + time.getSeconds().toString().padStart(2, '0');
      var icon = l.type === 'error' ? '✕' : (l.type === 'success' ? '✓' : (l.type === 'warn' ? '⚠' : '›'));
      return '<div class="ai-br-log ' + cls + '"><span class="ai-br-log-icon">' + icon + '</span><span class="ai-br-log-time">' + ts + '</span><span class="ai-br-log-msg">' + escHtml(l.msg) + '</span></div>';
    }).join('');
  }

  function updateStatusIndicator() {
    var indicator = document.getElementById('aiBrowserStatus');
    if (!indicator) return;
    if (state.isExecuting) {
      indicator.className = 'ai-browser-status executing';
      indicator.innerHTML = '<span class="ai-status-dot"></span>执行中...';
    } else if (state.activeTabInfo) {
      indicator.className = 'ai-browser-status active';
      indicator.innerHTML = '<span class="ai-status-dot"></span>' + escHtml(state.activeTabInfo.url || '已连接');
    } else {
      indicator.className = 'ai-browser-status idle';
      indicator.innerHTML = '<span class="ai-status-dot"></span>就绪';
    }
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function show() {
    state.visible = true;
    var panel = document.getElementById('aiBrowserPanel');
    if (panel) panel.classList.add('open');
  }

  function hide() {
    state.visible = false;
    var panel = document.getElementById('aiBrowserPanel');
    if (panel) panel.classList.remove('open');
  }

  function toggle() {
    if (state.visible) hide(); else show();
  }

  function updateScreenshot(data) {
    state.screenshot = data;
    var img = document.getElementById('aiBrowserScreenshot');
    if (img && data && data.image) {
      img.src = data.image;
      img.style.display = 'block';
      var placeholder = document.getElementById('aiBrowserPlaceholder');
      if (placeholder) placeholder.style.display = 'none';
      var emptyState = document.getElementById('aiBrowserEmptyState');
      if (emptyState) emptyState.style.display = 'none';
    }
    updateMousePosition(data && data.mousePosition ? data.mousePosition : state.mousePosition);
  }

  function updateMousePosition(pos) {
    state.mousePosition = pos || { x: 0, y: 0 };
    var cursor = document.getElementById('aiVirtualMouse');
    if (cursor) {
      var img = document.getElementById('aiBrowserScreenshot');
      if (img && img.naturalWidth && img.clientWidth) {
        var scaleX = img.clientWidth / img.naturalWidth;
        var scaleY = img.clientHeight / img.naturalHeight;
        cursor.style.left = (state.mousePosition.x * scaleX) + 'px';
        cursor.style.top = (state.mousePosition.y * scaleY) + 'px';
      }
    }
  }

  function showClickEffect(x, y) {
    var container = document.getElementById('aiBrowserPreview');
    if (!container) return;
    var img = document.getElementById('aiBrowserScreenshot');
    if (!img || !img.naturalWidth || !img.clientWidth) return;
    var scaleX = img.clientWidth / img.naturalWidth;
    var scaleY = img.clientHeight / img.naturalHeight;
    var ripple = document.createElement('div');
    ripple.className = 'ai-click-ripple';
    ripple.style.left = (x * scaleX - 15) + 'px';
    ripple.style.top = (y * scaleY - 15) + 'px';
    container.appendChild(ripple);
    setTimeout(function() { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 600);
  }

  function setMode(mode) {
    state.mode = mode;
    var modeLabel = document.getElementById('aiBrowserModeLabel');
    if (modeLabel) {
      modeLabel.textContent = mode === 'multimodal' ? '多模态' : '标准';
      modeLabel.className = 'ai-browser-mode-badge ' + (mode === 'multimodal' ? 'badge-multimodal' : 'badge-standard');
    }
    var cursor = document.getElementById('aiVirtualMouse');
    if (cursor) cursor.style.display = mode === 'multimodal' ? 'block' : 'none';
    log('模式: ' + (mode === 'multimodal' ? '多模态 (截图+坐标)' : '标准 (DOM操作)'), 'info');
  }

  function getActiveWebview() {
    if (!window.FBrowser || !window.FBrowser.tabs) return null;
    var tabs = window.FBrowser.tabs.tabs || [];
    var activeId = typeof window.FBrowser.tabs.getActiveTabId === 'function' ? window.FBrowser.tabs.getActiveTabId() : window.FBrowser.tabs.activeTabId;
    if (!activeId) return null;
    var tab = tabs.find(function(t) { return t.id === activeId; });
    return tab && tab.webview ? tab.webview : null;
  }

  function detectSiteAiCapability(url) {
    if (!url || url.startsWith('f://') || url === 'about:blank') {
      updateStandardButton(false);
      return;
    }

    var now = Date.now();
    if (url === state.currentUrl && (now - state.detectedAt) < DETECT_COOLDOWN) return;
    state.currentUrl = url;
    state.detectedAt = now;

    var wv = getActiveWebview();
    if (!wv) {
      updateStandardButton(false);
      return;
    }

    try {
      wv.executeJavaScript(STANDARD_DETECT_SCRIPT).then(function(result) {
        if (typeof result === 'string') {
          try { result = JSON.parse(result); } catch (e) { updateStandardButton(false); return; }
        }
        if (!result) { updateStandardButton(false); return; }

        var interactiveCount = result.interactiveCount || 0;
        var formCount = result.formCount || 0;
        var hasSearch = result.hasSearch || false;

        var supports = interactiveCount >= 3 || formCount >= 1 || hasSearch;

        state.siteSupportsStandard = supports;
        updateStandardButton(supports);

        if (supports) {
          log('当前页面支持AI操作 (' + interactiveCount + '个可交互元素)', 'info');
        }
      }).catch(function() {
        updateStandardButton(false);
      });
    } catch (e) {
      updateStandardButton(false);
    }
  }

  function updateStandardButton(show) {
    var btn = document.getElementById('btnAiBrowserStandard');
    if (!btn) return;
    btn.style.display = show ? 'flex' : 'none';
    updateToolbarTooltip();
  }

  function updateToolbarTooltip() {
    var standardBtn = document.getElementById('btnAiBrowserStandard');
    var multimodalBtn = document.getElementById('btnAiBrowserMultimodal');
    if (standardBtn) standardBtn.title = 'AI 操作当前网页（DOM智能操作）';
    if (multimodalBtn) multimodalBtn.title = 'AI 多模态操作（截图识别+坐标点击）';
  }

  function openAiChatWithCommand(command) {
    if (!window.FBrowser || !window.FBrowser.tabs) return;
    var tabs = window.FBrowser.tabs.tabs || [];
    var aiTab = tabs.find(function(t) { return t.isAiChat; });
    if (aiTab) {
      if (window.FBrowser.tabs.switchTab) window.FBrowser.tabs.switchTab(aiTab.id);
    } else {
      if (window.FBrowser.tabs.createTab) window.FBrowser.tabs.createTab('f://ai-chat');
    }

    setTimeout(function() {
      var input = document.getElementById('aiInput');
      if (input) {
        input.value = command;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 150) + 'px';
        input.focus();
      }
    }, 800);
  }

  function handleStandardClick() {
    var url = state.currentUrl || '';
    var command = '请帮我操作当前网页 ' + url + '，先获取页面结构，然后告诉我可以做哪些操作';
    openAiChatWithCommand(command);
    log('启动标准模式 → AI对话', 'info');
  }

  function handleMultimodalClick() {
    var url = state.currentUrl || '';
    var command = '请用多模态模式帮我操作当前网页 ' + url + '，先截图查看页面，然后告诉我你可以做什么';
    openAiChatWithCommand(command);
    log('启动多模态模式 → AI对话', 'info');
  }

  function initToolbarButtons() {
    var standardBtn = document.getElementById('btnAiBrowserStandard');
    var multimodalBtn = document.getElementById('btnAiBrowserMultimodal');

    if (standardBtn) {
      standardBtn.addEventListener('click', handleStandardClick);
    }
    if (multimodalBtn) {
      multimodalBtn.addEventListener('click', handleMultimodalClick);
    }
    updateToolbarTooltip();
  }

  function onUrlChanged(url) {
    state.currentUrl = url || '';
    state.siteSupportsStandard = false;
    updateStandardButton(false);
    detectSiteAiCapability(url);
  }

  function init() {
    if (document.getElementById('aiBrowserPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'aiBrowserPanel';
    panel.className = 'ai-browser-panel';
    panel.innerHTML =
      '<div class="ai-browser-header">' +
        '<div class="ai-browser-header-left">' +
          '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/></svg>' +
          '<span class="ai-browser-title">AI 浏览器</span>' +
          '<span class="ai-browser-mode-badge badge-standard" id="aiBrowserModeLabel">标准</span>' +
          '<div class="ai-browser-status idle" id="aiBrowserStatus"><span class="ai-status-dot"></span>就绪</div>' +
        '</div>' +
        '<div class="ai-browser-header-right">' +
          '<button class="ai-browser-btn" id="aiBrowserToggleMode" title="切换操作模式">' +
            '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.5"/></svg>' +
          '</button>' +
          '<button class="ai-browser-btn" id="aiBrowserRefresh" title="刷新截图">' +
            '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M9 6a3 3 0 1 1-.8-2" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9 2.5v2h2" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>' +
          '</button>' +
          '<button class="ai-browser-btn" id="aiBrowserClose" title="关闭面板">' +
            '<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ai-browser-body">' +
        '<div class="ai-browser-preview" id="aiBrowserPreview">' +
          '<img id="aiBrowserScreenshot" class="ai-browser-screenshot" style="display:none" alt="AI Browser Preview">' +
          '<div class="ai-virtual-mouse" id="aiVirtualMouse" style="display:none"></div>' +
          '<div class="ai-browser-empty-state" id="aiBrowserEmptyState">' +
            '<div class="ai-empty-icon">' +
              '<svg width="48" height="48" viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"/><circle cx="24" cy="22" r="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"/><path d="M18 36l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/></svg>' +
            '</div>' +
            '<div class="ai-empty-title">AI 浏览器预览</div>' +
            '<div class="ai-empty-desc">在AI对话中请求浏览网页后，此处实时显示操作截图</div>' +
            '<div class="ai-empty-steps">' +
              '<div class="ai-empty-step"><span class="ai-step-num">1</span>在AI对话中输入浏览请求</div>' +
              '<div class="ai-empty-step"><span class="ai-step-num">2</span>AI自动打开网页并操作</div>' +
              '<div class="ai-empty-step"><span class="ai-step-num">3</span>此处实时显示操作过程</div>' +
            '</div>' +
          '</div>' +
          '<div class="ai-browser-placeholder" id="aiBrowserPlaceholder" style="display:none">' +
            '<svg width="32" height="32" viewBox="0 0 32 32"><rect x="2" y="4" width="28" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="10" x2="30" y2="10" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="7" r="1.5" fill="currentColor"/><circle cx="10" cy="7" r="1.5" fill="currentColor"/><line x1="8" y1="28" x2="24" y2="28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '<span>AI 浏览器预览区</span>' +
            '<span class="ai-browser-placeholder-sub">让 AI 打开网页后此处显示截图</span>' +
          '</div>' +
        '</div>' +
        '<div class="ai-browser-sidebar">' +
          '<div class="ai-browser-sidebar-header">' +
            '<span class="ai-browser-logs-title">操作日志</span>' +
            '<button class="ai-browser-btn ai-browser-btn-sm" id="aiBrowserClearLogs" title="清空日志">' +
              '<svg width="10" height="10" viewBox="0 0 10 10"><line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1"/><line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="ai-browser-logs" id="aiBrowserLogs"></div>' +
          '<div class="ai-browser-sidebar-footer">' +
            '<div class="ai-browser-quick-actions">' +
              '<button class="ai-quick-btn" id="aiQuickScreenshot" title="截图当前页面">' +
                '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="2" width="10" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="5.5" r="1.5" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' +
                '<span>截图</span>' +
              '</button>' +
              '<button class="ai-quick-btn" id="aiQuickStructure" title="获取页面结构">' +
                '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/><rect x="7" y="1" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/><rect x="1" y="7" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/><rect x="7" y="7" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' +
                '<span>结构</span>' +
              '</button>' +
              '<button class="ai-quick-btn" id="aiQuickBack" title="后退">' +
                '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '<span>后退</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var aiMain = document.querySelector('.ai-main');
    if (aiMain) {
      aiMain.appendChild(panel);
    }

    document.getElementById('aiBrowserClose').addEventListener('click', hide);
    document.getElementById('aiBrowserToggleMode').addEventListener('click', function() {
      var newMode = state.mode === 'standard' ? 'multimodal' : 'standard';
      window.electronAPI.aiBrowserSetMode(newMode).then(function(r) {
        if (r.success) setMode(newMode);
      });
    });
    document.getElementById('aiBrowserRefresh').addEventListener('click', function() {
      if (state.activeTabId) {
        log('刷新截图...', 'info');
        window.electronAPI.aiBrowserScreenshot(state.activeTabId).then(function(r) {
          if (r.success && r.data) {
            updateScreenshot(r.data);
            log('截图已更新', 'success');
          } else {
            log('截图失败: ' + (r.error || '未知错误'), 'error');
          }
        });
      } else {
        log('没有活动的AI标签页', 'warn');
      }
    });

    var clearLogsBtn = document.getElementById('aiBrowserClearLogs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', function() {
        state.logs = [];
        renderLogs();
      });
    }

    var quickScreenshot = document.getElementById('aiQuickScreenshot');
    if (quickScreenshot) {
      quickScreenshot.addEventListener('click', function() {
        if (state.activeTabId) {
          window.electronAPI.aiBrowserScreenshot(state.activeTabId).then(function(r) {
            if (r.success && r.data) updateScreenshot(r.data);
          });
        }
      });
    }

    var quickStructure = document.getElementById('aiQuickStructure');
    if (quickStructure) {
      quickStructure.addEventListener('click', function() {
        if (state.activeTabId) {
          openAiChatWithCommand('获取当前页面的结构信息');
        }
      });
    }

    var quickBack = document.getElementById('aiQuickBack');
    if (quickBack) {
      quickBack.addEventListener('click', function() {
        if (state.activeTabId) {
          window.electronAPI.aiBrowserGoBack(state.activeTabId).then(function(r) {
            if (r.success) log('已后退', 'success');
            else log('无法后退', 'warn');
          });
        }
      });
    }

    window.electronAPI.onAIBrowserScreenshot(function(data) {
      updateScreenshot(data);
    });

    window.electronAPI.onAIBrowserMouseUpdate(function(data) {
      if (data.clicked) {
        showClickEffect(data.x, data.y);
      }
      updateMousePosition({ x: data.x, y: data.y });
    });

    initToolbarButtons();

    log('AI 浏览器模块已就绪', 'success');
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.aiBrowser = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    updateScreenshot: updateScreenshot,
    updateMousePosition: updateMousePosition,
    setMode: setMode,
    log: log,
    getState: function() { return state; },
    setActiveTab: function(tabId) { state.activeTabId = tabId; },
    onUrlChanged: onUrlChanged,
    detectSiteAiCapability: detectSiteAiCapability,
    setExecuting: function(v) { state.isExecuting = v; updateStatusIndicator(); },
    setActiveTabInfo: function(info) { state.activeTabInfo = info; updateStatusIndicator(); }
  };
})();
