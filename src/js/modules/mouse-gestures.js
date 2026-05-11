// ==================== 鼠标手势模块 ====================
// 鼠标右键划动执行操作（关闭标签、后退等）
(function() {
  'use strict';

  const { config, saveConfig } = window.FBrowser.config;

  if (config.mouseGestures === undefined) {
    config.mouseGestures = true;
    saveConfig();
  }

  let enabled = config.mouseGestures;
  let isDrawing = false;
  let canvas = null;
  let ctx = null;
  let startX = 0, startY = 0;
  let points = [];
  let gesturePath = '';

  // 手势映射
  const GESTURE_MAP = {
    'L': 'go-back',       // 左
    'R': 'go-forward',    // 右
    'U': 'scroll-top',    // 上
    'D': 'scroll-bottom', // 下
    'DR': 'new-tab',      // 下右
    'LD': 'close-tab',    // 左下
    'RL': 'reload',       // 右左
    'UD': 'scroll-down',  // 上下
    'DU': 'scroll-up',    // 下上
    'UL': 'prev-tab',     // 上左
    'UR': 'next-tab',     // 上右
  };

  function isEnabled() {
    return enabled;
  }

  function setEnabled(val) {
    enabled = val;
    config.mouseGestures = val;
    saveConfig();
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function init() {
    if (!enabled) return;

    // 创建画布
    canvas = document.createElement('canvas');
    canvas.className = 'gesture-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;pointer-events:none;display:none;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });

    // 右键手势
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    // 阻止右键菜单在手势模式下
    document.addEventListener('contextmenu', onContextMenu);
  }

  function onContextMenu(e) {
    if (isDrawing) {
      e.preventDefault();
    }
  }

  function onMouseDown(e) {
    if (!enabled) return;

    // 仅在 webview 区域外响应，或者用右键触发
    if (e.button === 2) {
      // 右键 - 开始手势
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      points = [{ x: e.clientX, y: e.clientY }];
      gesturePath = '';
      canvas.style.display = 'block';

      // 阻止默认右键菜单
      e.preventDefault();
    }
  }

  function onMouseMove(e) {
    if (!isDrawing) return;

    const x = e.clientX;
    const y = e.clientY;
    points.push({ x, y });

    // 绘制轨迹
    if (points.length >= 2) {
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#4A90D9';
      ctx.shadowBlur = 6;

      const prev = points[points.length - 2];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // 识别方向
    const lastPoint = points[points.length - 2];
    if (!lastPoint) return;
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return; // 最小距离阈值

    let direction = '';
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'R' : 'L';
    } else {
      direction = dy > 0 ? 'D' : 'U';
    }

    // 避免连续相同方向
    if (gesturePath.length === 0 || gesturePath[gesturePath.length - 1] !== direction) {
      gesturePath += direction;
    }
  }

  function onMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';

    // 执行手势
    if (gesturePath.length > 0) {
      executeGesture(gesturePath);
    }
  }

  function executeGesture(path) {
    // 尝试完整匹配，再尝试最后两个方向
    let action = GESTURE_MAP[path];
    if (!action && path.length >= 2) {
      action = GESTURE_MAP[path.slice(-2)];
    }
    if (!action && path.length >= 1) {
      action = GESTURE_MAP[path.slice(-1)];
    }

    if (!action) return;

    const wv = window.FBrowser.tabs.getActiveWebview();
    const tabs = window.FBrowser.tabs;

    switch (action) {
      case 'go-back':
        if (wv) wv.goBack();
        break;
      case 'go-forward':
        if (wv) wv.goForward();
        break;
      case 'scroll-top':
        if (wv) wv.executeJavaScript('window.scrollTo(0, 0)').catch(() => {});
        break;
      case 'scroll-bottom':
        if (wv) wv.executeJavaScript('window.scrollTo(0, document.body.scrollHeight)').catch(() => {});
        break;
      case 'new-tab':
        tabs.createTab();
        break;
      case 'close-tab':
        tabs.closeTab(tabs.activeTabId);
        break;
      case 'reload':
        if (wv) wv.reload();
        break;
      case 'prev-tab': {
        const allTabs = tabs.tabs;
        const idx = allTabs.findIndex(t => t.id === tabs.activeTabId);
        const prevIdx = (idx - 1 + allTabs.length) % allTabs.length;
        tabs.switchTab(allTabs[prevIdx].id);
        break;
      }
      case 'next-tab': {
        const allTabs = tabs.tabs;
        const idx = allTabs.findIndex(t => t.id === tabs.activeTabId);
        const nextIdx = (idx + 1) % allTabs.length;
        tabs.switchTab(allTabs[nextIdx].id);
        break;
      }
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.mouseGestures = { isEnabled, setEnabled, toggle, init };
})();
