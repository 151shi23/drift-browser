(function() {
  var dialogVisible = false;
  var currentRelease = null;
  var downloadProgress = 0;

  function init() {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable(function(release) {
      currentRelease = release;
      showUpdateDialog(release);
    });

    window.electronAPI.onUpdateProgress(function(data) {
      downloadProgress = data.percent || 0;
      updateProgressUI(data.percent, data.downloaded, data.total);
    });

    window.electronAPI.onUpdateDownloaded(function(data) {
      showInstallPrompt(data.filePath, data.version);
    });
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  function parseSimpleMarkdown(text) {
    if (!text) return '';
    var html = escHtml(text);
    html = html.replace(/### (.*)/g, '<strong>$1</strong>');
    html = html.replace(/## (.*)/g, '<strong style="font-size:14px">$1</strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/- (.*)/g, '<div style="padding-left:12px;position:relative"><span style="position:absolute;left:0;color:var(--ai-accent)">·</span>$1</div>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function injectStyles() {
    if (document.getElementById('updaterStyles')) return;
    var style = document.createElement('style');
    style.id = 'updaterStyles';
    style.textContent = ''
      + '.update-overlay { position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;animation:updateFadeIn .2s ease }'
      + '.update-dialog { background:var(--bg-1,#1a1a1e);border:1px solid var(--border,rgba(255,255,255,.06));border-radius:16px;width:420px;max-width:90vw;max-height:80vh;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,.4);animation:updateSlideIn .3s cubic-bezier(.16,1,.3,1) }'
      + '.update-header { padding:20px 24px 16px;border-bottom:1px solid var(--border,rgba(255,255,255,.06));display:flex;align-items:center;gap:12px }'
      + '.update-header-icon { width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4A90D9,#6C5CE7);display:flex;align-items:center;justify-content:center;flex-shrink:0 }'
      + '.update-header-icon svg { width:20px;height:20px }'
      + '.update-header-info { flex:1;min-width:0 }'
      + '.update-header-title { font-size:15px;font-weight:600;color:var(--fg-0,#e8e6dc) }'
      + '.update-header-ver { font-size:12px;color:var(--fg-2,#8a8880);margin-top:2px }'
      + '.update-close { width:28px;height:28px;border-radius:6px;border:none;background:transparent;color:var(--fg-2,#8a8880);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .15s }'
      + '.update-close:hover { background:var(--hover,rgba(255,255,255,.06));color:var(--fg-0,#e8e6dc) }'
      + '.update-body { padding:16px 24px;max-height:300px;overflow-y:auto;font-size:13px;line-height:1.7;color:var(--fg-1,#b0aea5) }'
      + '.update-body::-webkit-scrollbar { width:4px }'
      + '.update-body::-webkit-scrollbar-thumb { background:var(--fg-3,#5c5a54);border-radius:2px }'
      + '.update-footer { padding:16px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border,rgba(255,255,255,.06)) }'
      + '.update-btn { padding:8px 18px;border-radius:8px;border:none;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s }'
      + '.update-btn-primary { background:var(--accent,#4A90D9);color:#fff }'
      + '.update-btn-primary:hover { filter:brightness(1.1) }'
      + '.update-btn-primary:disabled { opacity:.5;cursor:not-allowed }'
      + '.update-btn-secondary { background:var(--hover,rgba(255,255,255,.06));color:var(--fg-1,#b0aea5) }'
      + '.update-btn-secondary:hover { background:var(--hover-strong,rgba(255,255,255,.1));color:var(--fg-0,#e8e6dc) }'
      + '.update-progress-wrap { padding:16px 24px }'
      + '.update-progress-bar { width:100%;height:6px;background:var(--bg-2,#222226);border-radius:3px;overflow:hidden }'
      + '.update-progress-fill { height:100%;background:linear-gradient(90deg,#4A90D9,#6C5CE7);border-radius:3px;transition:width .3s ease }'
      + '.update-progress-text { font-size:11px;color:var(--fg-2,#8a8880);margin-top:6px;text-align:center }'
      + '.update-status { padding:12px 24px;font-size:12px;color:var(--fg-2,#8a8880);display:flex;align-items:center;gap:6px }'
      + '.update-status-dot { width:6px;height:6px;border-radius:50%;background:#4A90D9;animation:updatePulse 1.5s ease-in-out infinite }'
      + '.update-badge { display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:rgba(74,144,217,.1);color:#4A90D9 }'
      + '@keyframes updateFadeIn { from{opacity:0}to{opacity:1} }'
      + '@keyframes updateSlideIn { from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)} }'
      + '@keyframes updatePulse { 0%,100%{opacity:1}50%{opacity:.4} }';
    document.head.appendChild(style);
  }

  function showUpdateDialog(release) {
    if (dialogVisible) return;
    dialogVisible = true;
    injectStyles();

    var bodyHtml = '';
    if (release.body) {
      bodyHtml = parseSimpleMarkdown(release.body);
    } else {
      bodyHtml = '<span style="color:var(--fg-3,#5c5a54)">暂无更新说明</span>';
    }

    var assetInfo = '';
    if (release.asset) {
      assetInfo = '<div style="margin-top:8px"><span class="update-badge">' + escHtml(release.asset.name) + ' · ' + formatBytes(release.asset.size) + '</span></div>';
    }

    var overlay = document.createElement('div');
    overlay.id = 'updateOverlay';
    overlay.className = 'update-overlay';
    overlay.innerHTML = ''
      + '<div class="update-dialog">'
        + '<div class="update-header">'
          + '<div class="update-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div>'
          + '<div class="update-header-info">'
            + '<div class="update-header-title">发现新版本</div>'
            + '<div class="update-header-ver">v' + escHtml(release.version) + '</div>'
          + '</div>'
          + '<button class="update-close" id="updateCloseBtn">×</button>'
        + '</div>'
        + '<div class="update-body">' + bodyHtml + assetInfo + '</div>'
        + '<div class="update-progress-wrap" id="updateProgressWrap" style="display:none">'
          + '<div class="update-progress-bar"><div class="update-progress-fill" id="updateProgressFill" style="width:0%"></div></div>'
          + '<div class="update-progress-text" id="updateProgressText">准备下载...</div>'
        + '</div>'
        + '<div class="update-footer">'
          + '<button class="update-btn update-btn-secondary" id="updateSkipBtn">跳过此版本</button>'
          + '<button class="update-btn update-btn-secondary" id="updateLaterBtn">稍后提醒</button>'
          + '<button class="update-btn update-btn-primary" id="updateDownloadBtn">' + (release.asset ? '下载更新' : '前往下载页') + '</button>'
        + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    document.getElementById('updateCloseBtn').addEventListener('click', closeDialog);
    document.getElementById('updateLaterBtn').addEventListener('click', closeDialog);
    document.getElementById('updateSkipBtn').addEventListener('click', function() {
      if (window.electronAPI && window.electronAPI.updaterDismiss) window.electronAPI.updaterDismiss();
      closeDialog();
    });
    document.getElementById('updateDownloadBtn').addEventListener('click', function() {
      if (release.asset) {
        document.getElementById('updateProgressWrap').style.display = '';
        document.getElementById('updateDownloadBtn').disabled = true;
        document.getElementById('updateDownloadBtn').textContent = '下载中...';
        if (window.electronAPI && window.electronAPI.updaterDownload) window.electronAPI.updaterDownload();
      } else if (release.htmlUrl) {
        window.open(release.htmlUrl, '_blank');
        closeDialog();
      }
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeDialog();
    });
  }

  function updateProgressUI(percent, downloaded, total) {
    var fill = document.getElementById('updateProgressFill');
    var text = document.getElementById('updateProgressText');
    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = percent + '% · ' + formatBytes(downloaded) + ' / ' + formatBytes(total);
  }

  function showInstallPrompt(filePath, version) {
    var dialog = document.querySelector('.update-dialog');
    if (!dialog) return;

    var body = dialog.querySelector('.update-body');
    var progressWrap = dialog.querySelector('.update-progress-wrap');
    var footer = dialog.querySelector('.update-footer');

    if (body) body.innerHTML = '<div style="text-align:center;padding:8px 0"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#788c5d" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg><div style="margin-top:8px;font-size:14px;font-weight:500;color:var(--fg-0,#e8e6dc)">v' + escHtml(version) + ' 已下载完成</div><div style="font-size:12px;color:var(--fg-2,#8a8880);margin-top:4px">点击安装并重启以完成更新</div></div>';
    if (progressWrap) progressWrap.style.display = 'none';
    if (footer) footer.innerHTML = ''
      + '<button class="update-btn update-btn-secondary" id="updateLaterBtn2">稍后安装</button>'
      + '<button class="update-btn update-btn-primary" id="updateInstallBtn">安装并重启</button>';

    document.getElementById('updateLaterBtn2').addEventListener('click', closeDialog);
    document.getElementById('updateInstallBtn').addEventListener('click', function() {
      if (window.electronAPI && window.electronAPI.updaterInstall) window.electronAPI.updaterInstall();
    });
  }

  function closeDialog() {
    var overlay = document.getElementById('updateOverlay');
    if (overlay) overlay.remove();
    dialogVisible = false;
  }

  async function manualCheck() {
    if (!window.electronAPI || !window.electronAPI.updaterCheck) return;
    var result = await window.electronAPI.updaterCheck();
    if (result.success && result.hasUpdate) {
      currentRelease = result.release;
      showUpdateDialog(result.release);
    } else if (result.success) {
      showNoUpdateToast(result.message || '当前已是最新版本');
    } else {
      showNoUpdateToast(result.error || '检查更新失败');
    }
    return result;
  }

  function showNoUpdateToast(message) {
    injectStyles();
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-2,#222226);color:var(--fg-1,#b0aea5);padding:10px 20px;border-radius:10px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:99999;animation:updateSlideIn .3s cubic-bezier(.16,1,.3,1);border:1px solid var(--border,rgba(255,255,255,.06))';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.updater = {
    init: init,
    manualCheck: manualCheck,
    showUpdateDialog: showUpdateDialog,
    closeDialog: closeDialog
  };
})();
