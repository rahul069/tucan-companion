#!/usr/bin/env bash
# Build the extension zip for GitHub releases and the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('extension/manifest.json'))['version'])")
mkdir -p dist
rm -f dist/tucan-companion-extension.zip
(cd extension && zip -qr ../dist/tucan-companion-extension.zip . -x '.*')
echo "dist/tucan-companion-extension.zip (v$version)"
