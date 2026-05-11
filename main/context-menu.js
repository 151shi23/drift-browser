// ==================== 右键菜单模块（Edge 风格） ====================
// 参考 Edge/Chromium 标准右键菜单布局

const { Menu, BrowserWindow, clipboard, shell, dialog } = require('electron');

/**
 * 显示页面右键菜单
 * 由渲染进程通过 IPC 调用，params 包含 webview context-menu 事件参数
 */
function showContextMenu(params) {
  const items = [];

  // ==================== 导航区域 ====================
  // 从 params.pageURL 获取当前页面信息，或使用 navigationFlags
  const canGoBack = params.navigationFlags?.canGoBack ?? true;
  const canGoForward = params.navigationFlags?.canGoForward ?? true;

  // 后退 / 前进
  if (canGoBack) {
    items.push({ label: '后退\tAlt+←', click: () => sendAction('go-back') });
  }
  if (canGoForward) {
    items.push({ label: '前进\tAlt+→', click: () => sendAction('go-forward') });
  }

  // 重新加载
  items.push({ label: '重新加载\tF5', click: () => sendAction('reload') });
  // 强制刷新
  items.push({ label: '强制刷新\tCtrl+F5', click: () => sendAction('force-reload') });

  // ==================== 页面级操作（通用）====================
  items.push({ type: 'separator' });

  // 收藏此页
  items.push({
    label: '收藏此页\tCtrl+D',
    click: () => sendAction('bookmark-page'),
  });

  // 保存页面为...
  items.push({
    label: '另存为...\tCtrl+S',
    click: () => sendAction('save-page'),
  });

  // 打印
  items.push({
    label: '打印...\tCtrl+P',
    click: () => sendAction('print'),
  });

  items.push({ type: 'separator' });

  // 查找
  items.push({
    label: '查找...\tCtrl+F',
    click: () => sendAction('find'),
  });

  // 缩放子菜单
  items.push({
    label: '缩放',
    submenu: [
      { label: '放大\tCtrl++', click: () => sendAction('zoom-in') },
      { label: '缩小\tCtrl+-', click: () => sendAction('zoom-out') },
      { label: '重置\tCtrl+0', click: () => sendAction('zoom-reset') },
      { type: 'separator' },
      { label: '全屏\tF11', click: () => sendAction('fullscreen') },
    ],
  });

  // 全屏（独立项，Edge 也常放在这里）
  items.push({ type: 'separator' });

  // AI 对话浮窗
  items.push({
    label: 'AI 对话\tCtrl+Shift+A',
    click: () => sendAction('open-float-chat', {
      text: params.selectionText || '',
      url: params.pageURL || ''
    }),
  });

  // 检查元素
  items.push({
    label: '检查元素(N)\tF12',
    click: () => sendAction('inspect', { x: params.x, y: params.y }),
  });

  // 查看源代码
  items.push({
    label: '查看源代码(U)\tCtrl+U',
    click: () => sendAction('view-source'),
  });

  // ==================== 文本选中时 ====================
  if (params.selectionText && params.selectionText.trim()) {
    const text = params.selectionText;
    const shortText = text.trim().substring(0, 30);

    items.unshift({ type: 'separator' }); // 在导航区后加分隔线

    // 剪切（仅在可编辑区域）
    if (params.isEditable) {
      items.splice(items.length - 5, 0, {
        label: '剪切(X)\tCtrl+X',
        click: () => { clipboard.writeText(text); sendAction('cut'); },
      });
    }

    items.splice(items.length - 4 + (params.isEditable ? 1 : 0), 0,
      { label: `复制(C)\tCtrl+C`, click: () => { clipboard.writeText(text); } },

      // 搜索选中文本（带搜索引擎子菜单）
      {
        label: `搜索"${shortText}"${text.length > 30 ? '...' : ''}...`,
        submenu: [
          { label: '使用百度搜索', click: () => sendAction('search-text', text, 'https://www.baidu.com/s?wd=') },
          { label: '使用 Bing 搜索', click: () => sendAction('search-text', text, 'https://cn.bing.com/search?q=') },
          { label: '使用 Google 搜索', click: () => sendAction('search-text', text, 'https://www.google.com/search?q=') },
          { type: 'separator' },
          { label: '使用默认搜索引擎', click: () => sendAction('search-text', text) },
        ],
      },

      // AI 解释选中文本
      {
        label: `🤖 AI 解释: "${shortText}"`,
        click: () => sendAction('open-float-chat', { text: text, url: params.pageURL || '', mode: 'explain' }),
      },

      // 打印（仅选中文字时）
      { label: '打印...', click: () => sendAction('print'), enabled: false }, // TODO: 实现选中文字的打印
    );

    // 可编辑区域的额外选项
    if (params.isEditable) {
      items.splice(-3, 0,
        { label: '粘贴(P)\tCtrl+V', click: () => sendAction('paste') },
        { label: '全选(A)\tCtrl+A', click: () => sendAction('select-all') },
      );
    }
  }

  // ==================== 链接上右键 ====================
  if (params.linkURL) {
    items.unshift({ type: 'separator' });

    // 插入链接相关操作到分隔线之后、通用操作之前
    const linkOps = [
      { label: '在新标签页中打开链接(T)', click: () => sendAction('open-link', params.linkURL) },
      { label: '在新窗口中打开链接', click: () => sendAction('open-link-new-window', params.linkURL) },
      { label: '保存链接为(K)...', click: () => sendAction('save-link-as', params.linkURL) },
      { label: '复制链接地址(E)', click: () => clipboard.writeText(params.linkURL) },
    ];

    // 如果有链接文本
    if (params.linkText) {
      linkOps.push(
        { label: '复制链接文字', click: () => clipboard.writeText(params.linkText) },
        { label: '将链接添加到书签(B)', click: () => sendAction('bookmark-link', { url: params.linkURL, title: params.linkText }) },
      );
    }

    // 合并：在"检查元素"之前插入所有链接操作
    const inspectIdx = items.findIndex(i => i.label && i.label.includes('检查'));
    if (inspectIdx > 0) {
      items.splice(inspectIdx, 0, ...linkOps);
    } else {
      items.push(...linkOps);
    }
  }

  // ==================== 图片上右键 ====================
  if (params.mediaType === 'image') {
    items.unshift({ type: 'separator' });

    const imgOps = [
      { label: '在新标签页中打开图片(I)', click: () => sendAction('open-link', params.srcURL) },
      { label: '在新窗口中打开图片', click: () => sendAction('open-image-new-window', params.srcURL) },
      { type: 'separator' },
      { label: '保存图片为(V)...', click: () => sendAction('save-image', params.srcURL) },
      { label: '复制图片(Y)', click: () => sendAction('copy-image', params.srcURL) },
      { label: '复制图片地址(S)', click: () => clipboard.writeText(params.srcURL) },
    ];

    // 在"检查元素"前插入
    const inspectIdx = items.findIndex(i => i.label && i.label.includes('检查'));
    if (inspectIdx > 0) {
      items.splice(inspectIdx, 0, ...imgOps);
    } else {
      items.push(...imgOps);
    }
  }

  // ==================== 视频/音频上右键 ====================
  if (params.mediaType === 'video' || params.mediaType === 'audio') {
    items.unshift({ type: 'separator' });

    const mediaOps = [];
    if (params.mediaType === 'video') {
      mediaOps.push(
        { label: '静音', click: () => sendAction('media-mute') },
        { label: '显示控件', click: () => sendAction('media-show-controls') },
        { label: '进入全屏', click: () => sendAction('media-fullscreen') },
        { label: '画中画', click: () => sendAction('media-pip') },
        { type: 'separator' },
      );
    }

    mediaOps.push(
      { label: '复制媒体地址', click: () => clipboard.writeText(params.srcURL || '') },
      { label: '保存媒体为...', click: () => sendAction('save-media', params.srcURL) },
      { label: '在新标签页中打开媒体', click: () => sendAction('open-link', params.srcURL) },
    );

    const inspectIdx = items.findIndex(i => i.label && i.label.includes('检查'));
    if (inspectIdx > 0) {
      items.splice(inspectIdx, 0, ...mediaOps);
    } else {
      items.push(...mediaOps);
    }
  }

  // ==================== 可编辑输入框（无选中文字时）====================
  if (params.isEditable && !params.selectionText?.trim()) {
    items.unshift({ type: 'separator' });

    const editOps = [
      { label: '撤销(U)\tCtrl+Z', click: () => sendAction('undo') },
      { label: '重做(R)\tCtrl+Y', click: () => sendAction('redo') },
      { type: 'separator' },
      { label: '剪切(X)\tCtrl+X', click: () => sendAction('cut') },
      { label: '复制(C)\tCtrl+C', click: () => sendAction('copy') },
      { label: '粘贴(P)\tCtrl+V', click: () => sendAction('paste') },
      { label: '粘贴为纯文本', click: () => sendAction('paste-plain') },
      { type: 'separator' },
      { label: '全选(A)\tCtrl+A', click: () => sendAction('select-all') },
    ];

    const inspectIdx = items.findIndex(i => i.label && i.label.includes('检查'));
    if (inspectIdx > 0) {
      items.splice(inspectIdx, 0, ...editOps);
    } else {
      items.push(...editOps);
    }
  }

  // ==================== 清理多余分隔线 ====================
  cleanSeparators(items);

  // 构建并显示菜单
  if (items.length === 0) return;

  try {
    const menu = Menu.buildFromTemplate(items);
    const win = BrowserWindow.getFocusedWindow();
    if (win) menu.popup({ window: win });
  } catch (e) {
    console.error('[ContextMenu] 构建菜单失败:', e.message);
  }
}

/**
 * 清理多余的分隔线：连续多个合并为一个；开头/末尾的移除
 */
function cleanSeparators(arr) {
  let prevWasSep = true; // 开头视为分隔符
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].type === 'separator') {
      if (prevWasSep || i === 0 || i === arr.length - 1) {
        arr.splice(i, 1);
      }
      prevWasSep = true;
    } else {
      prevWasSep = false;
    }
  }
}

/**
 * 向渲染进程发送菜单动作
 */
function sendAction(action, data, extra) {
  const { getMainWindow } = require('./window-manager');
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('context-menu:action', { action, data, extra });
  }
}

module.exports = { showContextMenu };
