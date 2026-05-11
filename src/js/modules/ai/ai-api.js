(function() {
  var FC_PROVIDERS = ['openai', 'anthropic', 'google', 'mimo', 'ollama', 'moonshot'];
  var RETRYABLE_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'fetch failed', 'network', 'timeout', '429'];
  var NON_RETRYABLE_ERRORS = ['401', '403', 'invalid api key', 'authentication', 'unauthorized'];

  var _activeAbortController = null;
  var _requestQueue = [];
  var _isProcessingQueue = false;

  function isRetryable(err) {
    if (!err) return false;
    var msg = (err.message || err.error || '').toLowerCase();
    for (var i = 0; i < NON_RETRYABLE_ERRORS.length; i++) { if (msg.indexOf(NON_RETRYABLE_ERRORS[i]) !== -1) return false; }
    for (var j = 0; j < RETRYABLE_ERRORS.length; j++) { if (msg.indexOf(RETRYABLE_ERRORS[j]) !== -1) return true; }
    return false;
  }

  function retryWithBackoff(fn, maxRetries, baseDelay) {
    maxRetries = maxRetries || 2;
    baseDelay = baseDelay || 1000;
    return fn().catch(function(err) {
      if (maxRetries <= 0 || !isRetryable(err)) throw err;
      var delay = baseDelay * Math.pow(2, (2 - maxRetries)) + Math.random() * 500;
      console.log('[AI API] 重试 (' + (3 - maxRetries) + '/' + 2 + ')，延迟 ' + Math.round(delay) + 'ms');
      return new Promise(function(resolve) { setTimeout(resolve, delay); }).then(function() {
        return retryWithBackoff(fn, maxRetries - 1, baseDelay);
      });
    });
  }

  function classifyTaskComplexity(userMessage, chatMessages) {
    if (!userMessage) return 'react';
    var msg = userMessage.toLowerCase();

    var instantPatterns = [
      /^(你好|hi|hello|hey|嗨|早上好|晚上好|下午好|早安|晚安)[\s!！。.]*$/i,
      /^(谢谢|感谢|thanks|thank you|thx)[\s!！。.]*$/i,
      /^(再见|bye|goodbye|拜拜)[\s!！。.]*$/i,
      /^(是|否|对|不对|好的|ok|okay)[\s!！。.]*$/i
    ];
    for (var i = 0; i < instantPatterns.length; i++) {
      if (instantPatterns[i].test(msg.trim())) return 'instant';
    }

    var reflexionKeywords = ['重试', '再试一次', '换种方式', '换个方法', '重新尝试', 'retry', 'try again', 'another way', '换个思路'];
    for (var r = 0; r < reflexionKeywords.length; r++) {
      if (msg.indexOf(reflexionKeywords[r]) !== -1) return 'reflexion';
    }

    var planKeywords = [
      '搜索.*整理', '调研', '分析.*生成', '对比.*总结', '收集.*汇总',
      '查找.*整理', '搜索.*总结', '调研.*报告', '分析.*报告',
      '多步', '分步', '逐步', '先.*再.*然后', '第一步.*第二步',
      'research', 'compare.*summarize', 'search.*organize',
      '综合分析', '全面分析', '深度分析', '系统分析',
      '制定.*计划', '规划.*方案', '设计.*方案'
    ];
    for (var p = 0; p < planKeywords.length; p++) {
      try {
        if (new RegExp(planKeywords[p], 'i').test(msg)) return 'plan';
      } catch(e) {}
    }

    var toolKeywords = [
      '读取', '打开', '写入', '创建', '删除', '截图', '点击', '输入',
      '运行', '执行', '查看', '列出', '导航', '滚动',
      'read', 'open', 'write', 'create', 'delete', 'screenshot',
      'click', 'input', 'run', 'execute', 'list', 'navigate',
      '文件', '目录', '文件夹', '命令', '剪贴板',
      'browser', 'tab', 'url', '网页', '网站'
    ];
    var toolMatchCount = 0;
    for (var t = 0; t < toolKeywords.length; t++) {
      if (msg.indexOf(toolKeywords[t]) !== -1) toolMatchCount++;
    }
    if (toolMatchCount >= 2) return 'plan';
    if (toolMatchCount >= 1) return 'react';

    var questionPatterns = [
      /^(什么是|什么是|what is|什么是|解释|explain|如何|how to|怎么)/i,
      /^(为什么|why|原因)/i,
      /^(区别|差异|不同|difference)/i
    ];
    var isQuestion = false;
    for (var q = 0; q < questionPatterns.length; q++) {
      if (questionPatterns[q].test(msg.trim())) { isQuestion = true; break; }
    }
    if (isQuestion && toolMatchCount === 0) return 'instant';

    if (chatMessages && chatMessages.length > 6) return 'plan';

    return 'react';
  }

  function buildSystemPrompt(forceRefresh, mode) {
    var C = window.AICore;
    var now = Date.now();
    if (!forceRefresh && C.state.systemPromptCache && now - C.state.systemPromptCacheTime < 300000 && C.state._lastPromptMode === mode) {
      return C.state.systemPromptCache;
    }

    var layers = [];

    var identityLayer = [];
    if (C.SYSTEM_RULES.identity) {
      C.SYSTEM_RULES.identity.forEach(function(rule) { if (rule) identityLayer.push(rule); });
    }
    layers.push(identityLayer.join('\n'));

    var constraintLayer = [];
    if (C.SYSTEM_RULES.safety) {
      C.SYSTEM_RULES.safety.forEach(function(rule) { if (rule) constraintLayer.push(rule); });
    }
    if (C.SYSTEM_RULES.behavior) {
      constraintLayer.push('');
      C.SYSTEM_RULES.behavior.forEach(function(rule) { if (rule) constraintLayer.push(rule); });
    }
    layers.push(constraintLayer.join('\n'));

    if (mode !== 'chat') {
      var agentConfig = C.loadAgentConfig();
      if (agentConfig.agentEnabled) {
        var toolLayer = [];
        toolLayer.push('【可用工具 - 按类别】');

        var fileTools = ['file_read', 'file_write', 'file_list', 'file_mkdir', 'file_delete', 'file_move'];
        var systemTools = ['system_info', 'process_list', 'shell_exec', 'app_launch', 'app_open_url'];
        var clipboardTools = ['clipboard_read', 'clipboard_write'];
        var browserTools = ['browser_create_tab', 'browser_navigate', 'browser_screenshot', 'browser_get_structure', 'browser_click', 'browser_input', 'browser_scroll', 'browser_mouse_move', 'browser_close_tab', 'browser_go_back', 'browser_go_forward', 'browser_list_tabs'];

        toolLayer.push('\n📁 文件操作:');
        fileTools.forEach(function(t) { toolLayer.push('- ' + t); });
        toolLayer.push('\n💻 系统操作:');
        systemTools.forEach(function(t) { toolLayer.push('- ' + t); });
        toolLayer.push('\n📋 剪贴板:');
        clipboardTools.forEach(function(t) { toolLayer.push('- ' + t); });
        toolLayer.push('\n🌐 浏览器自动化:');
        browserTools.forEach(function(t) { toolLayer.push('- ' + t); });

        toolLayer.push('\n【调用方式】回复第一行直接输出工具调用JSON：');
        toolLayer.push('{"tool":"工具名","params":{"key":"value"}}');
        toolLayer.push('【规则】每次只调用一个工具，等待结果后再决定下一步。');

        var skills = C.getEnabledSkills(agentConfig);
        if (skills.length > 0) {
          toolLayer.push('\n【可用技能】');
          skills.forEach(function(s) { toolLayer.push('- ' + s.name + ': ' + s.description); });
          toolLayer.push('使用技能时回复：{"skill":"技能id","params":{"key":"value"}}');
        }

        layers.push(toolLayer.join('\n'));
      }

      var exampleLayer = [];
      exampleLayer.push('【使用示例】');
      exampleLayer.push('示例1-读取文件: 用户:"读取C:/test.txt" → {"tool":"file_read","params":{"path":"C:/test.txt"}}');
      exampleLayer.push('示例2-浏览器操作: 用户:"打开百度搜索AI" → 先{"tool":"browser_create_tab","params":{"url":"https://www.baidu.com"}} → 获取结构 → 输入搜索 → 点击搜索');
      exampleLayer.push('示例3-多步骤任务: 用户:"搜索XX并整理" → 先制定计划，再逐步执行');
      layers.push(exampleLayer.join('\n'));
    }

    var outputLayer = [];
    if (C.SYSTEM_RULES.format) {
      C.SYSTEM_RULES.format.forEach(function(rule) { if (rule) outputLayer.push(rule); });
    }
    if (C.SYSTEM_RULES.quality) {
      outputLayer.push('');
      C.SYSTEM_RULES.quality.forEach(function(rule) { if (rule) outputLayer.push(rule); });
    }
    if (C.SYSTEM_RULES.optimization) {
      outputLayer.push('');
      C.SYSTEM_RULES.optimization.forEach(function(rule) { if (rule) outputLayer.push(rule); });
    }
    layers.push(outputLayer.join('\n'));

    var customLayer = [];
    var customRules = C.loadCustomRules();
    if (customRules.enabled && customRules.content) {
      customLayer.push('【自定义规则】');
      customRules.content.split('\n').forEach(function(line) { if (line.trim()) customLayer.push(line.trim()); });
    }
    var config = C.loadConfig();
    if (config.systemPrompt) {
      customLayer.push('【用户指令】');
      customLayer.push(config.systemPrompt);
    }
    if (customLayer.length > 0) {
      layers.push(customLayer.join('\n'));
    }

    if (mode === 'chat') {
      var chatConstraint = [];
      chatConstraint.push('【纯对话模式】');
      chatConstraint.push('你当前处于纯对话模式。请直接回答用户的问题，不要输出任何工具调用格式（如 {"tool":...} 或 JSON）。');
      chatConstraint.push('- 不要输出 JSON 格式的内容');
      chatConstraint.push('- 不要提及任何工具名称或参数');
      chatConstraint.push('- 直接用自然语言回复用户即可');
      layers.push(chatConstraint.join('\n'));
    }

    var prompt = layers.filter(function(l) { return l && l.length > 0; }).join('\n\n');
    C.state.systemPromptCache = prompt;
    C.state.systemPromptCacheTime = now;
    C.state._lastPromptMode = mode;
    return prompt;
  }

  function compactToolResult(content, maxLen) {
    if (!maxLen) maxLen = 2000;
    if (!content || content.length <= maxLen) return content;
    var headLen = Math.floor(maxLen * 0.4);
    var tailLen = Math.floor(maxLen * 0.4);
    var head = content.substring(0, headLen);
    var tail = content.substring(content.length - tailLen);
    return head + '\n...[已截断，原始长度: ' + content.length + '字符]...\n' + tail;
  }

  function compactMessages(messages) {
    if (!messages || messages.length <= 8) return messages;

    var systemMsgs = messages.filter(function(m) { return m.role === 'system'; });
    var otherMsgs = messages.filter(function(m) { return m.role !== 'system'; });

    if (otherMsgs.length <= 6) return messages;

    var recentMsgs = otherMsgs.slice(-5);
    var oldMsgs = otherMsgs.slice(0, otherMsgs.length - 5);

    var summaryParts = [];
    var lastUserIntent = '';
    var toolCallsSummary = [];

    for (var i = 0; i < oldMsgs.length; i++) {
      var msg = oldMsgs[i];
      if (msg.role === 'user' && msg.content) {
        var contentStr = typeof msg.content === 'string' ? msg.content : '';
        if (contentStr.length > 100) contentStr = contentStr.substring(0, 100) + '...';
        lastUserIntent = contentStr;
      } else if (msg.role === 'assistant' && msg.content) {
        var assistStr = typeof msg.content === 'string' ? msg.content : '';
        if (assistStr.length > 80) assistStr = assistStr.substring(0, 80) + '...';
        if (assistStr.trim()) summaryParts.push('AI回答: ' + assistStr);
      } else if (msg.role === 'tool' || (msg.role === 'user' && msg.content && msg.content.indexOf('[工具结果]') === 0)) {
        var toolStr = typeof msg.content === 'string' ? msg.content : '';
        if (toolStr.indexOf('[工具结果]') === 0) toolStr = toolStr.substring(5);
        if (toolStr.length > 60) toolStr = toolStr.substring(0, 60) + '...';
        var toolName = msg.toolName || '工具';
        toolCallsSummary.push(toolName + (msg.toolSuccess ? '成功' : '失败'));
      }
    }

    var summaryContent = '[对话历史摘要] ';
    if (lastUserIntent) summaryContent += '用户最近询问: ' + lastUserIntent + '。';
    if (toolCallsSummary.length > 0) summaryContent += '已执行工具: ' + toolCallsSummary.join(', ') + '。';
    if (summaryParts.length > 0) {
      var lastSummary = summaryParts[summaryParts.length - 1];
      summaryContent += lastSummary;
    }

    var summaryMsg = { role: 'system', content: summaryContent };

    return systemMsgs.concat([summaryMsg]).concat(recentMsgs);
  }

  function buildApiMessages(chat, providerKey, mode) {
    var C = window.AICore;
    var messages = chat.messages.filter(function(m) { return !m.isStreaming && !m.error; }).map(function(m) {
      var content = m.content;
      if (m.role === 'tool') {
        var rawContent = typeof content === 'string' ? content : JSON.stringify(content);
        content = '[工具结果] ' + compactToolResult(rawContent, 2000);
      }
      var msg = { role: m.role === 'tool' ? 'user' : m.role, content: content };
      if (m.image && providerKey === 'openai') msg.content = [{ type: 'text', text: m.content || '' }, { type: 'image_url', image_url: { url: m.image } }];
      return msg;
    });
    messages.unshift({ role: 'system', content: buildSystemPrompt(mode) });
    var compacted = compactMessages(messages);
    return C.truncateMessages(compacted, 20);
  }

  function handleStreamRequest(reqParams, onChunk) {
    return new Promise(function(resolve) {
      reqParams.stream = true;
      var fullContent = '';
      var toolCalls = [];
      var currentToolCallName = '';
      var currentToolCallArgs = '';
      var isDone = false;
      var timeoutId = setTimeout(function() {
        if (!isDone) { isDone = true; cleanup(); resolve({ success: false, error: '流式请求超时（120秒）' }); }
      }, 120000);

      if (_activeAbortController) {
        _activeAbortController._cleanup = function() {
          if (!isDone) { isDone = true; clearTimeout(timeoutId); cleanup(); resolve({ success: false, error: '请求已取消' }); }
        };
      }

      window.electronAPI.aiChatStreamStart(reqParams);

      function onStreamData(data) {
        if (isDone) return;
        if (data.type === 'chunk') {
          fullContent += data.content || '';
          if (onChunk) onChunk(data.content || '');
        } else if (data.type === 'tool_call_start') {
          currentToolCallName = data.name || '';
          currentToolCallArgs = '';
        } else if (data.type === 'tool_call_delta') {
          currentToolCallArgs += data.arguments || '';
        } else if (data.type === 'tool_call_end') {
          toolCalls.push({ function: { name: currentToolCallName, arguments: currentToolCallArgs } });
        } else if (data.type === 'done') {
          if (isDone) return;
          isDone = true; clearTimeout(timeoutId); cleanup();
          var response = { success: true, content: fullContent };
          if (toolCalls.length > 0) response.toolCalls = toolCalls;
          resolve(response);
        } else if (data.type === 'error') {
          if (isDone) return;
          isDone = true; clearTimeout(timeoutId); cleanup();
          resolve({ success: false, error: data.error || '流式请求失败' });
        }
      }

      function cleanup() {
        try { window.electronAPI.removeAiStreamListener(onStreamData); } catch(e) {}
        if (_activeAbortController && _activeAbortController._cleanup === cleanup) {
          _activeAbortController = null;
        }
      }

      window.electronAPI.onAiStreamChunk(onStreamData);
    });
  }

  async function sendApiRequest(reqParams) {
    return retryWithBackoff(function() {
      return window.electronAPI.aiChatRequest(reqParams);
    }, 2, 1000);
  }

  async function sendRequest(chat, assistantMsgId, onChunk, executionMode, mode) {
    var C = window.AICore;
    var config = C.loadConfig();
    var agentConfig = C.loadAgentConfig();
    var providerKey = config.provider || 'openai';
    var provider = C.PROVIDERS[providerKey];
    var apiKey = config[provider.keyField] || '';
    if (providerKey === 'custom') apiKey = config.customApiKey || '';
    else if (providerKey === 'ollama') apiKey = 'ollama';
    if (!apiKey && providerKey !== 'ollama') return { success: false, error: '请先在设置中配置 ' + provider.name + ' API Key' };

    var apiMessages = buildApiMessages(chat, providerKey, mode);
    var modelId = config.modelId || 'gpt-3.5-turbo';
    var baseUrl = provider.baseUrl;
    if (providerKey === 'custom') baseUrl = config.customBaseUrl || 'https://api.openai.com/v1';
    else if (providerKey === 'ollama') baseUrl = config.ollamaBaseUrl || 'http://localhost:11434/v1';

    var useStream = config.streamEnabled !== false;
    var reqParams = { provider: providerKey, baseUrl: baseUrl, apiKey: apiKey, model: modelId, messages: apiMessages, temperature: config.temperature || 0.7, maxTokens: config.maxTokens || 4096, stream: useStream, msgId: assistantMsgId };

    if (mode === 'chat' || executionMode === 'instant') {
      delete reqParams.tools;
    } else if (agentConfig.agentEnabled && FC_PROVIDERS.indexOf(providerKey) !== -1) {
      try { var toolsResult = await window.electronAPI.aiAgentGetTools(); if (toolsResult.success && toolsResult.tools && toolsResult.tools.length > 0) reqParams.tools = toolsResult.tools; } catch(e) {}
    }

    if (executionMode === 'plan') {
      var planInstruction = '\n\n【规划模式指令】\n你正在执行一个多步骤任务。请先制定执行计划，然后逐步执行。\n输出格式：\n## 执行计划\n1. [步骤描述]\n2. [步骤描述]\n...\n\n然后按计划逐步调用工具执行，每步确认结果后再进行下一步。如果某步失败，分析原因并调整策略。';
      var lastSystemMsg = null;
      for (var si = 0; si < reqParams.messages.length; si++) {
        if (reqParams.messages[si].role === 'system') lastSystemMsg = reqParams.messages[si];
      }
      if (lastSystemMsg) {
        lastSystemMsg.content = lastSystemMsg.content + planInstruction;
      }
    }

    _activeAbortController = { _cleanup: null };

    var result;
    if (useStream) {
      result = await handleStreamRequest(reqParams, onChunk);
    } else {
      result = await sendApiRequest(reqParams);
    }

    _activeAbortController = null;

    if (!result.success) {
      var errMsg = result.error || '请求失败';
      if (errMsg === '请求已取消') return result;
      if (errMsg.indexOf('function call') !== -1 || errMsg.indexOf('Function') !== -1 || errMsg.indexOf('20037') !== -1) {
        delete reqParams.tools; reqParams.stream = false;
        result = await sendApiRequest(reqParams);
      } else if (errMsg.indexOf('stream') !== -1 || errMsg.indexOf('Stream') !== -1) {
        reqParams.stream = false;
        result = await sendApiRequest(reqParams);
      }
    }

    return result;
  }

  function abortActiveRequest() {
    if (_activeAbortController && _activeAbortController._cleanup) {
      _activeAbortController._cleanup();
      _activeAbortController = null;
    }
  }

  async function refreshModels(provider) {
    var C = window.AICore;
    var config = C.loadConfig();
    var pc = C.PROVIDERS[provider];
    if (!pc || provider === 'custom') return { success: false, error: '不支持' };
    var apiKey = config[pc.keyField];
    if (!apiKey && provider !== 'ollama') return { success: false, error: '请先配置API Key' };
    var r = await window.electronAPI.aiGetModels({ provider: provider, baseUrl: pc.baseUrl, apiKey: apiKey || 'ollama' });
    if (r.success && r.models.length > 0) { C.state.dynamicModels[provider] = r.models; C.saveModelsCache(); }
    return r;
  }

  async function refreshAllModels() {
    var C = window.AICore;
    if (C.state.isLoadingModels) return;
    C.state.isLoadingModels = true;
    var config = C.loadConfig();
    var keys = ['siliconflow','scnet','openai','deepseek','aliyun','zhipu','moonshot','google','mimo','ollama'];
    var ok = 0;
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i];
      if (config[C.PROVIDERS[p].keyField] || p === 'ollama') {
        var r = await refreshModels(p);
        if (r.success) ok++;
      }
    }
    C.state.isLoadingModels = false;
    if (ok > 0) C.showNotification('已刷新 ' + ok + ' 个服务商的模型列表', 'success');
    return ok;
  }

  async function loadRulesFromFile() {
    try {
      var C = window.AICore;
      if (C.state._rulesCache && Date.now() - (C.state._rulesCacheTime || 0) < 60000) return C.state._rulesCache;
      var result = await window.electronAPI.aiGetRulesFile();
      if (result.success && result.content) {
        C.state._rulesCache = result.content;
        C.state._rulesCacheTime = Date.now();
        return result.content;
      }
    } catch(e) {}
    return null;
  }

  window.AIApi = {
    FC_PROVIDERS: FC_PROVIDERS,
    classifyTaskComplexity: classifyTaskComplexity,
    buildSystemPrompt: buildSystemPrompt,
    buildApiMessages: buildApiMessages,
    sendRequest: sendRequest,
    handleStreamRequest: handleStreamRequest,
    refreshModels: refreshModels,
    refreshAllModels: refreshAllModels,
    loadRulesFromFile: loadRulesFromFile,
    retryWithBackoff: retryWithBackoff,
    compactMessages: compactMessages,
    compactToolResult: compactToolResult,
    abortActiveRequest: abortActiveRequest
  };
})();
