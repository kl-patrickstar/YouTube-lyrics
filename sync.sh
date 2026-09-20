#!/bin/bash
# sync.sh — Kopiert Extension-Dateien aus Xcode in den flachen Ordner (für Chrome + GitHub)

set -e

SRC="/Users/stefankl/YouTube Lyrics/Shared (Extension)"
DST="$HOME/youtube-lyrics-extension"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🔄 YouTube Lyrics — Sync Xcode → Flacher Ordner${NC}"
echo ""

if [ ! -d "$SRC" ] || [ ! -d "$DST" ]; then
  echo -e "${RED}❌ Ordner nicht gefunden${NC}"
  exit 1
fi

COPIED=0
SKIPPED=0

sync_file() {
  local src_file="$1"
  local dst_file="$2"
  if [ ! -f "$src_file" ]; then return; fi
  if [ -f "$dst_file" ] && cmp -s "$src_file" "$dst_file"; then
    SKIPPED=$((SKIPPED + 1)); return
  fi
  cp "$src_file" "$dst_file"
  echo -e "   ${GREEN}✅${NC} $(basename "$dst_file")"
  COPIED=$((COPIED + 1))
}

# 8 Content-Module: aus Xcode content/ → flach nach DST
for f in ui.js template.js sync.js youtube.js api.js lyrics.js bridge.js state.js; do
  sync_file "$SRC/content/$f" "$DST/$f"
done

# Popup
sync_file "$SRC/popup.js" "$DST/popup.js"
sync_file "$SRC/popup.html" "$DST/popup.html"

# Icons-Ordner
if [ -d "$SRC/icons" ]; then
  mkdir -p "$DST/icons"
  for icon in "$SRC/icons"/*; do
    if [ -f "$icon" ]; then
      sync_file "$icon" "$DST/icons/$(basename "$icon")"
    fi
  done
fi

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
