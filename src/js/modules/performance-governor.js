(function() {
  const PRESSURE_LEVELS = {
    IDLE: 'idle',
    LIGHT: 'light',
    MODERATE: 'moderate',
    HEAVY: 'heavy',
    CRITICAL: 'critical'
  };

  const FREEZE_ACTIONS = {
    NONE: 'none',
    THROTTLE: 'throttle',
    PAUSE_MEDIA: 'pause-media',
    SUSPEND: 'suspend',
    DISCARD: 'discard',
    DESTROY: 'destroy'
  };

  let enabled = false;
  let currentPressureLevel = PRESSURE_LEVELS.IDLE;
  let lastResourceData = null;
  let governorTimer = null;
  let lastActions = [];
  let statsHistory = [];

  function calculatePressureLevel(systemData, browserData) {
    const sysPressure = systemData.memoryPressure;
    const browserMB = browserData.mainProcessMemoryMB;
    const rendererCount = browserData.rendererCount || 0;

    let level = PRESSURE_LEVELS.IDLE;

    if (sysPressure > 0.9 || browserMB > 1000) {
      level = PRESSURE_LEVELS.CRITICAL;
    } else if (sysPressure > 0.8 || browserMB > 800) {
      level = PRESSURE_LEVELS.HEAVY;
    } else if (sysPressure > 0.65 || browserMB > 600 || rendererCount > 12) {
      level = PRESSURE_LEVELS.MODERATE;
    } else if (sysPressure > 0.5 || browserMB > 400 || rendererCount > 6) {
      level = PRESSURE_LEVELS.LIGHT;
    }

    return level;
  }

  function decideTabActions(pressureLevel, tabs, behaviorData) {
    const actions = [];
    const activeTabId = window.FBrowser?.tabs?.activeTabId;

    const predictedNext = window.BehaviorLearner
      ? window.BehaviorLearner.predictNextTabs()
      : [];

    for (const tab of tabs) {
      if (!tab) continue;

      const tabId = tab.id;
      if (tabId === activeTabId) {
        actions.push({ tabId, action: FREEZE_ACTIONS.NONE, freezeLevel: 0, priority: 1 });
        continue;
      }

      const behavior = behaviorData?.[tabId];
      const priority = behavior?.priority || 0.5;
      const isMedia = behavior?.isMediaTab || false;
      const idleTime = Date.now() - (tab.lastActiveTime || tab.lastSwitchTime || Date.now());
      const isPredicted = predictedNext.includes(tabId);
      const currentFreezeLevel = tab.freezeLevel || 0;

      if (isPredicted && currentFreezeLevel >= 3) {
        actions.push({ tabId, action: FREEZE_ACTIONS.PAUSE_MEDIA, freezeLevel: 2, priority, reason: 'predicted-next' });
        continue;
      }

      let action = FREEZE_ACTIONS.NONE;
      let freezeLevel = 0;

      switch (pressureLevel) {
        case PRESSURE_LEVELS.IDLE:
          if (idleTime > 600000) { action = FREEZE_ACTIONS.THROTTLE; freezeLevel = 1; }
          break;

        case PRESSURE_LEVELS.LIGHT:
          if (idleTime > 300000) {
            action = isMedia ? FREEZE_ACTIONS.THROTTLE : FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = isMedia ? 1 : 2;
          } else if (idleTime > 60000) {
            action = FREEZE_ACTIONS.THROTTLE;
            freezeLevel = 1;
          }
          break;

        case PRESSURE_LEVELS.MODERATE:
          if (priority > 0.7 && isMedia) {
            action = FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = 2;
          } else if (idleTime > 120000) {
            action = FREEZE_ACTIONS.SUSPEND;
            freezeLevel = 3;
          } else if (idleTime > 30000) {
            action = FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = 2;
          } else {
            action = FREEZE_ACTIONS.THROTTLE;
            freezeLevel = 1;
          }
          break;

        case PRESSURE_LEVELS.HEAVY:
          if (priority > 0.9 && isMedia) {
            action = FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = 2;
          } else if (idleTime > 60000) {
            action = FREEZE_ACTIONS.DISCARD;
            freezeLevel = 4;
          } else if (idleTime > 15000) {
            action = FREEZE_ACTIONS.SUSPEND;
            freezeLevel = 3;
          } else {
            action = FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = 2;
          }
          break;

        case PRESSURE_LEVELS.CRITICAL:
          if (priority > 0.95) {
            action = FREEZE_ACTIONS.PAUSE_MEDIA;
            freezeLevel = 2;
          } else if (idleTime > 30000) {
            action = FREEZE_ACTIONS.DESTROY;
            freezeLevel = 5;
          } else {
            action = FREEZE_ACTIONS.DISCARD;
            freezeLevel = 4;
          }
          break;
      }

      if (currentFreezeLevel > freezeLevel) {
        if (currentFreezeLevel >= 4 && freezeLevel <= 1) {
          action = FREEZE_ACTIONS.PAUSE_MEDIA;
          freezeLevel = 2;
        } else {
          action = FREEZE_ACTIONS.NONE;
          freezeLevel = currentFreezeLevel;
        }
      }

      actions.push({
        tabId,
        action,
        freezeLevel,
        priority,
        reason: `pressure=${pressureLevel}, idle=${Math.round(idleTime / 1000)}s, media=${isMedia}`
      });
    }

    return actions;
  }

  function getNetworkBlockLevel(pressureLevel) {
    switch (pressureLevel) {
      case PRESSURE_LEVELS.IDLE: return 'off';
      case PRESSURE_LEVELS.LIGHT: return 'basic';
      case PRESSURE_LEVELS.MODERATE: return 'basic';
      case PRESSURE_LEVELS.HEAVY: return 'enhanced';
      case PRESSURE_LEVELS.CRITICAL: return 'aggressive';
      default: return 'off';
    }
  }

  function getProcessLimit(pressureLevel) {
    switch (pressureLevel) {
      case PRESSURE_LEVELS.IDLE: return 16;
      case PRESSURE_LEVELS.LIGHT: return 8;
      case PRESSURE_LEVELS.MODERATE: return 6;
      case PRESSURE_LEVELS.HEAVY: return 4;
      case PRESSURE_LEVELS.CRITICAL: return 2;
      default: return 8;
    }
  }

  function getCacheAggressiveness(pressureLevel) {
    switch (pressureLevel) {
      case PRESSURE_LEVELS.IDLE: return 'none';
      case PRESSURE_LEVELS.LIGHT: return 'light';
      case PRESSURE_LEVELS.MODERATE: return 'moderate';
      case PRESSURE_LEVELS.HEAVY: return 'aggressive';
      case PRESSURE_LEVELS.CRITICAL: return 'aggressive';
      default: return 'none';
    }
  }

  async function executeActions(actions) {
    if (!window.FBrowser?.tabs) return;

    const tabsModule = window.FBrowser.tabs;
    const tabArr = tabsModule.tabs || [];
    const tabMap = {};
    tabArr.forEach(t => { if (t && t.id) tabMap[t.id] = t; });

    for (const action of actions) {
      const tab = tabMap[action.tabId];
      if (!tab) continue;

      const currentLevel = tab.freezeLevel || 0;
      const targetLevel = action.freezeLevel;

      if (targetLevel > currentLevel) {
        if (typeof tabsModule.freezeTabLevel === 'function') {
          tabsModule.freezeTabLevel(tab, targetLevel);
        }
      } else if (targetLevel < currentLevel) {
        if (typeof tabsModule.unfreezeTabLevel === 'function') {
          tabsModule.unfreezeTabLevel(tab);
          if (targetLevel > 0 && typeof tabsModule.freezeTabLevel === 'function') {
            tabsModule.freezeTabLevel(tab, targetLevel);
          }
        }
      }
    }
  }

  async function runGovernorCycle() {
    if (!enabled) return;

    try {
      const resourceData = await window.electronAPI.apgGetResourceData();
      if (!resourceData) return;

      lastResourceData = resourceData;
      currentPressureLevel = calculatePressureLevel(resourceData.system, resourceData.browser);

      statsHistory.push({
        timestamp: Date.now(),
        pressureLevel: currentPressureLevel,
        memoryMB: resourceData.browser.mainProcessMemoryMB,
        rendererCount: resourceData.browser.rendererCount
      });
      if (statsHistory.length > 60) statsHistory.shift();

      const behaviorData = window.BehaviorLearner
        ? window.BehaviorLearner.getAllBehaviors()
        : {};

      const tabList = window.FBrowser?.tabs?.tabs || [];
      lastActions = decideTabActions(currentPressureLevel, tabList, behaviorData);

      await executeActions(lastActions);

      const blockLevel = getNetworkBlockLevel(currentPressureLevel);
      await window.electronAPI.networkSetBlockLevel(blockLevel);

      const processLimit = getProcessLimit(currentPressureLevel);
      await window.electronAPI.processAdjustLimit(currentPressureLevel);

      const cacheAgg = getCacheAggressiveness(currentPressureLevel);
      if (cacheAgg === 'aggressive') {
        await window.electronAPI.clearCache({ keepCookies: true });
      } else if (cacheAgg === 'moderate') {
        const cacheSize = await window.electronAPI.getCacheSize();
        if (cacheSize > 512) {
          await window.electronAPI.clearCache({ keepCookies: true });
        }
      }

      updateStatusUI(resourceData);

    } catch (e) {
      console.error('[APG] 调控循环错误:', e);
    }
  }

  function updateStatusUI(resourceData) {
    const pressureDot = document.getElementById('apgPressureDot');
    const pressureLabel = document.getElementById('apgPressureLabel');
    const memEl = document.getElementById('apgMem');
    const tabsEl = document.getElementById('apgTabs');
    const frozenEl = document.getElementById('apgFrozen');

    if (pressureDot) {
      const colors = {
        idle: '#4caf50',
        light: '#ff9800',
        moderate: '#ff5722',
        heavy: '#f44336',
        critical: '#9c27b0'
      };
      pressureDot.style.backgroundColor = colors[currentPressureLevel] || '#4caf50';
    }

    if (pressureLabel) {
      const labels = {
        idle: '空闲',
        light: '轻度',
        moderate: '中度',
        heavy: '重度',
        critical: '紧急'
      };
      pressureLabel.textContent = labels[currentPressureLevel] || '空闲';
    }

    if (memEl && resourceData) {
      memEl.textContent = resourceData.browser.mainProcessMemoryMB;
    }

    if (tabsEl) {
      const tabList = window.FBrowser?.tabs?.tabs || [];
      tabsEl.textContent = tabList.length;
    }

    if (frozenEl) {
      const tabList = window.FBrowser?.tabs?.tabs || [];
      const frozenCount = tabList.filter(t => t && (t.freezeLevel || 0) > 0).length;
      frozenEl.textContent = frozenCount;
    }
  }

  function start() {
    if (enabled) return;
    enabled = true;
    governorTimer = setInterval(runGovernorCycle, 5000);
    runGovernorCycle();
    console.log('[APG] 自适应性能调控引擎已启动');
  }

  function stop() {
    enabled = false;
    if (governorTimer) {
      clearInterval(governorTimer);
      governorTimer = null;
    }
    console.log('[APG] 自适应性能调控引擎已停止');
  }

  function isEnabled() {
    return enabled;
  }

  function getPressureLevel() {
    return currentPressureLevel;
  }

  function getLastActions() {
    return lastActions;
  }

  function getStatsHistory() {
    return statsHistory;
  }

  function getLastResourceData() {
    return lastResourceData;
  }

  window.PerformanceGovernor = {
    start,
    stop,
    isEnabled,
    getPressureLevel,
    getLastActions,
    getStatsHistory,
    getLastResourceData,
    calculatePressureLevel,
    decideTabActions,
    PRESSURE_LEVELS,
    FREEZE_ACTIONS
  };
})();
