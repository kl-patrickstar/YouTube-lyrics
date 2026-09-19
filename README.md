# 🎵 YouTube Lyrics – Browser Extension

Eine schlanke Browser-Extension, die synchronisierte Songtexte zu YouTube-Videos anzeigt – im Stil moderner Music-Apps wie Apple Music oder Spotify.

**Status:** Aktiv in Entwicklung · v1.0.0 
**Browser:** Safari (macOS)  und Chrome (macOS/Windows/Linux)
**Standard:** WebExtension (Manifest V3)

---

## ✨ Features

### 🎤 Karaoke-Modus
- Automatische Zeilen-Hervorhebung synchron zum Video 
- Sanftes Auto-Scrolling (ein-/ausschaltbar)
- Klick auf eine Zeile springt zur entsprechenden Song-Position

### 📖 Text-Modus
- Ruhige Lese-Ansicht ohne Hervorhebung
- Ideal zum Mitsingen oder Nachlesen

### ⏱️ Intelligentes Timing
- Auto-Offset-Erkennung via YouTube-Kapitel (Intro/Song/Outro)
- Dauer-basierte Heuristik für Videos ohne Kapitel
- Manuelle Feinjustierung (±0,5s / ±5s)
- LRC-Offset-Tag (`[offset: +500]`) wird unterstützt

### 🎨 Premium-UI
- Modernes Dark-Theme mit Glassmorphism
- Automatische Light/Dark-Erkennung basierend auf YouTube
- Frei verschiebbares Panel und Button
- Smooth Animations

### 🖼️ Album-Cover
- Automatische Cover-Suche via iTunes Search API
- Angezeigt im Header neben Songtitel & Künstler

### 🔗 Externe Links & Aktionen
- Ultimate Guitar – Tabs & Chords
- Apple Music – Song öffnen
- Drucken – Sauber formatierte Druckvorschau in neuem Tab
- Kopieren – Songtext in die Zwischenablage

### 💾 Caching
- Lyrics, Cover & Einstellungen werden lokal gespeichert
- Sofortiger Start bei wiederholtem Anhören

### ⚙️ Einstellungen
- Auto-Open bei Musikvideos (Topic-Kanäle)
- Theme: Dunkel / Hell / Auto
- Schriftgröße (14–26 px)
- Karaoke- oder Text-Modus

### ⌨️ Keyboard Shortcut
- `⌘ + Shift + L` (macOS) / `Ctrl + Shift + L` (Windows/Linux) – Panel öffnen/schließen

---

## 🌐 Browser-Unterstützung

| Browser | Status | Installation |
|---------|--------|--------------|
| Safari (macOS) | ✅ Vollständig unterstützt | Über Xcode konvertieren |
| Chrome (macOS/Windows/Linux) | ✅ Vollständig unterstützt | Direkt als Entpackte Erweiterung laden |
| Edge (Chromium-basiert) | ✅ Sollte funktionieren | Wie Chrome |
| Firefox | ⚠️ Nicht getestet | Andere Manifest-Version nötig (V2) |
| iOS Safari | ⚠️ In Vorbereitung | Über Xcode bauen |

---

## 🛠️ Installation

### 🟢 Chrome (Entwicklermodus)

Die einfachste und schnellste Methode. Kein Xcode, keine Konvertierung.

**1. Repository klonen:**

    git clone https://github.com/kl-patrickstar/YouTube-lyrics.git
    cd YouTube-lyrics

**2. Chrome öffnen:**

- Adressleiste: `chrome://extensions`
- Oben rechts: Entwicklermodus aktivieren

**3. Extension laden:**

- Klick auf "Entpackte Erweiterung laden"
- Wähle den geklonten Ordner YouTube-lyrics

**4. Fertig:**

- Die Extension erscheint in der Liste
- Toolbar-Icon anpinnen (Puzzle-Symbol → Pin)
- YouTube öffnen und testen 🎉

Tipp: Chrome lädt Änderungen automatisch neu, wenn du auf das 🔄-Symbol in der Extension-Liste klickst. Du musst Chrome nicht neu starten.

---

### 🔵 Safari (macOS)

Safari erlaubt es nicht, einen Ordner direkt zu laden. Wir konvertieren die Extension mit Xcode.

**Voraussetzungen:**
- macOS 12 oder neuer
- Xcode (kostenlos im App Store)
- Apple Developer Account
- (Für unsignierte Extensions): Entwicklermodus in Safari aktivieren

**1. Repository klonen:**

    git clone https://github.com/kl-patrickstar/YouTube-lyrics.git
    cd YouTube-lyrics

**2. Xcode-Projekt generieren:**

    xcrun safari-web-extension-converter . \
      --project-location ~/YouTubeLyrics \
      --app-name "YouTube Lyrics" \
      --extension-name "YouTubeLyricsExtension" \
      --macos-only

**3. Projekt in Xcode öffnen:**

    open ~/YouTubeLyrics/YouTube\ Lyrics.xcodeproj

**4. App bauen & starten:**

- ⌘ + R drücken
- Die Host-App startet
- Host-Fenster wieder schließen

**5. Extension in Safari aktivieren:**

- Safari → Einstellungen → Erweiterungen
- "YouTube Lyrics" aktivieren
- Berechtigungen bestätigen

**6. Testen:**

- YouTube öffnen
- Ein Musikvideo abspielen
- ⌘ + Shift + L drücken oder auf das 🎵-Icon klicken

Wichtig: Bei jedem Code-Update muss die Extension in Safari deaktiviert und neu aktiviert werden, weil Safari Web-Extensions aggressiv cached.

---

## 📂 Projektstruktur

Die Extension folgt dem WebExtension-Standard (Manifest V3) und läuft unverändert in Safari und Chrome.

    YouTube-lyrics/
    ├── manifest.json         # Extension-Konfiguration (Manifest V3)
    ├── background.js         # Service Worker: Storage, CORS-Proxy, Commands
    │
    ├── content.js            # Orchestrierung: Refresh, Song-Info, Lyrics-Abruf
    ├── state.js              # Globaler State (Settings, UI-Referenzen, Cache)
    ├── bridge.js             # Kommunikation zum Service Worker (Storage, Fetch)
    ├── api.js                # Lyrics-APIs (LRCLIB, lyrics.ovh, iTunes)
    ├── lyrics.js             # LRC-Parser, Song-Info-Parsing, Titel-Varianten
    ├── youtube.js            # YouTube-DOM-Helfer (Video-ID, Metadaten, Kapitel)
    ├── sync.js               # Sync-Engine (requestVideoFrameCallback, Offset)
    ├── template.js           # Shadow-DOM Template + Styles
    ├── ui.js                 # UI-Logik (Panel, Settings, Drag, Copy/Print)
    │
    ├── popup.html            # Extension-Popup (Toolbar-Icon)
    ├── popup.js              # Popup-Logik (Status-Anzeige)
    │
    ├── icon.svg              # Vektor-Icon
    ├── icons/                # Icon-Set (16–512 px)
    └── README.md

---

## 🔀 Browser-Kompatibilität im Code

Die Extension nutzt bereits Cross-Browser-kompatible APIs:

    const browserAPI = globalThis.browser || globalThis.chrome;

- Safari stellt `browser.*` bereit (Standard der WebExtensions)
- Chrome stellt `chrome.*` bereit (unterstützt aber auch `browser.*` ab Manifest V3)
- Der Fallback sorgt dafür, dass beide funktionieren

**Voraussetzungen für Cross-Browser-Support:**
- ✅ Manifest V3 (siehe manifest.json)
- ✅ Kein chrome.*-spezifischer Code, der nicht auch in Safari läuft
- ✅ Keine Safari-only APIs wie SafariWebExtensionHandler (wird nur im Xcode-Build verwendet und ist optional)

---

## 📋 Verwendete APIs

Diese Extension nutzt ausschließlich öffentliche, kostenlose APIs ohne API-Key:

| API | Zweck |
|-----|-------|
| LRCLIB (https://lrclib.net) | Synchronisierte Songtexte (LRC-Format) |
| lyrics.ovh (https://lyrics.ovh) | Fallback für Plain-Text-Lyrics |
| iTunes Search API | Album-Cover |

---

## 🎯 Wie es funktioniert

**1. Video-Erkennung**
content.js erkennt die aktuelle YouTube-Video-ID und holt Metadaten (Titel, Kanal) über oEmbed + DOM.

**2. Song-Info-Parsing**
lyrics.js extrahiert Künstler und Titel mit mehreren Heuristiken:
- Topic-Kanäle
- Artist - Song-Trenner
- ft./feat.-Erkennung
- Fan-Kanal-Erkennung
- Fallback auf Kanalname

**3. Lyrics-Abruf**
api.js fragt zuerst LRCLIB (mehrere Titel-Varianten parallel via Promise.any), dann lyrics.ovh als Fallback.

**4. Synchronisation**
sync.js nutzt requestVideoFrameCallback (30–60 Updates/Sekunde) für frame-genaues Timing. LRC-[offset:...]-Tags werden berücksichtigt.

**5. Darstellung**
ui.js rendert den Songtext in einem Shadow DOM (isoliert vom YouTube-Layout) mit Karaoke-Hervorhebung, Auto-Scroll und Offset-Korrektur.

---

## 🔒 Datenschutz

- Alle Daten (Cache, Einstellungen, Offset) werden lokal im Browser gespeichert
- Keine Server-Kommunikation außer zu den oben genannten APIs
- Keine Tracking-Analytics
- Keine Drittanbieter-Skripte

---

## 🐛 Bekannte Einschränkungen

- Funktioniert nur auf YouTube-Videos mit erkennbaren Song-Metadaten
- Bei manchen Videos muss das Timing manuell korrigiert werden
- Cover-Bilder sind nicht für alle Songs verfügbar
- iOS-Safari noch nicht getestet
- Firefox wird nicht offiziell unterstützt

---

## 🚀 Roadmap

- [ ] iOS-Safari testen
- [ ] Firefox-Support (Manifest V2 → V3 Konverter)
- [ ] Export-Funktionen (.lrc, .srt, .md)
- [ ] "Andere Version suchen"-Button für bessere LRC-Dateien
- [ ] Web-Share-API (native Share-Sheet)
- [ ] Kompakt-Modus (nur aktive Zeile)
- [ ] Fokus-/Kinomodus
- [ ] Übersetzungsfunktion (EN → DE)

---

## 🤝 Mitwirken

Beiträge, Issues und Pull Requests sind willkommen!
Wenn du einen Bug findest oder ein Feature vorschlagen willst, öffne bitte ein Issue auf GitHub.

---

## 📄 Lizenz

MIT License – frei nutzbar, auch kommerziell.

Hinweis zu Songtexten:
Die Lyrics werden von Drittanbieter-APIs bereitgestellt. Die kommerzielle Nutzung von Songtexten erfordert entsprechende Lizenzen (z. B. Musixmatch, LyricFind). Die Extension selbst ist Open Source und kann frei verwendet werden.

---

## 🙏 Credits

- Inspiration: Apple Music, Spotify Lyrics
- Icons: Custom SVG
- Design: Modern Dark UI mit Glassmorphism
- Lyrics-APIs: LRCLIB, lyrics.ovh
- Cover-Bilder: iTunes Search API

Made with ❤️ for music lovers

---

## 📬 Kontakt

- GitHub: @kl-patrickstar
- Repository: https://github.com/kl-patrickstar/YouTube-lyrics
ENDOFREADME
