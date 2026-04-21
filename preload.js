const { contextBridge, ipcRenderer } = require('electron');

let marked, hljs;

try {
  marked = require('marked').marked;
  hljs = require('highlight.js');

  marked.use({
    gfm: true,
    breaks: true,
    renderer: {
      heading({ text, depth, raw }) {
        const slug = raw
          .toLowerCase()
          .replace(/<[^>]+>/g, '')
          .replace(/[^\w\u0400-\u04ff\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
      },
      code({ text, lang }) {
        try {
          // PlantUML — insert placeholder, render async
          if (lang === 'plantuml' || lang === 'puml') {
            const id = 'puml-' + Math.random().toString(36).slice(2, 10);
            let src = text.includes('@start') ? text : `@startuml\n${text}\n@enduml`;
            // Fire async render
            ipcRenderer.invoke('render-plantuml', src).then((svgHtml) => {
              const el = document.getElementById(id);
              if (el) el.innerHTML = svgHtml;
            });
            return `<div class="plantuml-diagram" id="${id}"><div class="plantuml-loading">Rendering diagram...</div></div>\n`;
          }

          // Mermaid — insert placeholder, render in DOM
          if (lang === 'mermaid') {
            const id = 'mermaid-' + Math.random().toString(36).slice(2, 10);
            const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="mermaid-diagram" id="${id}">${escaped}</div>\n`;
          }

          // Regular code highlighting
          let highlighted;
          if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(text, { language: lang }).value;
          } else {
            highlighted = hljs.highlightAuto(text).value;
          }
          const langClass = lang ? ` language-${lang}` : '';
          return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;
        } catch (e) {
          return `<pre><code>${text}</code></pre>\n`;
        }
      },
    },
  });
} catch (e) {
  console.error('Failed to load modules:', e);
}

function renderMarkdown(text) {
  if (!marked) return `<pre>${text}</pre>`;
  try {
    return marked.parse(text);
  } catch (e) {
    console.error('Markdown render error:', e);
    return `<pre>${text}</pre>`;
  }
}

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFilePath: (filePath) => ipcRenderer.invoke('open-file-path', filePath),
  reloadFile: (filePath) => ipcRenderer.invoke('reload-file', filePath),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  notifyModified: () => ipcRenderer.send('content-modified'),
  setActiveTab: (filePath, fileName) => ipcRenderer.send('set-active-tab', filePath, fileName),
  confirmClose: (tabId, fileName) => ipcRenderer.invoke('confirm-close', tabId, fileName),

  renderMarkdown,

  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (_, data) => callback(data));
  },
  onFileSaved: (callback) => {
    ipcRenderer.on('file-saved', (_, data) => callback(data));
  },
  onNewFile: (callback) => {
    ipcRenderer.on('new-file', () => callback());
  },
  onCloseTab: (callback) => {
    ipcRenderer.on('close-tab', () => callback());
  },
  onToggleMode: (callback) => {
    ipcRenderer.on('toggle-mode', () => callback());
  },
  onToggleTheme: (callback) => {
    ipcRenderer.on('toggle-theme', () => callback());
  },
  onRequestSave: (callback) => {
    ipcRenderer.on('request-save', () => callback());
  },
  onRequestSaveAs: (callback) => {
    ipcRenderer.on('request-save-as', () => callback());
  },
  onRenderPreview: (callback) => {
    ipcRenderer.on('render-preview', () => callback());
  },
  onNextTab: (callback) => {
    ipcRenderer.on('next-tab', () => callback());
  },
  onPrevTab: (callback) => {
    ipcRenderer.on('prev-tab', () => callback());
  },
  onGoToTab: (callback) => {
    ipcRenderer.on('go-to-tab', (_, index) => callback(index));
  },
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  watchFolder: (folderPath) => ipcRenderer.send('watch-folder', folderPath),
  unwatchFolder: () => ipcRenderer.send('unwatch-folder'),
  onFsChanged: (callback) => {
    ipcRenderer.on('fs-changed', (_, data) => callback(data));
  },
  onFsWatcherError: (callback) => {
    ipcRenderer.on('fs-watcher-error', (_, data) => callback(data));
  },
  // File operations
  fsCreateFile: (dirPath, name) => ipcRenderer.invoke('fs-create-file', dirPath, name),
  fsCreateFolder: (dirPath, name) => ipcRenderer.invoke('fs-create-folder', dirPath, name),
  fsRename: (oldPath, newName) => ipcRenderer.invoke('fs-rename', oldPath, newName),
  fsDelete: (targetPath) => ipcRenderer.invoke('fs-delete', targetPath),
  fsReveal: (targetPath) => ipcRenderer.invoke('fs-reveal', targetPath),
  fsCopyPath: (targetPath) => ipcRenderer.invoke('fs-copy-path', targetPath),
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder-opened', (_, folderPath) => callback(folderPath));
  },
  onToggleSidebar: (callback) => {
    ipcRenderer.on('toggle-sidebar', () => callback());
  },
  exportPdf: (html, fileName) => ipcRenderer.invoke('export-pdf', html, fileName),
  onExportPdf: (callback) => {
    ipcRenderer.on('export-pdf', () => callback());
  },
  onFind: (callback) => {
    ipcRenderer.on('find', () => callback());
  },
  onReplaceAll: (callback) => {
    ipcRenderer.on('replace-all', () => callback());
  },
  findInPage: (text, options) => ipcRenderer.send('find-in-page', text, options),
  stopFindInPage: () => ipcRenderer.send('stop-find-in-page'),
  onFoundInPage: (callback) => {
    ipcRenderer.on('found-in-page-result', (_, result) => callback(result));
  },
});
