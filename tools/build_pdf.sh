#!/usr/bin/env bash
# Render the reading guide HTML to an A4 PDF using headless Google Chrome (macOS path by default).
# Usage: tools/build_pdf.sh   — override the browser with CHROME=/path/to/chrome
# Needs internet once for Google Fonts; without it Chrome falls back to system fonts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="$ROOT/01-reading-guide/reading-guide.html"
OUT="$ROOT/01-reading-guide/DataFusion-ban-doc-hieu.pdf"
PROFILE="$(mktemp -d)"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (set CHROME=...)" >&2; exit 1; }
rm -f "$OUT"
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$PROFILE" --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf="$OUT" "file://$SRC" >/dev/null 2>&1 &
PID=$!
# Headless Chrome sometimes lingers after writing the file: wait for a stable file, then stop it.
last=-1
for _ in $(seq 1 120); do
  sleep 1
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  size=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT" 2>/dev/null || echo 0)
  if [ "$size" -gt 0 ] && [ "$size" -eq "$last" ]; then break; fi
  last=$size
done
kill "$PID" 2>/dev/null || true
rm -rf "$PROFILE"
[ -s "$OUT" ] || { echo "PDF was not produced" >&2; exit 1; }
echo "Wrote $OUT"
