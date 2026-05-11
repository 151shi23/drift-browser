(function() {
  var C, R, T, Api, S;
  var agentIsUserScrolling = false;

  function initModules() {
    C = window.AICore;
    R = window.AIRender;
    T = window.AITools;
    Api = window.AIApi;
    S = window.AISettings;
  }

  var executionLog = [];
  var MAX_LOG = 200;
  var currentTaskId = null;
  var agentState = {
    isRunning: false,
    currentStep: 0,
    totalSteps: 0,
    executionMode: 'react',
    startTime: 0,
    stepsExecuted: 0,
    toolsUsed: []
  };

  function addLog(entry) {
    entry.timestamp = Date.now();
    entry.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 4));
    executionLog.unshift(entry);
    if (executionLog.length > MAX_LOG) executionLog.length = MAX_LOG;
    renderLogPanel();
  }

  function clearLog() { executionLog = []; renderLogPanel(); }
  function getLog() { return executionLog.slice(); }

  function getActiveTask() {
    if (!currentTaskId) return null;
    var chats = C.state.chats;
    return chats.find(function(c) { return c.id === currentTaskId && c.type === 'agent'; });
  }

  function createAgentTask(title) {
    initModules();
    var chat = { id: C.generateId(), title: title || '新Agent任务', messages: [], type: 'agent', status: 'idle', createdAt: Date.now(), meta: { stepsExecuted: 0, toolsUsed: [], executionMode: 'react' } };
    var chats = C.state.chats;
    chats.unshift(chat);
    currentTaskId = chat.id;
    C.saveChats();
    renderTaskList();
    renderTimeline();
    return chat;
  }

  function switchTask(taskId) {
    currentTaskId = taskId;
    var task = getActiveTask();
    if (task) { agentState.executionMode = task.meta.executionMode || 'react'; }
    renderTaskList();
    renderTimeline();
    updateStatusBar();
  }

  async function sendMessage(text, image) {
    if (!text.trim() && !image) return;
    if (C.state.isGenerating || agentState.isRunning) return;

    var userToolCalls = T.parseToolCalls(text);
    if (userToolCalls.length > 0 && text.trim().indexOf('{') === 0) {
      var task = ensureActiveTask(text.substring(0, 30));
      task.messages.push({ id: C.generateId(), role: 'user', content: text, timestamp: Date.now() });
      for (var ui = 0; ui < userToolCalls.length; ui++) {
        var ucall = userToolCalls[ui];
        addLog({ type: 'tool_call', tool: ucall.tool || ucall.skill || ucall.mcp, params: ucall.params, status: 'executing' });
        var agentConfig = C.loadAgentConfig();
        var uResult = await T.executeToolCall(ucall, agentConfig);
        var uname = ucall.skill ? ucall.skill : (ucall.mcp ? ucall.mcp + '/' + ucall.tool : ucall.tool);
        addLog({ type: 'tool_result', tool: uname, success: uResult.success });
        task.messages.push({ id: C.generateId(), role: 'tool', toolName: uname, toolSuccess: uResult.success, content: uResult.success ? (typeof uResult.data === 'string' ? uResult.data : JSON.stringify(uResult.data)) : '错误: ' + uResult.error, timestamp: Date.now() });
        if (!uResult.success && uname) task.meta.toolsUsed.push(uname + '(失败)');
        else if (uname) task.meta.toolsUsed.push(uname);
      }
      C.saveChats(); renderTimeline();
      return;
    }

    var task = ensureActiveTask(text.substring(0, 30));
    task.messages.push({ id: C.generateId(), role: 'user', content: text, image: image || null, timestamp: Date.now() });
    if (task.messages.length === 1) { task.title = text.substring(0, 30); renderTaskList(); }
    var assistantMsg = { id: C.generateId(), role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() };
    task.messages.push(assistantMsg);
    renderTimeline();

    C.state.isGenerating = true;
    agentState.isRunning = true;
    agentState.startTime = Date.now();
    C.state.streamingContent = '';
    updateSendButton();
    updateStatusBar();

    var executionMode = Api.classifyTaskComplexity(text, task.messages);
    agentState.executionMode = executionMode;
    task.meta.executionMode = executionMode;
    C.state.executionMode = executionMode;
    C.state.executionMeta = { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null };

    var maxRounds = 5;
    if (executionMode === 'instant') maxRounds = 1;
    else if (executionMode === 'plan') maxRounds = 10;
    else if (executionMode === 'reflexion') maxRounds = 8;

    try {
      for (var round = 0; round < maxRounds; round++) {
        try {
          var onChunk = function(chunk) {
            C.state.streamingContent += chunk;
            var msg = task.messages.find(function(m) { return m.id === assistantMsg.id; });
            if (msg) {
              msg.content = C.state.streamingContent;
              var msgEl = document.querySelector('.agent-step[data-id="' + assistantMsg.id + '"] .agent-step-content');
              if (msgEl) {
                var streamEl = msgEl.querySelector('.ai-msg-streaming');
                if (streamEl) {
                  if (window.AIRenderV2) {
                    streamEl.innerHTML = window.AIRenderV2.parseMarkdown(C.state.streamingContent) + '<span class="ai-stream-cursor"></span>';
                  } else {
                    streamEl.innerHTML = C.escHtml(C.state.streamingContent) + '<span class="ai-stream-cursor"></span>';
                  }
                }
                var container = document.getElementById('agentTimeline');
                if (container && !agentIsUserScrolling) container.scrollTop = container.scrollHeight;
              }
            }
          };

          addLog({ type: 'api_request', mode: executionMode, round: round + 1, maxRounds: maxRounds });
          var result = await Api.sendRequest(task, assistantMsg.id, onChunk, executionMode, 'agent');

          if (!result.success) {
            assistantMsg.isStreaming = false;
            assistantMsg.error = result.error || '请求失败';
            addLog({ type: 'error', message: result.error, round: round });
            break;
          }

          var content = result.content || '';
          var hasToolCalls = false;
          var agentConfig = C.loadAgentConfig();

          if (result.toolCalls && result.toolCalls.length > 0) {
            hasToolCalls = true;
            for (var i = 0; i < result.toolCalls.length; i++) {
              var tc = result.toolCalls[i];
              var toolArgs = {};
              try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch(e) { toolArgs = {}; }
              var toolCallObj = { tool: tc.function.name, params: toolArgs };
              var t0 = Date.now();
              addLog({ type: 'tool_call', tool: tc.function.name, params: toolArgs, source: 'fc' });

              if (toolCallObj.tool === 'file_write' || toolCallObj.tool === 'file_delete' || toolCallObj.tool === 'shell_exec') {
                C.saveCheckpoint(task.id, '操作前: ' + toolCallObj.tool + (toolCallObj.params.path || '').substring(0, 50));
              }

              var toolResult = await T.executeToolCall(toolCallObj, agentConfig);
              var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
              addLog({ type: 'tool_result', tool: tc.function.name, success: toolResult.success, elapsed: elapsed + 's' });

              if (!toolResult.success) {
                var evalResult = T.reflexionEvaluate(toolCallObj, toolResult, C.state.executionMeta.retryCount);
                addLog({ type: 'reflexion', tool: tc.function.name, strategy: evalResult.strategy, shouldRetry: evalResult.shouldRetry });
                if (evalResult.shouldRetry) {
                  C.state.executionMeta.retryCount++;
                  var modifiedCall = T.applyReflexionStrategy(toolCallObj, evalResult);
                  var retryResult = await T.executeToolCall(modifiedCall, agentConfig);
                  var retryName = modifiedCall.skill ? modifiedCall.skill : (modifiedCall.mcp ? modifiedCall.mcp + '/' + modifiedCall.tool : modifiedCall.tool);
                  task.messages.push({ id: C.generateId(), role: 'tool', toolName: retryName, toolSuccess: retryResult.success, content: retryResult.success ? (typeof retryResult.data === 'string' ? retryResult.data : JSON.stringify(retryResult.data)) : '错误(重试后): ' + retryResult.error, timestamp: Date.now() });
                  if (retryResult.success) { C.state.executionMeta.retryCount = 0; }
                } else {
                  task.messages.push({ id: C.generateId(), role: 'tool', toolName: tc.function.name, toolSuccess: false, content: '错误: ' + toolResult.error + '\n[Reflexion]: ' + evalResult.strategy, timestamp: Date.now() });
                }
              } else {
                task.messages.push({ id: C.generateId(), role: 'tool', toolName: tc.function.name, toolSuccess: true, content: typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data), timestamp: Date.now() });
                if (task.meta.toolsUsed.indexOf(tc.function.name) === -1) task.meta.toolsUsed.push(tc.function.name);
              }
              agentState.stepsExecuted++;
              renderTimeline();
            }
          }

          if (!hasToolCalls) {
            var parsedCalls = T.parseToolCalls(content);
            if (parsedCalls.length > 0) {
              hasToolCalls = true;
              for (var j = 0; j < parsedCalls.length; j++) {
                var call = parsedCalls[j];
                var ct0 = Date.now();
                addLog({ type: 'tool_call', tool: call.tool || call.skill || call.mcp, params: call.params, source: 'regex' });

                if (call.tool === 'file_write' || call.tool === 'file_delete' || call.tool === 'shell_exec') {
                  C.saveCheckpoint(task.id, '操作前: ' + call.tool + (call.params.path || '').substring(0, 50));
                }

                var callResult = await T.executeToolCall(call, agentConfig);
                var celapsed = ((Date.now() - ct0) / 1000).toFixed(1);
                addLog({ type: 'tool_result', tool: call.tool || call.skill || call.mcp, success: callResult.success, elapsed: celapsed + 's' });

                if (!callResult.success) {
                  var callEval = T.reflexionEvaluate(call, callResult, C.state.executionMeta.retryCount);
                  if (callEval.shouldRetry) {
                    C.state.executionMeta.retryCount++;
                    var modCall = T.applyReflexionStrategy(call, callEval);
                    var retryCResult = await T.executeToolCall(modCall, agentConfig);
                    var rName = modCall.skill ? modCall.skill : (modCall.mcp ? modCall.mcp + '/' + modCall.tool : modCall.tool);
                    task.messages.push({ id: C.generateId(), role: 'tool', toolName: rName, toolSuccess: retryCResult.success, content: retryCResult.success ? (typeof retryCResult.data === 'string' ? retryCResult.data : JSON.stringify(retryCResult.data)) : '错误(重试后): ' + retryCResult.error, timestamp: Date.now() });
                    if (retryCResult.success) C.state.executionMeta.retryCount = 0;
                  } else {
                    var cn = call.skill ? call.skill : (call.mcp ? call.mcp + '/' + call.tool : call.tool);
                    task.messages.push({ id: C.generateId(), role: 'tool', toolName: cn, toolSuccess: false, content: '错误: ' + callResult.error + '\n[Reflexion]: ' + callEval.strategy, timestamp: Date.now() });
                  }
                } else {
                  var cn2 = call.skill ? call.skill : (call.mcp ? call.mcp + '/' + call.tool : call.tool);
                  task.messages.push({ id: C.generateId(), role: 'tool', toolName: cn2, toolSuccess: true, content: typeof callResult.data === 'string' ? callResult.data : JSON.stringify(callResult.data), timestamp: Date.now() });
                  if (task.meta.toolsUsed.indexOf(cn2) === -1) task.meta.toolsUsed.push(cn2);
                }
                agentState.stepsExecuted++;
                renderTimeline();
              }
            }
          }

          if (executionMode === 'plan' && !C.state.executionMeta.plan && content) {
            var planSteps = window.AIPlanner ? window.AIPlanner.parsePlanFromAIResponse(content) : [];
            if (planSteps.length > 0) {
              C.state.executionMeta.plan = planSteps;
              C.state.executionMeta.totalSteps = planSteps.length;
              agentState.totalSteps = planSteps.length;
            }
          }

          C.state.executionMeta.currentStep++;
          agentState.currentStep = C.state.executionMeta.currentStep;
          updateStatusBar();

          if (hasToolCalls) {
            var displayContent = content;
            if (content === '[调用工具]' || (content.trim().indexOf('{') === 0 && content.indexOf('"tool"') !== -1)) displayContent = '';
            else if (content) { var jR = content.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '').replace(/```\w*[\s\S]*?```/g, '').trim(); displayContent = jR || ''; }
            assistantMsg.content = displayContent;
            assistantMsg.isStreaming = false;
            assistantMsg = { id: C.generateId(), role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() };
            task.messages.push(assistantMsg);
            C.state.streamingContent = '';
            renderTimeline();
            continue;
          }

          assistantMsg.isStreaming = false;
          if (content === '[调用工具]') content = '';
          if (!content && !hasToolCalls) content = '（AI 未返回内容）';
          assistantMsg.content = content;
          break;
        } catch(roundErr) {
          if (round === 0) { assistantMsg.isStreaming = false; assistantMsg.error = roundErr.message; break; }
          assistantMsg.content = assistantMsg.content || ('执行出错: ' + (roundErr.message || '未知错误'));
          break;
        }
      }
    } catch(e) { assistantMsg.isStreaming = false; assistantMsg.error = e.message; }

    task.status = 'completed';
    task.meta.stepsExecuted = agentState.stepsExecuted;
    task.updatedAt = Date.now();

    C.state.isGenerating = false;
    agentState.isRunning = false;
    C.state.streamingContent = '';
    C.state.executionMode = 'instant';
    C.state.executionMeta = { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null };
    C.saveChats(); renderTimeline(); updateSendButton(); updateStatusBar();
    addLog({ type: 'session_complete', steps: agentState.stepsExecuted, tools: task.meta.toolsUsed.length, duration: (((Date.now() - agentState.startTime) / 1000).toFixed(1) + 's') });
  }

  function ensureActiveTask(title) {
    var task = getActiveTask();
    if (!task) { task = createAgentTask(title); }
    return task;
  }

  function stopExecution() {
    C.state.isGenerating = false;
    agentState.isRunning = false;
    C.state.streamingContent = '';
    if (Api && Api.abortActiveRequest) Api.abortActiveRequest();
    updateSendButton();
    updateStatusBar();
    addLog({ type: 'manual_stop' });
    C.showNotification('已停止执行', 'info');
  }

  function init() {
    initModules();
    var container = document.getElementById('aiAgentPage');
    if (!container) return;
    if (container.hasChildNodes()) return;
    var config = C.loadConfig();
    container.innerHTML = '<div class="agent-layout">'
      + '<div class="agent-sidebar" id="agentSidebar">'
        + '<div class="agent-sidebar-header"><span class="agent-sidebar-title">任务</span><button class="agent-new-task-btn" id="agentNewTaskBtn">+ 新任务</button></div>'
        + '<div class="agent-task-list" id="agentTaskList"></div>'
        + '<div class="agent-sidebar-section"><div class="agent-section-title">执行日志</div><button class="agent-clear-log-btn" id="agentClearLogBtn">清空</button></div>'
        + '<div class="agent-log-list" id="agentLogList"></div>'
      + '</div>'
      + '<div class="agent-main">'
        + '<div class="agent-main-header">'
          + '<div class="agent-main-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 014 4v2a9 9 0 01-9 9H5a2 2 0 01-2-2v-2a4 4 0 014-4h2z"/><circle cx="8" cy="14" r="3"/><path d="M16 6l4 4-4 4"/></svg> AI Agent</div>'
          + '<div class="agent-main-actions">'
            + '<button class="agent-header-btn agent-stop-btn" id="agentStopBtn" title="停止执行" style="display:none"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/></svg> 停止</button>'
            + '<button class="agent-header-btn" id="agentSettingsBtn" title="设置">⚙</button>'
            + '<button class="agent-header-btn" id="agentCloseBtn" title="关闭">✕</button>'
          + '</div>'
        + '</div>'
        + '<div class="agent-timeline" id="agentTimeline"></div>'
        + '<div class="agent-input-area">'
          + '<textarea class="agent-input" id="agentInput" placeholder="输入任务指令...（如：搜索XX并整理成表格）" rows="1"></textarea>'
          + '<button class="agent-send-btn" id="agentSendBtn"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8l12-5-5 12z" fill="currentColor"/></svg></button>'
        + '</div>'
        + '<div class="agent-status-bar" id="agentStatusBar"><span class="status-mode" id="agentStatusMode">就绪</span><span class="status-steps" id="agentStatusSteps"></span><span class="status-time" id="agentStatusTime"></span></div>'
      + '</div>'
    + '</div>';
    bindEvents();
  }

  function bindEvents() {
    var input = document.getElementById('agentInput');
    var sendBtn = document.getElementById('agentSendBtn');
    var newTaskBtn = document.getElementById('agentNewTaskBtn');
    var closeBtn = document.getElementById('agentCloseBtn');
    var stopBtn = document.getElementById('agentStopBtn');
    var clearLogBtn = document.getElementById('agentClearLogBtn');
    if (input) { input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var t = input.value.trim(); if (t) { input.value = ''; input.style.height = 'auto'; sendMessage(t); } } }); input.addEventListener('input', function() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }); }
    if (sendBtn) sendBtn.addEventListener('click', function() { var t = document.getElementById('agentInput').value.trim(); if (t) { document.getElementById('agentInput').value = ''; document.getElementById('agentInput').style.height = 'auto'; sendMessage(t); } });
    if (newTaskBtn) newTaskBtn.addEventListener('click', function() { createAgentTask('新任务'); });
    if (closeBtn) closeBtn.addEventListener('click', function() { if (window.FBrowser && window.FBrowser.tabs) { var t = (window.FBrowser.tabs.tabs || []).find(function(t) { return t.isAiAgent; }); if (t) window.FBrowser.tabs.closeTab(t.id); } });
    if (stopBtn) stopBtn.addEventListener('click', stopExecution);
    if (clearLogBtn) clearLogBtn.addEventListener('click', clearLog);
    var settingsBtn = document.getElementById('agentSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', function() { if (window.AISettings) window.AISettings.open(); });
  }

  function renderTaskList() {
    var list = document.getElementById('agentTaskList');
    if (!list) return;
    var agentTasks = C.state.chats.filter(function(c) { return c.type === 'agent'; });
    var html = '';
    agentTasks.forEach(function(t) {
      var isActive = t.id === currentTaskId;
      var statusCls = t.status === 'running' ? 'running' : t.status === 'completed' ? 'done' : t.status === 'failed' ? 'error' : 'idle';
      html += '<div class="agent-task-item' + (isActive ? ' active' : '') + '" data-id="' + t.id + '">'
        + '<span class="agent-task-status ' + statusCls + '"></span>'
        + '<span class="agent-task-title">' + C.escHtml(t.title) + '</span>'
        + '<span class="agent-task-meta">' + t.messages.length + '条 · ' + (t.meta.toolsUsed || []).length + '工具</span>'
      + '</div>';
    });
    list.innerHTML = html || '<div class="agent-empty-tasks">暂无任务</div>';
    list.querySelectorAll('.agent-task-item').forEach(function(el) {
      el.addEventListener('click', function() { switchTask(el.getAttribute('data-id')); });
    });
  }

  function renderTimeline() {
    var container = document.getElementById('agentTimeline');
    if (!container) return;
    var task = getActiveTask();
    if (!task || !task.messages || task.messages.length === 0) {
      container.innerHTML = '<div class="agent-welcome">'
        + '<div class="agent-welcome-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ai-accent)" stroke-width="1"><path d="M12 2a4 4 0 014 4v2a9 9 0 01-9 9H5a2 2 0 01-2-2v-2a4 4 0 014-4h2z"/><circle cx="8" cy="14" r="3"/><path d="M16 6l4 4-4 4"/></svg></div>'
        + '<div class="agent-welcome-title">Agent 就绪</div>'
        + '<div class="agent-welcome-desc">输入任务指令开始执行，支持多步骤任务、浏览器自动化、文件操作等</div>'
        + '<div class="agent-mode-cards">'
          + '<div class="agent-mode-card" data-prompt="帮我搜索最新的AI Agent框架并整理成对比表格"><div class="agent-mode-card-icon">📊</div><div class="agent-mode-card-label">搜索+整理</div></div>'
          + '<div class="agent-mode-card" data-prompt="读取当前项目目录并列出所有文件"><div class="agent-mode-card-icon">📁</div><div class="agent-mode-card-label">文件浏览</div></div>'
          + '<div class="agent-mode-card" data-prompt="打开百度首页截图"><div class="agent-mode-card-icon">🌐</div><div class="agent-mode-card-label">浏览器操作</div></div>'
          + '<div class="agent-mode-card" data-prompt="获取当前系统信息"><div class="agent-mode-card-icon">💻</div><div class="agent-mode-card-label">系统信息</div></div>'
        + '</div>'
      + '</div>';
      return;
    }

    var html = '<div class="agent-timeline-inner">';
    task.messages.forEach(function(msg, idx) {
      if (msg.role === 'user') {
        html += '<div class="agent-step agent-step-user" data-id="' + msg.id + '">'
          + '<div class="agent-step-node user"></div>'
          + '<div class="agent-step-body">'
            + '<div class="agent-step-label">用户指令</div>'
            + '<div class="agent-step-content">' + C.escHtml(msg.content) + '</div>'
          + '</div>'
        + '</div>';
      } else if (msg.role === 'assistant') {
        var cont = msg.isStreaming ? (C.state.streamingContent || '') : (msg.content || '');
        var stepType = msg.isStreaming ? 'running' : 'done';
        if (msg.error) stepType = 'error';

        html += '<div class="agent-step agent-step-ai" data-id="' + msg.id + '">'
          + '<div class="agent-step-node ' + stepType + '"></div>'
          + '<div class="agent-step-body">';

        if (msg.error) {
          html += '<div class="agent-step-label">AI 响应 · 错误</div>'
            + '<div class="agent-step-content agent-step-error">' + C.escHtml(msg.error) + '</div>';
        } else if (msg.isStreaming) {
          html += '<div class="agent-step-label">AI 思考中...</div>'
            + '<div class="agent-step-content"><div class="ai-msg-streaming">';
          if (cont) {
            html += (window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(cont) : C.escHtml(cont));
          }
          html += '<span class="ai-stream-cursor"></span></div></div>';
        } else {
          html += '<div class="agent-step-label">AI 响应</div>'
            + '<div class="agent-step-content">' + (window.AIRenderV2 ? window.AIRenderV2.parseMarkdown(cont) : C.escHtml(cont)) + '</div>';
        }

        html += '</div></div>';
      } else if (msg.role === 'tool') {
        var toolStatus = msg.toolSuccess ? 'done' : 'error';
        var displayName = T ? T.getBrowserToolDisplayName(msg.toolName) : msg.toolName;

        html += '<div class="agent-step agent-step-tool" data-id="' + msg.id + '">'
          + '<div class="agent-step-node ' + toolStatus + '"></div>'
          + '<div class="agent-step-body">';

        if (window.AIRenderV2) {
          html += window.AIRenderV2.renderAgentToolCard({
            name: displayName || msg.toolName,
            input: msg.toolInput || '',
            result: msg.content,
            status: msg.toolSuccess ? 'ok' : 'error'
          });
        } else {
          var sIcon = msg.toolSuccess ? '✓' : '✕';
          var sClass = msg.toolSuccess ? 'tool-success' : 'tool-error';
          html += '<div class="agent-step-label">工具 · ' + C.escHtml(displayName || msg.toolName) + ' ' + sIcon + '</div>'
            + '<div class="agent-step-content ' + sClass + '">' + C.escHtml((msg.content || '').substring(0, 200)) + '</div>';
        }

        html += '</div></div>';
      }
    });
    html += '</div>';

    if (agentState.isRunning) {
      html += '<div class="agent-progress-bar"><div class="agent-progress-fill" style="width:' + (agentState.totalSteps > 0 ? Math.round(agentState.currentStep / agentState.totalSteps * 100) : 0) + '%"></div></div>';
    }

    container.innerHTML = html;
    if (!agentIsUserScrolling) container.scrollTop = container.scrollHeight;

    var scrollHandler = container._agentScrollHandler;
    if (!scrollHandler) {
      scrollHandler = function() {
        var distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        agentIsUserScrolling = distFromBottom > 100;
      };
      container._agentScrollHandler = scrollHandler;
      container.addEventListener('scroll', scrollHandler);
    }
  }

  function renderLogPanel() {
    var list = document.getElementById('agentLogList');
    if (!list) return;
    var html = '';
    var recentLogs = executionLog.slice(0, 50);
    recentLogs.forEach(function(log) {
      var icon = log.type === 'tool_call' ? '⟳' : log.type === 'tool_result' ? (log.success ? '✓' : '✕') : log.type === 'error' ? '✕' : log.type === 'reflexion' ? '🔄' : '•';
      var cls = log.type === 'error' || (log.type === 'tool_result' && !log.success) ? 'log-error' : log.type === 'tool_result' ? 'log-success' : '';
      var time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('zh-CN', {hour12:false}).substring(0, 8) : '';
      var text = '';
      if (log.type === 'tool_call') text = (log.tool || '') + ' ' + (log.params ? JSON.stringify(log.params).substring(0, 40) : '');
      else if (log.type === 'tool_result') text = (log.tool || '') + ' ' + (log.elapsed || '');
      else if (log.type === 'error') text = log.message || (log.round ? 'Round ' + log.round : '');
      else if (log.type === 'reflexion') text = log.strategy ? log.strategy.substring(0, 40) : '';
      else if (log.type === 'session_complete') text = '完成: ' + (log.steps || 0) + '步 ' + (log.tools || 0) + '工具 ' + (log.duration || '');
      else text = log.mode || '';
      html += '<div class="agent-log-entry ' + cls + '" data-id="' + (log.id || '') + '"><span class="log-time">' + time + '</span><span class="log-icon">' + icon + '</span><span class="log-text">' + C.escHtml(text) + '</span></div>';
    });
    list.innerHTML = html || '<div class="agent-empty-log">暂无日志</div>';
  }

  function updateStatusBar() {
    var modeEl = document.getElementById('agentStatusMode');
    var stepsEl = document.getElementById('agentStatusSteps');
    var timeEl = document.getElementById('agentStatusTime');
    var stopBtn = document.getElementById('agentStopBtn');
    if (modeEl) {
      var modeLabel = { instant: '即时', react: 'ReAct', plan: '规划', reflexion: '反思' };
      modeEl.textContent = (agentState.isRunning ? '▶ ' : '') + (modeLabel[agentState.executionMode] || agentState.executionMode);
    }
    if (stepsEl) stepsEl.textContent = agentState.isRunning ? ('步骤 ' + agentState.currentStep + '/' + (agentState.totalSteps || '-')) : '';
    if (timeEl) timeEl.textContent = agentState.isRunning ? (((Date.now() - agentState.startTime) / 1000).toFixed(0) + 's') : '';
    if (stopBtn) stopBtn.style.display = agentState.isRunning ? '' : 'none';
  }

  function updateSendButton() {
    var btn = document.getElementById('agentSendBtn');
    if (!btn) return;
    btn.disabled = C.state.isGenerating || agentState.isRunning;
    if (C.state.isGenerating || agentState.isRunning) btn.innerHTML = '<span class="agent-send-loading"></span>';
    else btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8l12-5-5 12z" fill="currentColor"/></svg>';
  }

  function activate() {
    initModules();
    var page = document.getElementById('aiAgentPage');
    if (!page) return;
    if (!page.hasChildNodes()) init();
    if (C.initFromAIState) C.initFromAIState();
    C.loadChats();
    if (!currentTaskId) {
      var agentTasks = C.state.chats.filter(function(c) { return c.type === 'agent'; });
      if (agentTasks.length > 0) { currentTaskId = agentTasks[0].id; }
      else { createAgentTask('新任务'); }
    }
    renderTaskList();
    renderTimeline();
    renderLogPanel();
    updateStatusBar();
    if (R && R.updateModelDatalist) R.updateModelDatalist();
    document.addEventListener('click', function(e) { var card = e.target.closest('.agent-mode-card'); if (card) { var p = card.getAttribute('data-prompt'); if (p) sendMessage(p); } });
  }

  function openAsTab() {
    if (window.FBrowser && window.FBrowser.tabs) {
      var existing = (window.FBrowser.tabs.tabs || []).find(function(t) { return t.isAiAgent; });
      if (existing) { window.FBrowser.tabs.switchTab(existing.id); return; }
      window.FBrowser.tabs.createTab('f://ai-agent');
    }
  }

  function exportLog() {
    var text = executionLog.map(function(l) {
      var time = l.timestamp ? new Date(l.timestamp).toISOString() : '';
      return '[' + time + '] ' + (l.type || '') + ' ' + (l.tool || '') + ' ' + (l.message || (l.params ? JSON.stringify(l.params) : ''));
    }).join('\n');
    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'agent-log-' + Date.now() + '.txt'; a.click(); URL.revokeObjectURL(url);
    C.showNotification('日志已导出', 'success');
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.aiAgent = {
    open: openAsTab,
    activate: activate,
    runTask: sendMessage,
    stopTask: stopExecution,
    exportLog: exportLog,
    rollback: function(msgId) {
      var task = getActiveTask();
      if (!task) { C.showNotification('没有活动任务', 'warning'); return; }
      var cps = C.loadCheckpoints(task.id);
      if (cps.length === 0) { C.showNotification('没有回滚点', 'warning'); return; }
      if (C.restoreCheckpoint(task.id, cps[0].id)) { C.showNotification('已回滚', 'success'); renderTimeline(); }
      else { C.showNotification('回滚失败', 'error'); }
    },
    getLog: getLog,
    getState: function() { return agentState; }
  };
})();
