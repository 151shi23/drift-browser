// ==================== 视频浮窗（画中画）模块 ====================
// 检测页面视频并提供画中画功能
(function() {
  'use strict';

  let pipPanelEl = null;
  let panelVisible = false;

  /**
   * 检测当前页面视频并进入画中画
   */
  function activatePiP() {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video');
        if (videos.length === 0) return { found: false };
        
        // 找到正在播放的视频
        let targetVideo = null;
        for (const v of videos) {
          if (!v.paused && v.readyState >= 2) {
            targetVideo = v;
            break;
          }
        }
        if (!targetVideo) targetVideo = videos[0];
        
        if (targetVideo) {
          targetVideo.requestPictureInPicture().then(() => {
            return { found: true, pip: true };
          }).catch(e => {
            return { found: true, pip: false, error: e.message };
          });
        }
        return { found: false };
      })()
    `).then(result => {
      if (result && result.found && !result.pip) {
        // 画中画失败，显示提示
      }
    }).catch(() => {});
  }

  /**
   * 退出画中画
   */
  function exitPiP() {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        }
      })()
    `).catch(() => {});
  }

  /**
   * 检测页面是否有视频
   */
  function detectVideos() {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video');
        return Array.from(videos).map(v => ({
          src: v.src || v.currentSrc || '',
          duration: v.duration || 0,
          paused: v.paused,
          width: v.videoWidth,
          height: v.videoHeight,
          title: v.title || document.title || '视频',
        }));
      })()
    `).then(videos => {
      if (videos && videos.length > 0) {
        showVideoPanel(videos);
      }
    }).catch(() => {});
  }

  /**
   * 显示视频列表面板
   */
  function showVideoPanel(videos) {
    ensurePanel();
    pipPanelEl.innerHTML = `
      <div class="vp-header">
        <span>视频 (${videos.length})</span>
        <button class="vp-close">✕</button>
      </div>
      <div class="vp-list">
        ${videos.map((v, i) => `
          <div class="vp-item" data-index="${i}">
            <div class="vp-item-icon">🎬</div>
            <div class="vp-item-info">
              <div class="vp-item-title">${window.FBrowser.data.escHtml(v.title)}</div>
              <div class="vp-item-meta">${v.width}x${v.height} | ${v.paused ? '已暂停' : '播放中'}</div>
            </div>
            <button class="vp-pip-btn" data-index="${i}" title="画中画">📌</button>
          </div>
        `).join('')}
      </div>
    `;

    pipPanelEl.querySelector('.vp-close')?.addEventListener('click', hidePanel);

    pipPanelEl.querySelectorAll('.vp-pip-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        activatePiP();
        hidePanel();
      });
    });

    pipPanelEl.classList.add('visible');
    panelVisible = true;
  }

  function hidePanel() {
    ensurePanel();
    if (pipPanelEl) {
      pipPanelEl.classList.remove('visible');
    }
    panelVisible = false;
  }

  function ensurePanel() {
    if (!pipPanelEl) {
      pipPanelEl = document.getElementById('videoPipPanel');
    }
    if (!pipPanelEl) {
      pipPanelEl = document.createElement('div');
      pipPanelEl.id = 'videoPipPanel';
      pipPanelEl.className = 'video-pip-panel';
      document.body.appendChild(pipPanelEl);
    }
  }

  function togglePanel() {
    if (panelVisible) hidePanel();
    else detectVideos();
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.videoPip = { activatePiP, exitPiP, detectVideos, togglePanel };
})();
