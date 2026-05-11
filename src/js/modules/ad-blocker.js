// ==================== 广告拦截模块 ====================
// 内置简单规则拦截广告
(function() {
  'use strict';

  const { config, saveConfig } = window.FBrowser.config;

  // 初始化配置
  if (config.adBlocker === undefined) {
    config.adBlocker = true;
    saveConfig();
  }

  // 常见广告域名列表
  const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'facebook.net',
    'fbcdn.net', 'ads.yahoo.com', 'amazon-adsystem.com',
    'adnxs.com', 'adsrvr.org', 'casalemedia.com', 'criteo.com',
    'demdex.net', 'moatads.com', 'outbrain.com', 'rubiconproject.com',
    'scorecardresearch.com', 'serving-sys.com', 'sharethis.com',
    'taboola.com', 'tapad.com', 'quantserve.com', 'pubmatic.com',
    'openx.net', 'lijit.com', 'adcolony.com', 'applovin.com',
    'unity3d.com', 'ironsrc.com', 'chartboost.com',
    'pagead2.googlesyndication.com', 'tpc.googlesyndication.com',
    'ad.360.cn', 'ads.unity3d.com', 'stat.m.jd.com',
    'hm.baidu.com', 'cnzz.com', 'umeng.com',
  ];

  // 广告关键词匹配
  const AD_PATTERNS = [
    /\/ad[sx]?\//i, /\/advert/i, /\/banner/i, /\/popup/i,
    /\/tracking/i, /\/analytics/i, /\/pixel\./i, /\/beacon/i,
    /\/collect\?/i, /\/utm_/i, /\/click\?/i, /\/impression/i,
  ];

  let enabled = config.adBlocker;
  let blockedCount = 0;

  function isEnabled() {
    return enabled;
  }

  function setEnabled(val) {
    enabled = val;
    config.adBlocker = val;
    saveConfig();
  }

  function getBlockedCount() {
    return blockedCount;
  }

  function shouldBlock(url) {
    if (!enabled) return false;

    try {
      const u = new URL(url);
      const hostname = u.hostname.toLowerCase();

      // 检查域名匹配
      for (const domain of AD_DOMAINS) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          blockedCount++;
          return true;
        }
      }

      // 检查路径模式匹配
      const path = u.pathname + u.search;
      for (const pattern of AD_PATTERNS) {
        if (pattern.test(path)) {
          blockedCount++;
          return true;
        }
      }
    } catch(e) {}

    return false;
  }

  // 请求主进程设置 webRequest 拦截
  function initAdBlocker() {
    if (enabled) {
      window.electronAPI.adBlockerEnable?.();
    }
  }

  function toggle() {
    setEnabled(!enabled);
    if (enabled) {
      window.electronAPI.adBlockerEnable?.();
    } else {
      window.electronAPI.adBlockerDisable?.();
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.adBlocker = {
    isEnabled, setEnabled, getBlockedCount, shouldBlock,
    initAdBlocker, toggle, AD_DOMAINS, AD_PATTERNS,
  };
})();
