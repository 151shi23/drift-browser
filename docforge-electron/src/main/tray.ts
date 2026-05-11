import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import * as path from 'path';

export class DocForgeTray {
  private tray: Tray | null = null;

  create(iconPath: string, mainWindow: BrowserWindow): void {
    const icon = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开 DocForge',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: '新建文档',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('docforge:new-doc');
        },
      },
      {
        label: '打开文件...',
        click: () => {
          mainWindow.webContents.send('docforge:trigger-open-file');
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setToolTip('DocForge 文档编辑器');
    this.tray.setContextMenu(contextMenu);

    this.tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
