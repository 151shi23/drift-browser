// ==================== 通知管理模块 ====================
// 网页通知权限管理和历史
(function() {
  'use strict';

  let notifications = [];
  let permissionSettings = {};
  try {
    notifications = JSON.parse(localStorage.getItem('f-notifications') || '[]');
    if (!Array.isArray(notifications)) notifications = [];
  } catch (e) { notifications = []; }
  try {
    permissionSettings = JSON.parse(localStorage.getItem('f-notification-perms') || '{}');
    if (typeof permissionSettings !== 'object') permissionSettings = {};
  } catch (e) { permissionSettings = {}; }
  let panelEl = null;
  let panelVisible = false;

  const MAX_NOTIFICATIONS = 100;

  function getNotifications() {
    return notifications;
  }

  function addNotification(notif) {
    notifications.unshift({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      title: notif.title || '通知',
      body: notif.body || '',
      icon: notif.icon || '',
      url: notif.url || '',
      origin: notif.origin || '',
      time: Date.now(),
      read: false,
    });
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }
    saveNotifications();
    // 显示桌面通知
    showDesktopNotification(notif);
  }

  function markAsRead(id) {
    const n = notifications.find(n => n.id === id);
    if (n) { n.read = true; saveNotifications(); }
  }

  function markAllRead() {
    notifications.forEach(n => n.read = true);
    saveNotifications();
  }

  function clearNotifications() {
    notifications = [];
    saveNotifications();
  }

  function deleteNotification(id) {
    notifications = notifications.filter(n => n.id !== id);
    saveNotifications();
  }

  function saveNotifications() {
    localStorage.setItem('f-notifications', JSON.stringify(notifications));
  }

  function getUnreadCount() {
    return notifications.filter(n => !n.read).length;
  }

  // 权限管理
  function getPermission(origin) {
    return permissionSettings[origin] || 'ask'; // 'ask' | 'allow' | 'block'
  }

  function setPermission(origin, perm) {
    permissionSettings[origin] = perm;
    localStorage.setItem('f-notification-perms', JSON.stringify(permissionSettings));
    // 通知主进程
    window.electronAPI.setNotificationPermission?.(origin, perm);
  }

  function getPermissionSettings() {
    return permissionSettings;
  }

  function showDesktopNotification(notif) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title || 'Drift 浏览器', {
        body: notif.body || '',
        icon: notif.icon || '',
      });
    }
  }

  // 面板
  function togglePanel() {
    if (panelVisible) hidePanel();
    else showPanel();
  }

  function showPanel() {
    ensurePanel();
    panelEl.classList.add('visible');
    panelVisible = true;
    renderPanel();
  }

  function hidePanel() {
    ensurePanel();
    panelEl.classList.remove('visible');
    panelVisible = false;
  }

  function ensurePanel() {
    if (!panelEl) {
      panelEl = document.getElementById('notificationPanel');
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'notificationPanel';
      panelEl.className = 'notification-panel';
      document.body.appendChild(panelEl);
    }
  }

  function renderPanel() {
    ensurePanel();
    const unread = getUnreadCount();

    panelEl.innerHTML = `
      <div class="np-header">
        <span>通知${unread > 0 ? ' (' + unread + ')' : ''}</span>
        <div class="np-actions">
          ${unread > 0 ? '<button class="np-mark-read">全部已读</button>' : ''}
          <button class="np-clear">清空</button>
          <button class="np-close">✕</button>
        </div>
      </div>
      <div class="np-list">
        ${notifications.length === 0 ? '<div class="np-empty">暂无通知</div>' :
          notifications.map(n => `
            <div class="np-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
              <div class="np-item-icon">${n.icon ? '<img src="' + n.icon + '">' : '🔔'}</div>
              <div class="np-item-content">
                <div class="np-item-title">${window.FBrowser.data.escHtml(n.title)}</div>
                <div class="np-item-body">${window.FBrowser.data.escHtml(n.body)}</div>
                <div class="np-item-meta">
                  <span class="np-item-origin">${window.FBrowser.data.escHtml(n.origin)}</span>
                  <span class="np-item-time">${formatTime(n.time)}</span>
                </div>
              </div>
              <button class="np-item-del" data-id="${n.id}">✕</button>
            </div>
          `).join('')
        }
      </div>
    `;

    panelEl.querySelector('.np-close')?.addEventListener('click', hidePanel);
    panelEl.querySelector('.np-clear')?.addEventListener('click', () => {
      clearNotifications();
      renderPanel();
    });
    panelEl.querySelector('.np-mark-read')?.addEventListener('click', () => {
      markAllRead();
      renderPanel();
    });

    panelEl.querySelectorAll('.np-item-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteNotification(btn.dataset.id);
        renderPanel();
      });
    });

    panelEl.querySelectorAll('.np-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        markAsRead(id);
        const n = notifications.find(n => n.id === id);
        if (n && n.url) {
          window.FBrowser.navigation.navigateTo(n.url);
        }
        hidePanel();
      });
    });
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return d.toLocaleDateString('zh-CN');
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.notificationManager = {
    getNotifications, addNotification, markAsRead, markAllRead,
    clearNotifications, deleteNotification, getUnreadCount,
    getPermission, setPermission, getPermissionSettings,
    togglePanel, showPanel, hidePanel,
  };
})();
