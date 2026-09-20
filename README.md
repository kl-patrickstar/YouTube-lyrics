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

### Safari (macOS)

Safari doesn't allow loading a folder directly. You have to generate an **Xcode project** and build it yourself.

#### Prerequisites

- macOS 12 or newer
- **Xcode** (free on the Mac App Store)
- An Apple Account (a free one is enough for local development)

#### 1. Clone the repository

```bash
git clone https://github.com/kl-patrickstar/YouTube-lyrics.git
cd YouTube-lyrics
```

#### 2. Generate the Xcode project

Apple ships a converter that turns any WebExtension folder into a ready-to-build Xcode project:

```bash
xcrun safari-web-extension-converter . \
  --project-location ~/Desktop/YouTubeLyrics \
  --app-name "YouTube Lyrics" \
  --bundle-identifier "com.yourname.youtubelyrics" \
  --macos-only \
  --no-open
```

Replace `com.yourname.youtubelyrics` with your own unique identifier.

#### 3. Open the project

```bash
open ~/Desktop/YouTubeLyrics/YouTube\ Lyrics.xcodeproj
```

Or double-click the `.xcodeproj` file in Finder.

#### 4. Build and run

In Xcode:

1. Set the scheme in the top toolbar to **YouTube Lyrics (macOS)**
2. Press `⌘R` to build and run
3. A small **host window** appears — close it again
4. If Xcode complains about signing: go to **Signing & Capabilities** and select your Apple team

#### 5. Enable in Safari

1. Safari → **Settings** (`⌘,`)
2. Open the **Extensions** tab
3. Find **YouTube Lyrics** → enable the checkbox
4. Accept the permission prompt
5. Optional: **Safari → Settings → Websites → YouTube Lyrics** → set to **Allow**

#### 6. Test

1. Open YouTube and play a music video
2. Press `⌘⇧L` or click the 🎵 icon

> **Tip:** Safari caches Web Extensions aggressively. After code changes:
> 1. Disable the extension in Safari
> 2. Quit Safari completely (`⌘Q`)
> 3. In Xcode: `Product → Clean Build Folder` (`⇧⌘K`)
> 4. Rebuild with `⌘R`
> 5. Restart Safari → re-enable the extension

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
2. **Parse song** — artist/title via heuristics (Topic channels, separators, `ft.`)
3. **Fetch lyrics** — LRCLIB first, lyrics.ovh as fallback
4. **Sync** — `requestVideoFrameCallback` for 30–60 fps timing accuracy
5. **Render** — isolated Shadow DOM with karaoke highlighting + auto-scroll

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
