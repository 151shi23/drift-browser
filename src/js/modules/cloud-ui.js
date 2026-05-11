(function() {
  'use strict';

  var currentGroupId = null;
  var currentPath = '';
  var authStatus = null;
  var selectedFiles = [];
  var viewMode = 'list';
  var searchQuery = '';
  var searchTimeout = null;
  var uploadProgress = null;
  var downloadProgress = null;

  var SVG = {
    cloud: '<svg width="28" height="28" viewBox="0 0 14 14"><path d="M3 9a2.5 2.5 0 0 1-.2-4.98A3.5 3.5 0 0 1 10 5a3 3 0 0 1 .5 5.96L3 11z" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linejoin="round"/></svg>',
    cloudSmall: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 9a2.5 2.5 0 0 1-.2-4.98A3.5 3.5 0 0 1 10 5a3 3 0 0 1 .5 5.96L3 11z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h4l1.5 1.5H14v7H2V4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    file: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v3h3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v7M4 7l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    share: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="10" cy="3" r="2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="4" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="10" cy="11" r="2" fill="none" stroke="currentColor" stroke-width="1"/><path d="M6 6l2-2M6 8l2 2" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4v8a1 1 0 001 1h4a1 1 0 001-1V4" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 7A5 5 0 1 1 7 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 2v5h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12V5M4 7l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    newFolder: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 4h4l1.5 1.5H12v6H2V4z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><line x1="7" y1="7" x2="7" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5.5" y1="8.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    eyeOff: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7s2.5-4 6-4c.7 0 1.3.1 1.9.3M13 7s-2.5 4-6 4c-.7 0-1.3-.1-1.9-.3" fill="none" stroke="currentColor" stroke-width="1"/><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    sync: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 1v3h-3M3 13v-3h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 4L6 8l4 4"/></svg>',
    github: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    logout: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    browse: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 3h4l1.5 1.5H12v7H2V3z" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    grid: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><rect x="8" y="1" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><rect x="1" y="8" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><rect x="8" y="8" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    list: '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1"/><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    zoomIn: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1"/><line x1="6" y1="4" x2="6" y2="8" stroke="currentColor" stroke-width="1"/><line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" stroke-width="1"/><line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    zoomOut: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1"/><line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" stroke-width="1"/><line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2 7 5.5 10.5 12 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 9a3 3 0 0 0 4.24 0l2-2A3 3 0 0 0 7 2.76L5.76 4" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M9 5a3 3 0 0 0-4.24 0l-2 2A3 3 0 0 0 7 11.24L8.24 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    more: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="3" r="1" fill="currentColor"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="7" cy="11" r="1" fill="currentColor"/></svg>'
  };

  function escHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatSize(bytes) {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function getFileIconSvg(name, type) {
    if (type === 'dir') return SVG.folder;
    return SVG.file;
  }

  function getFileType(name) {
    var ext = (name || '').split('.').pop().toLowerCase();
    var imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    var audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    var videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
    var textExts = ['txt', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'json', 'xml', 'yml', 'yaml', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'sh', 'bat', 'sql', 'ini', 'cfg', 'conf', 'log', 'csv'];
    if (imageExts.indexOf(ext) !== -1) return 'image';
    if (audioExts.indexOf(ext) !== -1) return 'audio';
    if (videoExts.indexOf(ext) !== -1) return 'video';
    if (ext === 'md') return 'markdown';
    if (textExts.indexOf(ext) !== -1) return 'text';
    return 'other';
  }

  async function checkAuth() {
    try { authStatus = await window.electronAPI.cloudAuthStatus(); }
    catch (e) { authStatus = { authenticated: false }; }
    return authStatus;
  }

  function settingsBtn(cls, html, id) {
    return '<button class="settings-btn ' + (cls || '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + html + '</button>';
  }

  function renderSidebarPanel() {
    var container = document.getElementById('cloudSidebarContent');
    if (!container) return;

    if (!authStatus || !authStatus.authenticated) {
      container.innerHTML = '<div class="cloud-sidebar-auth">'
        + '<div style="opacity:0.3;margin-bottom:8px">' + SVG.cloud + '</div>'
        + '<p>登录账号以使用云盘</p>'
        + '<button class="settings-btn primary" id="cloudSidebarLogin" style="width:100%">登录</button>'
        + '</div>';
      var loginBtn = document.getElementById('cloudSidebarLogin');
      if (loginBtn) loginBtn.addEventListener('click', function() { openCloudPage(); });
      return;
    }

    container.innerHTML = '<div class="cloud-user-card" style="margin:8px">'
      + '<img class="cloud-user-avatar" src="' + escHtml(authStatus.user.avatar || '') + '" onerror="this.style.display=\'none\'">'
      + '<div class="cloud-user-info"><div class="cloud-user-name" style="font-size:12px">' + escHtml(authStatus.user.name || authStatus.user.login) + '</div></div>'
      + '</div>'
      + '<div id="cloudSidebarGroups"></div>';

    loadSidebarGroups();
  }

  async function loadSidebarGroups() {
    try {
      var result = await window.electronAPI.cloudListGroups();
      var groupsEl = document.getElementById('cloudSidebarGroups');
      if (!groupsEl) return;
      if (!result.groups || result.groups.length === 0) {
        groupsEl.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--fg-2)">暂无空间</div>';
        return;
      }
      var html = '';
      for (var i = 0; i < result.groups.length; i++) {
        var g = result.groups[i];
        html += '<div class="cloud-nav-item" data-group="' + g.id + '">' + SVG.folder + '<span class="cloud-nav-item-name">' + escHtml(g.name) + '</span></div>';
      }
      groupsEl.innerHTML = html;
      var items = groupsEl.querySelectorAll('.cloud-nav-item');
      for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('click', (function(gid) {
          return function() { currentGroupId = gid; openCloudPage(); };
        })(result.groups[j].id));
      }
    } catch (e) { console.error('[CloudUI] loadSidebarGroups:', e); }
  }

  function openCloudPage() {
    window.FBrowser.tabs.createTab('f://cloud');
  }

  function createCloudPage() {
    var existing = document.getElementById('cloudManagerPage');
    if (existing) { existing.classList.add('active'); return; }
    var page = document.createElement('div');
    page.id = 'cloudManagerPage';
    page.className = 'view active';
    var contentArea = document.getElementById('contentArea');
    (contentArea || document.body).appendChild(page);
    renderCloudPage(page);
  }

  async function renderCloudPage(page) {
    await checkAuth();
    if (!authStatus || !authStatus.authenticated) renderAuthPage(page);
    else renderMainPage(page);
  }

  function renderAuthPage(page) {
    page.innerHTML = '<div class="cloud-page">'
      + '<div class="cloud-page-header">'
      + '<button class="cloud-header-back" id="cloudBackBtn">' + SVG.back + '</button>'
      + '<h2>Drift Cloud</h2>'
      + '</div>'
      + '<div class="cloud-page-body">'
      + '<div class="cloud-scroll"><div class="cloud-inner">'
      + '<div class="cloud-auth-section">'
      + '<div class="cloud-auth-logo">' + SVG.cloud + '</div>'
      + '<h3 class="cloud-auth-title">连接云盘</h3>'
      + '<p class="cloud-auth-desc">将你的文件安全存储在云端，免费使用，随时随地访问</p>'
      + '<div class="cloud-auth-steps">'
      + '<div class="cloud-auth-steps-title">'
      + '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1"/><text x="7" y="10" font-size="8" text-anchor="middle" font-weight="600" fill="currentColor">?</text></svg>'
      + '如何获取连接密钥'
      + '</div>'
      + '<ol>'
      + '<li>点击下方按钮打开账号设置页面</li>'
      + '<li>点击 <strong>Generate new token (classic)</strong> 生成新密钥</li>'
      + '<li>在备注栏填写 <code>Drift Cloud</code></li>'
      + '<li>勾选 <code>repo</code> 选项（勾选第一个大选项即可）</li>'
      + '<li>点击绿色按钮生成密钥</li>'
      + '<li>复制生成的密钥（以 <code>ghp_</code> 开头的一串字符）</li>'
      + '</ol>'
      + '</div>'
      + '<a href="https://github.com/settings/tokens/new?scopes=repo&description=Drift%20Cloud" target="_blank" class="cloud-auth-github-btn">'
      + SVG.github + ' 去获取连接密钥</a>'
      + '<div class="cloud-auth-form">'
      + '<label>连接密钥</label>'
      + '<div class="cloud-auth-input-group">'
      + '<input type="password" id="cloudPatInput" placeholder="粘贴以 ghp_ 开头的密钥">'
      + '<button class="cloud-auth-toggle-vis" id="cloudToggleVis" title="显示/隐藏">' + SVG.eye + '</button>'
      + '</div>'
      + '<div class="cloud-auth-status" id="cloudAuthStatus"></div>'
      + settingsBtn('primary', '连接账号', 'cloudPatLogin')
      + '</div>'
      + '</div>'
      + '</div></div></div></div>';

    document.getElementById('cloudBackBtn').addEventListener('click', function() { page.classList.remove('active'); });
    document.getElementById('cloudToggleVis').addEventListener('click', function() {
      var input = document.getElementById('cloudPatInput');
      if (input.type === 'password') { input.type = 'text'; this.innerHTML = SVG.eyeOff; }
      else { input.type = 'password'; this.innerHTML = SVG.eye; }
    });
    document.getElementById('cloudPatLogin').addEventListener('click', async function() {
      var btn = this;
      var token = document.getElementById('cloudPatInput').value.trim();
      var statusEl = document.getElementById('cloudAuthStatus');
      if (!token) { statusEl.className = 'cloud-auth-status error'; statusEl.textContent = '请输入连接密钥'; return; }
      btn.textContent = '正在连接...'; btn.disabled = true;
      statusEl.className = 'cloud-auth-status'; statusEl.textContent = '';
      try {
        var result = await Promise.race([
          window.electronAPI.cloudAuthPat(token),
          new Promise(function(_, reject) { setTimeout(function() { reject(new Error('请求超时(30s)，请检查网络或代理设置')); }, 30000); })
        ]);
        if (result && result.success) {
          statusEl.className = 'cloud-auth-status success'; statusEl.textContent = '连接成功！正在加载...';
          window.FBrowser.notify.success('登录成功: ' + result.user.login);
          await checkAuth(); renderMainPage(page);
        } else {
          statusEl.className = 'cloud-auth-status error'; statusEl.textContent = '登录失败: ' + ((result && result.error) || '未知错误');
          btn.textContent = '连接账号'; btn.disabled = false;
        }
      } catch (e) {
        statusEl.className = 'cloud-auth-status error'; statusEl.textContent = '连接超时，请检查网络是否正常';
        btn.textContent = '连接账号'; btn.disabled = false;
      }
    });
  }

  async function renderMainPage(page) {
    var groupsResult = await window.electronAPI.cloudListGroups();
    var groups = (groupsResult && groupsResult.groups) || [];

    page.innerHTML = '<div class="cloud-page">'
      + '<div class="cloud-page-header">'
      + '<button class="cloud-header-back" id="cloudBackBtn2">' + SVG.back + '</button>'
      + '<h2>Drift Cloud</h2>'
      + '<div style="flex:1"></div>'
      + '<div class="cloud-user-card" style="margin:0;padding:6px 12px">'
      + '<img class="cloud-user-avatar" src="' + escHtml(authStatus.user.avatar || '') + '" style="width:28px;height:28px" onerror="this.style.display=\'none\'">'
      + '<div class="cloud-user-info"><div class="cloud-user-name" style="font-size:12px">' + escHtml(authStatus.user.name || authStatus.user.login) + '</div></div>'
      + settingsBtn('danger', SVG.logout + ' 退出登录', 'cloudLogoutBtn')
      + '</div>'
      + '</div>'
      + '<div class="cloud-page-body">'
      + '<div class="cloud-layout">'
      + '<div class="cloud-nav">'
      + '<div class="cloud-nav-header">' + SVG.cloudSmall + '<span class="cloud-nav-title">云盘</span></div>'
      + '<div class="cloud-nav-menu">'
      + '<div class="cloud-nav-group"><div class="cloud-nav-label">空间</div>'
      + '<div id="cloudGroupList"></div>'
      + '<button class="cloud-nav-add" id="cloudAddGroupBtn">' + SVG.plus + ' 新建空间</button>'
      + '</div>'
      + '<div class="cloud-nav-group"><div class="cloud-nav-label">同步</div>'
      + '<div id="cloudSyncList"></div>'
      + '<button class="cloud-nav-add" id="cloudAddSyncBtn">' + SVG.sync + ' 添加同步</button>'
      + '</div>'
      + '</div>'
      + '<div class="cloud-nav-storage" id="cloudStorageBar"></div>'
      + '</div>'
      + '<div class="cloud-content">'
      + '<div class="cloud-scroll"><div class="cloud-inner" id="cloudMainArea">'
      + '<div class="cloud-empty"><div class="cloud-empty-icon">' + SVG.cloud + '</div>'
      + '<h4>选择一个空间</h4><p>从左侧选择或新建一个空间开始使用</p></div>'
      + '</div></div>'
      + '</div>'
      + '</div></div></div>';

    document.getElementById('cloudBackBtn2').addEventListener('click', function() { page.classList.remove('active'); });
    document.getElementById('cloudLogoutBtn').addEventListener('click', async function() {
      await window.electronAPI.cloudLogout();
      window.FBrowser.notify.success('已退出登录');
      await checkAuth(); renderAuthPage(page);
    });
    document.getElementById('cloudAddGroupBtn').addEventListener('click', function() { showCreateGroupModal(page); });
    document.getElementById('cloudAddSyncBtn').addEventListener('click', function() { showAddSyncModal(page); });

    renderGroupList(page, groups);
    loadSyncList(page);

    if (currentGroupId) selectGroup(page, currentGroupId);
  }

  function renderGroupList(page, groups) {
    var listEl = document.getElementById('cloudGroupList');
    if (!listEl) return;
    if (!groups || groups.length === 0) {
      listEl.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--fg-2)">暂无空间</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var isActive = g.id === currentGroupId ? ' active' : '';
      html += '<button class="cloud-nav-item' + isActive + '" data-group="' + g.id + '">'
        + SVG.folder + '<span class="cloud-nav-item-name">' + escHtml(g.name) + '</span>'
        + '<span class="cloud-nav-item-more" data-group-id="' + g.id + '">' + SVG.more + '</span>'
        + '</button>';
    }
    listEl.innerHTML = html;

    var items = listEl.querySelectorAll('.cloud-nav-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', (function(gid) {
        return function(e) {
          if (e.target.closest('.cloud-nav-item-more')) return;
          selectGroup(page, gid);
        };
      })(groups[j].id));
    }

    var moreBtns = listEl.querySelectorAll('.cloud-nav-item-more');
    for (var k = 0; k < moreBtns.length; k++) {
      moreBtns[k].addEventListener('click', (function(gid, gname) {
        return function(e) {
          e.stopPropagation();
          showGroupContextMenu(page, gid, gname, e);
        };
      })(groups[k].id, groups[k].name));
    }
  }

  function showGroupContextMenu(page, groupId, groupName, event) {
    var existing = document.querySelector('.cloud-context-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'cloud-context-menu';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - 120) + 'px';
    menu.innerHTML = '<div class="cloud-context-item" data-action="view-repo">' + SVG.link + ' 在网页中查看</div>'
      + '<div class="cloud-context-item danger" data-action="delete">' + SVG.trash + ' 删除空间</div>';

    document.body.appendChild(menu);

    menu.querySelector('[data-action="view-repo"]').addEventListener('click', async function() {
      menu.remove();
      var group = findGroupInState(groupId);
      if (group) {
        var url = 'https://github.com/' + group.owner + '/' + group.repo;
        window.open(url, '_blank');
      }
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', function() {
      menu.remove();
      showDeleteGroupModal(page, groupId, groupName);
    });

    setTimeout(function() {
      var closeHandler = function() { menu.remove(); document.removeEventListener('click', closeHandler); };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  function findGroupInState(groupId) {
    return null;
  }

  async function selectGroup(page, groupId) {
    currentGroupId = groupId;
    currentPath = '';
    selectedFiles = [];

    var items = page.querySelectorAll('#cloudGroupList .cloud-nav-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].dataset.group === groupId);
    }

    await loadFiles(page);
    loadStorageBar(page);
  }

  async function loadStorageBar(page) {
    if (!currentGroupId) return;
    var barEl = document.getElementById('cloudStorageBar');
    if (!barEl) return;

    try {
      var result = await window.electronAPI.cloudStorageInfo(currentGroupId);
      if (result.success && result.storage) {
        var s = result.storage;
        barEl.innerHTML = '<div class="cloud-storage-info">'
          + '<div class="cloud-storage-text">' + s.sizeFormatted + ' / ' + s.limitFormatted + '</div>'
          + '<div class="cloud-progress-bar"><div class="cloud-progress-fill" style="width:' + s.usagePercent + '%"></div></div>'
          + '</div>';
      }
    } catch (e) {}
  }

  async function loadFiles(page) {
    var mainArea = document.getElementById('cloudMainArea');
    if (!mainArea) return;

    mainArea.innerHTML = '<div class="cloud-toolbar">'
      + '<div class="cloud-breadcrumb" id="cloudBreadcrumb"></div>'
      + '<div class="cloud-toolbar-actions">'
      + '<div class="cloud-search-box">' + SVG.search + '<input type="text" id="cloudSearchInput" placeholder="搜索文件..."></div>'
      + settingsBtn('', SVG.upload + ' 上传', 'cloudUploadBtn')
      + settingsBtn('', SVG.newFolder + ' 新建文件夹', 'cloudNewFolderBtn')
      + settingsBtn('', SVG.refresh + ' 刷新', 'cloudRefreshBtn')
      + '<button class="cloud-view-toggle" id="cloudViewToggle" title="切换视图">' + SVG.grid + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="cloud-progress-area" id="cloudProgressArea"></div>'
      + '<div class="cloud-file-list ' + (viewMode === 'grid' ? 'grid-view' : '') + '" id="cloudFileList"></div>'
      + '<div class="cloud-drop-zone" id="cloudDropZone">'
      + '<p>拖拽文件到此处上传</p><p style="font-size:11px;opacity:0.6">或点击上方上传按钮选择文件</p>'
      + '</div>';

    renderBreadcrumb();

    document.getElementById('cloudUploadBtn').addEventListener('click', function() { showUploadMenu(page); });
    document.getElementById('cloudNewFolderBtn').addEventListener('click', function() { showNewFolderModal(page); });
    document.getElementById('cloudRefreshBtn').addEventListener('click', function() { loadFiles(page); });
    document.getElementById('cloudViewToggle').addEventListener('click', function() {
      viewMode = viewMode === 'list' ? 'grid' : 'list';
      this.innerHTML = viewMode === 'list' ? SVG.grid : SVG.list;
      var fl = document.getElementById('cloudFileList');
      if (fl) fl.classList.toggle('grid-view', viewMode === 'grid');
    });

    var searchInput = document.getElementById('cloudSearchInput');
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchQuery = this.value.trim();
      searchTimeout = setTimeout(function() {
        if (searchQuery) searchFiles(page, searchQuery);
        else loadFileList(page);
      }, 500);
    });

    var dropZone = document.getElementById('cloudDropZone');
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault(); dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) uploadFileList(page, e.dataTransfer.files);
    });

    setupProgressListeners();

    try {
      var result = await window.electronAPI.cloudListFiles(currentGroupId, currentPath);
      if (result.success) renderFileList(page, result.files);
      else document.getElementById('cloudFileList').innerHTML = '<div class="cloud-empty"><p>加载失败: ' + escHtml(result.error) + '</p></div>';
    } catch (e) {
      document.getElementById('cloudFileList').innerHTML = '<div class="cloud-empty"><p>加载失败</p></div>';
    }
  }

  function setupProgressListeners() {
    window.electronAPI.onCloudUploadProgress(function(p) {
      uploadProgress = p;
      renderProgress('upload', p);
    });
    window.electronAPI.onCloudDownloadProgress(function(p) {
      downloadProgress = p;
      renderProgress('download', p);
    });
  }

  function renderProgress(type, p) {
    var area = document.getElementById('cloudProgressArea');
    if (!area) return;
    if (!p || p.percent >= 100) {
      if (p && p.percent >= 100) {
        area.innerHTML = '<div class="cloud-progress-item ' + type + '">'
          + '<span>' + (type === 'upload' ? '上传' : '下载') + '完成</span>'
          + '</div>';
        setTimeout(function() { area.innerHTML = ''; }, 2000);
      }
      return;
    }
    area.innerHTML = '<div class="cloud-progress-item ' + type + '">'
      + '<span>' + (type === 'upload' ? '上传' : '下载') + '中...</span>'
      + '<span>' + p.percent + '%</span>'
      + '<div class="cloud-progress-bar"><div class="cloud-progress-fill" style="width:' + p.percent + '%"></div></div>'
      + '</div>';
  }

  function renderBreadcrumb() {
    var bc = document.getElementById('cloudBreadcrumb');
    if (!bc) return;
    var parts = currentPath ? currentPath.split('/') : [];
    var html = '<span data-path="">根目录</span>';
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      html += '<span class="sep">/</span>';
      var isCurrent = i === parts.length - 1;
      html += '<span data-path="' + parts.slice(0, i + 1).join('/') + '"' + (isCurrent ? ' class="current"' : '') + '>' + escHtml(parts[i]) + '</span>';
    }
    bc.innerHTML = html;
    var spans = bc.querySelectorAll('span[data-path]');
    for (var j = 0; j < spans.length; j++) {
      spans[j].addEventListener('click', (function(p, pg) {
        return function() { currentPath = p; loadFiles(pg); };
      })(spans[j].dataset.path, document.getElementById('cloudManagerPage')));
    }
  }

  async function searchFiles(page, query) {
    if (!currentGroupId || !query) return;
    var listEl = document.getElementById('cloudFileList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="cloud-empty"><p>搜索中...</p></div>';
    try {
      var result = await window.electronAPI.cloudSearchFiles(currentGroupId, query);
      if (result.success && result.results) {
        if (result.results.length === 0) {
          listEl.innerHTML = '<div class="cloud-empty"><h4>无搜索结果</h4><p>未找到匹配 "' + escHtml(query) + '" 的文件</p></div>';
        } else {
          var html = '';
          for (var i = 0; i < result.results.length; i++) {
            var f = result.results[i];
            html += '<div class="cloud-file-item" data-name="' + escHtml(f.name) + '" data-path="' + escHtml(f.path) + '">'
              + '<div class="cloud-file-icon file">' + SVG.file + '</div>'
              + '<div class="cloud-file-name">' + highlightMatch(escHtml(f.name), query) + '</div>'
              + '<div class="cloud-file-size" style="font-size:11px;color:var(--fg-2)">' + escHtml(f.path) + '</div>'
              + '</div>';
          }
          listEl.innerHTML = html;
        }
      }
    } catch (e) {
      listEl.innerHTML = '<div class="cloud-empty"><p>搜索失败</p></div>';
    }
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async function loadFileList(page) {
    try {
      var result = await window.electronAPI.cloudListFiles(currentGroupId, currentPath);
      if (result.success) renderFileList(page, result.files);
    } catch (e) {}
  }

  function renderFileList(page, files) {
    var listEl = document.getElementById('cloudFileList');
    if (!listEl) return;

    if (!files || files.length === 0) {
      listEl.innerHTML = '<div class="cloud-empty"><div class="cloud-empty-icon">' + SVG.folder + '</div>'
        + '<h4>空文件夹</h4><p>上传文件或创建文件夹开始使用</p></div>';
      return;
    }

    var dirs = [];
    var regularFiles = [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].name === '.gitkeep') continue;
      if (files[i].type === 'dir') dirs.push(files[i]);
      else regularFiles.push(files[i]);
    }
    var sorted = dirs.concat(regularFiles);

    if (viewMode === 'grid') {
      renderFileGrid(page, listEl, sorted);
    } else {
      renderFileListRows(page, listEl, sorted);
    }
  }

  function renderFileListRows(page, listEl, sorted) {
    var html = '<div class="cloud-file-header">'
      + '<div class="cloud-file-h-check"><input type="checkbox" id="cloudSelectAll"></div>'
      + '<div class="cloud-file-h-name">名称</div>'
      + '<div class="cloud-file-h-size">大小</div>'
      + '<div class="cloud-file-h-modified">修改时间</div>'
      + '<div class="cloud-file-h-actions"></div>'
      + '</div>';

    for (var j = 0; j < sorted.length; j++) {
      var f = sorted[j];
      var isDir = f.type === 'dir';
      var iconClass = isDir ? 'folder' : 'file';
      var isSelected = selectedFiles.indexOf(f.path) !== -1;
      html += '<div class="cloud-file-item' + (isSelected ? ' selected' : '') + '" data-type="' + f.type + '" data-name="' + escHtml(f.name) + '" data-path="' + escHtml(f.path) + '" data-sha="' + (f.sha || '') + '">'
        + '<div class="cloud-file-check"><input type="checkbox" class="cloud-file-cb" data-path="' + escHtml(f.path) + '"' + (isSelected ? ' checked' : '') + '></div>'
        + '<div class="cloud-file-icon ' + iconClass + '">' + getFileIconSvg(f.name, f.type) + '</div>'
        + '<div class="cloud-file-name">' + escHtml(f.name) + '</div>'
        + '<div class="cloud-file-size">' + (isDir ? '' : formatSize(f.size)) + '</div>'
        + '<div class="cloud-file-modified">' + formatDate(f.modified) + '</div>'
        + '<div class="cloud-file-actions">'
        + (isDir ? '' : '<button class="cloud-file-action" data-action="preview" title="预览">' + SVG.eye + '</button>')
        + (isDir ? '' : '<button class="cloud-file-action" data-action="download" title="下载">' + SVG.download + '</button>')
        + (isDir ? '' : '<button class="cloud-file-action" data-action="share" title="分享">' + SVG.share + '</button>')
        + '<button class="cloud-file-action danger" data-action="delete" title="删除">' + SVG.trash + '</button>'
        + '</div>'
        + '</div>';
    }
    listEl.innerHTML = html;

    document.getElementById('cloudSelectAll').addEventListener('change', function() {
      var checked = this.checked;
      var cbs = listEl.querySelectorAll('.cloud-file-cb');
      selectedFiles = [];
      for (var c = 0; c < cbs.length; c++) {
        cbs[c].checked = checked;
        if (checked) selectedFiles.push(cbs[c].dataset.path);
      }
      var items = listEl.querySelectorAll('.cloud-file-item');
      for (var d = 0; d < items.length; d++) {
        items[d].classList.toggle('selected', checked);
      }
    });

    bindFileItemEvents(page, listEl);
  }

  function renderFileGrid(page, listEl, sorted) {
    var html = '';
    for (var j = 0; j < sorted.length; j++) {
      var f = sorted[j];
      var isDir = f.type === 'dir';
      var iconClass = isDir ? 'folder' : 'file';
      html += '<div class="cloud-grid-item" data-type="' + f.type + '" data-name="' + escHtml(f.name) + '" data-path="' + escHtml(f.path) + '" data-sha="' + (f.sha || '') + '">'
        + '<div class="cloud-grid-icon ' + iconClass + '">' + getFileIconSvg(f.name, f.type) + '</div>'
        + '<div class="cloud-grid-name">' + escHtml(f.name) + '</div>'
        + '<div class="cloud-grid-size">' + (isDir ? '' : formatSize(f.size)) + '</div>'
        + '</div>';
    }
    listEl.innerHTML = html;

    var items = listEl.querySelectorAll('.cloud-grid-item');
    for (var k = 0; k < items.length; k++) {
      (function(item) {
        item.addEventListener('dblclick', function() {
          if (item.dataset.type === 'dir') {
            currentPath = item.dataset.path;
            loadFiles(page);
          } else {
            previewFile(page, item.dataset.path, item.dataset.name);
          }
        });
        item.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showFileContextMenu(page, item.dataset.path, item.dataset.name, item.dataset.type, e);
        });
      })(items[k]);
    }
  }

  function bindFileItemEvents(page, listEl) {
    var items = listEl.querySelectorAll('.cloud-file-item');
    for (var k = 0; k < items.length; k++) {
      (function(item) {
        item.addEventListener('click', function(e) {
          if (e.target.closest('[data-action]') || e.target.closest('.cloud-file-cb')) return;
          if (item.dataset.type === 'dir') {
            currentPath = item.dataset.path;
            loadFiles(page);
          } else {
            previewFile(page, item.dataset.path, item.dataset.name);
          }
        });

        var cb = item.querySelector('.cloud-file-cb');
        if (cb) {
          cb.addEventListener('change', function(e) {
            e.stopPropagation();
            var p = this.dataset.path;
            if (this.checked) {
              if (selectedFiles.indexOf(p) === -1) selectedFiles.push(p);
              item.classList.add('selected');
            } else {
              selectedFiles = selectedFiles.filter(function(s) { return s !== p; });
              item.classList.remove('selected');
            }
          });
        }

        item.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showFileContextMenu(page, item.dataset.path, item.dataset.name, item.dataset.type, e);
        });

        var actionBtns = item.querySelectorAll('[data-action]');
        for (var a = 0; a < actionBtns.length; a++) {
          actionBtns[a].addEventListener('click', (function(action, filePath, fileName) {
            return function(e) {
              e.stopPropagation();
              if (action === 'download') downloadCloudFile(filePath, fileName);
              else if (action === 'share') shareCloudFile(filePath);
              else if (action === 'delete') showDeleteConfirmModal(page, filePath, fileName);
              else if (action === 'preview') previewFile(page, filePath, fileName);
            };
          })(actionBtns[a].dataset.action, item.dataset.path, item.dataset.name));
        }
      })(items[k]);
    }
  }

  function showFileContextMenu(page, filePath, fileName, fileType, event) {
    var existing = document.querySelector('.cloud-context-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'cloud-context-menu';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - 200) + 'px';

    var items = '';
    if (fileType !== 'dir') {
      items += '<div class="cloud-context-item" data-action="preview">' + SVG.eye + ' 预览</div>';
      items += '<div class="cloud-context-item" data-action="download">' + SVG.download + ' 下载</div>';
      items += '<div class="cloud-context-item" data-action="share">' + SVG.share + ' 分享链接</div>';
    }
    items += '<div class="cloud-context-item danger" data-action="delete">' + SVG.trash + ' 删除</div>';
    menu.innerHTML = items;
    document.body.appendChild(menu);

    var actions = {
      preview: function() { previewFile(page, filePath, fileName); },
      download: function() { downloadCloudFile(filePath, fileName); },
      share: function() { shareCloudFile(filePath); },
      delete: function() { showDeleteConfirmModal(page, filePath, fileName); }
    };

    menu.querySelectorAll('.cloud-context-item').forEach(function(el) {
      el.addEventListener('click', function() {
        menu.remove();
        var action = this.dataset.action;
        if (actions[action]) actions[action]();
      });
    });

    setTimeout(function() {
      var closeHandler = function() { menu.remove(); document.removeEventListener('click', closeHandler); };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  function showUploadMenu(page) {
    var existing = document.querySelector('.cloud-context-menu');
    if (existing) existing.remove();

    var btn = document.getElementById('cloudUploadBtn');
    var rect = btn.getBoundingClientRect();

    var menu = document.createElement('div');
    menu.className = 'cloud-context-menu';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.innerHTML = '<div class="cloud-context-item" data-action="file">' + SVG.file + ' 选择文件</div>'
      + '<div class="cloud-context-item" data-action="folder">' + SVG.folder + ' 选择文件夹</div>'
      + '<div class="cloud-context-item" data-action="release">' + SVG.upload + ' 大文件上传（更快）</div>';
    document.body.appendChild(menu);

    menu.querySelector('[data-action="file"]').addEventListener('click', function() {
      menu.remove();
      uploadFiles(page, 'file');
    });
    menu.querySelector('[data-action="folder"]').addEventListener('click', function() {
      menu.remove();
      uploadFiles(page, 'folder');
    });
    menu.querySelector('[data-action="release"]').addEventListener('click', function() {
      menu.remove();
      uploadFiles(page, 'release');
    });

    setTimeout(function() {
      var closeHandler = function() { menu.remove(); document.removeEventListener('click', closeHandler); };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  async function uploadFiles(page, type) {
    var result;
    if (type === 'file') {
      result = await window.electronAPI.cloudSelectFile();
    } else {
      result = await window.electronAPI.cloudSelectFolder();
    }
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) return;

    var mode = type === 'release' ? 'release' : 'auto';
    for (var i = 0; i < result.filePaths.length; i++) {
      var uploadResult = await window.electronAPI.cloudUpload(currentGroupId, result.filePaths[i], currentPath, mode);
      if (uploadResult.success) {
        window.FBrowser.notify.success('上传成功: ' + uploadResult.path);
      } else {
        window.FBrowser.notify.error('上传失败: ' + uploadResult.error);
      }
    }
    loadFiles(page);
    loadStorageBar(page);
  }

  function uploadFileList(page, files) {
    (async function() {
      for (var i = 0; i < files.length; i++) {
        var uploadResult = await window.electronAPI.cloudUpload(currentGroupId, files[i].path, currentPath, 'auto');
        if (uploadResult.success) window.FBrowser.notify.success('上传成功: ' + uploadResult.path);
        else window.FBrowser.notify.error('上传失败: ' + uploadResult.error);
      }
      loadFiles(page);
      loadStorageBar(page);
    })();
  }

  async function downloadCloudFile(filePath, fileName) {
    var result = await window.electronAPI.cloudSelectFolder();
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) return;
    var localPath = result.filePaths[0] + '/' + fileName;
    window.FBrowser.notify.info('开始下载: ' + fileName);
    var downloadResult = await window.electronAPI.cloudDownload(currentGroupId, filePath, localPath);
    if (downloadResult.success) window.FBrowser.notify.success('下载完成: ' + fileName);
    else window.FBrowser.notify.error('下载失败: ' + downloadResult.error);
  }

  async function shareCloudFile(filePath) {
    var result = await window.electronAPI.cloudShareFile(currentGroupId, filePath);
    if (result.success) {
      try { await navigator.clipboard.writeText(result.url); } catch(e) {}
      window.FBrowser.notify.success('分享链接已复制: ' + result.url);
    } else {
      window.FBrowser.notify.error('分享失败: ' + result.error);
    }
  }

  async function previewFile(page, filePath, fileName) {
    var fileType = getFileType(fileName);

    if (fileType === 'text' || fileType === 'markdown') {
      window.FBrowser.notify.info('加载预览...');
      var contentResult = await window.electronAPI.cloudFileContent(currentGroupId, filePath);
      if (contentResult.success) {
        showTextPreview(page, fileName, contentResult.content, fileType);
      } else {
        window.FBrowser.notify.error('预览失败: ' + contentResult.error);
      }
      return;
    }

    var previewResult = await window.electronAPI.cloudPreviewUrl(currentGroupId, filePath);
    if (!previewResult.success) {
      window.FBrowser.notify.error('预览失败: ' + previewResult.error);
      return;
    }

    if (fileType === 'image') showImagePreview(page, fileName, previewResult.url);
    else if (fileType === 'audio') showMediaPreview(page, fileName, previewResult.url, 'audio');
    else if (fileType === 'video') showMediaPreview(page, fileName, previewResult.url, 'video');
    else showOtherPreview(page, fileName, filePath);
  }

  function showImagePreview(page, fileName, url) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay cloud-preview-overlay';
    overlay.innerHTML = '<div class="cloud-preview-modal">'
      + '<div class="cloud-preview-header">'
      + '<span class="cloud-preview-title">' + escHtml(fileName) + '</span>'
      + '<div class="cloud-preview-actions">'
      + '<button class="cloud-file-action" id="cloudPreviewDownload" title="下载">' + SVG.download + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewShare" title="分享">' + SVG.share + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewClose" title="关闭">' + SVG.close + '</button>'
      + '</div></div>'
      + '<div class="cloud-preview-body">'
      + '<img class="cloud-preview-img" src="' + escHtml(url) + '" alt="' + escHtml(fileName) + '">'
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.getElementById('cloudPreviewClose').addEventListener('click', close);
    document.getElementById('cloudPreviewDownload').addEventListener('click', function() { downloadCloudFile(currentPath ? currentPath + '/' + fileName : fileName, fileName); });
    document.getElementById('cloudPreviewShare').addEventListener('click', function() { shareCloudFile(currentPath ? currentPath + '/' + fileName : fileName); });
  }

  function showTextPreview(page, fileName, content, fileType) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay cloud-preview-overlay';
    var rendered = escHtml(content);
    if (fileType === 'markdown') {
      rendered = simpleMarkdown(content);
    }
    overlay.innerHTML = '<div class="cloud-preview-modal">'
      + '<div class="cloud-preview-header">'
      + '<span class="cloud-preview-title">' + escHtml(fileName) + '</span>'
      + '<div class="cloud-preview-actions">'
      + '<button class="cloud-file-action" id="cloudPreviewDownload" title="下载">' + SVG.download + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewShare" title="分享">' + SVG.share + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewClose" title="关闭">' + SVG.close + '</button>'
      + '</div></div>'
      + '<div class="cloud-preview-body">'
      + (fileType === 'markdown' ? '<div class="cloud-preview-md">' + rendered + '</div>' : '<pre class="cloud-preview-code">' + rendered + '</pre>')
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.getElementById('cloudPreviewClose').addEventListener('click', close);
    document.getElementById('cloudPreviewDownload').addEventListener('click', function() { downloadCloudFile(currentPath ? currentPath + '/' + fileName : fileName, fileName); });
    document.getElementById('cloudPreviewShare').addEventListener('click', function() { shareCloudFile(currentPath ? currentPath + '/' + fileName : fileName); });
  }

  function simpleMarkdown(text) {
    var html = escHtml(text);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function showMediaPreview(page, fileName, url, mediaType) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay cloud-preview-overlay';
    var mediaEl = mediaType === 'audio'
      ? '<audio class="cloud-preview-audio" controls src="' + escHtml(url) + '"></audio>'
      : '<video class="cloud-preview-video" controls src="' + escHtml(url) + '"></video>';
    overlay.innerHTML = '<div class="cloud-preview-modal">'
      + '<div class="cloud-preview-header">'
      + '<span class="cloud-preview-title">' + escHtml(fileName) + '</span>'
      + '<div class="cloud-preview-actions">'
      + '<button class="cloud-file-action" id="cloudPreviewDownload" title="下载">' + SVG.download + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewShare" title="分享">' + SVG.share + '</button>'
      + '<button class="cloud-file-action" id="cloudPreviewClose" title="关闭">' + SVG.close + '</button>'
      + '</div></div>'
      + '<div class="cloud-preview-body">' + mediaEl + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.getElementById('cloudPreviewClose').addEventListener('click', close);
    document.getElementById('cloudPreviewDownload').addEventListener('click', function() { downloadCloudFile(currentPath ? currentPath + '/' + fileName : fileName, fileName); });
    document.getElementById('cloudPreviewShare').addEventListener('click', function() { shareCloudFile(currentPath ? currentPath + '/' + fileName : fileName); });
  }

  function showOtherPreview(page, fileName, filePath) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay cloud-preview-overlay';
    overlay.innerHTML = '<div class="cloud-preview-modal" style="max-width:360px">'
      + '<div class="cloud-preview-header">'
      + '<span class="cloud-preview-title">' + escHtml(fileName) + '</span>'
      + '<div class="cloud-preview-actions">'
      + '<button class="cloud-file-action" id="cloudPreviewClose" title="关闭">' + SVG.close + '</button>'
      + '</div></div>'
      + '<div class="cloud-preview-body" style="text-align:center;padding:40px">'
      + '<div style="opacity:0.3;margin-bottom:12px">' + SVG.file + '</div>'
      + '<p style="color:var(--fg-2);margin:0 0 16px">此文件类型不支持预览</p>'
      + '<div style="display:flex;gap:8px;justify-content:center">'
      + settingsBtn('', SVG.download + ' 下载', 'cloudPreviewDownload')
      + settingsBtn('', SVG.share + ' 分享', 'cloudPreviewShare')
      + '</div></div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.getElementById('cloudPreviewClose').addEventListener('click', close);
    document.getElementById('cloudPreviewDownload').addEventListener('click', function() { downloadCloudFile(filePath, fileName); });
    document.getElementById('cloudPreviewShare').addEventListener('click', function() { shareCloudFile(filePath); });
  }

  function showDeleteConfirmModal(page, filePath, fileName) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay';
    overlay.innerHTML = '<div class="cloud-modal">'
      + '<div class="cloud-modal-header"><h3>确认删除</h3>'
      + '<button class="cloud-modal-close" id="cloudDelClose">&times;</button></div>'
      + '<div class="cloud-modal-body">'
      + '<div class="cloud-confirm-body">确定要删除 <span class="cloud-confirm-name">' + escHtml(fileName) + '</span> 吗？此操作不可撤销。</div>'
      + '</div>'
      + '<div class="cloud-modal-footer">'
      + settingsBtn('', '取消', 'cloudDelCancel')
      + settingsBtn('danger', '删除', 'cloudDelConfirm')
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    document.getElementById('cloudDelClose').addEventListener('click', close);
    document.getElementById('cloudDelCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

    document.getElementById('cloudDelConfirm').addEventListener('click', async function() {
      var result = await window.electronAPI.cloudDeleteFile(currentGroupId, filePath);
      if (result.success) { window.FBrowser.notify.success('已删除: ' + fileName); close(); loadFiles(page); loadStorageBar(page); }
      else window.FBrowser.notify.error('删除失败: ' + result.error);
    });
  }

  function showDeleteGroupModal(page, groupId, groupName) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay';
    overlay.innerHTML = '<div class="cloud-modal">'
      + '<div class="cloud-modal-header"><h3>删除空间</h3>'
      + '<button class="cloud-modal-close" id="cloudDgClose">&times;</button></div>'
      + '<div class="cloud-modal-body">'
      + '<div class="cloud-confirm-body">确定要删除空间 <span class="cloud-confirm-name">' + escHtml(groupName) + '</span> 吗？</div>'
      + '<div class="cloud-form-group" style="margin-top:12px">'
      + '<label class="cloud-form-checkbox"><input type="checkbox" id="cloudDgDeleteRepo"> 同时删除云端存储</label>'
      + '</div></div>'
      + '<div class="cloud-modal-footer">'
      + settingsBtn('', '取消', 'cloudDgCancel')
      + settingsBtn('danger', '删除', 'cloudDgConfirm')
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    document.getElementById('cloudDgClose').addEventListener('click', close);
    document.getElementById('cloudDgCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

    document.getElementById('cloudDgConfirm').addEventListener('click', async function() {
      var deleteRepo = document.getElementById('cloudDgDeleteRepo').checked;
      var result = await window.electronAPI.cloudDeleteGroup(groupId, deleteRepo);
      if (result.success) { window.FBrowser.notify.success('空间已删除'); close(); if (currentGroupId === groupId) currentGroupId = null; renderMainPage(page); }
      else window.FBrowser.notify.error('删除失败: ' + result.error);
    });
  }

  function showNewFolderModal(page) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay';
    overlay.innerHTML = '<div class="cloud-modal">'
      + '<div class="cloud-modal-header"><h3>新建文件夹</h3>'
      + '<button class="cloud-modal-close" id="cloudNfClose">&times;</button></div>'
      + '<div class="cloud-modal-body">'
      + '<div class="cloud-form-group"><label class="cloud-form-label">文件夹名称</label>'
      + '<input type="text" class="cloud-form-input" id="cloudNfNameInput" placeholder="输入文件夹名称"></div>'
      + '</div>'
      + '<div class="cloud-modal-footer">'
      + settingsBtn('', '取消', 'cloudNfCancel')
      + settingsBtn('primary', '创建', 'cloudNfCreate')
      + '</div></div>';
    document.body.appendChild(overlay);

    var nameInput = document.getElementById('cloudNfNameInput');
    nameInput.focus();
    var close = function() { overlay.remove(); };
    document.getElementById('cloudNfClose').addEventListener('click', close);
    document.getElementById('cloudNfCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('cloudNfCreate').click(); });

    document.getElementById('cloudNfCreate').addEventListener('click', async function() {
      var name = nameInput.value.trim();
      if (!name) { window.FBrowser.notify.warning('请输入文件夹名称'); return; }
      var result = await window.electronAPI.cloudCreateFolder(currentGroupId, currentPath ? currentPath + '/' + name : name);
      if (result.success) { window.FBrowser.notify.success('文件夹已创建'); close(); loadFiles(page); }
      else window.FBrowser.notify.error('创建失败: ' + result.error);
    });
  }

  function showCreateGroupModal(page) {
    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay';
    overlay.innerHTML = '<div class="cloud-modal">'
      + '<div class="cloud-modal-header"><h3>新建空间</h3>'
      + '<button class="cloud-modal-close" id="cloudCgClose">&times;</button></div>'
      + '<div class="cloud-modal-body">'
      + '<div class="cloud-form-group"><label class="cloud-form-label">空间名称</label>'
      + '<input type="text" class="cloud-form-input" id="cloudCgNameInput" placeholder="如: 文档、图片、项目"></div>'
      + '<div class="cloud-form-group"><label class="cloud-form-checkbox">'
      + '<input type="checkbox" id="cloudCgNewRepo"> 创建独立存储空间（否则共用默认空间）</label></div>'
      + '</div>'
      + '<div class="cloud-modal-footer">'
      + settingsBtn('', '取消', 'cloudCgCancel')
      + settingsBtn('primary', '创建', 'cloudCgCreate')
      + '</div></div>';
    document.body.appendChild(overlay);

    var nameInput = document.getElementById('cloudCgNameInput');
    nameInput.focus();
    var close = function() { overlay.remove(); };
    document.getElementById('cloudCgClose').addEventListener('click', close);
    document.getElementById('cloudCgCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('cloudCgCreate').click(); });

    document.getElementById('cloudCgCreate').addEventListener('click', async function() {
      var name = nameInput.value.trim();
      if (!name) { window.FBrowser.notify.warning('请输入空间名称'); return; }
      var useNewRepo = document.getElementById('cloudCgNewRepo').checked;
      this.textContent = '创建中...'; this.disabled = true;
      var result = await window.electronAPI.cloudCreateGroup(name, useNewRepo);
      if (result.success) { window.FBrowser.notify.success('空间已创建: ' + name); overlay.remove(); renderMainPage(page); }
      else { window.FBrowser.notify.error('创建失败: ' + result.error); this.textContent = '创建'; this.disabled = false; }
    });
  }

  async function showAddSyncModal(page) {
    var groupsResult = await window.electronAPI.cloudListGroups();
    var groups = (groupsResult && groupsResult.groups) || [];

    var overlay = document.createElement('div');
    overlay.className = 'cloud-modal-overlay';
    var groupOptions = '';
    for (var i = 0; i < groups.length; i++) {
      groupOptions += '<option value="' + groups[i].id + '">' + escHtml(groups[i].name) + '</option>';
    }

    overlay.innerHTML = '<div class="cloud-modal">'
      + '<div class="cloud-modal-header"><h3>添加文件夹同步</h3>'
      + '<button class="cloud-modal-close" id="cloudSyncClose">&times;</button></div>'
      + '<div class="cloud-modal-body">'
      + '<div class="cloud-form-group"><label class="cloud-form-label">选择空间</label>'
      + '<select class="cloud-form-select" id="cloudSyncGroupSelect">' + (groupOptions || '<option>请先创建空间</option>') + '</select></div>'
      + '<div class="cloud-form-group"><label class="cloud-form-label">本地文件夹</label>'
      + '<div class="cloud-form-row">'
      + '<input type="text" class="cloud-form-input" id="cloudSyncPathInput" placeholder="选择本地文件夹" readonly style="flex:1">'
      + settingsBtn('', SVG.browse + ' 浏览', 'cloudSyncBrowseBtn')
      + '</div></div></div>'
      + '<div class="cloud-modal-footer">'
      + settingsBtn('', '取消', 'cloudSyncCancel')
      + settingsBtn('primary', '添加', 'cloudSyncAdd')
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function() { overlay.remove(); };
    document.getElementById('cloudSyncClose').addEventListener('click', close);
    document.getElementById('cloudSyncCancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

    document.getElementById('cloudSyncBrowseBtn').addEventListener('click', async function() {
      var result = await window.electronAPI.cloudSelectFolder();
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        document.getElementById('cloudSyncPathInput').value = result.filePaths[0];
      }
    });
    document.getElementById('cloudSyncAdd').addEventListener('click', async function() {
      var groupId = document.getElementById('cloudSyncGroupSelect').value;
      var localPath = document.getElementById('cloudSyncPathInput').value;
      if (!localPath) { window.FBrowser.notify.warning('请选择文件夹'); return; }
      var result = await window.electronAPI.cloudAddSyncFolder(groupId, localPath);
      if (result.success) { window.FBrowser.notify.success('同步已添加'); overlay.remove(); loadSyncList(page); }
      else window.FBrowser.notify.error('添加失败');
    });
  }

  async function loadSyncList(page) {
    var listEl = document.getElementById('cloudSyncList');
    if (!listEl) return;

    try {
      var result = await window.electronAPI.cloudSyncStatus();
      var syncFolders = result.syncFolders || [];

      if (syncFolders.length === 0) {
        listEl.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--fg-2)">暂无同步</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < syncFolders.length; i++) {
        var s = syncFolders[i];
        var lastSync = s.lastSync ? new Date(s.lastSync).toLocaleString() : '未同步';
        html += '<div class="cloud-sync-item">'
          + '<div class="cloud-sync-info">'
          + '<div class="cloud-sync-path">' + escHtml(s.localPath) + '</div>'
          + '<div class="cloud-sync-meta">' + lastSync + '</div>'
          + '</div>'
          + settingsBtn('', SVG.sync + ' 同步', 'cloudSyncRun' + i)
          + '<button class="cloud-file-action danger" id="cloudSyncDel' + i + '" title="移除">' + SVG.trash + '</button>'
          + '</div>';
      }
      listEl.innerHTML = html;

      for (var j = 0; j < syncFolders.length; j++) {
        (function(sid, runId, delId) {
          var runBtn = document.getElementById(runId);
          if (runBtn) {
            runBtn.addEventListener('click', async function() {
              window.FBrowser.notify.info('开始同步...');
              var result = await window.electronAPI.cloudSyncStart(sid);
              if (result.success) {
                window.FBrowser.notify.success('同步完成: 上传 ' + result.uploaded + ' 个, 下载 ' + result.downloaded + ' 个');
                loadSyncList(page);
              } else {
                window.FBrowser.notify.error('同步失败: ' + result.error);
              }
            });
          }
          var delBtn = document.getElementById(delId);
          if (delBtn) {
            delBtn.addEventListener('click', async function() {
              await window.electronAPI.cloudRemoveSyncFolder(sid);
              loadSyncList(page);
            });
          }
        })(syncFolders[j].id, 'cloudSyncRun' + j, 'cloudSyncDel' + j);
      }
    } catch (e) {
      listEl.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--fg-2)">加载失败</div>';
    }
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.cloud = {
    open: function() { createCloudPage(); },
    init: function() {
      checkAuth().then(function() { renderSidebarPanel(); });
      var expandBtn = document.getElementById('btnCloudExpand');
      if (expandBtn) expandBtn.addEventListener('click', function() { openCloudPage(); });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.FBrowser.cloud.init(); });
  } else {
    window.FBrowser.cloud.init();
  }
})();
