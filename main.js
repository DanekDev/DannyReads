const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');

let mainWindow;
let currentFilePath = null;
let isModified = false;
let pendingFile = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    // Open file passed via CLI or Finder
    const fileToOpen = pendingFile || process.argv.find(a => /\.(md|markdown|txt|puml|plantuml|pu|wsd)$/.test(a));
    if (fileToOpen) {
      pendingFile = null;
      openFile(fileToOpen);
    }
  });

  updateTitle();
}

function updateTitle() {
  if (!mainWindow) return;
  const fileName = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  const modified = isModified ? ' \u2014 Edited' : '';
  mainWindow.setTitle(`${fileName}${modified}`);
}

async function openFile(filePath) {
  if (!filePath) {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multipleSelections'],
      filters: [
        { name: 'All Supported', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt', 'puml', 'plantuml', 'pu', 'wsd'] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
        { name: 'PlantUML', extensions: ['puml', 'plantuml', 'pu', 'wsd'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || filePaths.length === 0) return null;
    for (const fp of filePaths) {
      await openFile(fp);
    }
    return { success: true };
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    currentFilePath = filePath;
    isModified = false;
    updateTitle();
    const ext = path.extname(filePath).toLowerCase();
    const isPuml = ['.puml', '.plantuml', '.pu', '.wsd'].includes(ext);
    mainWindow.webContents.send('file-opened', {
      content,
      filePath,
      fileName: path.basename(filePath),
      dirPath: path.dirname(filePath),
      isPuml,
    });
    return { success: true };
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to open file:\n${err.message}`);
    return null;
  }
}

async function saveFile(content) {
  if (!currentFilePath) {
    return saveFileAs(content);
  }
  try {
    await fs.writeFile(currentFilePath, content, 'utf-8');
    isModified = false;
    updateTitle();
    return { success: true, filePath: currentFilePath };
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to save file:\n${err.message}`);
    return { success: false };
  }
}

async function saveFileAs(content) {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: currentFilePath || 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { success: false };

  try {
    await fs.writeFile(filePath, content, 'utf-8');
    currentFilePath = filePath;
    isModified = false;
    updateTitle();
    mainWindow.webContents.send('file-saved', {
      filePath,
      fileName: path.basename(filePath),
    });
    return { success: true, filePath };
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to save file:\n${err.message}`);
    return { success: false };
  }
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-file');
          },
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile(),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow.webContents.send('close-tab'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('request-save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('request-save-as'),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Edit / Preview',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow.webContents.send('toggle-mode'),
        },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => mainWindow.webContents.send('toggle-theme'),
        },
        {
          label: 'Re-render Preview',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow.webContents.send('render-preview'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// PlantUML rendering via local JAR
const plantumlJar = app.isPackaged
  ? path.join(process.resourcesPath, 'vendor', 'plantuml.jar')
  : path.join(__dirname, 'vendor', 'plantuml.jar');

ipcMain.handle('render-plantuml', (_, code) => {
  return new Promise((resolve) => {
    const child = execFile('java', ['-Djava.awt.headless=true', '-jar', plantumlJar, '-tsvg', '-pipe', '-charset', 'UTF-8'], {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'buffer',
    }, (err, stdout, stderr) => {
      // PlantUML generates SVG even on errors (showing where the error is visually)
      if (stdout && stdout.length > 0 && stdout.toString('utf-8').includes('<svg')) {
        const svgBase64 = stdout.toString('base64');
        resolve(`<img src="data:image/svg+xml;base64,${svgBase64}" alt="PlantUML Diagram">`);
        return;
      }
      const msg = (stderr && stderr.length > 0) ? stderr.toString().trim() : (err ? err.message : 'Unknown error');
      const escaped = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      resolve(`<div class="plantuml-error">PlantUML: ${escaped}</div>`);
    });
    child.stdin.write(code);
    child.stdin.end();
  });
});

// IPC Handlers
ipcMain.handle('open-file', () => openFile());
ipcMain.handle('reload-file', async (_, filePath) => {
  if (!filePath) return null;
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (err) {
    return null;
  }
});
ipcMain.handle('save-file', (_, content) => saveFile(content));
ipcMain.handle('save-file-as', (_, content) => saveFileAs(content));
ipcMain.on('content-modified', () => {
  if (!isModified) {
    isModified = true;
    updateTitle();
  }
});

// Tab management IPC
ipcMain.on('set-active-tab', (_, filePath, fileName) => {
  currentFilePath = filePath;
  isModified = false;
  updateTitle();
});

ipcMain.handle('confirm-close', async (_, tabId, fileName) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Don\u2019t Save', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: `Do you want to save changes to "${fileName}"?`,
    detail: 'Your changes will be lost if you don\u2019t save them.',
  });
  if (response === 0) return 'save';
  if (response === 1) return 'discard';
  return 'cancel';
});

// App lifecycle
app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file open from Finder (double-click .md file)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    openFile(filePath);
    mainWindow.show();
    app.focus({ steal: true });
  } else {
    pendingFile = filePath;
  }
});
