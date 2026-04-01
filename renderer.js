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
const sidebar = document.getElementById('sidebar');
const sidebarTree = document.getElementById('sidebar-tree');
const sidebarTitle = document.getElementById('sidebar-title');
const sidebarOpenFolderBtn = document.getElementById('sidebar-open-folder-btn');
const sidebarResize = document.getElementById('sidebar-resize');

let currentTheme = 'light';
let sidebarVisible = false;
let currentFolderPath = null;
let folderTree = null;
let expandedDirs = new Set();
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

  // Update sidebar active highlight
  if (sidebarVisible && folderTree) renderTree();
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

// ===== Sidebar =====
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  sidebar.style.display = sidebarVisible ? 'flex' : 'none';
  sidebarResize.style.display = sidebarVisible ? 'block' : 'none';
  localStorage.setItem('md-reader-sidebar', sidebarVisible ? '1' : '0');
}

function showSidebar() {
  if (!sidebarVisible) toggleSidebar();
}

async function openFolder(folderPath) {
  currentFolderPath = folderPath;
  const result = await window.api.readDir(folderPath);
  if (!result) return;
  folderTree = result.tree;
  sidebarTitle.textContent = result.root;
  expandedDirs.clear();
  renderTree();
  showSidebar();
  localStorage.setItem('md-reader-folder', folderPath);
}

function renderTree() {
  sidebarTree.innerHTML = '';
  if (!folderTree) return;
  renderTreeNodes(folderTree, sidebarTree, 0);
}

function renderTreeNodes(nodes, container, depth) {
  for (const node of nodes) {
    const el = document.createElement('div');
    el.className = 'tree-item';
    el.style.paddingLeft = `${8 + depth * 16}px`;

    // Highlight active file
    const activeTab = getActiveTab();
    if (!node.isDir && activeTab && activeTab.filePath === node.path) {
      el.classList.add('active');
    }

    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'tree-item-arrow';
    if (node.isDir) {
      arrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      if (expandedDirs.has(node.path)) arrow.classList.add('expanded');
    } else {
      arrow.classList.add('hidden');
    }
    el.appendChild(arrow);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'tree-item-icon';
    if (node.isDir) {
      icon.innerHTML = expandedDirs.has(node.path)
        ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3.5C1 2.67 1.67 2 2.5 2H5.5L7 3.5H11.5C12.33 3.5 13 4.17 13 5V10.5C13 11.33 12.33 12 11.5 12H2.5C1.67 12 1 11.33 1 10.5V3.5Z" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3.5C1 2.67 1.67 2 2.5 2H5.5L7 3.5H11.5C12.33 3.5 13 4.17 13 5V10.5C13 11.33 12.33 12 11.5 12H2.5C1.67 12 1 11.33 1 10.5V3.5Z" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>';
    } else {
      const ext = node.name.split('.').pop().toLowerCase();
      if (['puml', 'plantuml', 'pu', 'wsd'].includes(ext)) {
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#6a9955" stroke-width="1.1"/><path d="M5 5L7 7L5 9" stroke="#6a9955" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      } else {
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5H8.5L11 4V12.5H3V1.5Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M8.5 1.5V4H11" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';
      }
    }
    el.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'tree-item-name';
    name.textContent = node.name;
    el.appendChild(name);

    // Click handler
    if (node.isDir) {
      el.addEventListener('click', () => {
        if (expandedDirs.has(node.path)) {
          expandedDirs.delete(node.path);
        } else {
          expandedDirs.add(node.path);
        }
        renderTree();
      });
    } else {
      el.addEventListener('click', () => {
        window.api.openFile().then(() => {}); // unused; we open directly
        // Open file via the same mechanism
        openFileFromSidebar(node.path);
      });
    }

    container.appendChild(el);

    // Render children if expanded
    if (node.isDir && expandedDirs.has(node.path) && node.children) {
      renderTreeNodes(node.children, container, depth + 1);
    }
  }
}

async function openFileFromSidebar(filePath) {
  // Check if already open
  const existing = tabs.find(t => t.filePath === filePath);
  if (existing) {
    switchTab(existing.id);
    return;
  }
  // Use the reload-file IPC to read, then create tab
  const result = await window.api.reloadFile(filePath);
  if (!result) return;
  const fileName = filePath.split('/').pop();
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
  const ext = fileName.split('.').pop().toLowerCase();
  const isPuml = ['puml', 'plantuml', 'pu', 'wsd'].includes(ext);

  // Reuse empty untitled tab
  const active = getActiveTab();
  if (active) active.content = editor.value;
  if (active && !active.filePath && !active.isModified && active.content === '') {
    active.fileName = fileName;
    active.filePath = filePath;
    active.dirPath = dirPath;
    active.content = result.content;
    active.isPuml = isPuml;
    active.isModified = false;
    if (isPuml) active.mode = 'preview';
    editor.value = active.content;
    fileNameEl.textContent = active.fileName;
    setModeInternal(active.mode);
    updateStats();
    renderTabBar();
    window.api.setActiveTab(active.filePath, active.fileName);
  } else {
    createTab({ fileName, filePath, dirPath, content: result.content, isPuml });
  }
  renderTree(); // Update active highlight
}

// Sidebar resize
let resizing = false;
sidebarResize.addEventListener('mousedown', (e) => {
  e.preventDefault();
  resizing = true;
  sidebarResize.classList.add('dragging');
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
});

function onResizeMove(e) {
  if (!resizing) return;
  const newWidth = e.clientX;
  if (newWidth >= 160 && newWidth <= 480) {
    sidebar.style.width = newWidth + 'px';
  }
}

function onResizeEnd() {
  resizing = false;
  sidebarResize.classList.remove('dragging');
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

sidebarOpenFolderBtn.addEventListener('click', async () => {
  const folderPath = await window.api.openFolderDialog();
  if (folderPath) openFolder(folderPath);
});

// Wire up sidebar IPC
window.api.onFolderOpened(openFolder);
window.api.onToggleSidebar(toggleSidebar);

// ===== Init =====
(function init() {
  const savedTheme = localStorage.getItem('md-reader-theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  }

  // Restore sidebar state
  const savedFolder = localStorage.getItem('md-reader-folder');
  const savedSidebar = localStorage.getItem('md-reader-sidebar');
  if (savedSidebar === '1' && savedFolder) {
    openFolder(savedFolder);
  }

  // Start with one empty tab
  createTab();
})();
