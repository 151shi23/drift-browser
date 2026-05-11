// ==================== 搜索引擎 ====================
(function() {
  'use strict';

  const engineMap = {
    baidu: { name: '百度', url: q => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
    google: { name: 'Google', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
    bing: { name: 'Bing', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  };

  const { config, saveConfig } = window.FBrowser.config;

  const homeEngineEl = document.getElementById('homeEngine');
  const settingEngineEl = document.getElementById('settingEngine');

  function updateEngineLabel() {
    if (homeEngineEl) homeEngineEl.textContent = engineMap[config.engine].name;
  }

  function resolveUrl(input) {
    if (!input) return null;
    if (/^f:\/\/[a-z]/i.test(input) || /^drift:\/\/[a-z]/i.test(input)) return input;
    if (/^https?:\/\//i.test(input)) return input;
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}/i.test(input)) return 'https://' + input;
    return engineMap[config.engine].url(input);
  }

  if (homeEngineEl) {
    homeEngineEl.addEventListener('click', () => {
      const keys = Object.keys(engineMap);
      const idx = keys.indexOf(config.engine);
      config.engine = keys[(idx + 1) % keys.length];
      if (settingEngineEl) settingEngineEl.value = config.engine;
      updateEngineLabel();
      saveConfig();
    });
  }

  if (settingEngineEl) {
    settingEngineEl.value = config.engine;
    settingEngineEl.addEventListener('change', () => {
      config.engine = settingEngineEl.value;
      updateEngineLabel();
      saveConfig();
    });
  }

  updateEngineLabel();

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.search = { engineMap, updateEngineLabel, resolveUrl };
})();
