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

  mainWindow.webContents.on('found-in-page', (_, result) => {
    mainWindow.webContents.send('found-in-page-result', result);
  });

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
        { type: 'separator' },
        {
          label: 'Export as PDF...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow.webContents.send('export-pdf'),
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
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('find'),
        },
        {
          label: 'Replace All',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => mainWindow.webContents.send('replace-all'),
        },
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
        {
          label: 'Next Tab',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: () => mainWindow.webContents.send('next-tab'),
        },
        {
          label: 'Previous Tab',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: () => mainWindow.webContents.send('prev-tab'),
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () => mainWindow.webContents.send('go-to-tab', i),
        })),
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

// Find in page
ipcMain.on('find-in-page', (_, text, options) => {
  if (!mainWindow) return;
  if (text) {
    mainWindow.webContents.findInPage(text, options || {});
  } else {
    mainWindow.webContents.stopFindInPage('clearSelection');
  }
});

ipcMain.on('stop-find-in-page', () => {
  if (!mainWindow) return;
  mainWindow.webContents.stopFindInPage('clearSelection');
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

// PDF Export
ipcMain.handle('export-pdf', async (_, html, fileName) => {
  const defaultName = fileName ? fileName.replace(/\.[^.]+$/, '.pdf') : 'export.pdf';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false };

  // A4 at 96dpi ≈ 794x1123px; use content width matching margins
  const pdfWindow = new BrowserWindow({
    show: false,
    width: 630,
    height: 900,
    webPreferences: { offscreen: true },
  });

  const cssPath = path.join(__dirname, 'styles.css').replace(/\\/g, '/');
  const hljsLight = path.join(__dirname, 'node_modules/highlight.js/styles/github.css').replace(/\\/g, '/');
  const fullHtml = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="file://${hljsLight}">
    <link rel="stylesheet" href="file://${cssPath}">
    <style>
      body { background: #fff; color: #1d1d1f; padding: 0; margin: 0; display: block; overflow: visible; height: auto; font-size: 13px; }
      .markdown-body { max-width: 100%; margin: 0; padding: 0; font-size: 13px; line-height: 1.6; }
      .markdown-body h1 { font-size: 1.6em; }
      .markdown-body h2 { font-size: 1.3em; }
      .markdown-body h3 { font-size: 1.1em; }
      .markdown-body table { font-size: 12px; }
      .markdown-body pre { font-size: 11px; }
      .markdown-body th, .markdown-body td { padding: 8px 12px; border: 1px solid #d2d2d7; text-align: left; }
      .markdown-body th { font-weight: 600; background: #f8f9fa; }
      .markdown-body tr:nth-child(even) { background: #f8f9fa; }
      .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
      .markdown-body blockquote { margin: 0 0 1em 0; padding: 0.5em 1em; border-left: 4px solid #d2d2d7; background: #f8f9fa; border-radius: 0 4px 4px 0; color: #555; }
      .markdown-body blockquote p:last-child { margin-bottom: 0; }
      .markdown-body code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.875em; padding: 0.2em 0.4em; background: #f5f5f7; border-radius: 4px; }
      .markdown-body pre code { padding: 0; background: transparent; }
      .markdown-body pre, .markdown-body table, .markdown-body blockquote { break-inside: avoid; }
      .plantuml-diagram { break-inside: avoid; }
      img { max-width: 100%; }
    </style>
  </head><body data-theme="light"><div class="markdown-body">${html}</div></body></html>`;

  await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

  // Wait for images to load
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.8, right: 0.8 },
    });
    await fs.writeFile(filePath, pdfData);
    pdfWindow.close();
    return { success: true, filePath };
  } catch (err) {
    pdfWindow.close();
    dialog.showErrorBox('PDF Export Error', err.message);
    return { success: false };
  }
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
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) {
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
