// ==================== 阅读模式模块 ====================
// 去除页面杂乱元素，纯文本阅读
(function() {
  'use strict';

  const READER_CSS = `
    @namespace url(http://www.w3.org/1999/xhtml);
    body {
      max-width: 680px !important;
      margin: 0 auto !important;
      padding: 40px 20px !important;
      background: #1a1a2e !important;
      color: #e0e0e8 !important;
      font-family: 'Georgia', 'Noto Serif SC', serif !important;
      font-size: 18px !important;
      line-height: 1.8 !important;
    }
    * {
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
      float: none !important;
      position: static !important;
      width: auto !important;
      max-width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      opacity: 1 !important;
      overflow: visible !important;
      text-align: left !important;
      visibility: visible !important;
    }
    img, video, iframe, object, embed, canvas, svg,
    nav, header, footer, aside, .ad, .ads, .advertisement,
    .sidebar, .side-bar, .social, .share, .comment, .comments,
    .related, .recommend, .popup, .modal, .overlay,
    .nav, .menu, .toolbar, .banner, .footer, .header,
    [role="navigation"], [role="banner"], [role="contentinfo"],
    [role="complementary"], [class*="ad-"], [class*="ads-"],
    [id*="ad-"], [id*="ads-"], [class*="social"], [class*="share"] {
      display: none !important;
    }
    h1 { font-size: 28px !important; font-weight: 700 !important; margin: 30px 0 20px !important; color: #f0f0f8 !important; }
    h2 { font-size: 24px !important; font-weight: 600 !important; margin: 25px 0 15px !important; color: #e8e8f0 !important; }
    h3 { font-size: 21px !important; font-weight: 600 !important; margin: 20px 0 12px !important; color: #e0e0e8 !important; }
    h4, h5, h6 { font-size: 18px !important; font-weight: 600 !important; margin: 15px 0 10px !important; }
    p { margin: 0 0 16px !important; padding: 0 !important; }
    a { color: #6C9FD9 !important; text-decoration: underline !important; }
    blockquote { border-left: 3px solid #4A90D9 !important; padding-left: 16px !important; margin: 16px 0 !important; color: #a0a0b8 !important; }
    pre, code { font-family: 'Fira Code', 'Consolas', monospace !important; background: #12121a !important; padding: 4px 8px !important; border-radius: 4px !important; }
    pre { padding: 16px !important; overflow-x: auto !important; }
    ul, ol { margin: 12px 0 !important; padding-left: 24px !important; }
    li { margin: 6px 0 !important; }
    table { border-collapse: collapse !important; width: 100% !important; margin: 16px 0 !important; }
    th, td { border: 1px solid #333 !important; padding: 8px 12px !important; }
    th { background: #12121a !important; font-weight: 600 !important; }
    figure { margin: 20px 0 !important; }
    figcaption { font-size: 14px !important; color: #808090 !important; text-align: center !important; }
  `;

  const READER_SCRIPT = `
    (function() {
      if (window.__fbReaderActive) return;
      window.__fbReaderActive = true;

      function extractMainContent() {
        // 尝试找到主要文章内容
        const selectors = [
          'article', '[role="article"]', '.article', '.post', '.entry-content',
          '.content', '.main-content', '#content', '#main-content',
          '.story-body', '.article-body', '.post-body',
          'main', '[role="main"]'
        ];

        let mainEl = null;
        for (const sel of selectors) {
          mainEl = document.querySelector(sel);
          if (mainEl && mainEl.textContent.trim().length > 200) break;
          mainEl = null;
        }

        if (!mainEl) {
          // 回退：找到文本最密集的 div
          const divs = document.querySelectorAll('div, section');
          let maxLen = 0;
          divs.forEach(d => {
            const textLen = d.textContent.trim().length;
            const childDivs = d.querySelectorAll('div').length;
            // 文本多但子 div 少的更可能是主内容
            if (textLen > maxLen && textLen > 200 && childDivs < 10) {
              maxLen = textLen;
              mainEl = d;
            }
          });
        }

        return mainEl;
      }

      // 不需要移除元素，CSS 已经隐藏了不必要的内容
      const main = extractMainContent();
      if (main) {
        // 标记主内容区域可见
        main.style.setProperty('display', 'block', 'important');
        main.querySelectorAll('*').forEach(el => {
          el.style.setProperty('display', '', 'important');
        });
      }
    })();
  `;

  let activeTabs = new Set();

  function toggle() {
    const tab = window.FBrowser.tabs.getActiveTab();
    if (!tab || !tab.webview) return;

    const wv = tab.webview;
    if (activeTabs.has(tab.id)) {
      disable(tab.id, wv);
    } else {
      enable(tab.id, wv);
    }
  }

  function enable(tabId, wv) {
    wv.insertCSS(READER_CSS).then(() => {
      wv.executeJavaScript(READER_SCRIPT).catch(() => {});
      activeTabs.add(tabId);
      updateButtonState(tabId, true);
    }).catch(() => {});
  }

  function disable(tabId, wv) {
    // 通过刷新页面退出阅读模式
    wv.reload();
    activeTabs.delete(tabId);
    updateButtonState(tabId, false);
  }

  function isActive(tabId) {
    return activeTabs.has(tabId);
  }

  function updateButtonState(tabId, active) {
    const btn = document.getElementById('btnReadingMode');
    if (btn) {
      btn.classList.toggle('active', active);
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.readingMode = { toggle, isActive, enable, disable };
})();
