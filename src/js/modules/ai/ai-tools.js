// ==================== AI 工具调用解析和执行 ====================
(function() {
  var VALID_TOOLS = ['file_read','file_write','file_list','file_mkdir','file_delete','file_move','app_launch','app_open_url','clipboard_read','clipboard_write','system_info','process_list','shell_exec','browser_create_tab','browser_close_tab','browser_navigate','browser_screenshot','browser_get_structure','browser_click','browser_input','browser_scroll','browser_mouse_move','browser_go_back','browser_go_forward','browser_list_tabs'];

  function isValidTool(name) { return VALID_TOOLS.indexOf(name) !== -1; }

  function extractJsonBlock(text) {
    try { return JSON.parse(text); } catch(e) { return null; }
  }

  function fixJson(str) {
    if (!str) return null;
    str = str.trim();
    if (str.charAt(0) === '\'' && str.charAt(str.length - 1) === '\'') str = str.substring(1, str.length - 1);
    try { return JSON.parse(str); } catch(e) {}
    try { var fixed = str.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":').replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch(e2) { return null; }
  }

  function parseToolCalls(text) {
    if (!text) return [];
    var calls = [];
    var cleaned = text.replace(/```[\s\S]*?```/g, '');

    var m1 = cleaned.match(/\{[\s\S]*?"tool"\s*:\s*"([^"]+)"[\s\S]*?\}/);
    if (m1) {
      var obj1 = fixJson(m1[0]);
      if (obj1 && (isValidTool(obj1.tool) || obj1.mcp || obj1.skill)) {
        calls.push({ tool: obj1.tool || '', params: obj1.params || obj1.arguments || {}, skill: obj1.skill || null, mcp: obj1.mcp || null });
      }
    }

    if (calls.length === 0) {
      var m2 = cleaned.match(/\{[\s\S]*?"skill"\s*:\s*"([^"]+)"[\s\S]*?\}/);
      if (m2) {
        var obj2 = fixJson(m2[0]);
        if (obj2 && obj2.skill) calls.push({ tool: '', params: obj2.params || {}, skill: obj2.skill, mcp: obj2.mcp || null });
      }
    }

    if (calls.length === 0) {
      var m3 = cleaned.match(/\{[\s\S]*?"mcp"\s*:\s*"([^"]+)"[\s\S]*?"tool"\s*:\s*"([^"]+)"[\s\S]*?\}/);
      if (m3) {
        var obj3 = fixJson(m3[0]);
        if (obj3 && obj3.mcp && obj3.tool) calls.push({ tool: obj3.tool, params: obj3.params || {}, skill: null, mcp: obj3.mcp });
      }
    }

    if (calls.length === 0) {
      var firstLine = cleaned.split('\n')[0].trim();
      var jsonBlock = extractJsonBlock(firstLine);
      if (jsonBlock && (jsonBlock.tool || jsonBlock.mcp || jsonBlock.skill)) {
        var name2 = jsonBlock.tool || jsonBlock.skill;
        if (isValidTool(name2) || jsonBlock.skill || jsonBlock.mcp) calls.push(jsonBlock);
      }
    }

    return calls;
  }

  async function executeToolCall(call, agentConfig) {
    var C = window.AICore;
    try {
      var isBrowserTool = call.tool && call.tool.indexOf('browser_') === 0;

      if (isBrowserTool) {
        if (window.FBrowser && window.FBrowser.aiBrowser) {
          window.FBrowser.aiBrowser.setExecuting(true);
          window.FBrowser.aiBrowser.log('⟳ ' + getBrowserToolDesc(call.tool, call.params), 'info');
        }
      }

      var result;
      if (call.skill) {
        result = await window.electronAPI.aiAgentSkillExecute({ skillId: call.skill, params: call.params || {} });
      } else if (call.mcp) {
        result = await window.electronAPI.aiAgentMcpCall({ serverName: call.mcp, toolName: call.tool, arguments: call.params || {} });
      } else {
        result = await window.electronAPI.aiAgentExecute({ name: call.tool, params: call.params || {} });
      }

      if (isBrowserTool && window.FBrowser && window.FBrowser.aiBrowser) {
        if (result.success) {
          window.FBrowser.aiBrowser.log('✓ ' + getBrowserToolDesc(call.tool, call.params), 'success');
          if (call.tool === 'browser_screenshot' && result.data && result.data.image) {
            window.FBrowser.aiBrowser.updateScreenshot(result.data);
            result = { success: true, data: { viewport: result.data.viewport, mousePosition: result.data.mousePosition, timestamp: result.data.timestamp, message: '截图成功，已在预览面板显示' } };
          }
          if (call.tool === 'browser_create_tab' && result.tabId) {
            window.FBrowser.aiBrowser.setActiveTab(result.tabId);
            window.FBrowser.aiBrowser.setActiveTabInfo({ tabId: result.tabId, url: call.params.url || '' });
          }
          if (call.tool === 'browser_get_structure' && result.data) {
            if (result.data.tree) {
              var treeCount = result.data.tree.length;
              if (treeCount > 40) {
                result.data.tree = result.data.tree.slice(0, 40);
                result.data._truncated = true;
                result.data._totalCount = treeCount;
              }
            }
            if (result.data.elements) {
              var elemCount = result.data.elements.length;
              result.data.elements = result.data.elements.slice(0, 30);
              result.data._truncated = elemCount > 30;
              result.data._totalCount = elemCount;
            }
            if (result.data.mode === 'screenshot' && result.data.message) {
              result.data._screenshotHint = result.data.message;
            }
          }
        } else {
          window.FBrowser.aiBrowser.log('✕ ' + call.tool + ': ' + (result.error || '失败'), 'error');
        }
        window.FBrowser.aiBrowser.setExecuting(false);
      }

      return result;
    } catch(execErr) {
      if (window.FBrowser && window.FBrowser.aiBrowser) {
        window.FBrowser.aiBrowser.setExecuting(false);
        window.FBrowser.aiBrowser.log('✕ 异常: ' + (execErr.message || '未知'), 'error');
      }
      return { success: false, error: execErr.message || '工具执行异常' };
    }
  }

  function getBrowserToolDisplayName(toolName) {
    var names = { 'browser_create_tab': '打开网页', 'browser_close_tab': '关闭标签页', 'browser_navigate': '导航', 'browser_screenshot': '截图', 'browser_get_structure': '获取结构', 'browser_click': '点击', 'browser_input': '输入文本', 'browser_scroll': '滚动', 'browser_mouse_move': '移动鼠标', 'browser_go_back': '后退', 'browser_go_forward': '前进', 'browser_list_tabs': '列出标签页' };
    return names[toolName] || toolName;
  }

  function getBrowserToolDesc(tool, params) {
    var p = params || {};
    switch(tool) {
      case 'browser_create_tab': return '打开网页 ' + (p.url || '');
      case 'browser_close_tab': return '关闭标签页';
      case 'browser_navigate': return '导航到 ' + (p.url || '');
      case 'browser_screenshot': return '截取页面截图';
      case 'browser_get_structure': return '获取页面结构';
      case 'browser_click': return '点击 ' + (p.selector || '');
      case 'browser_input': return '输入文本到 ' + (p.selector || '');
      case 'browser_scroll': return '滚动页面 ' + (p.direction || '');
      case 'browser_mouse_move': return '移动鼠标到 (' + (p.x || 0) + ', ' + (p.y || 0) + ')';
      case 'browser_go_back': return '后退';
      case 'browser_go_forward': return '前进';
      default: return tool;
    }
  }

  function getBrowserToolResultDesc(tool, result) {
    var d = result.data || {};
    switch(tool) {
      case 'browser_create_tab': return '已打开 ' + (d.url || '网页');
      case 'browser_screenshot': return '截图完成';
      case 'browser_get_structure':
        if (d.mode === 'screenshot') return '建议使用截图模式';
        return '获取到 ' + (d._totalCount || (d.tree || d.elements || []).length) + ' 个元素';
      case 'browser_click': return '点击完成';
      case 'browser_input': return '输入完成';
      case 'browser_mouse_move': return '鼠标已移动';
      default: return tool + ' 完成';
    }
  }

  function reflexionEvaluate(toolCall, result, retryCount) {
    if (!toolCall || !result) {
      return { shouldRetry: false, strategy: '无效的调用或结果', finalError: '无效参数' };
    }

    var error = result.error || '';
    var errorLower = error.toLowerCase();
    var toolName = toolCall.tool || '';
    var strategy = '';
    var errorType = 'unknown';

    if (errorLower.indexOf('selector') !== -1 || errorLower.indexOf('not found') !== -1 || errorLower.indexOf('找不到') !== -1 || errorLower.indexOf('no element') !== -1) {
      errorType = 'selector';
      strategy = '元素选择器未找到目标，建议：1)先调用browser_get_structure获取最新页面结构 2)从返回的elements中选择更精确的selector 3)或改用截图模式browser_screenshot观察页面后重试';
    } else if (errorLower.indexOf('timeout') !== -1 || errorLower.indexOf('超时') !== -1 || errorLower.indexOf('timed out') !== -1) {
      errorType = 'timeout';
      strategy = '操作超时，建议：1)增加等待时间 2)检查页面是否完全加载 3)先截图确认当前页面状态 4)减少操作复杂度';
    } else if (errorLower.indexOf('permission') !== -1 || errorLower.indexOf('权限') !== -1 || errorLower.indexOf('forbidden') !== -1 || errorLower.indexOf('denied') !== -1) {
      errorType = 'permission';
      strategy = '权限不足，建议：1)检查文件路径是否正确 2)确认操作是否需要用户确认 3)尝试替代方案';
    } else if (errorLower.indexOf('network') !== -1 || errorLower.indexOf('网络') !== -1 || errorLower.indexOf('econnreset') !== -1 || errorLower.indexOf('fetch failed') !== -1) {
      errorType = 'network';
      strategy = '网络错误，建议：1)检查URL是否正确 2)稍后重试 3)检查网络连接';
    } else if (errorLower.indexOf('param') !== -1 || errorLower.indexOf('参数') !== -1 || errorLower.indexOf('invalid') !== -1 || errorLower.indexOf('argument') !== -1) {
      errorType = 'param';
      strategy = '参数错误，建议：1)检查参数格式是否正确 2)确认必填参数是否完整 3)参考工具文档调整参数';
    } else {
      strategy = '工具执行失败，建议：1)分析错误信息调整策略 2)尝试替代工具或方法 3)简化操作步骤';
    }

    if (retryCount >= 3) {
      return { shouldRetry: false, strategy: '已达到最大重试次数(3次)', finalError: error, errorType: errorType };
    }

    return { shouldRetry: true, strategy: strategy, modifiedParams: null, errorType: errorType };
  }

  function applyReflexionStrategy(call, strategy) {
    if (!call || !strategy) return call;
    var modifiedCall = JSON.parse(JSON.stringify(call));
    var errorType = strategy.errorType || '';

    if (errorType === 'selector' && modifiedCall.params) {
      if (modifiedCall.tool === 'browser_click' || modifiedCall.tool === 'browser_input') {
        if (!modifiedCall.params._useScreenshot) {
          modifiedCall._reflexionHint = '选择器失败，请先调用browser_get_structure获取页面结构，再从返回的elements中选取正确的selector';
        }
      }
    }

    if (errorType === 'timeout' && modifiedCall.params) {
      if (modifiedCall.params.timeout) {
        modifiedCall.params.timeout = Math.min(modifiedCall.params.timeout * 2, 30000);
      } else {
        modifiedCall.params.timeout = 10000;
      }
      modifiedCall._reflexionHint = '已增加超时时间至' + modifiedCall.params.timeout + 'ms';
    }

    if (errorType === 'param' && modifiedCall.params) {
      modifiedCall._reflexionHint = '参数可能有误，请仔细检查参数格式和必填项：' + (strategy.strategy || '');
    }

    return modifiedCall;
  }

  window.AITools = {
    VALID_TOOLS: VALID_TOOLS,
    isValidTool: isValidTool,
    parseToolCalls: parseToolCalls,
    executeToolCall: executeToolCall,
    getBrowserToolDisplayName: getBrowserToolDisplayName,
    getBrowserToolDesc: getBrowserToolDesc,
    getBrowserToolResultDesc: getBrowserToolResultDesc,
    reflexionEvaluate: reflexionEvaluate,
    applyReflexionStrategy: applyReflexionStrategy
  };
})();
