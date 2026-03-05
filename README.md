# DannyReads

Markdown & PlantUML reader/editor for macOS (Apple Silicon).

## What it does

- Open `.md` files, edit them as raw text, preview rendered Markdown
- Open `.puml` files, preview PlantUML diagrams (rendered offline)
- Tabs — open multiple files at once (Cmd + O supports multi-select)
- Per-tab zoom in preview mode (30%–300%)
- Anchor link navigation in Markdown preview
- Manual re-render button for PlantUML diagrams
- Light and dark theme
- Syntax highlighting for code blocks

## Requirements

- macOS (Apple Silicon / M-series)
- [Node.js](https://nodejs.org/) (v18+)
- Java (for PlantUML rendering) — `brew install openjdk`

## Quick install

```bash
git clone https://github.com/DanekDev/DannyReads.git
cd DannyReads
./install.sh
```

The script installs dependencies, downloads PlantUML, builds the app, and copies it to `/Applications`.

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
curl -L -o vendor/plantuml.jar https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar
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
| Cmd + N | New tab |
| Cmd + O | Open file(s) in new tab |
| Cmd + W | Close tab |
| Cmd + S | Save |
| Cmd + Shift + S | Save as |
| Cmd + Shift + P | Toggle Edit / Preview |
| Cmd + Shift + R | Re-render preview |
| Cmd + Shift + T | Toggle Light / Dark theme |

## How to use

1. **Open a file** — Cmd + O (multi-select supported), drag a file onto the window, or double-click a `.md` / `.puml` file in Finder
2. **Edit** — type in the editor (Edit mode)
3. **Preview** — click Preview button or Cmd + Shift + P to see rendered Markdown / PlantUML
4. **Zoom** — use +/- buttons in the toolbar when in preview mode (per-tab)
5. **Re-render** — click the refresh icon or Cmd + Shift + R to re-render the preview
6. **Save** — Cmd + S
7. **Tabs** — open multiple files, click tabs to switch, click X on a tab to close it
8. **Theme** — click the sun/moon icon or Cmd + Shift + T

## Supported file types

- `.md`, `.markdown`, `.mdown`, `.mkd`, `.txt` — Markdown
- `.puml`, `.plantuml`, `.pu`, `.wsd` — PlantUML

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

**PlantUML "allowmixing" error:**
If your diagram mixes element types (e.g. `package` + `state`), add `allowmixing` after `@startuml` in your `.puml` file.
