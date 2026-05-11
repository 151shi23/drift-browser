// ==================== 设置页面 ====================
(function() {
  'use strict';

  const { config, saveConfig, applyTheme } = window.FBrowser.config;
  const homePageEl = document.getElementById('homePage');
  const homePageCyberEl = document.getElementById('homePageCyber');
  const webviewHostEl = document.getElementById('webviewHost');
  const settingsPageEl = document.getElementById('settingsPage');

  // 当前激活的设置分区
  let activeSection = 'appearance';

  function openSettings() {
    const tabs = window.FBrowser.tabs;

    const existingSettingsTab = tabs.tabs.find(t => t.isSettings);
    if (existingSettingsTab) {
      tabs.switchTab(existingSettingsTab.id);
      return;
    }

    tabs.createTab('f://settings');
  }

  function showSettingsContent() {
    homePageEl.classList.remove('active', 'exiting');
    if (homePageCyberEl) homePageCyberEl.classList.remove('active', 'exiting');
    webviewHostEl.classList.remove('active');
    settingsPageEl.classList.add('active');
    syncSettingsPage();
    renderSettingsSites();
    try { window.FBrowser.extensions.renderExtensions(); } catch(e) { console.error('渲染扩展列表失败:', e); }
    switchSettingsSection('appearance');
  }

  // 切换设置分区
  function switchSettingsSection(sectionId) {
    activeSection = sectionId;

    // 更新导航菜单激活状态
    document.querySelectorAll('.settings-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // 更新内容区显示
    document.querySelectorAll('.settings-content-section').forEach(section => {
      section.classList.toggle('active', section.id === 'section-' + sectionId);
    });
  }

  function syncSettingsPage() {
    document.querySelectorAll('#themeToggle .toggle-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.value === config.theme);
    });
    document.querySelectorAll('#engineToggle .toggle-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.value === config.engine);
    });
    document.querySelectorAll('#homeStyleToggle .toggle-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.value === config.homeStyle);
    });
  }

  // 主题切换
  document.querySelectorAll('#themeToggle .toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      config.theme = btn.dataset.value;
      applyTheme(config.theme);
      document.getElementById('settingTheme').value = config.theme;
      syncSettingsPage();
      saveConfig();
    });
  });

  // 引擎切换
  document.querySelectorAll('#engineToggle .toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      config.engine = btn.dataset.value;
      document.getElementById('settingEngine').value = config.engine;
      window.FBrowser.search.updateEngineLabel();
      syncSettingsPage();
      saveConfig();
    });
  });

  // 主页风格切换
  document.querySelectorAll('#homeStyleToggle .toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      config.homeStyle = btn.dataset.value;
      syncSettingsPage();
      saveConfig();
      // 如果当前在主页，实时切换
      const homePageEl = document.getElementById('homePage');
      const homePageCyberEl = document.getElementById('homePageCyber');
      if (homePageEl?.classList.contains('active') || homePageCyberEl?.classList.contains('active')) {
        window.FBrowser.homeGrid.applyHomeStyle(config.homeStyle);
      }
    });
  });

  // 站点管理
  function renderSettingsSites() {
    const container = document.getElementById('settingsSites');
    if (!container) return;
    const sites = window.FBrowser.data.getSites();
    container.innerHTML = '';
    sites.forEach((site, i) => {
      const el = document.createElement('div');
      el.className = 'settings-site-item';
      const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(site.color) ? site.color : '#555';
      el.innerHTML = `
        <div class="settings-site-dot" style="background:${safeColor}">${window.FBrowser.data.escHtml(site.name[0])}</div>
        <div class="settings-site-info">
          <div class="settings-site-name">${window.FBrowser.data.escHtml(site.name)}</div>
          <div class="settings-site-url">${window.FBrowser.data.escHtml(site.url)}</div>
        </div>
        <span class="settings-site-del" data-idx="${i}"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.3"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.3"/></svg></span>
      `;
      el.querySelector('.settings-site-del').addEventListener('click', () => {
        window.FBrowser.data.removeSite(i);
        window.FBrowser.homeGrid.renderHomeGrid();
        renderSettingsSites();
      });
      container.appendChild(el);
    });
  }

  // 添加站点
  const btnAddSite = document.getElementById('btnAddSite');
  if (btnAddSite) {
    btnAddSite.addEventListener('click', () => {
      const nameEl = document.getElementById('addSiteName');
      const urlEl = document.getElementById('addSiteUrl');
      const colorEl = document.getElementById('addSiteColor');
      if (!nameEl || !urlEl) return;
      const name = nameEl.value.trim();
      const url = urlEl.value.trim();
      const color = colorEl ? colorEl.value.trim() : '';
      if (!name || !url) return;
      window.FBrowser.data.addSite(name, url, color);
      try { window.FBrowser.homeGrid.renderHomeGrid(); } catch(e) {}
      renderSettingsSites();
      nameEl.value = '';
      urlEl.value = '';
      if (colorEl) colorEl.value = '';
    });
  }

  // 隐私：清除数据
  const btnClearAll = document.getElementById('btnClearAll');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('确定要清除所有浏览数据吗？此操作不可撤销。')) {
        window.FBrowser.data.clearBookmarks();
        window.FBrowser.data.clearHistoryData();
        try { window.FBrowser.bookmarks.renderBookmarks(); } catch(e) {}
        try { window.FBrowser.history.renderHistory(); } catch(e) {}
        try { window.FBrowser.bookmarks.updateBookmarkBtn(); } catch(e) {}
        // 同步清除服务端会话文件，防止重启后恢复旧会话
        try { window.electronAPI.sessionSave([]); } catch(e) {}
      }
    });
  }
  const btnClearHistS = document.getElementById('btnClearHistorySettings');
  if (btnClearHistS) {
    btnClearHistS.addEventListener('click', () => {
      window.FBrowser.data.clearHistoryData();
      try { window.FBrowser.history.renderHistory(); } catch(e) {}
    });
  }
  const btnClearBmS = document.getElementById('btnClearBookmarksSettings');
  if (btnClearBmS) {
    btnClearBmS.addEventListener('click', () => {
      window.FBrowser.data.clearBookmarks();
      try { window.FBrowser.bookmarks.renderBookmarks(); } catch(e) {}
      try { window.FBrowser.bookmarks.updateBookmarkBtn(); } catch(e) {}
    });
  }

  // 侧边栏设置 select 联动
  const settingThemeEl = document.getElementById('settingTheme');
  if (settingThemeEl) {
    settingThemeEl.addEventListener('change', () => {
      config.theme = settingThemeEl.value;
      applyTheme(config.theme);
      syncSettingsPage();
      saveConfig();
    });
  }

  // 下载路径设置
  const btnChooseDlPath = document.getElementById('btnChooseDownloadPath');
  const dlPathLabel = document.getElementById('downloadPathLabel');
  async function updateDownloadPathLabel() {
    if (dlPathLabel) {
      try {
        const path = await window.electronAPI.downloadsGetPath();
        dlPathLabel.textContent = path || '默认下载目录';
        dlPathLabel.title = path || '';
      } catch(e) { dlPathLabel.textContent = '默认下载目录'; }
    }
  }
  if (btnChooseDlPath) {
    btnChooseDlPath.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.downloadsOpenDialog();
        if (result && typeof result === 'object' && !result.canceled) {
          const dir = result.filePaths?.[0];
          if (dir) {
            await window.electronAPI.downloadsSetPath(dir);
            updateDownloadPathLabel();
          }
        }
      } catch(e) { console.error('[Settings] 选择下载路径失败:', e); }
    });
  }
  updateDownloadPathLabel();

  // 绑定导航菜单点击事件
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) switchSettingsSection(section);
    });
  });

  // 项目介绍弹窗
  const aboutProjectEl = document.getElementById('aboutProject');
  const projectModalEl = document.getElementById('projectModal');
  const closeProjectModalEl = document.getElementById('closeProjectModal');

  if (aboutProjectEl && projectModalEl) {
    aboutProjectEl.addEventListener('click', () => {
      projectModalEl.classList.add('active');
    });

    if (closeProjectModalEl) {
      closeProjectModalEl.addEventListener('click', () => {
        projectModalEl.classList.remove('active');
      });
    }

    projectModalEl.addEventListener('click', (e) => {
      if (e.target === projectModalEl) {
        projectModalEl.classList.remove('active');
      }
    });
  }

  // ---- 系统设置 ----
  // 默认浏览器
  const btnSetDefaultBrowser = document.getElementById('btnSetDefaultBrowser');
  const defaultBrowserStatus = document.getElementById('defaultBrowserStatus');

  async function checkDefaultBrowser() {
    if (!defaultBrowserStatus) return;
    try {
      const isDefault = await window.electronAPI.isDefaultBrowser();
      if (isDefault) {
        defaultBrowserStatus.textContent = 'Drift 已是您的默认浏览器';
        defaultBrowserStatus.style.color = '#22c55e';
        if (btnSetDefaultBrowser) {
          btnSetDefaultBrowser.textContent = '已是默认浏览器';
          btnSetDefaultBrowser.disabled = true;
        }
      } else {
        defaultBrowserStatus.textContent = 'Drift 不是默认浏览器';
        defaultBrowserStatus.style.color = '';
      }
    } catch (e) {
      defaultBrowserStatus.textContent = '无法检查状态';
    }
  }

  if (btnSetDefaultBrowser) {
    btnSetDefaultBrowser.addEventListener('click', async () => {
      try {
        btnSetDefaultBrowser.disabled = true;
        btnSetDefaultBrowser.textContent = '正在设置...';
        const result = await window.electronAPI.setDefaultBrowser();
        if (result.success) {
          defaultBrowserStatus.textContent = result.message;
          defaultBrowserStatus.style.color = '#22c55e';
        } else {
          defaultBrowserStatus.textContent = result.message;
          defaultBrowserStatus.style.color = 'var(--red)';
        }
      } catch (e) {
        defaultBrowserStatus.textContent = '设置失败';
        defaultBrowserStatus.style.color = 'var(--red)';
      }
      setTimeout(() => {
        btnSetDefaultBrowser.disabled = false;
        btnSetDefaultBrowser.textContent = '设为默认浏览器';
        checkDefaultBrowser();
      }, 2000);
    });
  }

  // 启动时恢复会话开关
  const toggleRestoreSession = document.getElementById('toggleRestoreSession');
  if (toggleRestoreSession) {
    const restoreSession = config.restoreSession !== false;
    toggleRestoreSession.classList.toggle('active', restoreSession);
    toggleRestoreSession.addEventListener('click', () => {
      config.restoreSession = !toggleRestoreSession.classList.contains('active');
      toggleRestoreSession.classList.toggle('active');
      saveConfig();
    });
  }

  // 硬件加速开关
  const toggleHardwareAccel = document.getElementById('toggleHardwareAccel');
  if (toggleHardwareAccel) {
    const hwAccel = config.hardwareAcceleration !== false;
    toggleHardwareAccel.classList.toggle('active', hwAccel);
    toggleHardwareAccel.addEventListener('click', () => {
      config.hardwareAcceleration = !toggleHardwareAccel.classList.contains('active');
      toggleHardwareAccel.classList.toggle('active');
      saveConfig();
    });
  }

  // 系统托盘开关
  const toggleSystemTray = document.getElementById('toggleSystemTray');
  if (toggleSystemTray) {
    const trayEnabled = config.systemTray !== false;
    toggleSystemTray.classList.toggle('active', trayEnabled);
    toggleSystemTray.addEventListener('click', () => {
      config.systemTray = !toggleSystemTray.classList.contains('active');
      toggleSystemTray.classList.toggle('active');
      saveConfig();
      if (window.electronAPI && window.electronAPI.updateTrayStatus) {
        window.electronAPI.updateTrayStatus(config.systemTray);
      }
      window.FBrowser?.notify?.success(config.systemTray ? '系统托盘已开启' : '系统托盘已关闭');
    });
  }

  // 开屏动画开关
  var toggleWelcomeAnim = document.getElementById('toggleWelcomeAnim');
  if (toggleWelcomeAnim) {
    var welcomeAnimEnabled = config.welcomeAnimation !== false;
    toggleWelcomeAnim.classList.toggle('active', welcomeAnimEnabled);
    toggleWelcomeAnim.addEventListener('click', function() {
      config.welcomeAnimation = !toggleWelcomeAnim.classList.contains('active');
      toggleWelcomeAnim.classList.toggle('active');
      saveConfig();
      window.FBrowser && window.FBrowser.notify && window.FBrowser.notify.success(
        config.welcomeAnimation ? '开屏动画已开启' : '开屏动画已关闭'
      );
    });
  }

  // 重新体验教程按钮
  var btnReplayTutorial = document.getElementById('btnReplayTutorial');
  if (btnReplayTutorial) {
    btnReplayTutorial.addEventListener('click', function() {
      config.welcomeShown = false;
      config.welcomeTutorialDone = false;
      saveConfig();
      if (window.DriftWelcome) {
        window.DriftWelcome.init();
      } else {
        window.FBrowser && window.FBrowser.notify && window.FBrowser.notify.warning('欢迎页模块未加载，请重启浏览器后重试');
      }
    });
  }

  // 初始化检查默认浏览器状态
  checkDefaultBrowser();

  // 初始化性能模式设置
  function initPowerModeSettings() {
    if (!window.FBrowser?.powerMode?.config) {
      requestAnimationFrame(initPowerModeSettings);
      return;
    }
    
    const pmConfig = window.FBrowser.powerMode.config;

    // 总开关
    const togglePowerMode = document.getElementById('togglePowerMode');
    if (togglePowerMode) {
      togglePowerMode.classList.toggle('active', pmConfig.enabled);
      togglePowerMode.addEventListener('click', () => {
        if (pmConfig.enabled) {
          window.FBrowser.powerMode.disable();
        } else {
          window.FBrowser.powerMode.enable();
        }
        togglePowerMode.classList.toggle('active');
        syncPowerModeUI();
      });
    }

    // APG 自适应性能调控开关
    const toggleAPG = document.getElementById('toggleAPG');
    const apgStatusEl = document.getElementById('apgStatus');
    if (toggleAPG) {
      toggleAPG.classList.toggle('active', pmConfig.apgEnabled);
      if (apgStatusEl) apgStatusEl.style.display = pmConfig.apgEnabled ? 'block' : 'none';
      toggleAPG.addEventListener('click', () => {
        pmConfig.apgEnabled = !pmConfig.apgEnabled;
        if (pmConfig.apgEnabled) {
          window.FBrowser.powerMode.enableAPG();
          if (apgStatusEl) apgStatusEl.style.display = 'block';
        } else {
          window.FBrowser.powerMode.disableAPG();
          if (apgStatusEl) apgStatusEl.style.display = 'none';
        }
        toggleAPG.classList.toggle('active', pmConfig.apgEnabled);
      });
    }

    // 内存优化
    const toggleAutoFreeze = document.getElementById('toggleAutoFreeze');
    if (toggleAutoFreeze) {
      toggleAutoFreeze.classList.toggle('active', pmConfig.autoFreeze);
      toggleAutoFreeze.addEventListener('click', () => {
        pmConfig.autoFreeze = !toggleAutoFreeze.classList.contains('active');
        toggleAutoFreeze.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const freezeDelay = document.getElementById('freezeDelay');
    if (freezeDelay) {
      freezeDelay.value = pmConfig.freezeDelay;
      freezeDelay.addEventListener('change', () => {
        pmConfig.freezeDelay = parseInt(freezeDelay.value);
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const toggleFreezeOnBlur = document.getElementById('toggleFreezeOnBlur');
    if (toggleFreezeOnBlur) {
      toggleFreezeOnBlur.classList.toggle('active', pmConfig.freezeOnBlur);
      toggleFreezeOnBlur.addEventListener('click', () => {
        pmConfig.freezeOnBlur = !toggleFreezeOnBlur.classList.contains('active');
        toggleFreezeOnBlur.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const memoryThreshold = document.getElementById('memoryThreshold');
    if (memoryThreshold) {
      memoryThreshold.value = pmConfig.memoryThreshold;
      memoryThreshold.addEventListener('change', () => {
        pmConfig.memoryThreshold = parseInt(memoryThreshold.value);
        window.FBrowser.powerMode.saveConfig();
      });
    }

    // CPU 优化
    const toggleBackgroundThrottle = document.getElementById('toggleBackgroundThrottle');
    if (toggleBackgroundThrottle) {
      toggleBackgroundThrottle.classList.toggle('active', pmConfig.backgroundThrottle);
      toggleBackgroundThrottle.addEventListener('click', () => {
        pmConfig.backgroundThrottle = !toggleBackgroundThrottle.classList.contains('active');
        toggleBackgroundThrottle.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const toggleAnimationThrottle = document.getElementById('toggleAnimationThrottle');
    if (toggleAnimationThrottle) {
      toggleAnimationThrottle.classList.toggle('active', pmConfig.animationThrottle);
      toggleAnimationThrottle.addEventListener('click', () => {
        pmConfig.animationThrottle = !toggleAnimationThrottle.classList.contains('active');
        toggleAnimationThrottle.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const toggleTimerThrottle = document.getElementById('toggleTimerThrottle');
    if (toggleTimerThrottle) {
      toggleTimerThrottle.classList.toggle('active', pmConfig.timerThrottle);
      toggleTimerThrottle.addEventListener('click', () => {
        pmConfig.timerThrottle = !toggleTimerThrottle.classList.contains('active');
        toggleTimerThrottle.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    // 媒体优化
    const toggleHwVideoDecode = document.getElementById('toggleHwVideoDecode');
    if (toggleHwVideoDecode) {
      toggleHwVideoDecode.classList.toggle('active', pmConfig.hwVideoDecode);
      toggleHwVideoDecode.addEventListener('click', () => {
        pmConfig.hwVideoDecode = !toggleHwVideoDecode.classList.contains('active');
        toggleHwVideoDecode.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const togglePauseBackgroundVideo = document.getElementById('togglePauseBackgroundVideo');
    if (togglePauseBackgroundVideo) {
      togglePauseBackgroundVideo.classList.toggle('active', pmConfig.pauseBackgroundVideo);
      togglePauseBackgroundVideo.addEventListener('click', () => {
        pmConfig.pauseBackgroundVideo = !togglePauseBackgroundVideo.classList.contains('active');
        togglePauseBackgroundVideo.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const toggleMediaProtection = document.getElementById('toggleMediaProtection');
    if (toggleMediaProtection) {
      toggleMediaProtection.classList.toggle('active', pmConfig.mediaProtection);
      toggleMediaProtection.addEventListener('click', () => {
        pmConfig.mediaProtection = !toggleMediaProtection.classList.contains('active');
        toggleMediaProtection.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    // 缓存管理
    const cacheClearInterval = document.getElementById('cacheClearInterval');
    if (cacheClearInterval) {
      cacheClearInterval.value = pmConfig.cacheClearInterval;
      cacheClearInterval.addEventListener('change', () => {
        pmConfig.cacheClearInterval = parseInt(cacheClearInterval.value);
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const cacheSizeLimit = document.getElementById('cacheSizeLimit');
    if (cacheSizeLimit) {
      cacheSizeLimit.value = pmConfig.cacheSizeLimit;
      cacheSizeLimit.addEventListener('change', () => {
        pmConfig.cacheSizeLimit = parseInt(cacheSizeLimit.value);
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const toggleKeepCookies = document.getElementById('toggleKeepCookies');
    if (toggleKeepCookies) {
      toggleKeepCookies.classList.toggle('active', pmConfig.keepCookies);
      toggleKeepCookies.addEventListener('click', () => {
        pmConfig.keepCookies = !toggleKeepCookies.classList.contains('active');
        toggleKeepCookies.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }

    const btnClearCacheNow = document.getElementById('btnClearCacheNow');
    if (btnClearCacheNow) {
      btnClearCacheNow.addEventListener('click', async () => {
        // 防止重复点击
        if (btnClearCacheNow.disabled) return;
        
        btnClearCacheNow.disabled = true;
        btnClearCacheNow.textContent = '清理中...';
        
        try {
          const result = await window.electronAPI.clearCache({ keepCookies: pmConfig.keepCookies });
          
          if (result && result.success) {
            const clearedMB = result.clearedMB || 0;
            btnClearCacheNow.textContent = '已清理 ' + clearedMB + ' MB';
            
            // 使用统一通知系统
            if (window.FBrowser?.notify) {
              window.FBrowser.notify.success('缓存清理完成，已释放 ' + clearedMB + ' MB');
            }
            
            // 2秒后恢复按钮状态
            setTimeout(() => {
              btnClearCacheNow.textContent = '清理';
              btnClearCacheNow.disabled = false;
            }, 2000);
          } else {
            const errorMsg = result?.error || '未知错误';
            btnClearCacheNow.textContent = '清理失败';
            
            if (window.FBrowser?.notify) {
              window.FBrowser.notify.error('缓存清理失败: ' + errorMsg);
            }
            
            // 2秒后恢复按钮状态
            setTimeout(() => {
              btnClearCacheNow.textContent = '清理';
              btnClearCacheNow.disabled = false;
            }, 2000);
          }
        } catch (e) {
          console.error('[Settings] 缓存清理异常:', e);
          btnClearCacheNow.textContent = '清理失败';
          
          if (window.FBrowser?.notify) {
            window.FBrowser.notify.error('缓存清理异常: ' + (e.message || '未知异常'));
          }
          
          // 2秒后恢复按钮状态
          setTimeout(() => {
            btnClearCacheNow.textContent = '清理';
            btnClearCacheNow.disabled = false;
          }, 2000);
        }
      });
    }

    // 高级选项
    const toggleShowNotifications = document.getElementById('toggleShowNotifications');
    if (toggleShowNotifications) {
      toggleShowNotifications.classList.toggle('active', pmConfig.showNotifications);
      toggleShowNotifications.addEventListener('click', () => {
        pmConfig.showNotifications = !toggleShowNotifications.classList.contains('active');
        toggleShowNotifications.classList.toggle('active');
        window.FBrowser.powerMode.saveConfig();
      });
    }
  }

  function syncPowerModeUI() {
    const pmConfig = window.FBrowser?.powerMode?.config;
    if (!pmConfig) return;

    const toggles = {
      'togglePowerMode': pmConfig.enabled,
      'toggleAutoFreeze': pmConfig.autoFreeze,
      'toggleFreezeOnBlur': pmConfig.freezeOnBlur,
      'toggleBackgroundThrottle': pmConfig.backgroundThrottle,
      'toggleAnimationThrottle': pmConfig.animationThrottle,
      'toggleTimerThrottle': pmConfig.timerThrottle,
      'toggleHwVideoDecode': pmConfig.hwVideoDecode,
      'togglePauseBackgroundVideo': pmConfig.pauseBackgroundVideo,
      'toggleMediaProtection': pmConfig.mediaProtection,
      'toggleKeepCookies': pmConfig.keepCookies,
      'toggleShowNotifications': pmConfig.showNotifications
    };

    Object.keys(toggles).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.toggle('active', toggles[id]);
      }
    });

    var freezeDelay = document.getElementById('freezeDelay');
    if (freezeDelay) freezeDelay.value = pmConfig.freezeDelay;
    
    var memoryThreshold = document.getElementById('memoryThreshold');
    if (memoryThreshold) memoryThreshold.value = pmConfig.memoryThreshold;
    
    var cacheClearInterval = document.getElementById('cacheClearInterval');
    if (cacheClearInterval) cacheClearInterval.value = pmConfig.cacheClearInterval;
    
    var cacheSizeLimit = document.getElementById('cacheSizeLimit');
    if (cacheSizeLimit) cacheSizeLimit.value = pmConfig.cacheSizeLimit;
  }

  // 初始化性能模式设置
  initPowerModeSettings();

  // ---- 远程更新设置 ----
  (function initUpdaterSettings() {
    var aboutVersionEl = document.getElementById('aboutVersion');
    if (aboutVersionEl && window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(function(ver) {
        aboutVersionEl.textContent = '版本 ' + ver;
      }).catch(function() {
        aboutVersionEl.textContent = '版本 --';
      });
    }

    if (window.FBrowser && window.FBrowser.updater && window.FBrowser.updater.init) {
      window.FBrowser.updater.init();
    }

    var checkUpdateBtn = document.getElementById('checkUpdateBtn');
    var updateStatusText = document.getElementById('updateStatusText');
    if (checkUpdateBtn) {
      checkUpdateBtn.addEventListener('click', async function() {
        checkUpdateBtn.disabled = true;
        checkUpdateBtn.textContent = '检查中...';
        if (updateStatusText) updateStatusText.textContent = '正在检查更新...';

        var result = await window.FBrowser.updater.manualCheck();

        checkUpdateBtn.disabled = false;
        checkUpdateBtn.textContent = '检查更新';
        if (updateStatusText) {
          if (result && result.success && !result.hasUpdate) {
            updateStatusText.textContent = result.message || '当前已是最新版本';
          } else if (result && !result.success) {
            updateStatusText.textContent = result.error || '检查更新失败';
          } else if (result && result.hasUpdate) {
            updateStatusText.textContent = '发现新版本 v' + result.release.version;
          }
        }
      });
    }

    var autoCheckToggle = document.getElementById('autoCheckUpdateToggle');
    if (autoCheckToggle && window.electronAPI) {
      if (window.electronAPI.updaterGetAutoCheck) {
        window.electronAPI.updaterGetAutoCheck().then(function(enabled) {
          autoCheckToggle.checked = !!enabled;
        });
      }
      autoCheckToggle.addEventListener('change', function() {
        if (window.electronAPI && window.electronAPI.updaterSetAutoCheck) {
          window.electronAPI.updaterSetAutoCheck(autoCheckToggle.checked);
        }
      });
    }
  })();

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.settings = { openSettings, syncSettingsPage, renderSettingsSites, switchSettingsSection };
})();
