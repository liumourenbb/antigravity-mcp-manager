import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 1. Register native Electron IPC handlers (Zero HTTP Server / Zero Ports!)
      registerIpcHandlers();

      // 2. Create native Windows 11 Fluent Design window
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 980,
        minHeight: 660,
        title: 'Antigravity MCP Manager',
        backgroundColor: '#202020',
        autoHideMenuBar: true,
        show: true,
        // Native Windows 11 TitleBar Overlay & Snap Layouts
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: '#202020',
          symbolColor: '#e0e0e0',
          height: 38,
        },
        backgroundMaterial: 'mica',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        },
      });

      mainWindow.show();
      mainWindow.focus();

      // Forward renderer console logs
      mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['LOG', 'INFO', 'WARN', 'ERROR'];
        console.log(`[Renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`);
      });

      // Press F12 to toggle DevTools
      mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
          mainWindow.webContents.toggleDevTools();
        }
      });

      // Open external links in default system browser
      mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
          shell.openExternal(targetUrl);
        }
        return { action: 'deny' };
      });

      mainWindow.on('closed', () => {
        mainWindow = null;
      });

      // 3. Load local UI directly from disk (No HTTP, 100% local file)
      const htmlPath = path.join(__dirname, '..', 'web', 'index.html');
      await mainWindow.loadFile(htmlPath);

    } catch (err) {
      console.error('Failed to launch Antigravity MCP Manager Desktop:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
