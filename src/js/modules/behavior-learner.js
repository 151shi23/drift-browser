(function() {
  const VIDEO_SITES = ['douyin.com', 'bilibili.com', 'b23.tv', 'youtube.com', 'tiktok.com', 'ixigua.com', 'kuaishou.com'];
  const SOCIAL_SITES = ['weibo.com', 'twitter.com', 'x.com', 'zhihu.com', 'reddit.com'];

  let tabBehaviors = {};
  let switchHistory = [];
  const MAX_HISTORY = 200;

  function recordTabSwitch(tabId, url) {
    const now = Date.now();

    if (switchHistory.length > 0) {
      const prev = switchHistory[switchHistory.length - 1];
      if (prev.tabId !== tabId) {
        recordTabLeave(prev.tabId);
      }
    }

    switchHistory.push({ tabId: tabId, time: now });
    if (switchHistory.length > MAX_HISTORY) {
      switchHistory = switchHistory.slice(-MAX_HISTORY);
    }

    if (!tabBehaviors[tabId]) {
      tabBehaviors[tabId] = {
        switchCount: 0,
        totalActiveTime: 0,
        lastSwitchTime: now,
        avgStayDuration: 0,
        isMediaTab: false,
        siteCategory: 'other',
        priority: 0.5,
        url: url || ''
      };
    }

    tabBehaviors[tabId].switchCount++;
    tabBehaviors[tabId].lastSwitchTime = now;
    if (url) tabBehaviors[tabId].url = url;

    tabBehaviors[tabId].siteCategory = detectSiteCategory(url);
    tabBehaviors[tabId].isMediaTab = isVideoSite(url);
  }

  function recordTabLeave(tabId) {
    if (!tabBehaviors[tabId]) return;
    const stayDuration = Date.now() - tabBehaviors[tabId].lastSwitchTime;
    if (stayDuration < 0 || stayDuration > 3600000) return;
    const b = tabBehaviors[tabId];
    b.avgStayDuration = b.avgStayDuration === 0
      ? stayDuration
      : (b.avgStayDuration * 0.7) + (stayDuration * 0.3);
    b.totalActiveTime += stayDuration;
  }

  function detectSiteCategory(url) {
    if (!url) return 'other';
    const lower = url.toLowerCase();
    if (VIDEO_SITES.some(s => lower.includes(s))) return 'video';
    if (SOCIAL_SITES.some(s => lower.includes(s))) return 'social';
    if (lower.includes('docs.google') || lower.includes('notion.so') || lower.includes('github.com')) return 'work';
    return 'other';
  }

  function isVideoSite(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return VIDEO_SITES.some(s => lower.includes(s));
  }

  function calculatePriority(tabId) {
    const b = tabBehaviors[tabId];
    if (!b) return 0.5;

    const switchScore = Math.min(1, b.switchCount / 20);
    const stayScore = Math.min(1, b.avgStayDuration / 300000);
    const recencyScore = Math.max(0, 1 - (Date.now() - b.lastSwitchTime) / 3600000);
    const mediaBonus = b.isMediaTab ? 0.3 : 0;

    b.priority = Math.min(1, switchScore * 0.3 + stayScore * 0.3 + recencyScore * 0.3 + mediaBonus);
    return b.priority;
  }

  function predictNextTabs() {
    if (switchHistory.length < 5) return [];

    const currentTabId = switchHistory[switchHistory.length - 1].tabId;
    const transitions = {};
    for (let i = 0; i < switchHistory.length - 1; i++) {
      if (switchHistory[i].tabId === currentTabId) {
        const next = switchHistory[i + 1].tabId;
        transitions[next] = (transitions[next] || 0) + 1;
      }
    }

    return Object.entries(transitions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => Number(id));
  }

  function getLongIdleTabs(thresholdMs) {
    const now = Date.now();
    return Object.entries(tabBehaviors)
      .filter(([_, b]) => (now - b.lastSwitchTime) > thresholdMs)
      .map(([id]) => Number(id));
  }

  function getFrequentSwitchIds(count) {
    const recent = switchHistory.slice(-50);
    const counts = {};
    recent.forEach(s => { counts[s.tabId] = (counts[s.tabId] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count || 5)
      .map(([id]) => Number(id));
  }

  function getTabBehavior(tabId) {
    return tabBehaviors[tabId] || null;
  }

  function getAllBehaviors() {
    Object.keys(tabBehaviors).forEach(id => calculatePriority(Number(id)));
    return tabBehaviors;
  }

  function removeTab(tabId) {
    delete tabBehaviors[tabId];
    switchHistory = switchHistory.filter(s => s.tabId !== tabId);
  }

  function setMediaTab(tabId, isMedia) {
    if (tabBehaviors[tabId]) {
      tabBehaviors[tabId].isMediaTab = isMedia;
    }
  }

  window.BehaviorLearner = {
    recordTabSwitch,
    recordTabLeave,
    calculatePriority,
    predictNextTabs,
    getLongIdleTabs,
    getFrequentSwitchIds,
    getTabBehavior,
    getAllBehaviors,
    removeTab,
    setMediaTab
  };
})();
