(function() {
  var sdk = window.DriftPluginSDK.register(__pluginMeta);

  var PRESETS = {
    'midnight-purple': {
      name: '暗夜紫', nameEn: 'Midnight Purple',
      accent: '#8B5CF6', accentRgb: '139,92,246',
      bgType: 'gradient', bgValue: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)',
      toolbarBg: '#1a0a2e', toolbarOpacity: 0.92,
      tabBarBg: '#1a0a2e', tabBarOpacity: 0.88,
      sidebarBg: '#1a0a2e', sidebarOpacity: 0.85,
      tabRadius: 10, tabSpacing: 4, tabFontSize: 12, toolbarHeight: 42, customCSS: ''
    },
    'ocean-blue': {
      name: '海洋蓝', nameEn: 'Ocean Blue',
      accent: '#0EA5E9', accentRgb: '14,165,233',
      bgType: 'gradient', bgValue: 'linear-gradient(135deg, #0c1929 0%, #0f2942 50%, #0c1929 100%)',
      toolbarBg: '#0c1929', toolbarOpacity: 0.92,
      tabBarBg: '#0c1929', tabBarOpacity: 0.88,
      sidebarBg: '#0c1929', sidebarOpacity: 0.85,
      tabRadius: 8, tabSpacing: 3, tabFontSize: 12, toolbarHeight: 42, customCSS: ''
    },
    'sakura-pink': {
      name: '樱花粉', nameEn: 'Sakura Pink',
      accent: '#EC4899', accentRgb: '236,72,153',
      bgType: 'gradient', bgValue: 'linear-gradient(135deg, #1f1020 0%, #2d1527 50%, #1f1020 100%)',
      toolbarBg: '#1f1020', toolbarOpacity: 0.92,
      tabBarBg: '#1f1020', tabBarOpacity: 0.88,
      sidebarBg: '#1f1020', sidebarOpacity: 0.85,
      tabRadius: 12, tabSpacing: 4, tabFontSize: 12, toolbarHeight: 42, customCSS: ''
    },
    'forest-green': {
      name: '森林绿', nameEn: 'Forest Green',
      accent: '#10B981', accentRgb: '16,185,129',
      bgType: 'gradient', bgValue: 'linear-gradient(135deg, #0a1f15 0%, #0f2e1f 50%, #0a1f15 100%)',
      toolbarBg: '#0a1f15', toolbarOpacity: 0.92,
      tabBarBg: '#0a1f15', tabBarOpacity: 0.88,
      sidebarBg: '#0a1f15', sidebarOpacity: 0.85,
      tabRadius: 8, tabSpacing: 3, tabFontSize: 12, toolbarHeight: 42, customCSS: ''
    },
    'minimal-white': {
      name: '极简白', nameEn: 'Minimal White',
      accent: '#6B7280', accentRgb: '107,114,128',
      bgType: 'solid', bgValue: '#f5f5f5',
      toolbarBg: '#ffffff', toolbarOpacity: 0.95,
      tabBarBg: '#f0f0f0', tabBarOpacity: 0.95,
      sidebarBg: '#ffffff', sidebarOpacity: 0.95,
      tabRadius: 8, tabSpacing: 2, tabFontSize: 12, toolbarHeight: 40, customCSS: ''
    }
  };

  var styleEl = null;
  var currentConfig = null;

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function generateCSS(config) {
    var css = '';

    if (config.bgType === 'solid' && config.bgValue) {
      css += 'body { background: ' + config.bgValue + ' !important; }';
    } else if (config.bgType === 'gradient' && config.bgValue) {
      css += 'body { background: ' + config.bgValue + ' !important; background-attachment: fixed !important; }';
    } else if (config.bgType === 'image' && config.bgValue) {
      css += 'body { background-image: url(' + config.bgValue + ') !important; background-size: cover !important; background-position: center !important; background-attachment: fixed !important; }';
    }

    if (config.accent) {
      css += ':root { --accent: ' + config.accent + ' !important; }';
      if (config.accentRgb) {
        css += ':root { --accent-rgb: ' + config.accentRgb + ' !important; }';
      }
    }

    if (config.toolbarBg) {
      var tBg = hexToRgba(config.toolbarBg, config.toolbarOpacity || 0.92);
      css += '.toolbar, .toolbar-container { background: ' + tBg + ' !important; }';
    }

    if (config.tabBarBg) {
      var tbBg = hexToRgba(config.tabBarBg, config.tabBarOpacity || 0.88);
      css += '.tab-bar, .tabs-container { background: ' + tbBg + ' !important; }';
    }

    if (config.sidebarBg) {
      var sBg = hexToRgba(config.sidebarBg, config.sidebarOpacity || 0.85);
      css += '.sidebar, .side-panel { background: ' + sBg + ' !important; }';
    }

    if (config.tabRadius !== undefined) {
      css += '.tab { border-radius: ' + config.tabRadius + 'px !important; }';
    }

    if (config.tabSpacing !== undefined) {
      css += '.tab { margin-right: ' + config.tabSpacing + 'px !important; }';
    }

    if (config.tabFontSize !== undefined) {
      css += '.tab-title { font-size: ' + config.tabFontSize + 'px !important; }';
    }

    if (config.toolbarHeight !== undefined) {
      css += '.toolbar { height: ' + config.toolbarHeight + 'px !important; min-height: ' + config.toolbarHeight + 'px !important; }';
    }

    if (config.customCSS) {
      css += config.customCSS;
    }

    return css;
  }

  function applyConfig(config) {
    currentConfig = config;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'drift-customizer-styles';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = generateCSS(config);
  }

  async function saveConfig(config) {
    if (sdk.storage && sdk.storage.set) {
      await sdk.storage.set('config', config);
    }
  }

  async function loadConfig() {
    if (sdk.storage && sdk.storage.get) {
      try {
        var config = await sdk.storage.get('config');
        if (config && typeof config === 'object') {
          applyConfig(config);
          currentConfig = config;
          return config;
        }
      } catch (e) {}
    }
    return null;
  }

  function createCustomizerPanel() {
    if (document.getElementById('driftCustomizerPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'driftCustomizerPanel';
    panel.style.cssText = 'position:fixed;top:0;right:-420px;width:400px;height:100vh;background:var(--bg-1);border-left:1px solid var(--border);z-index:99998;overflow-y:auto;transition:right .3s cubic-bezier(.16,1,.3,1);padding:20px;font-family:system-ui;';

    var html = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">'
        + '<h3 style="margin:0;font-size:16px;color:var(--fg-0);">个性化浏览器</h3>'
        + '<button id="custCloseBtn" style="width:28px;height:28px;border:none;background:transparent;color:var(--fg-2);cursor:pointer;border-radius:6px;font-size:16px;">✕</button>'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">预设主题</div>'
        + '<div id="custPresets" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">主页背景</div>'
        + '<div style="display:flex;gap:8px;margin-bottom:8px;">'
          + '<select id="custBgType" style="flex:1;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;">'
            + '<option value="none">无</option>'
            + '<option value="solid">纯色</option>'
            + '<option value="gradient">渐变</option>'
            + '<option value="image">图片</option>'
          + '</select>'
          + '<input type="color" id="custBgColor" value="#1a1a2e" style="width:36px;height:30px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;">'
        + '</div>'
        + '<input type="text" id="custBgValue" placeholder="渐变CSS或图片URL" style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;box-sizing:border-box;">'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">强调色</div>'
        + '<input type="color" id="custAccent" value="#4A90D9" style="width:100%;height:32px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;">'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">UI 颜色与透明度</div>'
        + '<div style="margin-bottom:8px;">'
          + '<label style="font-size:11px;color:var(--fg-2);">工具栏</label>'
          + '<div style="display:flex;gap:6px;align-items:center;">'
            + '<input type="color" id="custToolbarBg" value="#1a1a2e" style="width:32px;height:26px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:transparent;">'
            + '<input type="range" id="custToolbarOpacity" min="0" max="100" value="92" style="flex:1;">'
            + '<span id="custToolbarOpacityVal" style="font-size:10px;color:var(--fg-2);width:30px;text-align:right;">92%</span>'
          + '</div>'
        + '</div>'
        + '<div style="margin-bottom:8px;">'
          + '<label style="font-size:11px;color:var(--fg-2);">标签栏</label>'
          + '<div style="display:flex;gap:6px;align-items:center;">'
            + '<input type="color" id="custTabBarBg" value="#1a1a2e" style="width:32px;height:26px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:transparent;">'
            + '<input type="range" id="custTabBarOpacity" min="0" max="100" value="88" style="flex:1;">'
            + '<span id="custTabBarOpacityVal" style="font-size:10px;color:var(--fg-2);width:30px;text-align:right;">88%</span>'
          + '</div>'
        + '</div>'
        + '<div style="margin-bottom:8px;">'
          + '<label style="font-size:11px;color:var(--fg-2);">侧边栏</label>'
          + '<div style="display:flex;gap:6px;align-items:center;">'
            + '<input type="color" id="custSidebarBg" value="#1a1a2e" style="width:32px;height:26px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:transparent;">'
            + '<input type="range" id="custSidebarOpacity" min="0" max="100" value="85" style="flex:1;">'
            + '<span id="custSidebarOpacityVal" style="font-size:10px;color:var(--fg-2);width:30px;text-align:right;">85%</span>'
          + '</div>'
        + '</div>'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">布局微调</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
          + '<div>'
            + '<label style="font-size:10px;color:var(--fg-2);">标签圆角</label>'
            + '<input type="range" id="custTabRadius" min="0" max="20" value="8" style="width:100%;">'
          + '</div>'
          + '<div>'
            + '<label style="font-size:10px;color:var(--fg-2);">标签间距</label>'
            + '<input type="range" id="custTabSpacing" min="0" max="10" value="3" style="width:100%;">'
          + '</div>'
          + '<div>'
            + '<label style="font-size:10px;color:var(--fg-2);">标签字号</label>'
            + '<input type="range" id="custTabFontSize" min="10" max="16" value="12" style="width:100%;">'
          + '</div>'
          + '<div>'
            + '<label style="font-size:10px;color:var(--fg-2);">工具栏高度</label>'
            + '<input type="range" id="custToolbarHeight" min="32" max="56" value="42" style="width:100%;">'
          + '</div>'
        + '</div>'
      + '</div>'

      + '<div style="margin-bottom:20px;">'
        + '<div style="font-size:12px;font-weight:600;color:var(--fg-1);margin-bottom:8px;">自定义 CSS</div>'
        + '<textarea id="custCustomCSS" placeholder="/* 输入自定义 CSS */" style="width:100%;height:120px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:11px;font-family:monospace;resize:vertical;box-sizing:border-box;"></textarea>'
      + '</div>'

      + '<div style="display:flex;gap:8px;">'
        + '<button id="custApplyBtn" style="flex:1;padding:8px;border-radius:8px;border:none;background:var(--accent,#4A90D9);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">应用</button>'
        + '<button id="custResetBtn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-2);font-size:12px;cursor:pointer;">重置</button>'
      + '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);

    var presetsContainer = document.getElementById('custPresets');
    var presetKeys = Object.keys(PRESETS);
    for (var i = 0; i < presetKeys.length; i++) {
      (function(key) {
        var p = PRESETS[key];
        var btn = document.createElement('button');
        btn.style.cssText = 'padding:8px 10px;border-radius:8px;border:2px solid transparent;background:' + p.accent + '22;color:var(--fg-1);font-size:11px;font-weight:500;cursor:pointer;text-align:left;transition:all .15s;';
        btn.innerHTML = '<div style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:' + p.accent + ';display:inline-block;"></span>' + p.name + '</div>';
        btn.addEventListener('click', function() { applyPreset(key); });
        btn.addEventListener('mouseenter', function() { btn.style.borderColor = p.accent; });
        btn.addEventListener('mouseleave', function() { btn.style.borderColor = 'transparent'; });
        presetsContainer.appendChild(btn);
      })(presetKeys[i]);
    }

    document.getElementById('custCloseBtn').addEventListener('click', function() {
      panel.style.right = '-420px';
    });

    document.getElementById('custApplyBtn').addEventListener('click', function() {
      var config = readConfigFromUI();
      applyConfig(config);
      saveConfig(config);
    });

    document.getElementById('custResetBtn').addEventListener('click', function() {
      if (styleEl) { styleEl.textContent = ''; }
      currentConfig = null;
      saveConfig(null);
    });

    var opacitySliders = ['Toolbar', 'TabBar', 'Sidebar'];
    for (var s = 0; s < opacitySliders.length; s++) {
      (function(name) {
        var slider = document.getElementById('cust' + name + 'Opacity');
        var valSpan = document.getElementById('cust' + name + 'OpacityVal');
        if (slider && valSpan) {
          slider.addEventListener('input', function() {
            valSpan.textContent = slider.value + '%';
          });
        }
      })(opacitySliders[s]);
    }
  }

  function applyPreset(key) {
    var preset = PRESETS[key];
    if (!preset) return;

    var config = {};
    var keys = Object.keys(preset);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== 'name' && keys[i] !== 'nameEn') {
        config[keys[i]] = preset[keys[i]];
      }
    }

    applyConfig(config);
    saveConfig(config);
    populateUI(config);
  }

  function readConfigFromUI() {
    return {
      bgType: document.getElementById('custBgType').value,
      bgValue: document.getElementById('custBgValue').value || document.getElementById('custBgColor').value,
      accent: document.getElementById('custAccent').value,
      accentRgb: hexToRgbString(document.getElementById('custAccent').value),
      toolbarBg: document.getElementById('custToolbarBg').value,
      toolbarOpacity: parseInt(document.getElementById('custToolbarOpacity').value) / 100,
      tabBarBg: document.getElementById('custTabBarBg').value,
      tabBarOpacity: parseInt(document.getElementById('custTabBarOpacity').value) / 100,
      sidebarBg: document.getElementById('custSidebarBg').value,
      sidebarOpacity: parseInt(document.getElementById('custSidebarOpacity').value) / 100,
      tabRadius: parseInt(document.getElementById('custTabRadius').value),
      tabSpacing: parseInt(document.getElementById('custTabSpacing').value),
      tabFontSize: parseInt(document.getElementById('custTabFontSize').value),
      toolbarHeight: parseInt(document.getElementById('custToolbarHeight').value),
      customCSS: document.getElementById('custCustomCSS').value
    };
  }

  function hexToRgbString(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  function populateUI(config) {
    if (!config) return;
    var bgType = document.getElementById('custBgType');
    var bgValue = document.getElementById('custBgValue');
    var bgColor = document.getElementById('custBgColor');
    var accent = document.getElementById('custAccent');
    var toolbarBg = document.getElementById('custToolbarBg');
    var toolbarOpacity = document.getElementById('custToolbarOpacity');
    var toolbarOpacityVal = document.getElementById('custToolbarOpacityVal');
    var tabBarBg = document.getElementById('custTabBarBg');
    var tabBarOpacity = document.getElementById('custTabBarOpacity');
    var tabBarOpacityVal = document.getElementById('custTabBarOpacityVal');
    var sidebarBg = document.getElementById('custSidebarBg');
    var sidebarOpacity = document.getElementById('custSidebarOpacity');
    var sidebarOpacityVal = document.getElementById('custSidebarOpacityVal');
    var tabRadius = document.getElementById('custTabRadius');
    var tabSpacing = document.getElementById('custTabSpacing');
    var tabFontSize = document.getElementById('custTabFontSize');
    var toolbarHeight = document.getElementById('custToolbarHeight');
    var customCSS = document.getElementById('custCustomCSS');

    if (bgType) bgType.value = config.bgType || 'none';
    if (bgValue) bgValue.value = (config.bgType === 'gradient' || config.bgType === 'image') ? (config.bgValue || '') : '';
    if (bgColor && config.bgType === 'solid') bgColor.value = config.bgValue || '#1a1a2e';
    if (accent) accent.value = config.accent || '#4A90D9';
    if (toolbarBg) toolbarBg.value = config.toolbarBg || '#1a1a2e';
    if (toolbarOpacity) toolbarOpacity.value = Math.round((config.toolbarOpacity || 0.92) * 100);
    if (toolbarOpacityVal) toolbarOpacityVal.textContent = Math.round((config.toolbarOpacity || 0.92) * 100) + '%';
    if (tabBarBg) tabBarBg.value = config.tabBarBg || '#1a1a2e';
    if (tabBarOpacity) tabBarOpacity.value = Math.round((config.tabBarOpacity || 0.88) * 100);
    if (tabBarOpacityVal) tabBarOpacityVal.textContent = Math.round((config.tabBarOpacity || 0.88) * 100) + '%';
    if (sidebarBg) sidebarBg.value = config.sidebarBg || '#1a1a2e';
    if (sidebarOpacity) sidebarOpacity.value = Math.round((config.sidebarOpacity || 0.85) * 100);
    if (sidebarOpacityVal) sidebarOpacityVal.textContent = Math.round((config.sidebarOpacity || 0.85) * 100) + '%';
    if (tabRadius) tabRadius.value = config.tabRadius || 8;
    if (tabSpacing) tabSpacing.value = config.tabSpacing || 3;
    if (tabFontSize) tabFontSize.value = config.tabFontSize || 12;
    if (toolbarHeight) toolbarHeight.value = config.toolbarHeight || 42;
    if (customCSS) customCSS.value = config.customCSS || '';
  }

  function openCustomizer() {
    createCustomizerPanel();
    var panel = document.getElementById('driftCustomizerPanel');
    panel.style.right = '0';
    if (currentConfig) populateUI(currentConfig);
  }

  function closeCustomizer() {
    var panel = document.getElementById('driftCustomizerPanel');
    if (panel) panel.style.right = '-420px';
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.customizer = {
    open: openCustomizer,
    close: closeCustomizer,
    applyConfig: applyConfig,
    getConfig: function() { return currentConfig; }
  };

  loadConfig();

  console.log('[Plugin:Customizer] 个性化浏览器插件已加载');
})();
