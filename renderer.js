// ===== Tab State =====
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

// Elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const editBtn = document.getElementById('edit-btn');
const previewBtn = document.getElementById('preview-btn');
const themeBtn = document.getElementById('theme-btn');
const fileNameEl = document.getElementById('file-name');
const statusInfo = document.getElementById('status-info');
const statusMode = document.getElementById('status-mode');
const themeIconLight = document.getElementById('theme-icon-light');
const themeIconDark = document.getElementById('theme-icon-dark');
const hljsLight = document.getElementById('hljs-light');
const hljsDark = document.getElementById('hljs-dark');
const tabList = document.getElementById('tab-list');
const tabNewBtn = document.getElementById('tab-new-btn');
const renderBtn = document.getElementById('render-btn');
const previewInner = document.getElementById('preview-inner');
const zoomControls = document.getElementById('zoom-controls');
const zoomLabel = document.getElementById('zoom-label');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const replaceInput = document.getElementById('replace-input');
const searchCount = document.getElementById('search-count');
const searchPrevBtn = document.getElementById('search-prev-btn');
const searchNextBtn = document.getElementById('search-next-btn');
const searchCloseBtn = document.getElementById('search-close-btn');
const replaceBtn = document.getElementById('replace-btn');
const replaceAllBtn = document.getElementById('replace-all-btn');

let currentTheme = 'light';
const ZOOM_STEP = 10;
const ZOOM_MIN = 30;
const ZOOM_MAX = 300;

// ===== Tab helpers =====
function generateTabId() {
  return ++tabIdCounter;
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId);
}

function createTab(opts = {}) {
  const tab = {
    id: generateTabId(),
    fileName: opts.fileName || 'Untitled',
    filePath: opts.filePath || null,
    dirPath: opts.dirPath || null,
    content: opts.content || '',
    isPuml: opts.isPuml || false,
    mode: opts.isPuml ? 'preview' : 'edit',
    zoom: 100,
    isModified: false,
  };
  tabs.push(tab);
  renderTabBar();
  switchTab(tab.id);
  return tab;
}

function closeTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Save latest content from editor if this is the active tab
  if (tab.id === activeTabId) {
    tab.content = editor.value;
  }

  if (tab.isModified) {
    window.api.confirmClose(tabId, tab.fileName).then((result) => {
      if (result === 'save') {
        window.api.saveFile(tab.content).then(() => {
          removeTab(tabId);
        });
      } else if (result === 'discard') {
        removeTab(tabId);
      }
    });
    return;
  }
  removeTab(tabId);
}

function removeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab();
    return;
  }

  if (activeTabId === tabId) {
    const newIdx = Math.min(idx, tabs.length - 1);
    switchTab(tabs[newIdx].id);
  } else {
    renderTabBar();
  }
}

function switchTab(tabId) {
  // Save current tab state
  const prev = getActiveTab();
  if (prev) {
    prev.content = editor.value;
  }

  activeTabId = tabId;
  const tab = getActiveTab();
  if (!tab) return;

  // Restore tab content
  editor.value = tab.content;
  fileNameEl.textContent = tab.fileName;
  setModeInternal(tab.mode);
  updateStats();
  renderTabBar();

  // Notify main process about active tab
  window.api.setActiveTab(tab.filePath, tab.fileName);
}

// ===== Tab bar rendering =====
function renderTabBar() {
  tabList.innerHTML = '';
  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '') + (tab.isModified ? ' modified' : '');
    el.dataset.tabId = tab.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-item-name';
    nameSpan.textContent = tab.fileName;
    el.appendChild(nameSpan);

    const dot = document.createElement('span');
    dot.className = 'tab-item-dot';
    el.appendChild(dot);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-item-close';
    closeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => switchTab(tab.id));
    tabList.appendChild(el);
  });
}

// ===== Zoom =====
function applyZoom() {
  const tab = getActiveTab();
  const zoom = tab ? tab.zoom : 100;
  const scale = zoom / 100;
  previewInner.style.transform = `scale(${scale})`;
  previewInner.style.width = `${100 / scale}%`;
  zoomLabel.textContent = `${zoom}%`;
}

function zoomIn() {
  const tab = getActiveTab();
  if (!tab || tab.zoom >= ZOOM_MAX) return;
  tab.zoom = Math.min(tab.zoom + ZOOM_STEP, ZOOM_MAX);
  applyZoom();
}

function zoomOut() {
  const tab = getActiveTab();
  if (!tab || tab.zoom <= ZOOM_MIN) return;
  tab.zoom = Math.max(tab.zoom - ZOOM_STEP, ZOOM_MIN);
  applyZoom();
}

function zoomReset() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.zoom = 100;
  applyZoom();
}

// ===== Mode switching =====
function setModeInternal(mode) {
  const tab = getActiveTab();
  if (tab) tab.mode = mode;

  if (mode === 'edit') {
    editor.style.display = 'block';
    preview.style.display = 'none';
    editBtn.classList.add('active');
    previewBtn.classList.remove('active');
    statusMode.textContent = 'Edit';
    renderBtn.style.display = 'none';
    zoomControls.style.display = 'none';
    editor.focus();
  } else {
    renderPreview();
    editor.style.display = 'none';
    preview.style.display = 'block';
    editBtn.classList.remove('active');
    previewBtn.classList.add('active');
    statusMode.textContent = 'Preview';
    renderBtn.style.display = 'inline-flex';
    zoomControls.style.display = 'flex';
    applyZoom();
  }
}

function setMode(mode) {
  setModeInternal(mode);
}

function toggleMode() {
  const tab = getActiveTab();
  const current = tab ? tab.mode : 'edit';
  setMode(current === 'edit' ? 'preview' : 'edit');
}

function renderPreview() {
  const tab = getActiveTab();
  let source = editor.value;
  if (tab && tab.isPuml) {
    source = '```plantuml\n' + source + '\n```';
  }
  let html = window.api.renderMarkdown(source);
  const dirPath = tab ? tab.dirPath : null;
  if (dirPath) {
    html = html.replace(
      /(<img\s[^>]*src=")(?!https?:\/\/|data:|file:\/\/)([^"]*")/g,
      `$1file://${dirPath}/$2`
    );
  }
  previewInner.innerHTML = html;
}

async function reloadAndRender() {
  const tab = getActiveTab();
  if (!tab || !tab.filePath) {
    renderPreview();
    return;
  }
  const result = await window.api.reloadFile(tab.filePath);
  if (result && result.content !== undefined) {
    tab.content = result.content;
    tab.isModified = false;
    editor.value = tab.content;
    updateStats();
    renderTabBar();
  }
  renderPreview();
}

// ===== Theme =====
function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  hljsLight.disabled = theme === 'dark';
  hljsDark.disabled = theme === 'light';
  themeIconLight.style.display = theme === 'light' ? 'block' : 'none';
  themeIconDark.style.display = theme === 'dark' ? 'block' : 'none';
  localStorage.setItem('md-reader-theme', theme);
}

function toggleTheme() {
  setTheme(currentTheme === 'light' ? 'dark' : 'light');
}

// ===== Stats =====
function updateStats() {
  const text = editor.value;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines = text.split('\n').length;
  statusInfo.textContent = `Words: ${words}  |  Lines: ${lines}`;
}

// ===== File operations =====
function handleSave() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  window.api.saveFile(tab.content);
}

function handleSaveAs() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  window.api.saveFileAs(tab.content);
}

// ===== Anchor link navigation =====
preview.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  if (href && href.startsWith('#')) {
    e.preventDefault();
    const id = decodeURIComponent(href.slice(1));
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

// ===== Tab key support =====
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    editor.value = value.substring(0, start) + '  ' + value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
  }
});

// ===== Editor input =====
editor.addEventListener('input', () => {
  const tab = getActiveTab();
  if (tab && !tab.isModified) {
    tab.isModified = true;
    window.api.notifyModified();
    renderTabBar();
  }
  updateStats();
});

// ===== Button events =====
editBtn.addEventListener('click', () => setMode('edit'));
previewBtn.addEventListener('click', () => setMode('preview'));
themeBtn.addEventListener('click', toggleTheme);
renderBtn.addEventListener('click', reloadAndRender);
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
zoomResetBtn.addEventListener('click', zoomReset);
tabNewBtn.addEventListener('click', () => createTab());

// ===== Drag and drop =====
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer.files[0];
  if (file && file.path) {
    window.api.openFile();
  }
});

// ===== IPC Events from main process =====
window.api.onFileOpened((data) => {
  // Check if file is already open in a tab
  const existing = tabs.find(t => t.filePath === data.filePath);
  if (existing) {
    existing.content = data.content;
    existing.isModified = false;
    switchTab(existing.id);
    return;
  }

  // If active tab is an empty untitled tab, reuse it
  const active = getActiveTab();
  if (active) active.content = editor.value;
  if (active && !active.filePath && !active.isModified && active.content === '') {
    active.fileName = data.fileName;
    active.filePath = data.filePath;
    active.dirPath = data.dirPath;
    active.content = data.content;
    active.isPuml = data.isPuml || false;
    active.isModified = false;
    if (active.isPuml) active.mode = 'preview';
    editor.value = active.content;
    fileNameEl.textContent = active.fileName;
    setModeInternal(active.mode);
    updateStats();
    renderTabBar();
    window.api.setActiveTab(active.filePath, active.fileName);
    return;
  }

  // Create new tab
  createTab({
    fileName: data.fileName,
    filePath: data.filePath,
    dirPath: data.dirPath,
    content: data.content,
    isPuml: data.isPuml || false,
  });
});

window.api.onFileSaved((data) => {
  const tab = getActiveTab();
  if (tab) {
    tab.fileName = data.fileName;
    tab.filePath = data.filePath;
    tab.isModified = false;
    fileNameEl.textContent = data.fileName;
    renderTabBar();
  }
});

window.api.onNewFile(() => {
  createTab();
});

window.api.onCloseTab(() => {
  if (activeTabId) {
    closeTab(activeTabId);
  }
});

window.api.onToggleMode(toggleMode);
window.api.onToggleTheme(toggleTheme);
window.api.onRequestSave(handleSave);
window.api.onRequestSaveAs(handleSaveAs);
window.api.onRenderPreview(reloadAndRender);
window.api.onFind(openSearch);
window.api.onReplaceAll(replaceAll);
window.api.onExportPdf(async () => {
  const tab = getActiveTab();
  // Render markdown to HTML for export
  let source = editor.value;
  if (tab && tab.isPuml) {
    source = '```plantuml\n' + source + '\n```';
  }
  let html = window.api.renderMarkdown(source);
  const dirPath = tab ? tab.dirPath : null;
  if (dirPath) {
    html = html.replace(
      /(<img\s[^>]*src=")(?!https?:\/\/|data:|file:\/\/)([^"]*")/g,
      `$1file://${dirPath}/$2`
    );
  }
  // Wait for PlantUML diagrams to render
  const pumlDivs = previewInner.querySelectorAll('.plantuml-diagram');
  if (pumlDivs.length > 0) {
    // Switch to preview to trigger rendering, grab the final HTML
    const wasEdit = tab && tab.mode === 'edit';
    if (wasEdit) renderPreview();
    await new Promise(resolve => setTimeout(resolve, 2000));
    html = previewInner.innerHTML;
    if (wasEdit) setModeInternal('edit');
  }
  const fileName = tab ? tab.fileName : 'Untitled';
  await window.api.exportPdf(html, fileName);
});
window.api.onNextTab(() => {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex(t => t.id === activeTabId);
  const next = (idx + 1) % tabs.length;
  switchTab(tabs[next].id);
});
window.api.onPrevTab(() => {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex(t => t.id === activeTabId);
  const prev = (idx - 1 + tabs.length) % tabs.length;
  switchTab(tabs[prev].id);
});
window.api.onGoToTab((index) => {
  if (index >= 0 && index < tabs.length) {
    switchTab(tabs[index].id);
  }
});

// ===== Search & Replace (using Electron findInPage) =====
let searchQuery = '';

function openSearch() {
  searchBar.style.display = 'flex';
  searchInput.focus();
  const sel = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  if (sel && sel.length < 200 && !sel.includes('\n')) {
    searchInput.value = sel;
  }
  if (searchInput.value) {
    triggerFind();
  }
  searchInput.select();
}

function closeSearch() {
  searchBar.style.display = 'none';
  searchQuery = '';
  searchCount.textContent = '';
  window.api.stopFindInPage();
  editor.focus();
}

function triggerFind(forward = true, findNext = false) {
  const query = searchInput.value;
  if (!query) {
    searchQuery = '';
    searchCount.textContent = '';
    window.api.stopFindInPage();
    return;
  }
  searchQuery = query;
  window.api.findInPage(query, { forward, findNext });
}

function searchNext() {
  if (!searchInput.value) return;
  window.api.findInPage(searchInput.value, { forward: true, findNext: true });
}

function searchPrev() {
  if (!searchInput.value) return;
  window.api.findInPage(searchInput.value, { forward: false, findNext: true });
}

function replaceCurrent() {
  const query = searchInput.value;
  const replacement = replaceInput.value;
  if (!query) return;

  // Replace the current selection if it matches
  const selStart = editor.selectionStart;
  const selEnd = editor.selectionEnd;
  const selected = editor.value.substring(selStart, selEnd);
  if (selected.toLowerCase() === query.toLowerCase()) {
    editor.value = editor.value.substring(0, selStart) + replacement + editor.value.substring(selEnd);
    editor.setSelectionRange(selStart + replacement.length, selStart + replacement.length);
    markModified();
    updateStats();
    // Find next
    triggerFind(true, false);
  } else {
    // No match selected, find first
    triggerFind();
  }
}

function replaceAll() {
  const query = searchInput.value;
  const replacement = replaceInput.value;
  if (!query) return;

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const text = editor.value;
  const newText = text.replace(regex, replacement);
  if (newText === text) return;

  editor.value = newText;
  const tab = getActiveTab();
  if (tab) tab.content = newText;
  markModified();
  updateStats();
  triggerFind();
}

function markModified() {
  const tab = getActiveTab();
  if (tab && !tab.isModified) {
    tab.isModified = true;
    window.api.notifyModified();
    renderTabBar();
  }
}

// Listen for findInPage results
window.api.onFoundInPage((result) => {
  if (result.finalUpdate) {
    searchCount.textContent = result.matches > 0
      ? `${result.activeMatchOrdinal} / ${result.matches}`
      : 'No results';
  }
});

searchInput.addEventListener('input', () => triggerFind());

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    searchPrev();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    searchNext();
  } else if (e.key === 'Escape') {
    closeSearch();
  }
});

replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    replaceCurrent();
  } else if (e.key === 'Escape') {
    closeSearch();
  }
});

searchPrevBtn.addEventListener('click', searchPrev);
searchNextBtn.addEventListener('click', searchNext);
searchCloseBtn.addEventListener('click', closeSearch);
replaceBtn.addEventListener('click', replaceCurrent);
replaceAllBtn.addEventListener('click', replaceAll);

// ===== Init =====
(function init() {
  const savedTheme = localStorage.getItem('md-reader-theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  }

  // Start with one empty tab
  createTab();
})();
