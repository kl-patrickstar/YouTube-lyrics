#!/bin/bash
# sync.sh — Kopiert Extension-Dateien aus Xcode in den flachen Ordner (für GitHub)
#
# Verwendung:
#   ~/youtube-lyrics-extension/sync.sh                    # kopiert alles
#   ~/youtube-lyrics-extension/sync.sh --git              # kopiert + git add/commit/push
#   ~/youtube-lyrics-extension/sync.sh --git "Message"    # mit Commit-Message

set -e

SRC="/Users/stefankl/YouTube Lyrics/Shared (Extension)"
DST="$HOME/youtube-lyrics-extension"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🔄 YouTube Lyrics — Sync Xcode → GitHub-Ordner${NC}"
echo ""

if [ ! -d "$SRC" ]; then
  echo -e "${RED}❌ Quelle nicht gefunden: $SRC${NC}"
  exit 1
fi

if [ ! -d "$DST" ]; then
  echo -e "${RED}❌ Ziel nicht gefunden: $DST${NC}"
  exit 1
fi

COPIED=0
SKIPPED=0

sync_file() {
  local rel_path="$1"
  local src_file="$SRC/$rel_path"
  local dst_file="$DST/$rel_path"

  if [ ! -f "$src_file" ]; then
    return
  fi

  if [ -f "$dst_file" ] && cmp -s "$src_file" "$dst_file"; then
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  mkdir -p "$(dirname "$dst_file")"
  cp "$src_file" "$dst_file"
  echo -e "   ${GREEN}✅${NC} $rel_path"
  COPIED=$((COPIED + 1))
}

# Content-Module (8 Dateien)
for f in ui.js template.js sync.js youtube.js api.js lyrics.js bridge.js state.js; do
  sync_file "content/$f"
done

# Popup
sync_file "popup.js"
sync_file "popup.html"

# Icons-Ordner
if [ -d "$SRC/icons" ]; then
  for icon in "$SRC/icons"/*; do
    if [ -f "$icon" ]; then
      name="icons/$(basename "$icon")"
      sync_file "$name"
    fi
  done
fi

# NOTE: content.js, background.js, manifest.json, icon.svg are NOT synced —
# they live only in the flat folder and are loaded by Xcode via references.

echo ""
if [ $COPIED -eq 0 ]; then
  echo -e "${YELLOW}✨ Nichts zu tun — alle Dateien sind aktuell.${NC}"
else
  echo -e "${GREEN}✅ Fertig: $COPIED Datei(en) kopiert, $SKIPPED unverändert.${NC}"
fi

# Optional: Git commit + push
if [ "$1" = "--git" ]; then
  echo ""
  echo -e "${BLUE}📦 Git-Commit + Push${NC}"

  cd "$DST"

  if [ ! -d .git ]; then
    echo -e "${RED}❌ Kein Git-Repo in $DST${NC}"
    exit 1
  fi

  git add -A

  if git diff --cached --quiet; then
    echo -e "${YELLOW}Keine Änderungen zu committen.${NC}"
  else
    MSG="${2:-Update $(date '+%Y-%m-%d %H:%M')}"
    git commit -m "$MSG"
    git push origin main
    echo -e "${GREEN}✅ Gepusht zu GitHub.${NC}"
  fi
fi

echo ""
