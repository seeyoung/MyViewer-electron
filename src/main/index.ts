// 경로 별칭 설정 (런타임 모듈 해결을 위해)
import * as moduleAlias from 'module-alias';
moduleAlias.addAliases({
  '@shared': require('path').join(__dirname, '../shared'),
  '@main': require('path').join(__dirname, '.'),
  '@lib': require('path').join(__dirname, '../lib'),
});

import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './db/init';
import { initializeIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let pendingBossKeyMinimize = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow data URLs for images
    },
    title: 'MyViewer - Archive Image Viewer',
    show: false, // Don't show until ready-to-show
  });

  // Load app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window-fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window-fullscreen-changed', false);

    if (pendingBossKeyMinimize && mainWindow && !mainWindow.isDestroyed()) {
      console.log('🔽 Boss key pending minimize after fullscreen exit');
      pendingBossKeyMinimize = false;
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.minimize();
          console.log('✅ Boss key: Window minimized after exiting fullscreen');
        }
      });
    }
  });

  // Set up application menu
  setupMenu();
}

function setupMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Archive...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openFile'],
              filters: [
                {
                  name: 'Archive Files',
                  extensions: ['zip', 'cbz', 'rar', 'cbr', '7z', 'tar'],
                },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              mainWindow?.webContents.send('file-opened', filePath);
            }
          },
        },
        {
          label: 'Open Folder... ',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openDirectory'],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const folderPath = result.filePaths[0];
              mainWindow?.webContents.send('folder-opened', folderPath);
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


function initializeWindowHandlers() {
  // 창 최소화 이벤트 핸들러 (보스키 기능)
  ipcMain.on('window-minimize', () => {
    console.log('🔽 Boss key triggered - minimizing window');

    if (mainWindow && !mainWindow.isDestroyed()) {
      // 이미 최소화됐으면 아무것도 안 함
      if (mainWindow.isMinimized()) {
        console.log('📋 Window already minimized');
        return;
      }

      const isMaximized = mainWindow.isMaximized();
      const isFullScreen = mainWindow.isFullScreen();
      console.log(`📊 Window state: maximized=${isMaximized}, fullscreen=${isFullScreen}`);

      try {
        let shouldMinimizeNow = true;

        if (isFullScreen) {
          // 전체 화면에서는 먼저 나오기
          pendingBossKeyMinimize = true;
          shouldMinimizeNow = false;
          mainWindow.setFullScreen(false);
        } else if (isMaximized) {
          // 최대화에서는 먼저 원래 크기로
          mainWindow.unmaximize();
        }

        if (shouldMinimizeNow) {
          // 그냥 바로 최소화
          console.log('📉 Minimizing window...');
          mainWindow.minimize();
          console.log('✅ BOSS KEY: Window minimized successfully');
        } else {
          console.log('⏳ Waiting for fullscreen exit before minimizing');
        }

      } catch (error) {
        console.error('❌ Error minimizing window:', error);
        // 실패하면 그냥 숨기기
        mainWindow.hide();
      }
    } else {
      console.log('❌ No main window found');
    }
  });

  ipcMain.on('window-toggle-fullscreen', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('❌ Cannot toggle fullscreen - no active window');
      return;
    }

    const nextState = !mainWindow.isFullScreen();
    console.log(`🪟 Toggling fullscreen -> ${nextState}`);
    mainWindow.setFullScreen(nextState);
  });

  ipcMain.on('window-set-fullscreen', (_event, shouldFullscreen: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('❌ Cannot set fullscreen - no active window');
      return;
    }

    console.log(`🪟 Setting fullscreen: ${shouldFullscreen}`);
    mainWindow.setFullScreen(!!shouldFullscreen);
  });
}

app.whenReady().then(() => {
  // Initialize database
  initializeDatabase();

  // Initialize IPC handlers
  initializeIpcHandlers();

  // Initialize window event handlers
  initializeWindowHandlers();

  // Create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Close database connection
  closeDatabase();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  // Ensure database is closed on quit
  closeDatabase();
});

// Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // TODO: Handle file opening from command line
      // const filePath = commandLine[commandLine.length - 1];
    }
  });
}
