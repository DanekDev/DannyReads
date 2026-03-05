# DannyReads

Markdown & PlantUML reader/editor for macOS (Apple Silicon).

## What it does

- Open `.md` files, edit them as raw text, preview rendered Markdown
- Open `.puml` files, preview PlantUML diagrams (rendered offline)
- Tabs — open multiple files at once
- Light and dark theme
- Syntax highlighting for code blocks

## Requirements

- macOS (Apple Silicon / M-series)
- [Node.js](https://nodejs.org/) (v18+)
- Java (for PlantUML rendering) — `brew install openjdk`

## How to build and install

### Step 1: Clone the repo

```bash
git clone https://github.com/DanekDev/DannyReads.git
cd DannyReads
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Download PlantUML JAR

PlantUML JAR is not included in the repo (too large). Download it:

```bash
mkdir -p vendor
curl -L -o vendor/plantuml.jar https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar
```

If PlantUML rendering is not needed, skip this step — everything else will work fine.

### Step 4: Build the app

```bash
npm run build
```

This creates `dist/mac-arm64/DannyReads.app`.

### Step 5: Install to Applications

```bash
cp -r dist/mac-arm64/DannyReads.app /Applications/
```

### Step 6: Launch

Open **DannyReads** from Launchpad or `/Applications`.

First launch: macOS may say the app is from an unidentified developer. Go to **System Settings > Privacy & Security**, scroll down, click **Open Anyway**.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd + N | New tab |
| Cmd + O | Open file (in new tab) |
| Cmd + W | Close tab |
| Cmd + S | Save |
| Cmd + Shift + S | Save as |
| Cmd + Shift + P | Toggle Edit / Preview |
| Cmd + Shift + T | Toggle Light / Dark theme |

## How to use

1. **Open a file** — Cmd + O, or drag a file onto the window, or double-click a `.md` / `.puml` file in Finder
2. **Edit** — type in the editor (Edit mode)
3. **Preview** — click Preview button or Cmd + Shift + P to see rendered Markdown / PlantUML
4. **Save** — Cmd + S
5. **Tabs** — open multiple files, click tabs to switch, click X on a tab to close it
6. **Theme** — click the sun/moon icon or Cmd + Shift + T

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
