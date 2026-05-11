// ==================== 任务管理器标签页 ====================
(function() {
  'use strict';

  let refreshInterval = null;

  // HTML 转义函数
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadTaskManagerData() {
    try {
      const data = await window.electronAPI.getTaskManagerData();
      if (!data) return;

      document.getElementById('tmTabCount').textContent = data.tabs ? data.tabs.length : 0;
      document.getElementById('tmMemory').textContent = data.memory || '-- MB';
      document.getElementById('tmCpu').textContent = data.cpu || '--%';

      const list = document.getElementById('tmList');
      list.innerHTML = '';

      if (!data.tabs || data.tabs.length === 0) {
        list.innerHTML = '<div class="tm-loading">暂无标签页</div>';
        return;
      }

      data.tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tm-item' + (tab.frozen ? ' frozen' : '');
        
        // 使用转义函数防止 XSS
        const safeTitle = escapeHtml(tab.title || '新标签页');
        const safeUrl = escapeHtml(tab.url || 'about:blank');
        const safeIcon = escapeHtml(tab.icon || '');
        
        el.innerHTML = `
          <img class="tm-item-icon" src="${safeIcon}" alt="">
          <div class="tm-item-info" data-tab-id="${tab.id}">
            <div class="tm-item-title">${tab.frozen ? '❄️ ' : ''}${safeTitle}</div>
            <div class="tm-item-url">${safeUrl}</div>
          </div>
          <span class="tm-item-memory ${tab.frozen ? 'frozen' : ''}">${tab.memory || '-- MB'}</span>
          <button class="tm-item-close" data-tab-id="${tab.id}" title="关闭">×</button>
        `;

        el.querySelector('.tm-item-info').addEventListener('click', () => {
          window.electronAPI.switchToTab(tab.id);
        });

        el.querySelector('.tm-item-close').addEventListener('click', (e) => {
          e.stopPropagation();
          window.electronAPI.closeTabById(tab.id);
          setTimeout(loadTaskManagerData, 300);
        });

        list.appendChild(el);
      });
    } catch (e) {
      console.error('[TaskManager] 加载失败:', e);
    }
  }

  function init() {
    document.getElementById('tmRefresh')?.addEventListener('click', loadTaskManagerData);
    
    document.getElementById('tmCloseAll')?.addEventListener('click', () => {
      if (confirm('确定要关闭所有标签页吗？')) {
        window.electronAPI.closeAllTabs();
        setTimeout(loadTaskManagerData, 300);
      }
    });

    loadTaskManagerData();
    refreshInterval = setInterval(loadTaskManagerData, 2000);
  }

  function destroy() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.taskManager = { init, destroy, load: loadTaskManagerData };
})();

// ==================== 性能监视器标签页 ====================
(function() {
  'use strict';

  let refreshInterval = null;
  let cpuHistory = [];
  let memoryHistory = [];
  const MAX_HISTORY = 30;

  async function loadPerformanceData() {
    try {
      const data = await window.electronAPI.getPerformanceData();
      if (!data) return;

      // 更新数值
      document.getElementById('perfCpu').textContent = data.cpu || '--%';
      document.getElementById('perfMemory').textContent = data.memory || '-- MB';
      document.getElementById('perfTabs').textContent = data.tabs || 0;
      document.getElementById('perfActiveTabs').textContent = data.activeTabs || 0;
      document.getElementById('perfBackgroundTabs').textContent = data.backgroundTabs || 0;
      
      // 冻结标签页
      const frozenTabsEl = document.getElementById('perfFrozenTabs');
      if (frozenTabsEl) {
        frozenTabsEl.textContent = data.frozenTabs || 0;
        frozenTabsEl.parentElement.style.display = data.frozenTabs > 0 ? 'flex' : 'none';
      }

      // 系统信息
      if (data.system) {
        document.getElementById('perfPlatform').textContent = data.system.platform || '--';
        document.getElementById('perfElectron').textContent = data.system.electron || '--';
        document.getElementById('perfChrome').textContent = data.system.chrome || '--';
        document.getElementById('perfNode').textContent = data.system.node || '--';
      }

      // 更新图表
      const cpuVal = parseInt(data.cpu) || 0;
      const memVal = parseInt(data.memory) || 0;

      cpuHistory.push(cpuVal);
      memoryHistory.push(memVal);

      if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
      if (memoryHistory.length > MAX_HISTORY) memoryHistory.shift();

      renderChart('perfCpuChart', cpuHistory, 100);
      renderChart('perfMemoryChart', memoryHistory, Math.max(...memoryHistory, 100));
    } catch (e) {
      console.error('[Performance] 加载失败:', e);
    }
  }

  function renderChart(containerId, data, maxValue) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const width = container.offsetWidth;
    const barWidth = 8;
    const gap = 4;
    const count = Math.floor(width / (barWidth + gap));

    const visibleData = data.slice(-count);

    visibleData.forEach((val, i) => {
      const bar = document.createElement('div');
      bar.className = 'perf-chart-bar';
      bar.style.left = (i * (barWidth + gap)) + 'px';
      bar.style.height = Math.max(2, (val / maxValue) * 100) + '%';
      container.appendChild(bar);
    });
  }

  function init() {
    document.getElementById('perfRefresh')?.addEventListener('click', loadPerformanceData);

    loadPerformanceData();
    refreshInterval = setInterval(loadPerformanceData, 1000);
  }

  function destroy() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    cpuHistory = [];
    memoryHistory = [];
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.performance = { init, destroy, load: loadPerformanceData };
})();
