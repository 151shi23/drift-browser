// ==================== 缩放模块 ====================
(function() {
  'use strict';

  const LEVEL_STEP = 0.1;
  const MIN_LEVEL = -5;  // 50%
  const MAX_LEVEL = 5;   // 150%

  // 按 tabId 存储缩放级别
  const levels = {};

  function getActiveTabId() {
    return window.FBrowser.tabs.activeTabId ?? null;
  }

  function getLevel(tabId) {
    const id = tabId || getActiveTabId();
    return levels[id] || 0;
  }

  function setLevel(tabId, level) {
    const id = tabId || getActiveTabId();
    if (id == null) return;

    // 边界限制
    level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    levels[id] = level;

    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    // webview 的 setZoomFactor: factor = 1 + level * STEP
    const factor = 1 + level * LEVEL_STEP;
    wv.setZoomFactor(factor);

    try { window.FBrowser.findBar.updateZoomIndicator(level); } catch(e) {}
  }

  function zoomIn(tabId) {
    setLevel(tabId, getLevel(tabId) + 1);
  }

  function zoomOut(tabId) {
    setLevel(tabId, getLevel(tabId) - 1);
  }

  function zoomReset(tabId) {
    setLevel(tabId, 0);
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.zoom = {
    getLevel,
    setLevel,
    zoomIn,
    zoomOut,
    zoomReset,
  };
})();
