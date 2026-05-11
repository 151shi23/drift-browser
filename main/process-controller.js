const { app } = require('electron');

const VIDEO_SITES = ['douyin.com', 'bilibili.com', 'b23.tv', 'youtube.com', 'tiktok.com', 'ixigua.com', 'kuaishou.com'];
const SOCIAL_SITES = ['weibo.com', 'twitter.com', 'x.com', 'zhihu.com', 'reddit.com', 'tieba.baidu.com'];

let currentMaxProcesses = 8;

function adjustProcessLimit(pressureLevel) {
  const limits = {
    idle: 16,
    light: 8,
    moderate: 6,
    heavy: 4,
    critical: 2
  };
  const newLimit = limits[pressureLevel] || 8;
  if (newLimit !== currentMaxProcesses) {
    currentMaxProcesses = newLimit;
    console.log('[ProcessController] 渲染进程限制建议:', newLimit, '(运行时调整需重启生效)');
  }
  return newLimit;
}

function getPartitionForUrl(url, pressureLevel, tabId) {
  if (pressureLevel === 'idle' || pressureLevel === 'light') {
    return null;
  }

  try {
    const domain = new URL(url).hostname;

    if (pressureLevel === 'critical') {
      return 'persist:shared-all';
    }

    if (pressureLevel === 'heavy') {
      if (VIDEO_SITES.some(s => domain.includes(s))) {
        return 'persist:shared-video';
      }
      return 'persist:shared-other';
    }

    if (VIDEO_SITES.some(s => domain.includes(s))) {
      return 'persist:shared-video';
    }
    if (SOCIAL_SITES.some(s => domain.includes(s))) {
      return 'persist:shared-social';
    }
    return null;
  } catch (e) {
    return null;
  }
}

function setProcessPriority(pid, priority) {
  if (!pid) return;
  const { exec } = require('child_process');
  const priorities = {
    low: 'BelowNormal',
    normal: 'Normal',
    high: 'AboveNormal'
  };
  if (priorities[priority]) {
    exec(`wmic process where ProcessId=${pid} CALL setpriority "${priorities[priority]}"`, () => {});
  }
}

function getCurrentMaxProcesses() {
  return currentMaxProcesses;
}

module.exports = {
  adjustProcessLimit,
  getPartitionForUrl,
  setProcessPriority,
  getCurrentMaxProcesses,
  VIDEO_SITES,
  SOCIAL_SITES
};
