const { ipcMain, shell, clipboard, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

var agentLog = [];
var MAX_LOG = 500;

var SENSITIVE_EXTS = ['.env', '.key', '.pem', '.p12', '.pfx', '.ssh', '.gpg', '.kube', '.aws', '.gitconfig', '.npmrc', '.netrc'];
var BLOCKED_PATHS = [
  path.join(os.homedir(), '.ssh'),
  path.join(os.homedir(), '.gnupg'),
  path.join(os.homedir(), '.kube'),
  path.join(os.homedir(), '.aws'),
  'C:\\Windows\\System32',
  'C:\\Windows\\SysWOW64',
  '/etc',
  '/root',
  '/var'
];

var SAFE_COMMANDS = [
  'dir', 'ls', 'cat', 'type', 'echo', 'pwd', 'cd',
  'whoami', 'hostname', 'ipconfig', 'ifconfig',
  'tasklist', 'ps', 'systeminfo', 'uname',
  'where', 'which', 'find', 'findstr', 'grep',
  'tree', 'date', 'time', 'cmd /c dir',
  'ping', 'nslookup', 'netstat'
];

var TOOL_DEFINITIONS = [
  {
    name: 'file_read',
    description: '读取文本文件内容。用于查看代码、配置文件、日志等。常见组合：file_list → file_read',
    risk: 1,
    params: { path: { type: 'string', required: true, description: '文件路径' } }
  },
  {
    name: 'file_write',
    description: '写入文件内容。用于创建新文件、修改配置、保存数据。常见组合：file_read → file_write',
    risk: 2,
    params: { path: { type: 'string', required: true, description: '文件路径' }, content: { type: 'string', required: true, description: '文件内容' } }
  },
  {
    name: 'file_list',
    description: '列出目录内容，返回文件和子目录信息。用于浏览项目结构、查找文件。常见组合：file_list → file_read',
    risk: 1,
    params: { path: { type: 'string', required: true, description: '目录路径' } }
  },
  {
    name: 'file_mkdir',
    description: '创建文件夹（含中间目录）。用于创建项目目录结构、输出目录。常见组合：file_list → file_mkdir → file_write',
    risk: 2,
    params: { path: { type: 'string', required: true, description: '目录路径' } }
  },
  {
    name: 'file_delete',
    description: '删除文件（高风险，需确认）。用于清理临时文件、移除旧文件。常见组合：file_list → file_delete',
    risk: 3,
    params: { path: { type: 'string', required: true, description: '文件路径' } }
  },
  {
    name: 'file_move',
    description: '移动或重命名文件。用于整理文件、修改文件名。常见组合：file_list → file_move',
    risk: 2,
    params: { source: { type: 'string', required: true, description: '源路径' }, destination: { type: 'string', required: true, description: '目标路径' } }
  },
  {
    name: 'app_launch',
    description: '启动应用程序或打开文件。用于打开编辑器、运行程序、打开文档。常见组合：system_info → app_launch',
    risk: 1,
    params: { target: { type: 'string', required: true, description: '应用名称或文件路径' } }
  },
  {
    name: 'app_open_url',
    description: '在系统默认浏览器中打开URL。用于打开网页链接、API文档。常见组合：独立使用',
    risk: 1,
    params: { url: { type: 'string', required: true, description: 'URL地址' } }
  },
  {
    name: 'clipboard_read',
    description: '读取剪贴板文本内容。用于获取用户复制的信息、跨应用传递数据。常见组合：clipboard_read → file_write',
    risk: 2,
    params: {}
  },
  {
    name: 'clipboard_write',
    description: '设置剪贴板文本。用于将结果复制到剪贴板供用户粘贴。常见组合：file_read → clipboard_write',
    risk: 1,
    params: { text: { type: 'string', required: true, description: '剪贴板文本' } }
  },
  {
    name: 'system_info',
    description: '获取系统信息（CPU、内存、磁盘、平台）。用于了解运行环境、诊断性能问题。常见组合：独立使用或 system_info → process_list',
    risk: 1,
    params: {}
  },
  {
    name: 'process_list',
    description: '获取正在运行的进程列表。用于检查程序是否运行、排查资源占用。常见组合：system_info → process_list',
    risk: 1,
    params: {}
  },
  {
    name: 'shell_exec',
    description: '执行系统命令（高风险，仅限安全白名单命令，如dir/ls/cat/ping等）。用于快速查询系统信息。常见组合：独立使用',
    risk: 3,
    params: { command: { type: 'string', required: true, description: '要执行的命令' } }
  },
  {
    name: 'browser_create_tab',
    description: '【浏览器自动化】创建AI代理浏览器标签页，用于浏览网页、搜索信息、填写表单。操作流程：1.browser_create_tab打开页面 → 2.browser_get_structure获取结构 → 3.browser_click/browser_input操作元素 → 4.browser_screenshot确认结果。必须先调用此工具创建标签页，返回tabId用于后续操作。',
    risk: 1,
    params: { url: { type: 'string', required: true, description: '要打开的网页URL，如 https://www.google.com' }, mode: { type: 'string', description: '操作模式: standard(默认，通过DOM操作) | multimodal(通过截图和坐标操作)' } }
  },
  {
    name: 'browser_navigate',
    description: '【浏览器自动化】导航到新URL。用于在已创建的标签页中跳转到其他网页。常见组合：browser_create_tab → browser_navigate',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '由browser_create_tab返回的标签页ID' }, url: { type: 'string', required: true, description: '要导航到的URL' } }
  },
  {
    name: 'browser_screenshot',
    description: '【浏览器自动化】截取页面截图。用于查看页面当前状态、确认操作结果、多模态模式下定位元素。当browser_get_structure返回的元素不够用时，截图可以获取更完整的页面信息。常见组合：browser_click → browser_screenshot',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' }, fullPage: { type: 'boolean', description: '是否全页面截图，默认false只截可视区域' } }
  },
  {
    name: 'browser_click',
    description: '【浏览器自动化】点击页面元素。优先使用selector精确定位，selector找不到时可用x/y坐标。常见错误：selector拼写错误 → 先用browser_get_structure获取正确selector。常见组合：browser_get_structure → browser_click',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' }, selector: { type: 'string', description: 'CSS选择器，如 #login-btn 或 input[name="q"]' }, x: { type: 'number', description: '点击X坐标（selector无效时使用）' }, y: { type: 'number', description: '点击Y坐标（selector无效时使用）' } }
  },
  {
    name: 'browser_input',
    description: '【浏览器自动化】在输入框中输入文本。用于填写搜索框、用户名、密码等。输入后通常需要browser_click点击提交按钮。常见组合：browser_get_structure → browser_input → browser_click',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' }, selector: { type: 'string', required: true, description: '输入框的CSS选择器，如 input[name="q"] 或 #search' }, text: { type: 'string', required: true, description: '要输入的文本内容' } }
  },
  {
    name: 'browser_get_structure',
    description: '【浏览器自动化】获取页面DOM结构，返回所有可交互元素的选择器和位置。在操作页面前必须先调用此工具了解页面结构，不要猜测selector。常见组合：browser_create_tab → browser_get_structure → browser_click',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' } }
  },
  {
    name: 'browser_mouse_move',
    description: '【浏览器自动化】移动虚拟鼠标到指定坐标位置。多模态模式下用于定位元素后再点击。常见组合：browser_screenshot → browser_mouse_move → browser_click',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' }, x: { type: 'number', required: true, description: 'X坐标' }, y: { type: 'number', required: true, description: 'Y坐标' } }
  },
  {
    name: 'browser_scroll',
    description: '【浏览器自动化】滚动页面。用于查看页面下方内容或回到顶部。常见组合：browser_get_structure → browser_scroll → browser_get_structure',
    risk: 1,
    params: { tabId: { type: 'string', required: true, description: '标签页ID' }, direction: { type: 'string', required: true, description: '滚动方向: up/down/left/right' }, amount: { type: 'number', description: '滚动像素量，默认300' } }
  }
];

function addLog(entry) {
  entry.timestamp = Date.now();
  agentLog.unshift(entry);
  if (agentLog.length > MAX_LOG) agentLog.length = MAX_LOG;
}

function isPathBlocked(filePath) {
  var normalized = path.resolve(filePath).toLowerCase();
  for (var i = 0; i < BLOCKED_PATHS.length; i++) {
    if (normalized.startsWith(BLOCKED_PATHS[i].toLowerCase())) return true;
  }
  return false;
}

function isSensitiveFile(filePath) {
  var ext = path.extname(filePath).toLowerCase();
  var name = path.basename(filePath).toLowerCase();
  if (SENSITIVE_EXTS.indexOf(ext) !== -1) return true;
  if (name === '.env' || name === '.gitconfig' || name === '.npmrc' || name === '.netrc') return true;
  return false;
}

function isCommandSafe(cmd) {
  var trimmed = cmd.trim().toLowerCase();
  for (var i = 0; i < SAFE_COMMANDS.length; i++) {
    if (trimmed === SAFE_COMMANDS[i] || trimmed.startsWith(SAFE_COMMANDS[i] + ' ')) return true;
  }
  return false;
}

function getToolDefinitions() {
  return TOOL_DEFINITIONS.map(function(t) {
    var props = {};
    Object.keys(t.params).forEach(function(k) {
      var p = {};
      if (t.params[k].type) p.type = t.params[k].type;
      if (t.params[k].description) p.description = t.params[k].description;
      if (t.params[k].enum) p.enum = t.params[k].enum;
      props[k] = p;
    });
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: props,
          required: Object.keys(t.params).filter(function(k) { return t.params[k].required; })
        }
      }
    };
  });
}

function getToolRisk(toolName) {
  var tool = TOOL_DEFINITIONS.find(function(t) { return t.name === toolName; });
  return tool ? tool.risk : 3;
}

var browserHandlerRef = null;

function setBrowserHandler(ref) {
  browserHandlerRef = ref;
}

function executeBrowserTool(channel, args) {
  return new Promise(function(resolve) {
    if (!browserHandlerRef) {
      resolve({ success: false, error: 'AI 浏览器模块未初始化' });
      return;
    }
    var fn = browserHandlerRef[channel];
    if (!fn || typeof fn !== 'function') {
      resolve({ success: false, error: '未知的浏览器操作: ' + channel });
      return;
    }
    var fakeEvent = { sender: { send: function() {} } };
    var allArgs = [fakeEvent].concat(args || []);
    Promise.resolve(fn.apply(browserHandlerRef, allArgs)).then(function(result) {
      resolve(result || { success: false, error: '无返回结果' });
    }).catch(function(e) {
      resolve({ success: false, error: e.message || '浏览器工具调用失败' });
    });
  });
}

function executeTool(toolName, params) {
  return new Promise(function(resolve) {
    try {
      switch (toolName) {
        case 'file_read':
          var readPath = params.path;
          if (readPath && !path.isAbsolute(readPath)) {
            readPath = path.resolve(process.cwd(), readPath);
          }
          if (isPathBlocked(readPath)) return resolve({ success: false, error: '路径被安全策略阻止' });
          if (isSensitiveFile(readPath)) return resolve({ success: false, error: '敏感文件禁止访问' });
          if (!fs.existsSync(readPath)) return resolve({ success: false, error: '文件不存在: ' + readPath });
          var stat = fs.statSync(readPath);
          if (stat.size > 1024 * 1024) return resolve({ success: false, error: '文件过大（超过1MB）' });
          var content = fs.readFileSync(readPath, 'utf-8');
          var lines = content.split('\n');
          resolve({ success: true, data: content, meta: { path: readPath, size: stat.size, lines: lines.length } });
          break;

        case 'file_write':
          if (isPathBlocked(params.path)) return resolve({ success: false, error: '路径被安全策略阻止' });
          var dir = path.dirname(params.path);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(params.path, params.content, 'utf-8');
          resolve({ success: true, data: '文件已写入', meta: { path: params.path, size: Buffer.byteLength(params.content, 'utf-8') } });
          break;

        case 'file_list':
          var listPath = params.path;
          if (listPath && !path.isAbsolute(listPath)) {
            listPath = path.resolve(process.cwd(), listPath);
          }
          if (isPathBlocked(listPath)) return resolve({ success: false, error: '路径被安全策略阻止' });
          if (!fs.existsSync(listPath)) return resolve({ success: false, error: '目录不存在' });
          var entries = fs.readdirSync(listPath, { withFileTypes: true });
          var items = entries.slice(0, 200).map(function(e) {
            return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: e.isFile() ? fs.statSync(path.join(listPath, e.name)).size : 0 };
          });
          resolve({ success: true, data: items, meta: { total: entries.length, path: listPath } });
          break;

        case 'file_mkdir':
          if (isPathBlocked(params.path)) return resolve({ success: false, error: '路径被安全策略阻止' });
          fs.mkdirSync(params.path, { recursive: true });
          resolve({ success: true, data: '目录已创建', meta: { path: params.path } });
          break;

        case 'file_delete':
          if (isPathBlocked(params.path)) return resolve({ success: false, error: '路径被安全策略阻止' });
          if (!fs.existsSync(params.path)) return resolve({ success: false, error: '文件不存在' });
          fs.unlinkSync(params.path);
          resolve({ success: true, data: '文件已删除', meta: { path: params.path } });
          break;

        case 'file_move':
          if (isPathBlocked(params.source) || isPathBlocked(params.destination)) return resolve({ success: false, error: '路径被安全策略阻止' });
          if (!fs.existsSync(params.source)) return resolve({ success: false, error: '源文件不存在' });
          fs.renameSync(params.source, params.destination);
          resolve({ success: true, data: '文件已移动', meta: { source: params.source, destination: params.destination } });
          break;

        case 'app_launch':
          shell.openPath(params.target).then(function() {
            resolve({ success: true, data: '已启动', meta: { target: params.target } });
          }).catch(function(e) {
            resolve({ success: false, error: e.message });
          });
          break;

        case 'app_open_url':
          shell.openExternal(params.url);
          resolve({ success: true, data: '已打开URL', meta: { url: params.url } });
          break;

        case 'clipboard_read':
          var text = clipboard.readText();
          resolve({ success: true, data: text || '', meta: { length: (text || '').length } });
          break;

        case 'clipboard_write':
          clipboard.writeText(params.text);
          resolve({ success: true, data: '已写入剪贴板', meta: { length: (params.text || '').length } });
          break;

        case 'system_info':
          var cpus = os.cpus();
          var totalMem = os.totalmem();
          var freeMem = os.freemem();
          resolve({
            success: true,
            data: {
              platform: os.platform(),
              arch: os.arch(),
              hostname: os.hostname(),
              cpuModel: cpus[0] ? cpus[0].model : 'unknown',
              cpuCores: cpus.length,
              totalMemory: Math.round(totalMem / 1024 / 1024) + ' MB',
              freeMemory: Math.round(freeMem / 1024 / 1024) + ' MB',
              memoryUsage: Math.round((1 - freeMem / totalMem) * 100) + '%',
              uptime: Math.round(os.uptime() / 3600) + ' hours',
              homedir: os.homedir(),
              tmpdir: os.tmpdir()
            }
          });
          break;

        case 'process_list':
          exec('tasklist /FO CSV /NH', { maxBuffer: 1024 * 1024 }, function(err, stdout) {
            if (err) {
              exec('ps aux --sort=-%mem | head -30', { maxBuffer: 1024 * 1024 }, function(err2, stdout2) {
                if (err2) return resolve({ success: false, error: '无法获取进程列表' });
                resolve({ success: true, data: stdout2.split('\n').slice(0, 30) });
              });
              return;
            }
            var lines = stdout.split('\n').filter(function(l) { return l.trim(); }).slice(0, 30);
            var procs = lines.map(function(line) {
              var parts = line.replace(/"/g, '').split(',');
              return { name: parts[0] || '', pid: parts[1] || '', memory: parts[4] || '' };
            });
            resolve({ success: true, data: procs });
          });
          break;

        case 'shell_exec':
          if (!isCommandSafe(params.command)) return resolve({ success: false, error: '命令不在安全白名单中，仅允许: ' + SAFE_COMMANDS.slice(0, 10).join(', ') + ' 等' });
          exec(params.command, { timeout: 10000, maxBuffer: 512 * 1024 }, function(err, stdout, stderr) {
            if (err) return resolve({ success: false, error: err.message });
            resolve({ success: true, data: (stdout || '') + (stderr || ''), meta: { command: params.command, exitCode: 0 } });
          });
          break;

        case 'browser_create_tab':
          executeBrowserTool('ai-browser-create-tab', [params.url, { mode: params.mode }]).then(resolve);
          break;

        case 'browser_navigate':
          executeBrowserTool('ai-browser-navigate', [params.tabId, params.url]).then(resolve);
          break;

        case 'browser_screenshot':
          executeBrowserTool('ai-browser-screenshot', [params.tabId, { fullPage: params.fullPage }]).then(resolve);
          break;

        case 'browser_click':
          if (params.selector) {
            executeBrowserTool('ai-browser-click-element', [params.tabId, params.selector]).then(resolve);
          } else if (params.x !== undefined && params.y !== undefined) {
            executeBrowserTool('ai-browser-mouse-click', [params.tabId, params.x, params.y, 'left']).then(resolve);
          } else {
            resolve({ success: false, error: '请提供 selector 或 x/y 坐标' });
          }
          break;

        case 'browser_input':
          executeBrowserTool('ai-browser-input-text', [params.tabId, params.selector, params.text]).then(resolve);
          break;

        case 'browser_get_structure':
          executeBrowserTool('ai-browser-get-structure', [params.tabId]).then(function(result) {
            if (result.success && result.data) {
              var elements = result.data.elements || [];
              result.meta = { elementCount: elements.length, url: result.data.url || '', title: result.data.title || '' };
            }
            resolve(result);
          });
          break;

        case 'browser_mouse_move':
          executeBrowserTool('ai-browser-mouse-move', [params.tabId, params.x, params.y]).then(resolve);
          break;

        case 'browser_scroll':
          executeBrowserTool('ai-browser-scroll', [params.tabId, params.direction, params.amount]).then(resolve);
          break;

        default:
          resolve({ success: false, error: '未知工具: ' + toolName });
      }
    } catch (e) {
      resolve({ success: false, error: e.message || '执行失败' });
    }
  });
}

function registerAgentHandlers() {
  ipcMain.handle('ai-agent-get-tools', function() {
    return { success: true, tools: getToolDefinitions() };
  });

  ipcMain.handle('ai-agent-execute', async function(event, params) {
    var toolName = params.tool;
    var toolParams = params.params || {};
    var risk = getToolRisk(toolName);

    addLog({ tool: toolName, params: toolParams, risk: risk, status: 'requested' });

    if (risk >= 3 && params.confirmed !== true) {
      return { success: false, needsConfirm: true, risk: risk, tool: toolName, params: toolParams };
    }

    var result = await executeTool(toolName, toolParams);
    addLog({ tool: toolName, params: toolParams, risk: risk, status: result.success ? 'success' : 'error', result: result.success ? 'ok' : result.error });
    return result;
  });

  ipcMain.handle('ai-agent-get-log', function() {
    return { success: true, log: agentLog.slice(0, 100) };
  });

  ipcMain.handle('ai-agent-clear-log', function() {
    agentLog = [];
    return { success: true };
  });

  // MCP 本地进程管理
  var activeMcpProcesses = new Map();
  var MAX_MCP_PROCESSES = 5;

  function cleanupMcpProcess(cacheKey) {
    var cached = activeMcpProcesses.get(cacheKey);
    if (cached && cached.proc) {
      try { cached.proc.kill(); } catch(e) {}
      activeMcpProcesses.delete(cacheKey);
      console.log('[MCP] 已清理进程:', cacheKey);
    }
  }

  function spawnMcpProcess(mcpConfig) {
    return new Promise(function(resolve, reject) {
      if (!mcpConfig.command) {
        reject(new Error('MCP 本地服务需要配置 command'));
        return;
      }
      var spawn = require('child_process').spawn;
      var args = mcpConfig.args || [];
      var options = {
        cwd: mcpConfig.cwd || process.cwd(),
        env: Object.assign({}, process.env, mcpConfig.env || {}),
        stdio: ['pipe', 'pipe', 'pipe']
      };

      var proc = spawn(mcpConfig.command, args, options);
      var stdout = '';
      var stderr = '';
      var initialized = false;

      proc.stdout.on('data', function(chunk) {
        stdout += chunk.toString();
        // MCP 使用 stdio 传输 JSON-RPC，每行一个消息
        var lines = stdout.split('\n');
        stdout = lines.pop(); // 保留不完整的最后一行
        lines.forEach(function(line) {
          if (!line.trim()) return;
          try {
            var msg = JSON.parse(line);
            if (!initialized && msg.result && msg.result.protocolVersion) {
              initialized = true;
              resolve({ proc: proc, send: function(req) { proc.stdin.write(JSON.stringify(req) + '\n'); } });
            }
          } catch(e) {}
        });
      });

      proc.stderr.on('data', function(chunk) {
        stderr += chunk.toString();
      });

      proc.on('error', function(e) {
        reject(new Error('MCP 进程启动失败: ' + e.message));
      });

      proc.on('close', function(code) {
        if (!initialized) {
          reject(new Error('MCP 进程退出 (code=' + code + '): ' + stderr.substring(0, 200)));
        }
      });

      // 发送初始化请求
      setTimeout(function() {
        if (!initialized) {
          try {
            proc.stdin.write(JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'drift-browser', version: '1.0.0' } }
            }) + '\n');
          } catch(e) {}
        }
      }, 500);

      // 超时处理
      setTimeout(function() {
        if (!initialized) {
          proc.kill();
          reject(new Error('MCP 初始化超时'));
        }
      }, 15000);
    });
  }

  async function getMcpConnection(mcpConfig) {
    var cacheKey = mcpConfig.name || mcpConfig.command || mcpConfig.url;
    var cached = activeMcpProcesses.get(cacheKey);
    if (cached && !cached.proc.killed) {
      return cached;
    }

    // 清理已死亡的进程
    if (cached && cached.proc.killed) {
      activeMcpProcesses.delete(cacheKey);
    }

    // 限制最大进程数
    if (activeMcpProcesses.size >= MAX_MCP_PROCESSES) {
      var oldestKey = activeMcpProcesses.keys().next().value;
      cleanupMcpProcess(oldestKey);
    }

    if (mcpConfig.command) {
      var conn = await spawnMcpProcess(mcpConfig);
      // 监听进程关闭事件，自动清理
      conn.proc.on('close', function() {
        console.log('[MCP] 进程已关闭:', cacheKey);
        activeMcpProcesses.delete(cacheKey);
      });
      conn.proc.on('error', function(err) {
        console.error('[MCP] 进程错误:', cacheKey, err.message);
        activeMcpProcesses.delete(cacheKey);
      });
      activeMcpProcesses.set(cacheKey, conn);
      return conn;
    }
    return null;
  }

  ipcMain.handle('ai-agent-mcp-call', async function(event, params) {
    var mcpConfig = params.mcpConfig;
    var toolName = params.toolName;
    var toolArgs = params.toolArgs || {};

    if (!mcpConfig) {
      return { success: false, error: 'MCP 服务未配置' };
    }

    try {
      var result;

      if (mcpConfig.command) {
        // 本地命令模式
        var conn = await getMcpConnection(mcpConfig);
        result = await new Promise(function(resolve, reject) {
          var reqId = Date.now();
          var timeout = setTimeout(function() { reject(new Error('MCP 调用超时')); }, 60000);
          var responseHandler = function(chunk) {
            var lines = chunk.toString().split('\n');
            lines.forEach(function(line) {
              if (!line.trim()) return;
              try {
                var msg = JSON.parse(line);
                if (msg.id === reqId) {
                  clearTimeout(timeout);
                  conn.proc.stdout.off('data', responseHandler);
                  resolve(msg);
                }
              } catch(e) {}
            });
          };
          conn.proc.stdout.on('data', responseHandler);
          conn.send({
            jsonrpc: '2.0',
            id: reqId,
            method: 'tools/call',
            params: { name: toolName, arguments: toolArgs }
          });
        });
      } else if (mcpConfig.url) {
        // HTTP 模式
        var http = require('http');
        var https = require('https');
        var url = new URL(mcpConfig.url);
        var body = JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: toolArgs }
        });

        result = await new Promise(function(resolve, reject) {
          var options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body)
            },
            timeout: 30000
          };
          if (mcpConfig.apiKey) {
            options.headers['Authorization'] = 'Bearer ' + mcpConfig.apiKey;
          }
          var requester = url.protocol === 'https:' ? https : http;
          var req = requester.request(options, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
              try { resolve(JSON.parse(data)); }
              catch (e) { reject(new Error('MCP 响应解析失败')); }
            });
          });
          req.on('error', function(e) { reject(e); });
          req.on('timeout', function() { req.destroy(); reject(new Error('MCP 请求超时')); });
          req.write(body);
          req.end();
        });
      } else {
        return { success: false, error: 'MCP 服务未配置 URL 或 command' };
      }

      addLog({ tool: 'mcp:' + toolName, params: toolArgs, risk: 2, status: 'success' });

      if (result.result) return { success: true, data: result.result };
      if (result.error) return { success: false, error: result.error.message || JSON.stringify(result.error) };
      return { success: false, error: 'MCP 返回未知格式' };
    } catch (e) {
      addLog({ tool: 'mcp:' + toolName, params: toolArgs, risk: 2, status: 'error', result: e.message });
      return { success: false, error: e.message || 'MCP 调用失败' };
    }
  });

  ipcMain.handle('ai-agent-mcp-list-tools', async function(event, mcpConfig) {
    if (!mcpConfig) {
      return { success: false, error: 'MCP 服务未配置' };
    }

    try {
      var result;

      if (mcpConfig.command) {
        // 本地命令模式
        var conn = await getMcpConnection(mcpConfig);
        result = await new Promise(function(resolve, reject) {
          var reqId = Date.now();
          var timeout = setTimeout(function() { reject(new Error('MCP 调用超时')); }, 15000);
          var responseHandler = function(chunk) {
            var lines = chunk.toString().split('\n');
            lines.forEach(function(line) {
              if (!line.trim()) return;
              try {
                var msg = JSON.parse(line);
                if (msg.id === reqId) {
                  clearTimeout(timeout);
                  conn.proc.stdout.off('data', responseHandler);
                  resolve(msg);
                }
              } catch(e) {}
            });
          };
          conn.proc.stdout.on('data', responseHandler);
          conn.send({
            jsonrpc: '2.0',
            id: reqId,
            method: 'tools/list',
            params: {}
          });
        });
      } else if (mcpConfig.url) {
        // HTTP 模式
        var http = require('http');
        var https = require('https');
        var url = new URL(mcpConfig.url);
        var body = JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list',
          params: {}
        });

        result = await new Promise(function(resolve, reject) {
          var options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 15000
          };
          if (mcpConfig.apiKey) {
            options.headers['Authorization'] = 'Bearer ' + mcpConfig.apiKey;
          }
          var requester = url.protocol === 'https:' ? https : http;
          var req = requester.request(options, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
              try { resolve(JSON.parse(data)); }
              catch (e) { reject(new Error('MCP 响应解析失败')); }
            });
          });
          req.on('error', function(e) { reject(e); });
          req.on('timeout', function() { req.destroy(); reject(new Error('MCP 请求超时')); });
          req.write(body);
          req.end();
        });
      } else {
        return { success: false, error: 'MCP 服务未配置 URL 或 command' };
      }

      if (result.result && result.result.tools) {
        return { success: true, tools: result.result.tools };
      }
      return { success: false, error: 'MCP 未返回工具列表' };
    } catch (e) {
      return { success: false, error: e.message || 'MCP 连接失败' };
    }
  });
  ipcMain.handle('ai-agent-skill-execute', async function(event, params) {
    var skillName = params.skillName;
    var skillPrompt = params.skillPrompt || '';
    var skillParams = params.params || {};

    addLog({ tool: 'skill:' + skillName, params: skillParams, risk: 1, status: 'requested' });

    try {
      var paramStr = Object.keys(skillParams).map(function(k) {
        return k + '=' + JSON.stringify(skillParams[k]);
      }).join(', ');
      var resultMsg = '技能 "' + skillName + '" 已触发。';
      if (skillPrompt) {
        resultMsg += ' 提示词: ' + skillPrompt.replace(/\{(\w+)\}/g, function(m, key) {
          return skillParams[key] !== undefined ? String(skillParams[key]) : m;
        });
      }
      if (paramStr) {
        resultMsg += ' 参数: ' + paramStr;
      }

      addLog({ tool: 'skill:' + skillName, params: skillParams, risk: 1, status: 'success' });
      return { success: true, data: resultMsg };
    } catch (e) {
      addLog({ tool: 'skill:' + skillName, params: skillParams, risk: 1, status: 'error', result: e.message });
      return { success: false, error: e.message || '技能执行失败' };
    }
  });

  // ---- 扫描本地 Skill 文件夹 ----
  ipcMain.handle('ai-agent-skill-scan-folder', async function(event) {
    try {
      var result = await dialog.showOpenDialog({
        title: '选择技能文件夹',
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, error: '用户取消选择' };
      }
      var folderPath = result.filePaths[0];
      var files = fs.readdirSync(folderPath);
      var skills = [];

      files.forEach(function(file) {
        var filePath = path.join(folderPath, file);
        var stat = fs.statSync(filePath);
        if (!stat.isFile()) return;
        var ext = path.extname(file).toLowerCase();
        if (ext !== '.json') return;
        try {
          var content = fs.readFileSync(filePath, 'utf8');
          var data = JSON.parse(content);
          if (Array.isArray(data)) {
            data.forEach(function(s) {
              if (s.id && s.name) skills.push(s);
            });
          } else if (data.id && data.name) {
            skills.push(data);
          } else if (data.skills && Array.isArray(data.skills)) {
            data.skills.forEach(function(s) {
              if (s.id && s.name) skills.push(s);
            });
          }
        } catch(e) {}
      });

      return { success: true, skills: skills, folder: folderPath };
    } catch (e) {
      return { success: false, error: e.message || '扫描文件夹失败' };
    }
  });

  // ---- 读取本地规则文件 ----
  ipcMain.handle('ai-get-rules-file', async function() {
    try {
      var rulesPath = path.join(process.cwd(), 'docs', 'ai-rules.md');
      if (fs.existsSync(rulesPath)) {
        var content = fs.readFileSync(rulesPath, 'utf-8');
        return { success: true, content: content };
      }
      return { success: false, error: '规则文件不存在' };
    } catch (e) {
      return { success: false, error: e.message || '读取规则文件失败' };
    }
  });
}

module.exports = { registerAgentHandlers, getToolDefinitions, setBrowserHandler };
