// ==================== 配置管理 ====================
(function() {
  'use strict';

  let config = {};
  try {
    config = JSON.parse(localStorage.getItem('f-config') || '{}');
    if (typeof config !== 'object' || config === null) config = {};
  } catch (e) {
    config = {};
  }
  config.engine = config.engine || 'baidu';
  config.theme = config.theme || 'dark';
  config.downloadPath = config.downloadPath || '';
  config.showBookmarkBar = config.showBookmarkBar !== undefined ? config.showBookmarkBar : true;
  config.homeStyle = config.homeStyle || 'classic';
  config.welcomeShown = config.welcomeShown || false;
  config.welcomeTutorialDone = config.welcomeTutorialDone || false;

  function getConfig() { return config; }

  function saveConfig() {
    localStorage.setItem('f-config', JSON.stringify(config));
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
  }

  applyTheme(config.theme);

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.config = { config, getConfig, saveConfig, applyTheme };
})();
