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
            // Auto-inject allowmixing when diagram mixes element types (e.g. package + state)
            if (!src.includes('allowmixing')) {
              const hasPackage = /\bpackage\b/.test(src);
              const hasState = /\bstate\b/.test(src);
              if (hasPackage && hasState) {
                src = src.replace(/(^@start\w+[^\n]*)/m, '$1\nallowmixing');
              }
            }
            // Fire async render
            ipcRenderer.invoke('render-plantuml', src).then((svgHtml) => {
              const el = document.getElementById(id);
              if (el) el.innerHTML = svgHtml;
            });
            return `<div class="plantuml-diagram" id="${id}"><div class="plantuml-loading">Rendering diagram...</div></div>\n`;
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
});
