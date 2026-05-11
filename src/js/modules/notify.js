// ==================== 全局通知系统 ====================
(function() {
  'use strict';

  function show(message, type) {
    type = type || 'info';

    var notification = document.createElement('div');
    notification.className = 'power-notification power-notification-' + type;

    var iconSvg;
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#22c55e" stroke-width="2"/><path d="M6 10l3 3 5-5" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#f59e0b" stroke-width="2"/><path d="M10 6v4M10 14h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#ef4444" stroke-width="2"/><path d="M7 7l6 6M13 7l-6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#4A90D9" stroke-width="2"/><path d="M10 6v4M10 14h.01" stroke="#4A90D9" stroke-width="2" stroke-linecap="round"/></svg>';
    }

    notification.innerHTML = iconSvg + '<span class="power-notification-text">' + message + '</span>';
    document.body.appendChild(notification);

    setTimeout(function() {
      notification.classList.add('fade-out');
      setTimeout(function() { notification.remove(); }, 300);
    }, 3000);
  }

  function success(message) {
    show(message, 'success');
  }

  function warning(message) {
    show(message, 'warning');
  }

  function error(message) {
    show(message, 'error');
  }

  function info(message) {
    show(message, 'info');
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.notify = {
    show: show,
    success: success,
    warning: warning,
    error: error,
    info: info
  };
})();
