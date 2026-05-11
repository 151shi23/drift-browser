const { ipcMain, webContents } = require('electron');
const { getMainWindow } = require('./window-manager');

var aiBrowserTabs = new Map();
var currentMode = 'standard';
var tabSeq = 0;
var MAX_AI_TABS = 10;

// 定期清理已关闭的AI标签页
setInterval(function() {
  aiBrowserTabs.forEach(function(info, tabId) {
    var wc = getWebContentsById(info.webContentsId);
    if (!wc || wc.isDestroyed()) {
      console.log('[AI-Browser] 清理已关闭标签页:', tabId);
      aiBrowserTabs.delete(tabId);
    }
  });
}, 60000);

var DOM_EXTRACTOR_SCRIPT = [
  '(function() {',
  '  function genSel(el) {',
  '    if (el.id) return "#" + el.id;',
  '    var path = [];',
  '    while (el && el.nodeType === 1) {',
  '      var sib = el, nth = 1;',
  '      while (sib = sib.previousElementSibling) { if (sib.tagName === el.tagName) nth++; }',
  '      path.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + nth + ")");',
  '      el = el.parentElement;',
  '    }',
  '    return path.join(" > ");',
  '  }',
  '  var els = [];',
  '  document.querySelectorAll("button, a, input, select, textarea, [onclick], [role=button], [tabindex]")',
  '    .forEach(function(el) {',
  '      var r = el.getBoundingClientRect();',
  '      if (r.width > 0 && r.height > 0) {',
  '        els.push({',
  '          type: el.tagName.toLowerCase(),',
  '          selector: el.id ? "#" + el.id : genSel(el),',
  '          text: (el.innerText || el.placeholder || "").substring(0, 200),',
  '          boundingBox: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },',
  '          visible: true,',
  '          attributes: { id: el.id || undefined, type: el.type || undefined, href: el.href || undefined, placeholder: el.placeholder || undefined }',
  '        });',
  '      }',
  '    });',
  '  return JSON.stringify({',
  '    url: window.location.href,',
  '    title: document.title,',
  '    viewport: { width: window.innerWidth, height: window.innerHeight },',
  '    scrollPosition: { x: window.scrollX, y: window.scrollY },',
  '    documentHeight: document.documentElement.scrollHeight,',
  '    elements: els,',
  '    links: Array.from(document.querySelectorAll("a[href]")).slice(0, 50).map(function(a) { return { text: (a.innerText || "").substring(0, 100), href: a.href }; }),',
  '    headings: Array.from(document.querySelectorAll("h1,h2,h3")).slice(0, 20).map(function(h) { return { level: h.tagName, text: h.innerText.substring(0, 200) }; })',
  '  });',
  '})()'
].join('\n');

var TEXT_EXTRACT_SCRIPT = [
  '(function() {',
  '  return JSON.stringify({',
  '    url: window.location.href,',
  '    title: document.title,',
  '    text: document.body ? document.body.innerText.substring(0, 5000) : ""',
  '  });',
  '})()'
].join('\n');

var ACCESSIBILITY_TREE_SCRIPT = [
  '(function() {',
  '  function genSel(el) {',
  '    if (el.id) return "#" + el.id;',
  '    var path = [];',
  '    var cur = el;',
  '    while (cur && cur.nodeType === 1) {',
  '      var sib = cur, nth = 1;',
  '      while (sib = sib.previousElementSibling) { if (sib.tagName === cur.tagName) nth++; }',
  '      path.unshift(cur.tagName.toLowerCase() + ":nth-of-type(" + nth + ")");',
  '      cur = cur.parentElement;',
  '    }',
  '    return path.join(" > ");',
  '  }',
  '  function getAriaRole(el) {',
  '    if (el.getAttribute("role")) return el.getAttribute("role");',
  '    var tag = el.tagName.toLowerCase();',
  '    var roleMap = {',
  '      "a": el.getAttribute("href") ? "link" : "text",',
  '      "button": "button",',
  '      "input": (el.type === "checkbox" ? "checkbox" : el.type === "radio" ? "radio" : el.type === "submit" ? "button" : el.type === "button" ? "button" : "textbox"),',
  '      "select": "combobox",',
  '      "textarea": "textbox",',
  '      "h1": "heading", "h2": "heading", "h3": "heading", "h4": "heading", "h5": "heading", "h6": "heading",',
  '      "img": "img",',
  '      "form": "form",',
  '      "table": "table",',
  '      "nav": "navigation",',
  '      "main": "main",',
  '      "header": "banner",',
  '      "footer": "contentinfo",',
  '      "dialog": "dialog",',
  '      "details": "group",',
  '      "summary": "button"',
  '    };',
  '    return roleMap[tag] || null;',
  '  }',
  '  function getAriaName(el) {',
  '    var name = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "";',
  '    if (!name) {',
  '      var labelFor = el.id && document.querySelector("label[for=" + JSON.stringify(el.id) + "]");',
  '      if (labelFor) name = (labelFor.innerText || "").trim();',
  '    }',
  '    if (!name && el.placeholder) name = el.placeholder;',
  '    if (!name) name = (el.innerText || "").trim().substring(0, 100);',
  '    if (!name && el.tagName.toLowerCase() === "img") name = el.getAttribute("alt") || "";',
  '    return name;',
  '  }',
  '  var tree = [];',
  '  var interactiveSelector = "button, a[href], input, select, textarea, [role], [tabindex]:not([tabindex=\\"-1\\"]), details, summary, [onclick], [aria-label], [contenteditable=\\"true\\"]";',
  '  var headingSelector = "h1, h2, h3, h4, h5, h6";',
  '  var allSelector = interactiveSelector + ", " + headingSelector;',
  '  document.querySelectorAll(allSelector).forEach(function(el) {',
  '    var r = el.getBoundingClientRect();',
  '    if (r.width <= 0 || r.height <= 0) return;',
  '    var role = getAriaRole(el);',
  '    if (!role) return;',
  '    var node = { role: role, name: getAriaName(el), selector: el.id ? "#" + el.id : genSel(el) };',
  '    if (role === "heading") {',
  '      var level = parseInt(el.tagName.charAt(1), 10);',
  '      if (level) node.level = level;',
  '    }',
  '    if (role === "link") node.href = el.href || undefined;',
  '    if (role === "textbox") {',
  '      node.value = (el.value || "").substring(0, 50);',
  '      node.required = el.required || undefined;',
  '    }',
  '    if (role === "combobox") {',
  '      node.options = Array.from(el.options).slice(0, 10).map(function(o) { return o.text; });',
  '      node.value = el.value || undefined;',
  '    }',
  '    if (role === "checkbox" || role === "radio") node.checked = el.checked;',
  '    if (role === "img") node.src = (el.src || "").substring(0, 200);',
  '    node.boundingBox = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };',
  '    tree.push(node);',
  '  });',
  '  var canvasEls = document.querySelectorAll("canvas");',
  '  var canvasArea = 0, vpArea = window.innerWidth * window.innerHeight;',
  '  canvasEls.forEach(function(c) {',
  '    var cr = c.getBoundingClientRect();',
  '    canvasArea += cr.width * cr.height;',
  '  });',
  '  var canvasRatio = vpArea > 0 ? canvasArea / vpArea : 0;',
  '  return JSON.stringify({',
  '    url: window.location.href,',
  '    title: document.title,',
  '    viewport: { width: window.innerWidth, height: window.innerHeight },',
  '    scrollPosition: { x: window.scrollX, y: window.scrollY },',
  '    tree: tree,',
  '    meta: { elementCount: tree.length, hasCanvas: canvasEls.length > 0, canvasRatio: Math.round(canvasRatio * 100) / 100 }',
  '  });',
  '})()'
].join('\n');

var CANVAS_DETECT_SCRIPT = [
  '(function() {',
  '  var canvasEls = document.querySelectorAll("canvas");',
  '  var canvasArea = 0, vpArea = window.innerWidth * window.innerHeight;',
  '  canvasEls.forEach(function(c) {',
  '    var r = c.getBoundingClientRect();',
  '    canvasArea += r.width * r.height;',
  '  });',
  '  var ratio = vpArea > 0 ? canvasArea / vpArea : 0;',
  '  return JSON.stringify({',
  '    hasCanvas: canvasEls.length > 0,',
  '    canvasCount: canvasEls.length,',
  '    canvasRatio: Math.round(ratio * 100) / 100,',
  '    shouldUseScreenshot: ratio > 0.5',
  '  });',
  '})()'
].join('\n');

function getWebContentsById(webContentsId) {
  try {
    var wc = webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) return null;
    return wc;
  } catch (e) {
    return null;
  }
}

function getWebContentsForTab(tabId) {
  var tabInfo = aiBrowserTabs.get(tabId);
  if (!tabInfo) return null;
  return getWebContentsById(tabInfo.webContentsId);
}

function createTabId() {
  tabSeq++;
  return 'ai-tab-' + Date.now() + '-' + tabSeq;
}

function executeOnWebview(tabId, script) {
  return new Promise(function(resolve) {
    var wc = getWebContentsForTab(tabId);
    if (!wc) {
      resolve({ success: false, error: '标签页不存在或已关闭' });
      return;
    }
    wc.executeJavaScript(script)
      .then(function(result) {
        resolve({ success: true, data: result });
      })
      .catch(function(e) {
        resolve({ success: false, error: e.message || '脚本执行失败' });
      });
  });
}

var handlerFunctions = {};

function registerAIBrowserHandlers() {
  handlerFunctions = {
    'ai-browser-create-tab': async function(event, url, options) {
      try {
        var mainWin = getMainWindow();
        if (!mainWin || mainWin.isDestroyed()) {
          return { success: false, error: '主窗口不存在' };
        }

        var tabId = createTabId();
        var targetUrl = url || 'about:blank';

        var createResult = await mainWin.webContents.executeJavaScript(
          '(function() {' +
          '  try {' +
          '    if (!window.FBrowser || !window.FBrowser.tabs) return { error: "FBrowser.tabs 不存在" };' +
          '    var tabId = window.FBrowser.tabs.createTab(' + JSON.stringify(targetUrl) + ');' +
          '    if (!tabId) return { error: "createTab 返回空" };' +
          '    return { id: tabId, ok: true };' +
          '  } catch(e) {' +
          '    return { error: e.message || "创建标签页异常" };' +
          '  }' +
          '})()'
        ).catch(function(e) {
          return { error: 'JS执行失败: ' + (e.message || e.toString()) };
        });

        if (!createResult || !createResult.id || createResult.error) {
          return { success: false, error: createResult?.error || '创建标签页失败' };
        }

        var webContentsId = null;

        var maxRetries = 30;
        for (var i = 0; i < maxRetries; i++) {
          await new Promise(function(r) { setTimeout(r, 300); });
          try {
            var checkResult = await mainWin.webContents.executeJavaScript(
              '(function() {' +
              '  try {' +
              '    var tabList = window.FBrowser && window.FBrowser.tabs ? window.FBrowser.tabs.tabs : [];' +
              '    var tab = tabList.find(function(t) { return t.id === ' + createResult.id + '; });' +
              '    if (!tab || !tab.webview) return null;' +
              '    var wcId = tab.webview.getWebContentsId();' +
              '    return wcId || null;' +
              '  } catch(e) {' +
              '    return null;' +
              '  }' +
              '})()'
            );
            if (checkResult) {
              webContentsId = checkResult;
              break;
            }
          } catch(e) {
            continue;
          }
        }

        if (!webContentsId) {
          return { success: false, error: '获取 webContentsId 超时，标签页可能未正确初始化' };
        }

        // 限制最大AI标签页数量
        if (aiBrowserTabs.size >= MAX_AI_TABS) {
          var oldestKey = aiBrowserTabs.keys().next().value;
          var oldestInfo = aiBrowserTabs.get(oldestKey);
          if (oldestInfo) {
            try {
              var mainWin2 = getMainWindow();
              if (mainWin2 && !mainWin2.isDestroyed()) {
                await mainWin2.webContents.executeJavaScript(
                  'window.FBrowser && window.FBrowser.tabs ? window.FBrowser.tabs.closeTab(' + oldestInfo.internalTabId + ') : null'
                );
              }
            } catch(e) {}
            aiBrowserTabs.delete(oldestKey);
          }
        }

        aiBrowserTabs.set(tabId, {
          tabId: tabId,
          internalTabId: createResult.id,
          webContentsId: webContentsId,
          url: targetUrl,
          title: '',
          createdAt: Date.now()
        });

        return { success: true, tabId: tabId, webContentsId: webContentsId };
      } catch (e) {
        return { success: false, error: e.message || '创建标签页失败' };
      }
    },

    'ai-browser-close-tab': async function(event, tabId) {
      try {
        var tabInfo = aiBrowserTabs.get(tabId);
        if (!tabInfo) {
          return { success: false, error: '标签页不存在' };
        }

        var mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          await mainWin.webContents.executeJavaScript(
            'window.FBrowser && window.FBrowser.tabs ? window.FBrowser.tabs.closeTab(' + tabInfo.internalTabId + ') : null'
          );
        }

        aiBrowserTabs.delete(tabId);
        return { success: true };
      } catch (e) {
        aiBrowserTabs.delete(tabId);
        return { success: false, error: e.message || '关闭标签页失败' };
      }
    },

    'ai-browser-list-tabs': function(event) {
      var tabs = [];
      aiBrowserTabs.forEach(function(info, tid) {
        var wc = getWebContentsById(info.webContentsId);
        tabs.push({
          tabId: tid,
          url: wc ? wc.getURL() : info.url,
          title: wc ? wc.getTitle() : info.title,
          alive: !!wc
        });
      });
      return { success: true, tabs: tabs };
    },

    'ai-browser-navigate': async function(event, tabId, url) {
      try {
        var wc = getWebContentsForTab(tabId);
        if (!wc) return { success: false, error: '标签页不存在或已关闭' };

        return new Promise(function(resolve) {
          var timeout = setTimeout(function() {
            resolve({ success: false, error: '导航超时（30秒）' });
          }, 30000);

          wc.once('did-finish-load', function() {
            clearTimeout(timeout);
            var tabInfo = aiBrowserTabs.get(tabId);
            if (tabInfo) {
              tabInfo.url = wc.getURL();
              tabInfo.title = wc.getTitle();
            }
            resolve({ success: true, url: wc.getURL(), title: wc.getTitle() });
          });

          wc.once('did-fail-load', function(event, errorCode, errorDesc) {
            clearTimeout(timeout);
            resolve({ success: false, error: '导航失败: ' + errorDesc });
          });

          wc.loadURL(url);
        });
      } catch (e) {
        return { success: false, error: e.message || '导航失败' };
      }
    },

    'ai-browser-go-back': async function(event, tabId) {
      try {
        var wc = getWebContentsForTab(tabId);
        if (!wc) return { success: false, error: '标签页不存在或已关闭' };
        if (wc.canGoBack()) {
          wc.goBack();
          return { success: true };
        }
        return { success: false, error: '无法后退' };
      } catch (e) {
        return { success: false, error: e.message || '后退失败' };
      }
    },

    'ai-browser-go-forward': async function(event, tabId) {
      try {
        var wc = getWebContentsForTab(tabId);
        if (!wc) return { success: false, error: '标签页不存在或已关闭' };
        if (wc.canGoForward()) {
          wc.goForward();
          return { success: true };
        }
        return { success: false, error: '无法前进' };
      } catch (e) {
        return { success: false, error: e.message || '前进失败' };
      }
    },

    'ai-browser-get-structure': async function(event, tabId) {
      try {
        var canvasResult = await executeOnWebview(tabId, CANVAS_DETECT_SCRIPT);
        var canvasInfo = { hasCanvas: false, canvasCount: 0, canvasRatio: 0 };
        if (canvasResult.success && typeof canvasResult.data === 'string') {
          try { canvasInfo = JSON.parse(canvasResult.data); } catch(e) {}
        }

        if (canvasInfo.hasCanvas && canvasInfo.canvasRatio > 0.5) {
          var basicResult = await executeOnWebview(tabId, ACCESSIBILITY_TREE_SCRIPT);
          var basicData = null;
          if (basicResult.success && typeof basicResult.data === 'string') {
            try { basicData = JSON.parse(basicResult.data); } catch(e) {}
          }
          return {
            success: true,
            data: {
              mode: 'screenshot',
              url: basicData ? basicData.url : '',
              title: basicData ? basicData.title : '',
              viewport: basicData ? basicData.viewport : {},
              tree: basicData ? basicData.tree.slice(0, 10) : [],
              meta: { elementCount: basicData ? basicData.tree.length : 0, hasCanvas: true, canvasRatio: canvasInfo.canvasRatio },
              message: '此页面包含Canvas/动态内容(占比' + Math.round(canvasInfo.canvasRatio * 100) + '%)，建议使用browser_screenshot获取视觉信息'
            }
          };
        }

        var a11yResult = await executeOnWebview(tabId, ACCESSIBILITY_TREE_SCRIPT);
        if (a11yResult.success && typeof a11yResult.data === 'string') {
          try {
            var a11yData = JSON.parse(a11yResult.data);
            return {
              success: true,
              data: {
                mode: 'a11y',
                url: a11yData.url,
                title: a11yData.title,
                viewport: a11yData.viewport,
                tree: a11yData.tree,
                meta: { elementCount: a11yData.tree.length, hasCanvas: canvasInfo.hasCanvas, canvasRatio: canvasInfo.canvasRatio }
              }
            };
          } catch(e) {
            // Accessibility Tree 解析失败，fallback 到 DOM 提取
          }
        }

        // Fallback: 使用原有的 DOM 提取
        var fallbackResult = await executeOnWebview(tabId, DOM_EXTRACTOR_SCRIPT);
        if (fallbackResult.success && typeof fallbackResult.data === 'string') {
          try {
            var fallbackData = JSON.parse(fallbackResult.data);
            return {
              success: true,
              data: {
                mode: 'dom',
                url: fallbackData.url,
                title: fallbackData.title,
                viewport: fallbackData.viewport,
                elements: fallbackData.elements,
                meta: { elementCount: fallbackData.elements ? fallbackData.elements.length : 0, hasCanvas: canvasInfo.hasCanvas, canvasRatio: canvasInfo.canvasRatio }
              }
            };
          } catch(e) {}
        }

        return fallbackResult;
      } catch(e) {
        return { success: false, error: e.message || '获取页面结构失败' };
      }
    },

    'ai-browser-get-text': async function(event, tabId) {
      var result = await executeOnWebview(tabId, TEXT_EXTRACT_SCRIPT);
      if (result.success && typeof result.data === 'string') {
        try {
          result.data = JSON.parse(result.data);
        } catch (e) {
          result.data = { rawText: result.data };
        }
      }
      return result;
    },

    'ai-browser-click-element': async function(event, tabId, selector) {
      var script = [
        '(function() {',
        '  var el = document.querySelector(' + JSON.stringify(selector) + ');',
        '  if (!el) return JSON.stringify({ success: false, error: "未找到元素: " + ' + JSON.stringify(selector) + ' });',
        '  el.scrollIntoView({ behavior: "instant", block: "center" });',
        '  el.click();',
        '  return JSON.stringify({ success: true });',
        '})()'
      ].join('\n');
      var result = await executeOnWebview(tabId, script);
      if (result.success && typeof result.data === 'string') {
        try { result.data = JSON.parse(result.data); } catch (e) {}
      }
      return result;
    },

    'ai-browser-input-text': async function(event, tabId, selector, text) {
      var script = [
        '(function() {',
        '  var el = document.querySelector(' + JSON.stringify(selector) + ');',
        '  if (!el) return JSON.stringify({ success: false, error: "未找到元素: " + ' + JSON.stringify(selector) + ' });',
        '  el.scrollIntoView({ behavior: "instant", block: "center" });',
        '  el.focus();',
        '  el.value = "";',
        '  var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;',
        '  var nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;',
        '  var setter = el.tagName === "TEXTAREA" ? nativeTextareaValueSetter : nativeInputValueSetter;',
        '  if (setter) setter.call(el, ' + JSON.stringify(text) + ');',
        '  else el.value = ' + JSON.stringify(text) + ';',
        '  el.dispatchEvent(new Event("input", { bubbles: true }));',
        '  el.dispatchEvent(new Event("change", { bubbles: true }));',
        '  return JSON.stringify({ success: true });',
        '})()'
      ].join('\n');
      var result = await executeOnWebview(tabId, script);
      if (result.success && typeof result.data === 'string') {
        try { result.data = JSON.parse(result.data); } catch (e) {}
      }
      return result;
    },

    'ai-browser-select-option': async function(event, tabId, selector, value) {
      var script = [
        '(function() {',
        '  var el = document.querySelector(' + JSON.stringify(selector) + ');',
        '  if (!el) return JSON.stringify({ success: false, error: "未找到元素" });',
        '  el.value = ' + JSON.stringify(value) + ';',
        '  el.dispatchEvent(new Event("change", { bubbles: true }));',
        '  return JSON.stringify({ success: true });',
        '})()'
      ].join('\n');
      var result = await executeOnWebview(tabId, script);
      if (result.success && typeof result.data === 'string') {
        try { result.data = JSON.parse(result.data); } catch (e) {}
      }
      return result;
    },

    'ai-browser-screenshot': async function(event, tabId, options) {
      try {
        var wc = getWebContentsForTab(tabId);
        if (!wc) return { success: false, error: '标签页不存在或已关闭' };

        var image = await wc.capturePage();
        var dataUrl = image.toDataURL();

        var tabInfo = aiBrowserTabs.get(tabId);
        var mousePos = tabInfo ? tabInfo.mousePosition || { x: 0, y: 0 } : { x: 0, y: 0 };

        var screenshotData = {
          image: dataUrl,
          viewport: { width: image.getSize().width, height: image.getSize().height },
          timestamp: Date.now(),
          mousePosition: mousePos,
          url: wc.getURL(),
          title: wc.getTitle()
        };

        var mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('ai-browser-screenshot-update', screenshotData);
        }

        return { success: true, data: screenshotData };
      } catch (e) {
        return { success: false, error: e.message || '截图失败' };
      }
    },

    'ai-browser-mouse-move': async function(event, tabId, x, y) {
      try {
        var tabInfo = aiBrowserTabs.get(tabId);
        if (!tabInfo) return { success: false, error: '标签页不存在' };

        tabInfo.mousePosition = { x: x, y: y };

        var mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('ai-browser-mouse-update', { tabId: tabId, x: x, y: y });
        }

        return { success: true };
      } catch (e) {
        return { success: false, error: e.message || '鼠标移动失败' };
      }
    },

    'ai-browser-mouse-click': async function(event, tabId, x, y, button) {
      var btn = button || 'left';
      var eventType = btn === 'right' ? 'contextmenu' : 'click';
      var buttonCode = btn === 'right' ? 2 : 0;

      var script = [
        '(function() {',
        '  var el = document.elementFromPoint(' + x + ', ' + y + ');',
        '  if (el) {',
        '    var evt = new MouseEvent("' + eventType + '", {',
        '      bubbles: true, cancelable: true,',
        '      clientX: ' + x + ', clientY: ' + y + ',',
        '      button: ' + buttonCode,
        '    });',
        '    el.dispatchEvent(evt);',
        '    return JSON.stringify({ success: true, tagName: el.tagName, text: (el.innerText || "").substring(0, 100) });',
        '  }',
        '  return JSON.stringify({ success: false, error: "坐标处未找到元素" });',
        '})()'
      ].join('\n');

      var result = await executeOnWebview(tabId, script);
      if (result.success && typeof result.data === 'string') {
        try { result.data = JSON.parse(result.data); } catch (e) {}
      }

      var mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('ai-browser-mouse-update', { tabId: tabId, x: x, y: y, clicked: true });
      }

      return result;
    },

    'ai-browser-scroll': async function(event, tabId, direction, amount) {
      var scrollAmount = amount || 300;
      var scrollX = 0, scrollY = 0;
      if (direction === 'up') scrollY = -scrollAmount;
      else if (direction === 'down') scrollY = scrollAmount;
      else if (direction === 'left') scrollX = -scrollAmount;
      else if (direction === 'right') scrollX = scrollAmount;

      var script = [
        '(function() {',
        '  window.scrollBy(' + scrollX + ', ' + scrollY + ');',
        '  return JSON.stringify({ success: true, scrollPosition: { x: window.scrollX, y: window.scrollY } });',
        '})()'
      ].join('\n');

      var result = await executeOnWebview(tabId, script);
      if (result.success && typeof result.data === 'string') {
        try { result.data = JSON.parse(result.data); } catch (e) {}
      }
      return result;
    },

    'ai-browser-set-mode': function(event, mode) {
      if (mode === 'standard' || mode === 'multimodal') {
        currentMode = mode;
        return { success: true, mode: currentMode };
      }
      return { success: false, error: '无效模式: ' + mode };
    },

    'ai-browser-get-mode': function(event) {
      return { success: true, mode: currentMode };
    }
  };

  Object.keys(handlerFunctions).forEach(function(channel) {
    ipcMain.handle(channel, handlerFunctions[channel]);
  });
}

module.exports = { registerAIBrowserHandlers: registerAIBrowserHandlers, handlerFunctions: function() { return handlerFunctions; } };
