const { app, BrowserWindow, dialog, Menu, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { execFile } = require('child_process');
const chokidar = require('chokidar');

let mainWindow;
let currentFilePath = null;
let isModified = false;
let pendingFile = null;
let watcher = null;
let watchedRoot = null;

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
    const fileToOpen = pendingFile || process.argv.find(a => /\.(md|markdown|txt|puml|plantuml|pu|wsd|mmd)$/.test(a));
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
        { name: 'All Supported', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt', 'puml', 'plantuml', 'pu', 'wsd', 'mmd'] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
        { name: 'PlantUML', extensions: ['puml', 'plantuml', 'pu', 'wsd'] },
        { name: 'Mermaid', extensions: ['mmd'] },
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
    const isMermaid = ext === '.mmd';
    mainWindow.webContents.send('file-opened', {
      content,
      filePath,
      fileName: path.basename(filePath),
      dirPath: path.dirname(filePath),
      isPuml,
      isMermaid,
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
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
            });
            if (!canceled && filePaths.length > 0) {
              mainWindow.webContents.send('folder-opened', filePaths[0]);
            }
          },
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
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.send('toggle-sidebar'),
        },
        { type: 'separator' },
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
ipcMain.handle('open-file-path', (_, filePath) => openFile(filePath));
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

ipcMain.handle('open-folder-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

// Read directory tree
// Broad whitelist of text/code file extensions (ADR-005)
const SUPPORTED_EXTS = new Set([
  // Markdown & docs
  '.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt', '.rst', '.adoc', '.org',
  // Diagrams
  '.puml', '.plantuml', '.pu', '.wsd', '.mmd',
  // Data
  '.json', '.jsonc', '.json5', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env',
  '.csv', '.tsv', '.xml', '.plist',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.svg',
  // Code — JS/TS
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  // Code — backend & systems
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.kts', '.scala', '.swift',
  '.c', '.h', '.cpp', '.cc', '.hpp', '.cs', '.m', '.mm',
  '.php', '.pl', '.lua', '.r', '.jl', '.ex', '.exs', '.erl', '.hs', '.elm',
  // Shell
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  // Build & configs
  '.dockerfile', '.makefile', '.mk', '.cmake', '.gradle', '.sbt',
  '.lock', '.gitignore', '.gitattributes', '.editorconfig',
  // SQL & data query
  '.sql', '.graphql', '.gql',
  // Other
  '.log', '.diff', '.patch', '.tex', '.bib',
]);

// Files with these exact names (no extension) are treated as text
const SUPPORTED_BASENAMES = new Set([
  'Makefile', 'makefile', 'Dockerfile', 'dockerfile', 'Jenkinsfile',
  'Rakefile', 'Gemfile', 'Procfile', 'Pipfile', 'CHANGELOG', 'LICENSE',
  'README', 'CONTRIBUTING', 'AUTHORS', 'NOTICE', 'TODO',
]);

function isSupportedFile(name) {
  if (SUPPORTED_BASENAMES.has(name)) return true;
  const ext = path.extname(name).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}
const IGNORED_DIRS = new Set(['.git', '.svn', 'node_modules', '.DS_Store', '__pycache__', '.claude']);

async function readDirTree(dirPath, depth = 0) {
  if (depth > 10) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  // Sort: folders first, then files, alphabetically
  const sorted = entries
    .filter(e => !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const children = await readDirTree(fullPath, depth + 1);
      result.push({ name: entry.name, path: fullPath, isDir: true, children });
    } else {
      if (isSupportedFile(entry.name)) {
        result.push({ name: entry.name, path: fullPath, isDir: false });
      }
    }
  }
  return result;
}

ipcMain.handle('read-dir', async (_, dirPath) => {
  try {
    const tree = await readDirTree(dirPath);
    return { root: path.basename(dirPath), rootPath: dirPath, tree };
  } catch (err) {
    return null;
  }
});

// ===== File system watcher =====
// Coalesces rapid bursts of fs events into batched updates sent to renderer.
// The renderer re-issues read-dir on batch; diffs itself. Simpler than TreeEvent
// reducers and correct enough for <10k-file vaults.

let watcherEventBuffer = [];
let watcherFlushTimer = null;

function scheduleWatcherFlush() {
  if (watcherFlushTimer) return;
  watcherFlushTimer = setTimeout(() => {
    watcherFlushTimer = null;
    if (watcherEventBuffer.length === 0) return;
    const events = watcherEventBuffer;
    watcherEventBuffer = [];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fs-changed', { root: watchedRoot, events });
    }
  }, 100);
}

function stopWatcher() {
  if (watcher) {
    watcher.close().catch(() => {});
    watcher = null;
    watchedRoot = null;
    watcherEventBuffer = [];
    if (watcherFlushTimer) {
      clearTimeout(watcherFlushTimer);
      watcherFlushTimer = null;
    }
  }
}

function startWatcher(rootPath) {
  stopWatcher();
  watchedRoot = rootPath;

  watcher = chokidar.watch(rootPath, {
    ignoreInitial: true,
    ignored: [
      /(^|[\\/])\../,        // dotfiles and dot-dirs (.git, .DS_Store, .claude)
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
    ],
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 },
    depth: 12,
    followSymlinks: false,
    atomic: 100,
  });

  const enqueue = (op, p, kind) => {
    watcherEventBuffer.push({ op, path: p, kind });
    scheduleWatcherFlush();
  };

  watcher.on('add', (p) => enqueue('add', p, 'file'));
  watcher.on('addDir', (p) => enqueue('add', p, 'dir'));
  watcher.on('unlink', (p) => enqueue('unlink', p, 'file'));
  watcher.on('unlinkDir', (p) => enqueue('unlink', p, 'dir'));
  watcher.on('change', (p) => enqueue('change', p, 'file'));
  watcher.on('error', (err) => {
    console.error('[watcher]', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fs-watcher-error', { message: err.message });
    }
  });
}

ipcMain.on('watch-folder', (_, folderPath) => {
  if (!folderPath) return;
  if (watchedRoot === folderPath) return; // already watching
  startWatcher(folderPath);
});

ipcMain.on('unwatch-folder', () => {
  stopWatcher();
});

// ===== File operations (for sidebar context menu) =====

ipcMain.handle('fs-create-file', async (_, dirPath, name) => {
  try {
    const fullPath = path.join(dirPath, name);
    // Refuse to overwrite existing
    try {
      await fs.access(fullPath);
      return { success: false, error: 'File already exists' };
    } catch { /* doesn't exist, good */ }
    await fs.writeFile(fullPath, '', 'utf-8');
    return { success: true, path: fullPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-create-folder', async (_, dirPath, name) => {
  try {
    const fullPath = path.join(dirPath, name);
    await fs.mkdir(fullPath, { recursive: false });
    return { success: true, path: fullPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-rename', async (_, oldPath, newName) => {
  try {
    const newPath = path.join(path.dirname(oldPath), newName);
    if (oldPath === newPath) return { success: true, path: newPath };
    try {
      await fs.access(newPath);
      return { success: false, error: 'A file with that name already exists' };
    } catch { /* doesn't exist */ }
    await fs.rename(oldPath, newPath);
    return { success: true, path: newPath, oldPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-delete', async (_, targetPath) => {
  try {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Move to Trash', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      message: `Move "${path.basename(targetPath)}" to Trash?`,
    });
    if (response !== 0) return { success: false, cancelled: true };
    await shell.trashItem(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-reveal', async (_, targetPath) => {
  try {
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-copy-path', async (_, targetPath) => {
  clipboard.writeText(targetPath);
  return { success: true };
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
  stopWatcher();
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
