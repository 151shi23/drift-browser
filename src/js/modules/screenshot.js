// ==================== 网页截图模块 ====================
// 截取整个页面或可见区域
(function() {
  'use strict';

  /**
   * 截取可见区域
   */
  function captureVisible() {
    window.electronAPI.capturePage?.('visible').then(result => {
      if (result && result.dataURL) {
        showScreenshotPreview(result.dataURL);
      }
    }).catch(e => {
      console.error('[Screenshot] 截图失败:', e);
    });
  }

  /**
   * 截取整个页面
   */
  function captureFullPage() {
    window.electronAPI.capturePage?.('full').then(result => {
      if (result && result.dataURL) {
        showScreenshotPreview(result.dataURL);
      }
    }).catch(e => {
      console.error('[Screenshot] 截图失败:', e);
    });
  }

  /**
   * 区域截图（通过覆盖层选择区域）
   */
  function captureArea() {
    // 创建截图覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'screenshot-overlay';
    overlay.innerHTML = `
      <div class="screenshot-hint">拖拽选择截图区域，按 Esc 取消</div>
      <canvas class="screenshot-canvas"></canvas>
    `;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('.screenshot-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let startX, startY, isDragging = false;

    overlay.addEventListener('mousedown', e => {
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
    });

    overlay.addEventListener('mousemove', e => {
      if (!isDragging) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 选区
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      ctx.clearRect(x, y, w, h);
      // 边框
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    });

    overlay.addEventListener('mouseup', e => {
      if (!isDragging) return;
      isDragging = false;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      overlay.remove();

      if (w > 10 && h > 10) {
        window.electronAPI.capturePage?.('area', { x, y, width: w, height: h }).then(result => {
          if (result && result.dataURL) {
            showScreenshotPreview(result.dataURL);
          }
        }).catch(() => {});
      }
    });

    // Esc 取消
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
      }
    }
    document.addEventListener('keydown', onKeyDown);
  }

  /**
   * 显示截图预览
   */
  function showScreenshotPreview(dataURL) {
    const preview = document.createElement('div');
    preview.className = 'screenshot-preview';
    preview.innerHTML = `
      <div class="sp-overlay"></div>
      <div class="sp-content">
        <div class="sp-header">
          <span>截图预览</span>
          <div class="sp-actions">
            <button class="sp-btn sp-save" title="保存">💾 保存</button>
            <button class="sp-btn sp-copy" title="复制到剪贴板">📋 复制</button>
            <button class="sp-btn sp-close" title="关闭">✕</button>
          </div>
        </div>
        <div class="sp-image">
          <img src="${dataURL}" alt="截图">
        </div>
      </div>
    `;
    document.body.appendChild(preview);

    preview.querySelector('.sp-overlay').addEventListener('click', () => preview.remove());
    preview.querySelector('.sp-close').addEventListener('click', () => preview.remove());

    preview.querySelector('.sp-save').addEventListener('click', () => {
      // 下载图片
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = 'screenshot_' + Date.now() + '.png';
      a.click();
    });

    preview.querySelector('.sp-copy').addEventListener('click', () => {
      // 复制到剪贴板
      fetch(dataURL).then(r => r.blob()).then(blob => {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
          preview.querySelector('.sp-copy').textContent = '✓ 已复制';
          setTimeout(() => {
            preview.querySelector('.sp-copy').textContent = '📋 复制';
          }, 2000);
        }).catch(() => {});
      }).catch(() => {});
    });
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.screenshot = { captureVisible, captureFullPage, captureArea };
})();
