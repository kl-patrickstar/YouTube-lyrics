# 🎵 YouTube Lyrics

Synced lyrics for YouTube — in a floating, resizable panel. Like Apple Music, but for any video.

![Browsers](https://img.shields.io/badge/browsers-Safari%20%7C%20Chrome-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ Features

- 🎤 **Karaoke mode** — Active line auto-highlights, frame-perfect sync
- 📖 **Text mode** — Clean reading view without highlighting
- ✨ **Popover UI** — Panel grows out of the button, shrinks back when closed
- 🎨 **Smart pill** — Click for ±0.5s, hold for ±5s repeated adjustment
- 🔵 **Streaming links** — Spotify, Apple Music, Ultimate Guitar tabs
- 📋 **Copy & print** — Clipboard with title + artist header, print preview
- ⚙️ **Settings overlay** — Auto-scroll toggle, theme, font size, reset
- ⌨️ **Shortcut** — `⌘⇧L` (macOS) / `Ctrl+Shift+L` (Win/Linux)

---

## 🌐 Browser Support

| Browser | Status | Install |
|---------|--------|---------|
| Safari (macOS) | ✅ Full | Xcode build |
| Chrome | ✅ Full | Load unpacked |
| Edge | ✅ Works | Like Chrome |
| Firefox | ⚠️ Not tested | Manifest V2 required |

---

## 🚀 Installation

### Chrome

```bash
git clone https://github.com/kl-patrickstar/YouTube-lyrics.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the cloned folder
4. Pin the toolbar icon, then open any YouTube video

### Safari

Build via Xcode:

1. Open the Xcode project: `YouTube Lyrics.xcodeproj`
2. Press `⌘R` to build & run the host app
3. Close the host window
4. Safari → **Settings → Extensions** → enable **YouTube Lyrics**
5. Open YouTube and press `⌘⇧L`

> **Tip:** Safari caches extensions aggressively. After code changes: disable → restart Safari → re-enable.

---

## 📂 Project Structure

```text
YouTube-lyrics/
├── manifest.json        # Manifest V3
├── background.js        # Service worker (storage, fetch proxy, commands)
├── content.js           # Orchestrator (refresh, resolve, render)
├── state.js             # Global state
├── bridge.js            # Storage + fetch messaging
├── api.js               # LRCLIB, lyrics.ovh, iTunes
├── lyrics.js            # LRC parser, song info heuristics
├── youtube.js           # DOM helpers (video ID, metadata, chapters)
├── sync.js              # Sync engine (requestVideoFrameCallback)
├── template.js          # Shadow DOM template + CSS
├── ui.js                # UI logic (panel, settings, drag, popover)
├── popup.html           # Toolbar popup markup
├── popup.js             # Toolbar popup logic
├── icon.svg             # Vector icon
├── icons/               # Icon set (16–512 px)
└── README.md
```

---

## 🔧 How It Works

1. **Detect video** — video ID + metadata via oEmbed + DOM
2. **Parse song** — Artist/title via heuristics (Topic channels, separators, `ft.`)
3. **Fetch lyrics** — LRCLIB first, lyrics.ovh as fallback
4. **Sync** — `requestVideoFrameCallback` for 30–60 fps timing accuracy
5. **Render** — Isolated Shadow DOM with karaoke highlighting + auto-scroll

---

## 📡 APIs Used

All free, no API keys required:

| API | Purpose |
|-----|---------|
| [LRCLIB](https://lrclib.net) | Synced lyrics (LRC format) |
| [lyrics.ovh](https://lyrics.ovh) | Plain-text fallback |
| [iTunes Search](https://itunes.apple.com) | Album artwork |

---

## 🔒 Privacy

- All data stored locally via `chrome.storage.local`
- No tracking, no analytics, no third-party scripts
- Only talks to the three public APIs listed above

---

## 🗺️ Roadmap

- [ ] Screenshots for README
- [ ] iOS Safari testing
- [ ] Firefox support (Manifest V2)
- [ ] Export as `.lrc` / `.srt` / `.md`
- [ ] Web Share API
- [ ] Compact mode (active line only)
- [ ] Translation toggle (EN ↔ DE)

---

## 🤝 Contributing

Issues and pull requests are welcome. Open an issue on GitHub for bugs or feature ideas.

---

## 📄 License

MIT — free to use, including commercially.

> **Note on lyrics:** Lyrics are provided by third-party APIs. Commercial use of lyrics requires proper licensing (e.g. Musixmatch, LyricFind). The extension itself is open source.

---

## 🙏 Credits

- Inspired by Apple Music & Spotify Lyrics
- Icons: custom SVG
- Lyrics: LRCLIB, lyrics.ovh · Artwork: iTunes Search API

Made with ❤️ for music lovers
