(function() {
  var container = document.getElementById('splitScreenContainer');
  var btnLeft = document.getElementById('splitScreenLeft');
  var btnRight = document.getElementById('splitScreenRight');
  var btnSwap = document.getElementById('splitScreenSwap');
  var btnClose = document.getElementById('splitScreenClose');
  var paneLeft = document.getElementById('splitPaneLeft');
  var paneRight = document.getElementById('splitPaneRight');
  var urlLeft = document.getElementById('splitUrlLeft');
  var urlRight = document.getElementById('splitUrlRight');
  var goLeft = document.getElementById('splitGoLeft');
  var goRight = document.getElementById('splitGoRight');
  var webviewLeft = document.getElementById('splitWebviewLeft');
  var webviewRight = document.getElementById('splitWebviewRight');
  var divider = document.getElementById('splitDivider');

  var leftWv = null;
  var rightWv = null;
  var isOpen = false;
  var splitRatio = 0.5;

  function formatUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    if (/^\S+\.\S+/.test(url)) return 'https://' + url;
    return 'https://www.baidu.com/s?wd=' + encodeURIComponent(url);
  }

  function createWebview(container, url) {
    var wv = document.createElement('webview');
    wv.setAttribute('src', url);
    wv.setAttribute('allowpopups', '');
    wv.style.cssText = 'width:100%;height:100%;border:none;background:var(--bg-0);';
    container.innerHTML = '';
    container.appendChild(wv);
    
    wv.addEventListener('did-start-loading', function() {
      container.classList.add('loading');
    });
    wv.addEventListener('did-stop-loading', function() {
      container.classList.remove('loading');
    });
    wv.addEventListener('did-finish-load', function() {
      try {
        var title = wv.getTitle();
        var wvUrl = wv.getURL();
        if (container === webviewLeft && urlLeft) {
          urlLeft.value = wvUrl;
        } else if (container === webviewRight && urlRight) {
          urlRight.value = wvUrl;
        }
      } catch(e) {}
    });
    
    return wv;
  }

  function createWelcomePage(container, side) {
    var html = `
      <div class="split-welcome">
        <div class="split-welcome-icon">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <rect x="4" y="8" width="40" height="32" rx="4" fill="none" stroke="var(--accent)" stroke-width="2"/>
            <circle cx="24" cy="24" r="8" fill="none" stroke="var(--accent)" stroke-width="2"/>
            <path d="M24 16v-4M24 36v4M16 24h-4M36 24h4" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="split-welcome-title">开始浏览</div>
        <div class="split-welcome-desc">在上方地址栏输入网址或搜索</div>
        <div class="split-welcome-shortcuts">
          <div class="split-shortcut" data-url="https://www.baidu.com">
            <div class="split-shortcut-icon" style="background:#2932E1;">B</div>
            <span>百度</span>
          </div>
          <div class="split-shortcut" data-url="https://www.bilibili.com">
            <div class="split-shortcut-icon" style="background:#00A1D6;">B</div>
            <span>哔哩哔哩</span>
          </div>
          <div class="split-shortcut" data-url="https://www.zhihu.com">
            <div class="split-shortcut-icon" style="background:#0066FF;">知</div>
            <span>知乎</span>
          </div>
          <div class="split-shortcut" data-url="https://www.github.com">
            <div class="split-shortcut-icon" style="background:#24292E;">G</div>
            <span>GitHub</span>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
    
    container.querySelectorAll('.split-shortcut').forEach(function(el) {
      el.addEventListener('click', function() {
        var url = el.getAttribute('data-url');
        if (side === 'left') {
          urlLeft.value = url;
          navigateLeft();
        } else {
          urlRight.value = url;
          navigateRight();
        }
      });
    });
  }

  function navigateLeft() {
    var url = formatUrl(urlLeft.value);
    if (!url) return;
    urlLeft.value = url;
    leftWv = createWebview(webviewLeft, url);
  }

  function navigateRight() {
    var url = formatUrl(urlRight.value);
    if (!url) return;
    urlRight.value = url;
    rightWv = createWebview(webviewRight, url);
  }

  function openSplitScreen() {
    if (isOpen) return;
    isOpen = true;
    container.classList.add('open');
    document.body.classList.add('split-screen-mode');

    var currentUrl = '';
    var activeWv = window.FBrowser && window.FBrowser.tabs && window.FBrowser.tabs.getActiveWebview();
    if (activeWv) {
      try {
        currentUrl = activeWv.getURL ? activeWv.getURL() : activeWv.src;
      } catch(e) {}
    }

    if (currentUrl && currentUrl !== 'about:blank') {
      urlLeft.value = currentUrl;
      leftWv = createWebview(webviewLeft, currentUrl);
    } else {
      urlLeft.value = '';
      createWelcomePage(webviewLeft, 'left');
    }

    urlRight.value = '';
    createWelcomePage(webviewRight, 'right');
    
    splitRatio = 0.5;
    paneLeft.style.width = '50%';
    paneRight.style.width = '50%';
  }

  function closeSplitScreen() {
    if (!isOpen) return;
    isOpen = false;
    container.classList.remove('open');
    document.body.classList.remove('split-screen-mode');

    if (leftWv) {
      try { leftWv.remove(); } catch(e) {}
      leftWv = null;
    }
    if (rightWv) {
      try { rightWv.remove(); } catch(e) {}
      rightWv = null;
    }
    webviewLeft.innerHTML = '';
    webviewRight.innerHTML = '';
  }

  function swapPanes() {
    var tempUrl = urlLeft.value;
    urlLeft.value = urlRight.value;
    urlRight.value = tempUrl;

    var tempWv = leftWv;
    leftWv = rightWv;
    rightWv = tempWv;

    webviewLeft.innerHTML = '';
    webviewRight.innerHTML = '';
    
    if (leftWv) {
      webviewLeft.appendChild(leftWv);
    } else {
      createWelcomePage(webviewLeft, 'left');
    }
    
    if (rightWv) {
      webviewRight.appendChild(rightWv);
    } else {
      createWelcomePage(webviewRight, 'right');
    }
  }

  function newTabLeft() {
    urlLeft.value = '';
    webviewLeft.innerHTML = '';
    leftWv = null;
    createWelcomePage(webviewLeft, 'left');
    urlLeft.focus();
  }

  function newTabRight() {
    urlRight.value = '';
    webviewRight.innerHTML = '';
    rightWv = null;
    createWelcomePage(webviewRight, 'right');
    urlRight.focus();
  }

  var isDragging = false;
  var startX = 0;
  var startRatio = 0.5;
  var dragOverlay = null;

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX || (e.touches && e.touches[0].clientX);
    startRatio = splitRatio;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    if (!dragOverlay) {
      dragOverlay = document.createElement('div');
      dragOverlay.className = 'split-drag-overlay';
      dragOverlay.innerHTML = '<div class="split-drag-indicator"></div>';
      document.body.appendChild(dragOverlay);
    }
    dragOverlay.classList.add('active');
    
    updateDragIndicator(startX);
  }

  function updateDragIndicator(x) {
    if (!dragOverlay) return;
    var indicator = dragOverlay.querySelector('.split-drag-indicator');
    if (indicator) {
      indicator.style.left = x + 'px';
    }
  }

  function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    var clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;

    updateDragIndicator(clientX);

    var bodyRect = container.querySelector('.split-screen-body').getBoundingClientRect();
    var delta = clientX - startX;
    var newRatio = startRatio + delta / bodyRect.width;
    splitRatio = Math.max(0.25, Math.min(0.75, newRatio));

    paneLeft.style.width = (splitRatio * 100) + '%';
    paneRight.style.width = ((1 - splitRatio) * 100) + '%';
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    if (dragOverlay) {
      dragOverlay.classList.remove('active');
    }
  }

  if (btnLeft) btnLeft.addEventListener('click', newTabLeft);
  if (btnRight) btnRight.addEventListener('click', newTabRight);
  if (btnSwap) btnSwap.addEventListener('click', swapPanes);
  if (btnClose) btnClose.addEventListener('click', closeSplitScreen);
  if (goLeft) goLeft.addEventListener('click', navigateLeft);
  if (goRight) goRight.addEventListener('click', navigateRight);

  if (urlLeft) {
    urlLeft.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') navigateLeft();
    });
  }
  if (urlRight) {
    urlRight.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') navigateRight();
    });
  }

  if (divider) {
    divider.addEventListener('mousedown', startDrag);
    divider.addEventListener('touchstart', startDrag, { passive: false });
  }

  document.addEventListener('mousemove', doDrag);
  document.addEventListener('touchmove', doDrag, { passive: false });
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.splitScreen = {
    open: openSplitScreen,
    close: closeSplitScreen,
    toggle: function() {
      if (isOpen) closeSplitScreen();
      else openSplitScreen();
    },
    isOpen: function() { return isOpen; }
  };
})();
