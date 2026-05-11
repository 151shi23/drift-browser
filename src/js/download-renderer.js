// ==================== 下载管理窗口渲染脚本 ====================
(function() {
  'use strict';

  const downloadListEl = document.getElementById('downloadList');
  const emptyMsg = document.getElementById('emptyMsg');
  const activeCountEl = document.getElementById('activeCount');
  const downloadPathLabel = document.getElementById('downloadPathLabel');

  let downloads = [];

  // ---- 初始化：获取下载路径 ----
  async function init() {
    try {
      const dp = await window.electronAPI.downloadsGetPath();
      if (downloadPathLabel) downloadPathLabel.textContent = dp || '';
    } catch(e) {}
  }
  init();

  // ---- 工具函数 ----
  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === -1) return '未知大小';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    return formatBytes(bytesPerSec) + '/s';
  }

  function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const icons = {
      'exe': '⚙', 'msi': '⚙', 'dmg': '⚙', 'apk': '📱',
      'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
      'mp4': '🎬', 'mkv': '🎬', 'avi': '🎬', 'mov': '🎬', 'wmv': '🎬', 'flv': '🎬',
      'mp3': '🎵', 'flac': '🎵', 'wav': '🎵', 'aac': '🎵', 'ogg': '🎵',
      'pdf': '📄', 'doc': '📝', 'docx': '📝', 'xls': '📊', 'xlsx': '📊', 'ppt': '📊', 'pptx': '📊',
      'jpg': '🖼', 'jpeg': '🖼', 'png': '🖼', 'gif': '🖼', 'webp': '🖼', 'svg': '🖼', 'bmp': '🖼',
      'txt': '📃', 'log': '📃', 'csv': '📃',
      'iso': '💿', 'torrent': '🧲',
    };
    return icons[ext] || '📎';
  }

  // ---- 渲染下载列表 ----
  function renderDownloads() {
    if (!downloadListEl) return;

    // 保留空状态提示
    const hasItems = downloads.length > 0;
    if (emptyMsg) emptyMsg.style.display = hasItems ? 'none' : 'flex';

    // 清空并重建
    const existingItems = downloadListEl.querySelectorAll('.dl-item');
    existingItems.forEach(el => el.remove());

    downloads.forEach(dl => {
      const el = document.createElement('div');
      const pct = dl.progress || 0;
      const stateClass = dl.state === 'progressing' ? 'progressing'
        : dl.state === 'completed' ? 'completed'
        : dl.state === 'cancelled' ? 'failed'
        : dl.state === 'interrupted' ? 'failed'
        : 'failed';

      el.className = 'dl-item ' + stateClass;
      el.dataset.id = dl.id;

      const icon = getFileIcon(dl.name);

      let statusHtml = '';
      if (dl.state === 'progressing') {
        statusHtml = `
          <span class="dl-speed">${dl.speed ? formatSpeed(dl.speed) : ''}</span>
          <span>${Math.round(pct)}%</span>
          <span>${formatBytes(dl.received)} / ${formatBytes(dl.total)}</span>
        `;
      } else if (dl.state === 'completed') {
        statusHtml = `<span style="color:var(--success)">下载完成</span><span>${formatBytes(dl.total || dl.received)}</span>`;
      } else if (dl.state === 'interrupted' || dl.state === 'cancelled') {
        statusHtml = `<span style="color:var(--danger)">下载失败</span><span>${formatBytes(dl.received)} / ${formatBytes(dl.total)}</span>`;
      } else if (dl.state === 'paused') {
        statusHtml = `<span style="color:var(--warning)">已暂停</span><span>${Math.round(pct)}% · ${formatBytes(dl.received)} / ${formatBytes(dl.total)}</span>`;
      }

      let actionsHtml = '';
      if (dl.state === 'progressing') {
        actionsHtml = `
          <button class="dl-act pause" data-action="pause" data-id="${dl.id}" title="暂停">⏸</button>
          <button class="dl-act cancel" data-action="cancel" data-id="${dl.id}" title="取消">✕</button>
        `;
      } else if (dl.state === 'paused' || dl.state === 'interrupted') {
        actionsHtml = `
          <button class="dl-act" data-action="resume" data-id="${dl.id}" title="继续" style="color:var(--success)">▶</button>
          <button class="dl-act cancel" data-action="cancel" data-id="${dl.id}" title="取消">✕</button>
        `;
      } else if (dl.state === 'completed') {
        actionsHtml = `
          <button class="dl-act open" data-action="open" data-id="${dl.id}" title="打开文件">📂</button>
          <button class="dl-act open" data-action="folder" data-id="${dl.id}" title="打开文件夹">📁</button>
        `;
      } else if (dl.state === 'cancelled') {
        actionsHtml = `
          <button class="dl-act" data-action="retry" data-id="${dl.id}" title="重试" style="color:var(--accent)">↻</button>
        `;
      }

      el.innerHTML = `
        <div class="dl-icon">${icon}</div>
        <div class="dl-body">
          <div class="dl-filename">${escHtml(dl.name)}</div>
          <div class="dl-meta">${statusHtml}</div>
          ${dl.state !== 'completed' ? `<div class="dl-progress-wrap"><div class="dl-progress-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="dl-actions">${actionsHtml}</div>
      `;

      downloadListEl.appendChild(el);
    });

    // 更新活跃下载数
    const activeCount = downloads.filter(d => d.state === 'progressing').length;
    if (activeCountEl) activeCountEl.textContent = activeCount > 0 ? `${activeCount} 个下载中` : '无活跃下载';
  }

  // ---- 按钮事件代理 ----
  downloadListEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.dl-act');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    switch (action) {
      case 'pause':
        await window.electronAPI.downloadsPause(id);
        break;
      case 'resume':
        await window.electronAPI.downloadsResume(id);
        break;
      case 'cancel':
        await window.electronAPI.downloadsCancel(id);
        // 从列表移除
        downloads = downloads.filter(d => d.id !== id);
        renderDownloads();
        break;
      case 'open':
        await window.electronAPI.downloadsShowInFolder(id);
        break;
      case 'folder':
        await window.electronAPI.downloadsShowInFolder(id);
        break;
      case 'retry': {
        const dl = downloads.find(d => d.id === id);
        if (dl && dl.url) {
          // 在主窗口打开下载链接
          await window.electronAPI.openWindow(dl.url);
        }
        break;
      }
    }
  });

  // ---- 监听下载事件 ----
  window.electronAPI.onDownloadStarted(data => {
    const exists = downloads.find(d => d.id === data.id);
    if (!exists) {
      downloads.unshift({
        id: data.id,
        name: data.filename || data.name || '未知文件',
        url: data.url || '',
        savePath: data.savePath || '',
        state: 'progressing',
        progress: 0,
        received: 0,
        total: data.totalBytes || 0,
        speed: 0,
      });
    }
    renderDownloads();
    // 闪烁任务栏
    try { window.electronAPI.downloadWindowFlash?.(); } catch(e) {}
  });

  window.electronAPI.onDownloadProgress(data => {
    const dl = downloads.find(d => d.id === data.id);
    if (dl) {
      dl.received = data.receivedBytes;
      dl.total = data.totalBytes;
      dl.progress = data.totalBytes > 0 ? (data.receivedBytes / data.totalBytes * 100) : 0;
      dl.state = 'progressing';
      // 计算速度
      if (data.speed) dl.speed = data.speed;
      renderDownloads();
    }
  });

  window.electronAPI.onDownloadCompleted(data => {
    const dl = downloads.find(d => d.id === data.id);
    if (dl) {
      dl.state = 'completed';
      dl.progress = 100;
      dl.received = data.receivedBytes || dl.received;
      dl.total = data.totalBytes || dl.total;
      dl.savePath = data.savePath || dl.savePath;
      dl.speed = 0;
      renderDownloads();
    }
  });

  window.electronAPI.onDownloadFailed(data => {
    const dl = downloads.find(d => d.id === data.id);
    if (dl) {
      dl.state = data.state || 'failed';
      dl.speed = 0;
      renderDownloads();
    }
  });

  // ---- 工具栏按钮 ----
  document.getElementById('btnClearAll')?.addEventListener('click', async () => {
    await window.electronAPI.downloadsClear();
    downloads = downloads.filter(d => d.state === 'progressing' || d.state === 'paused');
    renderDownloads();
  });

  document.getElementById('btnOpenFolder')?.addEventListener('click', async () => {
    const dp = await window.electronAPI.downloadsGetPath();
    if (dp) {
      const { shell } = require ? null : null; // 不能在渲染进程直接用
      // 通过 IPC 打开文件夹
      await window.electronAPI.downloadsOpenFolder?.();
    }
  });

  document.getElementById('btnCloseWin')?.addEventListener('click', () => {
    window.close();
  });

  // ---- 启动时拉取已有下载列表 ----
  async function restoreDownloads() {
    try {
      const list = await window.electronAPI.downloadsGetList();
      if (Array.isArray(list) && list.length > 0) {
        downloads = list.map(item => ({
          id: item.id,
          name: item.filename || item.name || '未知文件',
          url: item.url || '',
          savePath: item.savePath || '',
          state: item.state === 'progressing' ? 'progressing'
            : item.state === 'completed' ? 'completed'
            : item.state === 'cancelled' ? 'cancelled'
            : item.state === 'interrupted' ? 'interrupted'
            : 'failed',
          progress: item.totalBytes > 0 ? (item.receivedBytes / item.totalBytes * 100) : (item.state === 'completed' ? 100 : 0),
          received: item.receivedBytes || 0,
          total: item.totalBytes || 0,
          speed: 0,
        }));
        renderDownloads();
      }
    } catch(e) { /* 首次使用可能无数据 */ }
  }
  restoreDownloads();

})();
