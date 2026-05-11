const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;

function getWin() {
  const { getMainWindow } = require('./window-manager');
  const win = getMainWindow();
  if (win && !win.isDestroyed()) return win;
  const { BrowserWindow } = require('electron');
  const allWins = BrowserWindow.getAllWindows();
  return allWins.length > 0 ? allWins[0] : null;
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
  
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createFromBuffer(
        Buffer.from([
          137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,16,0,0,0,16,8,6,0,0,0,31,243,255,97,0,0,0,13,73,68,65,84,56,111,99,24,5,163,0,0,0,2,0,1,226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130
        ])
      );
    }
  } catch (e) {
    icon = nativeImage.createFromBuffer(
      Buffer.from([
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,16,0,0,0,16,8,6,0,0,0,31,243,255,97,0,0,0,13,73,68,65,84,56,111,99,24,5,163,0,0,0,2,0,1,226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130
      ])
    );
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Drift 浏览器');

  rebuildMenu();

  tray.on('click', () => {
    const win = getWin();
    if (win) {
      if (win.isVisible()) {
        if (win.isFocused()) {
          win.hide();
        } else {
          win.focus();
        }
      } else {
        win.show();
        win.focus();
      }
    }
  });

  tray.on('double-click', () => {
    const win = getWin();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  return tray;
}

function rebuildMenu() {
  if (!tray) return;

  const isVertical = (typeof localStorage !== 'undefined') ? false : false;
  const isPowerMode = false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 Drift 浏览器',
      click: () => {
        const win = getWin();
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '新建标签页',
      click: () => {
        const win = getWin();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('tray-action', 'new-tab');
        }
      }
    },
    {
      label: '新建无痕窗口',
      click: () => {
        const win = getWin();
        if (win) {
          win.webContents.send('tray-action', 'new-incognito');
        }
      }
    },
    { type: 'separator' },
    {
      label: '分屏浏览',
      click: () => {
        const win = getWin();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('tray-action', 'split-screen');
        }
      }
    },
    {
      label: '垂直标签栏',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        const win = getWin();
        if (win) {
          win.webContents.send('tray-action', 'toggle-vertical-tabs', menuItem.checked);
        }
      }
    },
    { type: 'separator' },
    {
      label: '书签管理',
      click: () => {
        const win = getWin();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('tray-action', 'open-bookmarks');
        }
      }
    },
    {
      label: '历史记录',
      click: () => {
        const win = getWin();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('tray-action', 'open-history');
        }
      }
    },
    { type: 'separator' },
    {
      label: '强力优化模式',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        const win = getWin();
        if (win) {
          win.webContents.send('tray-action', 'toggle-power-mode', menuItem.checked);
        }
      }
    },
    {
      label: '清理缓存',
      click: () => {
        const win = getWin();
        if (win) {
          win.webContents.send('tray-action', 'clear-cache');
        }
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        const win = getWin();
        if (win) {
          win.show();
          win.focus();
          win.webContents.send('tray-action', 'open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出 Drift 浏览器',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function getTray() {
  return tray;
}

module.exports = { createTray, getTray, rebuildMenu };
