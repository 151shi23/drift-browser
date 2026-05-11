// ==================== 工作区/标签组模块 ====================
// 标签页分组管理，一键切换工作区
(function() {
  'use strict';

  let groups = JSON.parse(localStorage.getItem('f-tab-groups') || '[]');
  let activeGroupId = null;
  let panelEl = null;

  function getGroups() {
    return groups;
  }

  function createGroup(name, color) {
    const group = {
      id: Date.now().toString(36),
      name: name || '新分组',
      color: color || '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
      tabs: [],
      time: Date.now(),
    };
    groups.push(group);
    saveGroups();
    return group;
  }

  function deleteGroup(groupId) {
    groups = groups.filter(g => g.id !== groupId);
    saveGroups();
  }

  function renameGroup(groupId, name) {
    const g = groups.find(g => g.id === groupId);
    if (g) { g.name = name; saveGroups(); }
  }

  function setGroupColor(groupId, color) {
    const g = groups.find(g => g.id === groupId);
    if (g) { g.color = color; saveGroups(); }
  }

  function addTabToGroup(groupId, tabId) {
    // 先从其他组移除
    groups.forEach(g => {
      g.tabs = g.tabs.filter(t => t.tabId !== tabId);
    });
    const g = groups.find(g => g.id === groupId);
    if (g) {
      const tab = window.FBrowser.tabs.tabs.find(t => t.id === tabId);
      if (tab) {
        g.tabs.push({
          tabId,
          url: tab.url || '',
          title: tab.element.querySelector('.tab-title')?.textContent || '',
        });
        // 更新标签样式
        tab.element.dataset.groupId = groupId;
        tab.element.style.borderTopColor = g.color;
        saveGroups();
      }
    }
  }

  function removeTabFromGroup(tabId) {
    groups.forEach(g => {
      g.tabs = g.tabs.filter(t => t.tabId !== tabId);
    });
    const tab = window.FBrowser.tabs.tabs.find(t => t.id === tabId);
    if (tab) {
      delete tab.element.dataset.groupId;
      tab.element.style.borderTopColor = '';
    }
    saveGroups();
  }

  function getTabGroup(tabId) {
    return groups.find(g => g.tabs.some(t => t.tabId === tabId));
  }

  function switchToGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    activeGroupId = groupId;
    const tabs = window.FBrowser.tabs.tabs;

    // 显示同组标签，隐藏其他
    tabs.forEach(tab => {
      const tabGroup = getTabGroup(tab.id);
      if (tabGroup && tabGroup.id === groupId) {
        tab.element.style.display = '';
      } else if (groupId !== null) {
        tab.element.style.display = 'none';
      } else {
        tab.element.style.display = '';
      }
    });

    // 切换到组内第一个可见标签
    const firstGroupTab = tabs.find(t => {
      const tg = getTabGroup(t.id);
      return tg && tg.id === groupId;
    });
    if (firstGroupTab) {
      window.FBrowser.tabs.switchTab(firstGroupTab.id);
    }
  }

  function showAllTabs() {
    activeGroupId = null;
    window.FBrowser.tabs.tabs.forEach(tab => {
      tab.element.style.display = '';
    });
  }

  function saveGroups() {
    localStorage.setItem('f-tab-groups', JSON.stringify(groups));
  }

  // 面板
  function togglePanel() {
    if (panelEl && panelEl.classList.contains('visible')) {
      panelEl.classList.remove('visible');
    } else {
      ensurePanel();
      renderPanel();
      panelEl.classList.add('visible');
    }
  }

  function ensurePanel() {
    if (!panelEl) {
      panelEl = document.getElementById('tabGroupPanel');
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'tabGroupPanel';
      panelEl.className = 'tab-group-panel';
      document.body.appendChild(panelEl);
    }
  }

  function renderPanel() {
    ensurePanel();
    panelEl.innerHTML = `
      <div class="tg-header">
        <span>标签分组</span>
        <div class="tg-actions">
          <button class="tg-add" title="新建分组">+ 新建</button>
          <button class="tg-show-all" title="显示全部">全部</button>
          <button class="tg-close">✕</button>
        </div>
      </div>
      <div class="tg-list">
        ${groups.length === 0 ? '<div class="tg-empty">暂无分组，点击"新建"创建</div>' :
          groups.map(g => `
            <div class="tg-item" data-id="${g.id}">
              <div class="tg-color" style="background:${g.color}"></div>
              <div class="tg-info">
                <div class="tg-name">${window.FBrowser.data.escHtml(g.name)}</div>
                <div class="tg-count">${g.tabs.length} 个标签</div>
              </div>
              <div class="tg-item-actions">
                <button class="tg-switch" data-id="${g.id}" title="切换到此组">切换</button>
                <button class="tg-delete" data-id="${g.id}" title="删除">✕</button>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;

    panelEl.querySelector('.tg-close')?.addEventListener('click', () => panelEl.classList.remove('visible'));
    panelEl.querySelector('.tg-show-all')?.addEventListener('click', showAllTabs);
    panelEl.querySelector('.tg-add')?.addEventListener('click', () => {
      const name = prompt('分组名称:');
      if (name) {
        createGroup(name);
        renderPanel();
      }
    });

    panelEl.querySelectorAll('.tg-switch').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        switchToGroup(btn.dataset.id);
      });
    });

    panelEl.querySelectorAll('.tg-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteGroup(btn.dataset.id);
        renderPanel();
      });
    });

    panelEl.querySelectorAll('.tg-item').forEach(item => {
      item.addEventListener('click', () => {
        switchToGroup(item.dataset.id);
      });
    });
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.tabGroups = {
    getGroups, createGroup, deleteGroup, renameGroup, setGroupColor,
    addTabToGroup, removeTabFromGroup, getTabGroup, switchToGroup,
    showAllTabs, togglePanel,
  };
})();
