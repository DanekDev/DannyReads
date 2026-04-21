# DannyReads

Markdown, PlantUML & Mermaid reader/editor for macOS (Apple Silicon).

## What it does

- Open `.md` files, edit them as raw text, preview rendered Markdown
- Open `.puml` files, preview PlantUML diagrams (rendered offline via local JAR)
- Open `.mmd` files, preview Mermaid diagrams (flowchart, sequence, class, gantt, pie, ER, state, etc.)
- Mermaid diagrams inside Markdown (` ```mermaid ` code blocks)
- Tabs — open multiple files at once (Cmd+O supports multi-select)
- Sidebar file explorer — open a folder and browse its tree (Cmd+Shift+O)
- Search & Replace (Cmd+F / Cmd+Shift+M)
- Export to PDF (Cmd+Shift+E) with styled tables, blockquotes, and diagrams
- Per-tab zoom in preview mode (30%–300%)
- Anchor link navigation in Markdown preview
- Light and dark theme (Mermaid diagrams adapt automatically)
- Syntax highlighting for code blocks
- Opens files from Finder ("Open With") and brings app to foreground

## Requirements

- macOS (Apple Silicon / M-series)
- [Node.js](https://nodejs.org/) (v18+) — auto-installed via brew if missing
- Java (for PlantUML rendering) — `brew install openjdk`

## Quick install

```bash
git clone https://github.com/DanekDev/DannyReads.git
cd DannyReads
./install.sh
```

The script installs Node (if missing), dependencies, downloads PlantUML, builds the app, and copies it to `/Applications`.

## Manual install

### Step 1: Clone and install dependencies

```bash
git clone https://github.com/DanekDev/DannyReads.git
cd DannyReads
npm install
```

### Step 2: Download PlantUML JAR

```bash
mkdir -p vendor
curl -L -o vendor/plantuml.jar https://github.com/plantuml/plantuml/releases/download/v1.2026.1/plantuml-1.2026.1.jar
```

If PlantUML rendering is not needed, skip this step — everything else will work fine.

### Step 3: Build and install

```bash
npm run build
cp -r dist/mac-arm64/DannyReads.app /Applications/
```

### Step 4: Launch

Open **DannyReads** from Launchpad or `/Applications`.

First launch: macOS may say the app is from an unidentified developer. Go to **System Settings > Privacy & Security**, scroll down, click **Open Anyway**.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd+N | New tab |
| Cmd+O | Open file(s) |
| Cmd+Shift+O | Open folder in sidebar |
| Cmd+W | Close tab |
| Cmd+S | Save |
| Cmd+Shift+S | Save as |
| Cmd+Shift+E | Export as PDF |
| Cmd+Shift+P | Toggle Edit / Preview |
| Cmd+Shift+R | Re-render preview |
| Cmd+Shift+T | Toggle Light / Dark theme |
| Cmd+B | Toggle sidebar |
| Cmd+F | Find |
| Cmd+Shift+M | Replace all |
| Cmd+Shift+] | Next tab |
| Cmd+Shift+[ | Previous tab |
| Cmd+1–9 | Go to tab by number |

## How to use

1. **Open a file** — Cmd+O (multi-select supported), drag a file onto the window, or double-click in Finder
2. **Open a folder** — Cmd+Shift+O to browse a project in the sidebar
3. **Edit** — type in the editor (Edit mode)
4. **Preview** — click Preview or Cmd+Shift+P to see rendered Markdown / PlantUML / Mermaid
5. **Search** — Cmd+F to find, Enter/Shift+Enter to navigate matches, replace individual or all
6. **Export** — Cmd+Shift+E to export current document as PDF
7. **Zoom** — use +/- buttons in the toolbar when in preview mode (per-tab)
8. **Tabs** — open multiple files, Cmd+Shift+]/[ to switch, Cmd+1–9 to jump
9. **Theme** — click the sun/moon icon or Cmd+Shift+T

## Supported file types

- `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt` — Markdown
- `.puml`, `.plantuml`, `.pu`, `.wsd` — PlantUML
- `.mmd` — Mermaid

## Development

Run without building:

```bash
npm start
```

## Troubleshooting

**App won't open / "damaged" warning:**
```bash
xattr -cr /Applications/DannyReads.app
```

**PlantUML diagrams show error:**
Make sure Java is installed: `java -version`. If not: `brew install openjdk`.

**Mermaid diagrams not rendering:**
Make sure `mermaid` is installed: `npm install` in the project directory.
