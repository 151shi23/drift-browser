(function() {
  var C, Api;
  var drawerOpen = false;

  function initModules() {
    C = window.AICore;
    Api = window.AIApi;
  }

  function createDrawer() {
    if (document.getElementById('aiSettingsDrawer')) return;
    var drawer = document.createElement('div');
    drawer.id = 'aiSettingsDrawer';
    drawer.className = 'ai-settings-drawer';
    drawer.innerHTML = '<div class="ai-settings-header">'
        + '<span class="ai-settings-title">AI 设置</span>'
        + '<button class="ai-settings-close" id="aiSettingsClose">✕</button>'
      + '</div>'
      + '<div class="ai-settings-body" id="aiSettingsBody"></div>';
    document.body.appendChild(drawer);
    document.getElementById('aiSettingsClose').addEventListener('click', close);
  }

  function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderSettings() {
    var body = document.getElementById('aiSettingsBody');
    if (!body) return;
    var config = C.loadConfig();
    var agentConfig = C.loadAgentConfig();
    var customRules = C.loadCustomRules();

    var html = '<div class="ai-settings-section">'
      + '<div class="ai-settings-section-title">模型配置</div>'
      + '<div class="ai-settings-row"><label>服务商</label><select id="aiSetProvider">';
    Object.keys(C.PROVIDERS).forEach(function(key) {
      html += '<option value="' + key + '"' + (config.provider === key ? ' selected' : '') + '>' + C.PROVIDERS[key].name + '</option>';
    });
    html += '</select></div>'
      + '<div class="ai-settings-row"><label>模型</label><input id="aiSetModel" value="' + escAttr(config.modelId || '') + '" list="aiSetModelList" placeholder="选择或输入模型"><datalist id="aiSetModelList">';

    var models = C.getModelsForProvider(config.provider);
    models.forEach(function(m) { html += '<option value="' + m + '">'; });

    var keyField = C.PROVIDERS[config.provider] ? C.PROVIDERS[config.provider].keyField : '';
    html += '</datalist></div>'
      + '<div class="ai-settings-row"><label>API Key</label><input id="aiSetApiKey" type="password" value="' + escAttr(keyField ? config[keyField] || '' : '') + '" placeholder="输入API Key"></div>'
      + '<div class="ai-settings-row"><label>温度</label><input id="aiSetTemp" type="range" min="0" max="2" step="0.1" value="' + (config.temperature || 0.7) + '"><span id="aiSetTempVal">' + (config.temperature || 0.7) + '</span></div>'
      + '<div class="ai-settings-row"><label>最大Token</label><input id="aiSetMaxTokens" type="number" value="' + (config.maxTokens || 4096) + '" min="256" max="128000" step="256"></div>'
      + '<div class="ai-settings-row ai-settings-row-check"><label>流式输出</label><input id="aiSetStream" type="checkbox"' + (config.streamEnabled !== false ? ' checked' : '') + '></div>'
      + '<button class="ai-settings-btn" id="aiSetRefreshModels">刷新模型列表</button>'
    + '</div>';

    html += '<div class="ai-settings-section">'
      + '<div class="ai-settings-section-title">Agent 配置</div>'
      + '<div class="ai-settings-row ai-settings-row-check"><label>启用Agent</label><input id="aiSetAgentEnabled" type="checkbox"' + (agentConfig.agentEnabled ? ' checked' : '') + '></div>'
      + '<div class="ai-settings-row ai-settings-row-check"><label>高风险操作确认</label><input id="aiSetConfirmHighRisk" type="checkbox"' + (agentConfig.confirmHighRisk !== false ? ' checked' : '') + '></div>'
    + '</div>';

    html += '<div class="ai-settings-section">'
      + '<div class="ai-settings-section-title">自定义规则</div>'
      + '<div class="ai-settings-row ai-settings-row-check"><label>启用自定义规则</label><input id="aiSetRulesEnabled" type="checkbox"' + (customRules.enabled ? ' checked' : '') + '></div>'
      + '<div class="ai-settings-row"><textarea id="aiSetRulesContent" rows="6" placeholder="输入自定义规则...">' + C.escHtml(customRules.content || '') + '</textarea></div>'
    + '</div>';

    html += '<div class="ai-settings-section">'
      + '<div class="ai-settings-section-title">系统提示词</div>'
      + '<div class="ai-settings-row"><textarea id="aiSetSystemPrompt" rows="4" placeholder="自定义系统提示词...">' + C.escHtml(config.systemPrompt || '') + '</textarea></div>'
    + '</div>';

    html += '<div class="ai-settings-section">'
      + '<div class="ai-settings-section-title">数据管理</div>'
      + '<button class="ai-settings-btn ai-settings-btn-danger" id="aiSetClearChats">清空所有对话</button>'
      + '<button class="ai-settings-btn" id="aiSetExportChats">导出对话数据</button>'
    + '</div>';

    body.innerHTML = html;
    bindSettingsEvents();
  }

  function bindSettingsEvents() {
    var providerEl = document.getElementById('aiSetProvider');
    var modelEl = document.getElementById('aiSetModel');
    var apiKeyEl = document.getElementById('aiSetApiKey');
    var tempEl = document.getElementById('aiSetTemp');
    var tempValEl = document.getElementById('aiSetTempVal');
    var maxTokensEl = document.getElementById('aiSetMaxTokens');
    var streamEl = document.getElementById('aiSetStream');
    var refreshBtn = document.getElementById('aiSetRefreshModels');
    var agentEnabledEl = document.getElementById('aiSetAgentEnabled');
    var confirmHighRiskEl = document.getElementById('aiSetConfirmHighRisk');
    var rulesEnabledEl = document.getElementById('aiSetRulesEnabled');
    var rulesContentEl = document.getElementById('aiSetRulesContent');
    var systemPromptEl = document.getElementById('aiSetSystemPrompt');
    var clearChatsBtn = document.getElementById('aiSetClearChats');
    var exportChatsBtn = document.getElementById('aiSetExportChats');

    if (providerEl) providerEl.addEventListener('change', function() {
      var config = C.loadConfig();
      config.provider = providerEl.value;
      C.saveConfig(config);
      renderSettings();
    });

    if (modelEl) modelEl.addEventListener('change', function() {
      var config = C.loadConfig();
      config.modelId = modelEl.value;
      C.saveConfig(config);
    });

    if (apiKeyEl) apiKeyEl.addEventListener('change', function() {
      var config = C.loadConfig();
      var keyField = C.PROVIDERS[config.provider].keyField;
      if (keyField) { config[keyField] = apiKeyEl.value; C.saveConfig(config); }
    });

    if (tempEl) tempEl.addEventListener('input', function() {
      if (tempValEl) tempValEl.textContent = tempEl.value;
      var config = C.loadConfig();
      config.temperature = parseFloat(tempEl.value);
      C.saveConfig(config);
    });

    if (maxTokensEl) maxTokensEl.addEventListener('change', function() {
      var config = C.loadConfig();
      config.maxTokens = parseInt(maxTokensEl.value) || 4096;
      C.saveConfig(config);
    });

    if (streamEl) streamEl.addEventListener('change', function() {
      var config = C.loadConfig();
      config.streamEnabled = streamEl.checked;
      C.saveConfig(config);
    });

    if (refreshBtn) refreshBtn.addEventListener('click', async function() {
      refreshBtn.textContent = '刷新中...';
      refreshBtn.disabled = true;
      try { await Api.refreshModels(document.getElementById('aiSetProvider').value); } catch(e) {}
      refreshBtn.textContent = '刷新模型列表';
      refreshBtn.disabled = false;
      renderSettings();
    });

    if (agentEnabledEl) agentEnabledEl.addEventListener('change', function() {
      var ac = C.loadAgentConfig();
      ac.agentEnabled = agentEnabledEl.checked;
      C.saveAgentConfig(ac);
    });

    if (confirmHighRiskEl) confirmHighRiskEl.addEventListener('change', function() {
      var ac = C.loadAgentConfig();
      ac.confirmHighRisk = confirmHighRiskEl.checked;
      C.saveAgentConfig(ac);
    });

    if (rulesEnabledEl) rulesEnabledEl.addEventListener('change', function() {
      var r = C.loadCustomRules();
      r.enabled = rulesEnabledEl.checked;
      C.saveCustomRules(r);
    });

    if (rulesContentEl) rulesContentEl.addEventListener('change', function() {
      var r = C.loadCustomRules();
      r.content = rulesContentEl.value;
      C.saveCustomRules(r);
    });

    if (systemPromptEl) systemPromptEl.addEventListener('change', function() {
      var config = C.loadConfig();
      config.systemPrompt = systemPromptEl.value;
      C.saveConfig(config);
    });

    if (clearChatsBtn) clearChatsBtn.addEventListener('click', function() {
      if (confirm('确定要清空所有对话吗？此操作不可恢复。')) {
        C.state.chats = [];
        C.state.activeChatId = null;
        C.saveChats();
        C.showNotification('已清空所有对话', 'success');
      }
    });

    if (exportChatsBtn) exportChatsBtn.addEventListener('click', function() {
      var data = JSON.stringify(C.state.chats, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'drift-ai-chats-' + Date.now() + '.json'; a.click();
      URL.revokeObjectURL(url);
      C.showNotification('对话数据已导出', 'success');
    });
  }

  function open() {
    if (!C) initModules();
    createDrawer();
    renderSettings();
    var drawer = document.getElementById('aiSettingsDrawer');
    if (drawer) { drawer.classList.add('open'); drawerOpen = true; }
  }

  function close() {
    var drawer = document.getElementById('aiSettingsDrawer');
    if (drawer) { drawer.classList.remove('open'); drawerOpen = false; }
  }

  function toggle() { drawerOpen ? close() : open(); }
  function isOpen() { return drawerOpen; }

  window.AISettings = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    render: renderSettings
  };
})();
