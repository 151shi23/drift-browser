// ==================== 扩展管理前端模块（Edge 风格） ====================
(function() {
  'use strict';

  const extListEl = document.getElementById('extList');
  const extImportResultEl = document.getElementById('extImportResult');
  const extToolbarEl = document.getElementById('extToolbar');
  const extMenuDropdownEl = document.getElementById('extMenuDropdown');
  const btnExtMenu = document.getElementById('btnExtMenu');

  let cachedExtensions = [];

  function escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  }

  // ---- 渲染工具栏扩展图标 ----
  function renderToolbarIcons() {
    if (!extToolbarEl) return;
    const enabledExts = cachedExtensions.filter(e => e.enabled);

    extToolbarEl.innerHTML = '';
    enabledExts.forEach(ext => {
      const btn = document.createElement('button');
      btn.className = 'ext-icon-btn';
      btn.title = ext.name;
      btn.dataset.extId = ext.id;

      if (ext.iconDataUrl) {
        const img = document.createElement('img');
        img.src = ext.iconDataUrl;
        img.alt = ext.name;
        img.onerror = () => { img.replaceWith(createFallbackIcon(ext.name)); };
        btn.appendChild(img);
      } else {
        btn.appendChild(createFallbackIcon(ext.name));
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeExtMenu();
        if (ext.popupPath) showExtPopup(ext, btn);
      });

      extToolbarEl.appendChild(btn);
    });

    if (btnExtMenu) {
      btnExtMenu.style.display = enabledExts.length > 0 ? '' : 'none';
    }
  }

  function createFallbackIcon(name) {
    const el = document.createElement('div');
    el.className = 'ext-icon-fallback';
    el.textContent = (name || '?')[0].toUpperCase();
    return el;
  }

  // ---- 扩展 Popup ----
  async function showExtPopup(ext, anchorBtn) {
    const rect = anchorBtn.getBoundingClientRect();
    const popupWidth = 360;
    const popupHeight = 480;

    let x = rect.left;
    let y = rect.bottom + 6;

    if (x + popupWidth > window.innerWidth) x = window.innerWidth - popupWidth - 8;
    if (y + popupHeight > window.innerHeight) y = rect.top - popupHeight - 6;

    const winBounds = await window.electronAPI.windowGetBounds();
    const screenX = Math.max(8, x) + (winBounds ? winBounds.x : 0);
    const screenY = Math.max(8, y) + (winBounds ? winBounds.y : 0);

    await window.electronAPI.extensionsOpenPopup({
      extId: ext.id,
      x: screenX,
      y: screenY,
    });
  }

  function closeExtPopup() {
    window.electronAPI.extensionsClosePopup();
  }

  // ---- 扩展菜单 ----
  function toggleExtMenu() {
    if (!extMenuDropdownEl) return;
    extMenuDropdownEl.classList.toggle('open');
    if (extMenuDropdownEl.classList.contains('open')) renderExtMenuDropdown();
  }

  function closeExtMenu() {
    if (extMenuDropdownEl) extMenuDropdownEl.classList.remove('open');
  }

  function renderExtMenuDropdown() {
    if (!extMenuDropdownEl) return;

    const enabledExts = cachedExtensions.filter(e => e.enabled);
    const disabledExts = cachedExtensions.filter(e => !e.enabled);

    let html = '';

    if (enabledExts.length) {
      html += '<div class="ext-menu-header"><span>已启用</span></div>';
      enabledExts.forEach(ext => {
        const iconHtml = ext.iconDataUrl
          ? `<img src="${ext.iconDataUrl}" alt="" onerror="this.style.display='none'">`
          : `<div class="ext-icon-fallback" style="width:20px;height:20px;font-size:10px">${escHtml(ext.name[0])}</div>`;
        html += `
          <div class="ext-menu-item" data-ext-id="${ext.id}" data-action="toggle">
            ${iconHtml}
            <div class="ext-menu-item-info">
              <div class="ext-menu-item-name">${escHtml(ext.name)}</div>
              <div class="ext-menu-item-ver">v${escHtml(ext.version)}</div>
            </div>
          </div>`;
      });
    }

    if (disabledExts.length) {
      if (enabledExts.length) html += '<div class="ext-menu-sep"></div>';
      html += '<div class="ext-menu-header"><span>已禁用</span></div>';
      disabledExts.forEach(ext => {
        const iconHtml = ext.iconDataUrl
          ? `<img src="${ext.iconDataUrl}" alt="" style="opacity:0.4">`
          : `<div class="ext-icon-fallback" style="width:20px;height:20px;font-size:10px;opacity:0.4">${escHtml(ext.name[0])}</div>`;
        html += `
          <div class="ext-menu-item" data-ext-id="${ext.id}" data-action="toggle" style="opacity:0.6">
            ${iconHtml}
            <div class="ext-menu-item-info">
              <div class="ext-menu-item-name">${escHtml(ext.name)}</div>
              <div class="ext-menu-item-ver">v${escHtml(ext.version)}</div>
            </div>
          </div>`;
      });
    }

    html += '<div class="ext-menu-sep"></div>';
    html += '<div class="ext-menu-header"><a id="extMenuManage">管理扩展</a></div>';

    if (!cachedExtensions.length) {
      html = '<div class="ext-menu-header"><span>暂无扩展</span></div>';
    }

    extMenuDropdownEl.innerHTML = html;

    extMenuDropdownEl.querySelectorAll('.ext-menu-item[data-action="toggle"]').forEach(item => {
      item.addEventListener('click', async () => {
        const extId = item.dataset.extId;
        await window.electronAPI.extensionsToggle(extId);
        await refreshExtensions();
        renderExtMenuDropdown();
      });
    });

    const manageLink = document.getElementById('extMenuManage');
    if (manageLink) {
      manageLink.addEventListener('click', () => {
        closeExtMenu();
        try { window.FBrowser.settings.openSettings(); } catch(e) {}
        setTimeout(() => {
          const extSection = document.querySelector('#extList')?.closest('.settings-section');
          if (extSection) extSection.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      });
    }
  }

  // ---- 渲染设置页扩展列表 ----
  async function renderExtensions() {
    if (!extListEl) return;
    if (!cachedExtensions.length) {
      extListEl.innerHTML = '<div class="ext-empty">暂无已加载的扩展</div>';
    } else {
      extListEl.innerHTML = cachedExtensions.map(ext => `
        <div class="ext-item ${ext.enabled ? 'enabled' : 'disabled'}" data-id="${ext.id}">
          <div class="ext-info">
            <div class="ext-name">${escHtml(ext.name)}</div>
            <div class="ext-meta">v${escHtml(ext.version)} · ${escHtml(ext.origin || '自定义')}${ext.hasPopup ? ' · 有弹窗' : ''}</div>
          </div>
          <div class="ext-actions">
            <button class="ext-folder" data-ext-id="${ext.id}" title="打开扩展目录">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 3h3l1 1h4v6H2V3z" fill="none" stroke="currentColor" stroke-width="1"/></svg>
            </button>
            <label class="ext-toggle">
              <input type="checkbox" ${ext.enabled ? 'checked' : ''} data-ext-id="${ext.id}">
              <span class="ext-toggle-slider"></span>
            </label>
            <button class="ext-remove" data-ext-id="${ext.id}" title="彻底删除扩展">
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.3"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.3"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      extListEl.querySelectorAll('.ext-toggle input').forEach(input => {
        input.addEventListener('change', async () => {
          const extId = input.dataset.extId;
          const success = await window.electronAPI.extensionsToggle(extId);
          if (!success) input.checked = !input.checked;
          await refreshExtensions();
        });
      });

      extListEl.querySelectorAll('.ext-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const extId = btn.dataset.extId;
          const ext = cachedExtensions.find(e => e.id === extId);
          if (confirm(`确定要彻底删除扩展"${ext?.name || extId}"吗？\n这将删除本地文件，不可恢复。`)) {
            const result = await window.electronAPI.extensionsDelete(extId);
            if (result.error) {
              showImportResult(result.error, 'error');
            } else {
              showImportResult(`已删除扩展: ${result.name}`, 'success');
              await refreshExtensions();
            }
          }
        });
      });

      extListEl.querySelectorAll('.ext-folder').forEach(btn => {
        btn.addEventListener('click', async () => {
          const extId = btn.dataset.extId;
          await window.electronAPI.extensionsOpenFolder(extId);
        });
      });
    }
  }

  // ---- 刷新扩展数据 ----
  async function refreshExtensions() {
    cachedExtensions = await window.electronAPI.extensionsGetList();
    renderToolbarIcons();
    if (extListEl) await renderExtensions();
    
    // 刷新新标签页覆盖缓存
    if (window.FBrowser?.tabs?.refreshNewtabOverride) {
      window.FBrowser.tabs.refreshNewtabOverride();
    }
  }

  // ---- 从浏览器导入扩展 ----
  async function importFromBrowser(browser) {
    showImportResult('正在扫描并加载扩展...', 'loading');
    try {
      const results = await window.electronAPI.extensionsImportFromBrowser(browser);
      if (!results || !results.length) {
        const browserNames = { edge: 'Edge', chrome: 'Chrome', fbrowser: 'F-Browser' };
        showImportResult(`未找到 ${browserNames[browser] || browser} 扩展，请确认浏览器已安装扩展`, 'empty');
        return;
      }

      const loaded = results.filter(r => r.status === 'loaded').length;
      const already = results.filter(r => r.status === 'already_loaded').length;
      const failed = results.filter(r => r.status === 'failed').length;

      let msg = `扫描到 ${results.length} 个扩展：`;
      if (loaded) msg += ` ${loaded} 个加载成功`;
      if (already) msg += ` ${already} 个已加载`;
      if (failed) msg += ` ${failed} 个加载失败（不兼容）`;

      const type = failed === results.length ? 'error' : (loaded > 0 ? 'success' : 'info');
      showImportResult(msg, type);
      await refreshExtensions();
    } catch (e) {
      showImportResult('导入失败: ' + e.message, 'error');
    }
  }

  // ---- 从文件夹加载扩展 ----
  async function loadFromFolder() {
    try {
      const result = await window.electronAPI.extensionsLoadFromFolder();
      if (!result) return;
      if (result.error) {
        showImportResult(result.error, 'error');
      } else {
        showImportResult(`已加载扩展：${result.name} v${result.version}`, 'success');
        await refreshExtensions();
      }
    } catch (e) {
      showImportResult('加载失败: ' + e.message, 'error');
    }
  }

  function showImportResult(msg, type) {
    if (!extImportResultEl) return;
    extImportResultEl.style.display = 'block';
    extImportResultEl.className = 'ext-import-result ' + (type || '');
    extImportResultEl.textContent = msg;
    if (type !== 'loading') {
      setTimeout(() => { extImportResultEl.style.display = 'none'; }, 5000);
    }
  }

  // ---- 事件绑定 ----
  if (btnExtMenu) {
    btnExtMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExtMenu();
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ext-menu-wrapper')) closeExtMenu();
    if (!e.target.closest('.ext-icon-btn')) closeExtPopup();
  });

  const btnImportEdgeExt = document.getElementById('btnImportEdgeExt');
  if (btnImportEdgeExt) btnImportEdgeExt.addEventListener('click', () => importFromBrowser('edge'));
  const btnImportChromeExt = document.getElementById('btnImportChromeExt');
  if (btnImportChromeExt) btnImportChromeExt.addEventListener('click', () => importFromBrowser('chrome'));
  const btnImportFBrowserExt = document.getElementById('btnImportFBrowserExt');
  if (btnImportFBrowserExt) btnImportFBrowserExt.addEventListener('click', () => importFromBrowser('fbrowser'));
  const btnLoadExtFolder = document.getElementById('btnLoadExtFolder');
  if (btnLoadExtFolder) btnLoadExtFolder.addEventListener('click', () => loadFromFolder());

  // ---- 从商店安装扩展 ----
  const btnInstallFromStore = document.getElementById('btnInstallFromStore');
  const extStoreUrlInput = document.getElementById('extStoreUrl');
  const extStoreSelect = document.getElementById('extStoreSelect');
  
  if (btnInstallFromStore && extStoreUrlInput) {
    btnInstallFromStore.addEventListener('click', async () => {
      const url = extStoreUrlInput.value.trim();
      if (!url) {
        showImportResult('请输入扩展商店链接或扩展 ID', 'error');
        return;
      }
      
      const store = extStoreSelect ? extStoreSelect.value : 'edge';
      showImportResult('正在下载并安装扩展...', 'loading');
      
      try {
        const result = await window.electronAPI.extensionsInstallFromStore(url, store);
        if (result.error) {
          showImportResult(result.error, 'error');
        } else {
          showImportResult(`安装成功: ${result.name} v${result.version}`, 'success');
          extStoreUrlInput.value = '';
          await refreshExtensions();
        }
      } catch (e) {
        showImportResult('安装失败: ' + e.message, 'error');
      }
    });
    
    // 回车键安装
    extStoreUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnInstallFromStore.click();
    });
  }

  refreshExtensions();

  // ---- VPN/代理状态指示器 ----
  const vpnBtn = document.getElementById('btnVpnIndicator');

  async function updateVpnIndicator() {
    if (!vpnBtn) return;
    try {
      const proxyState = await window.electronAPI.extensionsGetProxyState();
      if (proxyState && proxyState.active) {
        vpnBtn.style.display = '';
        vpnBtn.classList.add('vpn-active');
        vpnBtn.classList.remove('vpn-error');
        vpnBtn.title = 'VPN 已连接: ' + (proxyState.extName || '未知扩展');
      } else {
        const vpnExts = cachedExtensions.filter(e => e.isVpn || e.hasProxyPerm);
        if (vpnExts.length > 0) {
          vpnBtn.style.display = '';
          vpnBtn.classList.remove('vpn-active');
          vpnBtn.title = 'VPN 未连接（点击扩展连接）';
        } else {
          vpnBtn.style.display = 'none';
        }
      }
    } catch (e) {}
  }

  if (vpnBtn) {
    vpnBtn.addEventListener('click', () => {
      const vpnExts = cachedExtensions.filter(e => (e.isVpn || e.hasProxyPerm) && e.enabled && e.hasPopup);
      if (vpnExts.length > 0) {
        const ext = vpnExts[0];
        const btn = extToolbarEl?.querySelector(`[data-ext-id="${ext.id}"]`);
        if (btn) showExtPopup(ext, btn);
      }
    });

    window.electronAPI.onProxyStateChanged((data) => {
      updateVpnIndicator();
    });

    const origRefresh = refreshExtensions;
    const refreshWithVpn = async function() {
      await origRefresh.call(this);
      await updateVpnIndicator();
    };

    setInterval(updateVpnIndicator, 10000);
    updateVpnIndicator();
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.extensions = { renderExtensions, refreshExtensions };
})();
