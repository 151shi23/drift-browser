const { session } = require('electron');

const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'facebook.net',
  'fbcdn.net', 'ads.yahoo.com', 'amazon-adsystem.com',
  'adnxs.com', 'adsrvr.org', 'criteo.com', 'outbrain.com',
  'taboola.com', 'rubiconproject.com', 'pubmatic.com',
  'ad.360.cn', 'hm.baidu.com', 'cnzz.com', 'umeng.com',
  'ads.tiktok.com', 'ads.douyin.com', 'pangolin-sdk-toutiao.com',
  'ad.qq.com', 'ad.toutiao.com', 'ad.thsi.cn', 'tanx.com',
  'mmstat.com', 'umtrack.com', 'alog.umeng.com'
];

const TRACKER_DOMAINS = [
  'hotjar.com', 'mixpanel.com', 'amplitude.com', 'segment.io',
  'branch.io', 'appsflyer.com', 'adjust.com', 'kochava.com',
  'sensorsdata.cn', 'growingio.com', 'zhugeio.com',
  'mouseflow.com', 'luckyorange.com', 'crazyegg.com',
  'fullstory.com', 'logrocket.com', 'inspectlet.com'
];

const SOCIAL_WIDGET_DOMAINS = [
  'platform.twitter.com', 'connect.facebook.net',
  'apis.google.com/js', 'widgets.pin.it', 'assets.pinterest.com/js'
];

let currentLevel = 'off';
let blockedCount = 0;
let currentFilter = null;

function setBlockLevel(level) {
  if (level === currentLevel) return;
  currentLevel = level;
  applyBlocking(level);
}

function applyBlocking(level) {
  const ses = session.defaultSession;

  if (currentFilter) {
    try {
      ses.webRequest.onBeforeRequest(currentFilter);
      currentFilter = null;
    } catch (e) {}
  }

  if (level === 'off') return;

  let blockedDomains = [...AD_DOMAINS];
  if (level === 'enhanced' || level === 'aggressive') {
    blockedDomains = blockedDomains.concat(TRACKER_DOMAINS);
  }
  if (level === 'aggressive') {
    blockedDomains = blockedDomains.concat(SOCIAL_WIDGET_DOMAINS);
  }

  const domainSet = new Set(blockedDomains);

  const filter = (details, callback) => {
    try {
      const url = new URL(details.url);
      const hostname = url.hostname.toLowerCase();

      for (const domain of domainSet) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          blockedCount++;
          callback({ cancel: true });
          return;
        }
      }
    } catch (e) {}
    callback({});
  };

  ses.webRequest.onBeforeRequest(filter);
  currentFilter = filter;
}

function getBlockedCount() {
  return blockedCount;
}

function getCurrentLevel() {
  return currentLevel;
}

module.exports = { setBlockLevel, getBlockedCount, getCurrentLevel };
