(function() {
  var BUILTIN_MODELS = {
    siliconflow: ['Qwen/Qwen2.5-72B-Instruct','Qwen/Qwen2.5-7B-Instruct','deepseek-ai/DeepSeek-V3','deepseek-ai/DeepSeek-R1','THUDM/glm-4-9b-chat','meta-llama/Llama-3.3-70B-Instruct','meta-llama/Llama-3.1-8B-Instruct','Pro/deepseek-ai/DeepSeek-R1'],
    scnet: ['deepseek-chat','deepseek-reasoner','qwen-max','qwen-plus'],
    openai: ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo','o1-preview','o1-mini'],
    anthropic: ['claude-3-5-sonnet-20241022','claude-3-opus-20240229','claude-3-haiku-20240307'],
    google: ['gemini-2.0-flash','gemini-1.5-pro','gemini-1.5-flash'],
    deepseek: ['deepseek-chat','deepseek-reasoner'],
    aliyun: ['qwen-max','qwen-plus','qwen-turbo'],
    zhipu: ['glm-4-plus','glm-4-0520','glm-4-flash'],
    moonshot: ['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k','kimi-k2.6','kimi-k2.5','kimi-k2-0905-preview','kimi-k2-0711-preview','kimi-k2-turbo-preview','kimi-k2-thinking'],
    mimo: ['mimo-v2.5-pro','mimo-v2-pro','mimo-v2-flash','mimo-v2-omni'],
    ollama: ['llama3.2','llama3.1','llama3','qwen2.5','deepseek-r1','mistral','phi3','gemma2','codellama'],
    custom: []
  };

  var PROVIDERS = {
    siliconflow: { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', keyField: 'siliconflowApiKey', desc: 'Qwen/DeepSeek/GLM/Llama 开源模型聚合' },
    scnet: { name: '国家超算', baseUrl: 'https://api.scnet.cn/v1', keyField: 'scnetApiKey', desc: 'DeepSeek/Qwen 国产大模型' },
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyField: 'openaiApiKey', desc: 'GPT-4o/GPT-4 Turbo/GPT-3.5' },
    anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', keyField: 'anthropicApiKey', desc: 'Claude 3.5 Sonnet/Opus/Haiku' },
    google: { name: 'Google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyField: 'googleApiKey', desc: 'Gemini 2.0 Flash/Gemini 1.5 Pro' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyField: 'deepseekApiKey', desc: 'DeepSeek Chat/DeepSeek R1' },
    aliyun: { name: '阿里云', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyField: 'aliyunApiKey', desc: 'Qwen Max/Qwen Plus' },
    zhipu: { name: '智谱AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', keyField: 'zhipuApiKey', desc: 'GLM-4 Plus/GLM-4 Flash' },
    moonshot: { name: 'Kimi / Moonshot', baseUrl: 'https://api.moonshot.cn/v1', keyField: 'moonshotApiKey', desc: 'Kimi K2.6/K2.5/K2 + Moonshot V1 支持FC' },
    mimo: { name: 'MiMo (小米)', baseUrl: 'https://api.xiaomimimo.com/v1', keyField: 'mimoApiKey', desc: 'MiMo-V2.5-Pro/MiMo-V2-Pro/MiMo-V2-Flash' },
    ollama: { name: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1', keyField: '', desc: '本地运行的开源模型，无需API Key' },
    custom: { name: '自定义', baseUrl: '', keyField: 'customApiKey', desc: '兼容OpenAI格式的任意API' }
  };

  var BUILTIN_SKILLS = [
    { id: 'code-review', name: '代码审查', description: '审查代码质量、安全性和最佳实践', prompt: '请对以下代码进行全面审查，包括：1)安全漏洞 2)性能问题 3)代码风格 4)最佳实践建议', category: '开发', enabled: true },
    { id: 'code-explain', name: '代码解释', description: '逐行解释代码逻辑和原理', prompt: '请逐行解释以下代码的工作原理，包括关键函数和逻辑流程', category: '开发', enabled: true },
    { id: 'code-refactor', name: '代码重构', description: '优化代码结构和可读性', prompt: '请重构以下代码，提升可读性、性能和可维护性，说明每处修改的原因', category: '开发', enabled: true },
    { id: 'translate', name: '翻译', description: '将文本翻译为指定语言', prompt: '请将以下内容翻译为{lang}，保持原文的语气和格式', category: '语言', enabled: true },
    { id: 'summarize', name: '摘要总结', description: '提取文本的核心要点', prompt: '请总结以下内容的核心要点，使用简洁的列表格式，不超过{max_points:5}个要点', category: '写作', enabled: true },
    { id: 'write-email', name: '邮件撰写', description: '撰写专业商务邮件', prompt: '请撰写一封{tone:专业}的邮件，主题：{subject}，收件人：{recipient}，要点：{key_points}', category: '写作', enabled: true },
    { id: 'debug-helper', name: '调试助手', description: '分析错误信息并提供修复建议', prompt: '请分析以下错误信息，给出：1)错误原因 2)修复方案 3)预防措施', category: '开发', enabled: true },
    { id: 'api-design', name: 'API设计', description: '设计RESTful API接口', prompt: '请为{resource}设计RESTful API，包括：1)端点列表 2)请求/响应格式 3)状态码 4)认证方式', category: '开发', enabled: true },
    { id: 'data-analysis', name: '数据分析', description: '分析数据并提取洞察', prompt: '请分析以下数据，提取关键趋势、异常值和可执行的洞察', category: '分析', enabled: true },
    { id: 'learning-plan', name: '学习计划', description: '制定结构化学习路线', prompt: '请为{topic}制定一个{duration:4周}的学习计划，包括每周目标、学习资源和实践项目', category: '教育', enabled: true },
    { id: 'regex-gen', name: '正则生成', description: '根据描述生成正则表达式', prompt: '请根据以下描述生成正则表达式，并解释每个部分的含义：{description}', category: '开发', enabled: true },
    { id: 'commit-msg', name: '提交信息', description: '生成规范的Git提交信息', prompt: '请根据以下代码变更生成符合Conventional Commits规范的提交信息', category: '开发', enabled: true }
  ];

  var SYSTEM_RULES = {
    identity: ['你是 Drift 浏览器内置的 AI 助手，一个专业、高效、可靠的智能助手。','你的核心目标：准确理解用户意图，提供高质量、可直接使用的回答。'],
    behavior: ['回答简洁精准，不啰嗦。优先给出可直接使用的结果，而非冗长解释。','代码只输出核心逻辑，省略显而易见的注释。使用 markdown 代码块并标注语言。','数学/逻辑问题给出推导过程，非数学问题直接给结论。','如果用户要求解释，再展开详细说明；否则默认精简模式。'],
    quality: ['不确定的信息必须明确标注"不确定"或"建议验证"，绝不编造事实。','涉及安全、法律、医疗等敏感领域时，主动提醒用户咨询专业人士。','代码建议遵循最佳实践，指出潜在的安全风险（如SQL注入、XSS等）。','对有争议的话题保持中立，呈现多方观点。'],
    format: ['使用 markdown 格式化输出：标题用 ##，列表用 -，代码用 ```。','长回答使用标题分段，方便用户快速定位。','表格数据使用 markdown 表格呈现。','链接使用 [文字](URL) 格式。'],
    safety: ['拒绝生成恶意代码、攻击脚本、违法内容。','拒绝协助绕过安全机制、窃取数据等行为。','涉及文件操作、系统命令等危险操作时，先警告用户确认。','不主动访问外部网络资源，不执行未授权的操作。'],
    tools: ['【重要】当用户请求涉及以下操作时，你必须调用系统工具：','- 文件操作（读取、写入、列出目录、创建文件夹、删除文件）','- 系统操作（启动应用、打开URL、获取系统信息、查看进程列表）','- 剪贴板读写、执行命令','- 浏览器自动化（浏览网页、搜索信息、填写表单、点击按钮、截图）','','【调用方式】回复第一行直接输出工具调用JSON，不要有额外文字：','{"tool":"system_info","params":{}}','{"tool":"file_read","params":{"path":"C:/test.txt"}}','{"tool":"browser_create_tab","params":{"url":"https://example.com"}}','','【规则】每次只调用一个工具，等待结果后再决定下一步。普通聊天不需要调用工具。','','【浏览器自动化】用户要求浏览网页/搜索/填表/点击时使用：','1. browser_create_tab → 打开URL，获得tabId','2. browser_get_structure → 获取页面元素和选择器','3. browser_click/browser_input/browser_scroll → 操作页面','4. browser_screenshot → 确认结果','注意：操作前必须先get_structure，不要猜测选择器，从返回的elements中获取。'],
    optimization: ['优先使用技能(Skill)完成复杂任务，技能是预定义的高效操作流程。','多步骤任务先制定计划，按步骤执行，每步确认结果。','避免重复输出相同内容，引用之前的结果即可。','用户追问时，基于上下文继续，不重复已给信息。']
  };

  var STORAGE_KEY = 'drift-ai-chat';
  var CONFIG_KEY = 'drift-ai-config';
  var MODELS_CACHE_KEY = 'drift-ai-models-cache';
  var AGENT_CONFIG_KEY = 'drift-ai-agent-config';
  var RULES_KEY = 'drift-ai-custom-rules';
  var EXECUTION_STATE_KEY = 'drift-ai-execution-state';
  var CHECKPOINT_KEY = 'drift-ai-checkpoints';
  var MAX_CHECKPOINTS_PER_CHAT = 5;

  var _dynamicModels = {};
  var _isLoadingModels = false;
  var _systemPromptCache = null;
  var _systemPromptCacheTime = 0;
  var _lastPromptMode = null;
  var _rulesCache = null;
  var _rulesCacheTime = 0;

  function _getS() {
    return window.AIState;
  }

  var state = {
    get chats() { var s = _getS(); return s ? s.get('chats') : []; },
    set chats(v) { var s = _getS(); if (s) s.set('chats', v); },
    get activeChatId() { var s = _getS(); return s ? s.get('activeChatId') : null; },
    set activeChatId(v) { var s = _getS(); if (s) s.set('activeChatId', v); },
    get isGenerating() { var s = _getS(); return s ? s.get('isGenerating') : false; },
    set isGenerating(v) { var s = _getS(); if (s) s.set('isGenerating', v); },
    get streamingContent() { var s = _getS(); return s ? s.get('streamingContent') : ''; },
    set streamingContent(v) { var s = _getS(); if (s) s.set('streamingContent', v); },
    get dynamicModels() { return _dynamicModels; },
    set dynamicModels(v) { _dynamicModels = v; },
    get isLoadingModels() { return _isLoadingModels; },
    set isLoadingModels(v) { _isLoadingModels = v; },
    get systemPromptCache() { return _systemPromptCache; },
    set systemPromptCache(v) { _systemPromptCache = v; },
    get systemPromptCacheTime() { return _systemPromptCacheTime; },
    set systemPromptCacheTime(v) { _systemPromptCacheTime = v; },
    get _lastPromptMode() { return _lastPromptMode; },
    set _lastPromptMode(v) { _lastPromptMode = v; },
    get _rulesCache() { return _rulesCache; },
    set _rulesCache(v) { _rulesCache = v; },
    get _rulesCacheTime() { return _rulesCacheTime; },
    set _rulesCacheTime(v) { _rulesCacheTime = v; },
    get executionMode() { var s = _getS(); return s ? s.get('executionMode') : 'instant'; },
    set executionMode(v) { var s = _getS(); if (s) s.set('executionMode', v); },
    get executionMeta() { var s = _getS(); return s ? s.get('executionMeta') : { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }; },
    set executionMeta(v) { var s = _getS(); if (s) s.set('executionMeta', v); }
  };

  function loadChats() {
    try {
      var d = localStorage.getItem(STORAGE_KEY);
      if (d) {
        var chats = JSON.parse(d);
        var s = _getS();
        if (s) s.set('chats', chats);
      }
    } catch(e) {
      var s2 = _getS();
      if (s2) s2.set('chats', []);
    }
  }

  function saveChats() {
    try {
      var s = _getS();
      var chats = s ? s.get('chats') : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch(e) {}
  }

  function loadConfig() {
    try { var d = localStorage.getItem(CONFIG_KEY); if (d) return JSON.parse(d); } catch(e) {}
    return { provider: 'openai', modelId: 'gpt-4o-mini', siliconflowApiKey: '', scnetApiKey: '', openaiApiKey: '', anthropicApiKey: '', googleApiKey: '', deepseekApiKey: '', aliyunApiKey: '', zhipuApiKey: '', moonshotApiKey: '', mimoApiKey: '', ollamaBaseUrl: 'http://localhost:11434/v1', customApiKey: '', customBaseUrl: '', systemPrompt: '', temperature: 0.7, maxTokens: 4096, streamEnabled: true };
  }

  function saveConfig(c) { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); } catch(e) {} }

  function loadAgentConfig() {
    try { var d = localStorage.getItem(AGENT_CONFIG_KEY); if (d) return JSON.parse(d); } catch(e) {}
    return { agentEnabled: false, agentLevel: 0, mcpServers: [], skills: [], confirmHighRisk: true, whitelistedOps: [], disabledSkillIds: [] };
  }

  function saveAgentConfig(c) { try { localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(c)); } catch(e) {} }

  function loadCustomRules() {
    try { var d = localStorage.getItem(RULES_KEY); if (d) return JSON.parse(d); } catch(e) {}
    return { enabled: false, content: '' };
  }

  function saveCustomRules(r) { try { localStorage.setItem(RULES_KEY, JSON.stringify(r)); } catch(e) {} }

  function loadModelsCache() {
    try {
      var d = localStorage.getItem(MODELS_CACHE_KEY);
      if (d) {
        var c = JSON.parse(d);
        if (c.timestamp && Date.now() - c.timestamp < 3600000) {
          _dynamicModels = c.models || {};
        }
      }
    } catch(e) {}
  }

  function saveModelsCache() {
    try { localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), models: _dynamicModels })); } catch(e) {}
  }

  function getModelsForProvider(p) {
    var b = BUILTIN_MODELS[p] || [];
    var d = _dynamicModels[p] || [];
    var ids = d.map(function(m) { return m.id; });
    var a = b.slice();
    ids.forEach(function(id) { if (a.indexOf(id) === -1) a.push(id); });
    return a;
  }

  function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

  function createChat(title) {
    var c = { id: generateId(), title: title || '新对话', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    var s = _getS();
    if (s) {
      var chats = s.get('chats') || [];
      chats.unshift(c);
      s.batch({ chats: chats, activeChatId: c.id });
    }
    saveChats();
    return c;
  }

  function getActiveChat() {
    var s = _getS();
    var chats = s ? s.get('chats') : [];
    var activeId = s ? s.get('activeChatId') : null;
    return chats.find(function(c) { return c.id === activeId; });
  }

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function getEnabledSkills(agentConfig) {
    var disabledIds = (agentConfig.disabledSkillIds || []);
    var external = (agentConfig.skills || []);
    return BUILTIN_SKILLS.filter(function(s) { return disabledIds.indexOf(s.id) === -1; }).concat(external);
  }

  function truncateMessages(messages, maxMessages) {
    if (!maxMessages) maxMessages = 20;
    if (messages.length <= maxMessages) return messages;
    var systemMsgs = messages.filter(function(m) { return m.role === 'system'; });
    var otherMsgs = messages.filter(function(m) { return m.role !== 'system'; });
    var kept = otherMsgs.slice(-maxMessages);
    return systemMsgs.concat(kept);
  }

  function truncateContent(content, maxLen) {
    if (!maxLen) maxLen = 4000;
    if (!content || content.length <= maxLen) return content;
    var head = content.substring(0, Math.floor(maxLen * 0.4));
    var tail = content.substring(content.length - Math.floor(maxLen * 0.4));
    return head + '\n...[已截断]...\n' + tail;
  }

  function loadExecutionState() {
    try {
      var d = localStorage.getItem(EXECUTION_STATE_KEY);
      if (d) {
        var parsed = JSON.parse(d);
        var s = _getS();
        if (s) {
          s.batch({
            executionMode: parsed.executionMode || 'instant',
            executionMeta: parsed.executionMeta || { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }
          });
        }
      }
    } catch(e) {
      var s2 = _getS();
      if (s2) {
        s2.batch({
          executionMode: 'instant',
          executionMeta: { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }
        });
      }
    }
  }

  function saveExecutionState() {
    try {
      var s = _getS();
      localStorage.setItem(EXECUTION_STATE_KEY, JSON.stringify({
        executionMode: s ? s.get('executionMode') : 'instant',
        executionMeta: s ? s.get('executionMeta') : { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }
      }));
    } catch(e) {}
  }

  function saveCheckpoint(chatId, label) {
    try {
      var s = _getS();
      var chats = s ? s.get('chats') : [];
      var chat = chats.find(function(c) { return c.id === chatId; });
      if (!chat) return null;
      var checkpoint = {
        id: generateId(),
        chatId: chatId,
        label: label || '手动保存',
        messages: JSON.parse(JSON.stringify(chat.messages)),
        timestamp: Date.now(),
        executionMode: s ? s.get('executionMode') : 'instant',
        executionMeta: JSON.parse(JSON.stringify(s ? s.get('executionMeta') : {}))
      };
      var allCheckpoints = [];
      try { var d = localStorage.getItem(CHECKPOINT_KEY); if (d) allCheckpoints = JSON.parse(d); } catch(e) { allCheckpoints = []; }
      allCheckpoints.push(checkpoint);
      var chatCheckpoints = allCheckpoints.filter(function(cp) { return cp.chatId === chatId; });
      if (chatCheckpoints.length > MAX_CHECKPOINTS_PER_CHAT) {
        var toRemove = chatCheckpoints.slice(0, chatCheckpoints.length - MAX_CHECKPOINTS_PER_CHAT);
        var removeIds = toRemove.map(function(cp) { return cp.id; });
        allCheckpoints = allCheckpoints.filter(function(cp) { return removeIds.indexOf(cp.id) === -1; });
      }
      try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(allCheckpoints)); } catch(e) {}
      return checkpoint;
    } catch(e) { return null; }
  }

  function loadCheckpoints(chatId) {
    try {
      var d = localStorage.getItem(CHECKPOINT_KEY);
      if (!d) return [];
      var allCheckpoints = JSON.parse(d);
      return allCheckpoints.filter(function(cp) { return cp.chatId === chatId; }).sort(function(a, b) { return b.timestamp - a.timestamp; });
    } catch(e) { return []; }
  }

  function restoreCheckpoint(chatId, checkpointId) {
    try {
      var d = localStorage.getItem(CHECKPOINT_KEY);
      if (!d) return false;
      var allCheckpoints = JSON.parse(d);
      var checkpoint = allCheckpoints.find(function(cp) { return cp.id === checkpointId && cp.chatId === chatId; });
      if (!checkpoint) return false;
      var s = _getS();
      var chats = s ? s.get('chats') : [];
      var chat = chats.find(function(c) { return c.id === chatId; });
      if (!chat) return false;
      chat.messages = JSON.parse(JSON.stringify(checkpoint.messages));
      if (s) {
        s.batch({
          executionMode: checkpoint.executionMode || 'instant',
          executionMeta: checkpoint.executionMeta || { plan: null, currentStep: 0, totalSteps: 0, retryCount: 0, lastError: null }
        });
      }
      saveChats();
      saveExecutionState();
      return true;
    } catch(e) { return false; }
  }

  function deleteCheckpoint(checkpointId) {
    try {
      var d = localStorage.getItem(CHECKPOINT_KEY);
      if (!d) return;
      var allCheckpoints = JSON.parse(d);
      allCheckpoints = allCheckpoints.filter(function(cp) { return cp.id !== checkpointId; });
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(allCheckpoints));
    } catch(e) {}
  }

  function showNotification(msg, type) { if (window.FBrowser && window.FBrowser.notify) window.FBrowser.notify(msg, type || 'info'); }

  function initFromAIState() {
    var s = _getS();
    if (!s) return;
    loadChats();
    loadModelsCache();
    loadExecutionState();
    var config = loadConfig();
    s.batch({
      activeProvider: config.provider || '',
      activeModel: config.modelId || '',
      config: config
    });
  }

  window.AICore = {
    BUILTIN_MODELS: BUILTIN_MODELS,
    PROVIDERS: PROVIDERS,
    BUILTIN_SKILLS: BUILTIN_SKILLS,
    SYSTEM_RULES: SYSTEM_RULES,
    state: state,
    loadChats: loadChats,
    saveChats: saveChats,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    loadAgentConfig: loadAgentConfig,
    saveAgentConfig: saveAgentConfig,
    loadCustomRules: loadCustomRules,
    saveCustomRules: saveCustomRules,
    loadModelsCache: loadModelsCache,
    saveModelsCache: saveModelsCache,
    getModelsForProvider: getModelsForProvider,
    generateId: generateId,
    createChat: createChat,
    getActiveChat: getActiveChat,
    escHtml: escHtml,
    getEnabledSkills: getEnabledSkills,
    truncateMessages: truncateMessages,
    truncateContent: truncateContent,
    showNotification: showNotification,
    loadExecutionState: loadExecutionState,
    saveExecutionState: saveExecutionState,
    saveCheckpoint: saveCheckpoint,
    loadCheckpoints: loadCheckpoints,
    restoreCheckpoint: restoreCheckpoint,
    deleteCheckpoint: deleteCheckpoint,
    initFromAIState: initFromAIState
  };
})();
