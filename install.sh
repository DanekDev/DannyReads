#!/bin/bash
set -e

echo "=== DannyReads Installer ==="
echo ""

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: DannyReads is macOS only."
  exit 1
fi

# Check Apple Silicon
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Error: DannyReads requires Apple Silicon (M-series)."
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js not found. Install it: https://nodejs.org/"
  exit 1
fi

echo "[1/5] Installing dependencies..."
npm install

echo "[2/5] Downloading PlantUML..."
mkdir -p vendor
if [ ! -f vendor/plantuml.jar ]; then
  curl -L -o vendor/plantuml.jar \
    https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar
  echo "      PlantUML downloaded."
else
  echo "      PlantUML already exists, skipping."
fi

echo "[3/5] Building app..."
npm run build

echo "[4/5] Installing to /Applications..."
cp -r dist/mac-arm64/DannyReads.app /Applications/

echo "[5/5] Clearing quarantine flag..."
xattr -cr /Applications/DannyReads.app 2>/dev/null || true

echo ""
echo "Done! Open DannyReads from Launchpad or /Applications."
