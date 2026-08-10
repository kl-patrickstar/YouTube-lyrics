# 🎵 YouTube Lyrics – Safari Extension

Eine Safari-Web-Extension für macOS, die synchronisierte Songtexte zu YouTube-Videos anzeigt – im Stil einer modernen Music-App.

## ✨ Features

### 🎤 Karaoke-Modus
- Automatische Zeilen-Hervorhebung synchron zum Video
- Sanftes Auto-Scrolling (aktivierbar/deaktivierbar)
- Präzises Timing mit manueller Korrektur (±0.5s / ±5s)

### 📖 Text-Modus
- Ruhiges Lesen ohne Ablenkung
- Perfekt zum Mitsingen oder Nachlesen

### ⏱️ Intelligentes Timing
- **Auto-Erkennung** via Video-Kapitel (Intro/Song/Outro)
- **Dauer-basierte Heuristik** für Videos ohne Kapitel
- Manuelle Feinjustierung mit ±0.5s Schritten

### 🎨 Premium UI
- Modernes Dark-Theme mit Glassmorphism-Design
- Automatische Light/Dark-Erkennung basierend auf YouTube
- Responsive Layout für alle Bildschirmgrößen
- Smooth Animations & Transitions

### 🖼️ Album-Cover
- Automatische Cover-Suche via iTunes Search API
- Angezeigt im Header neben Songtitel & Künstler

### 🔗 Externe Links
- **Ultimate Guitar** – Tabs & Chords zum Song
- **Apple Music** – Song in Apple Music öffnen

### 💾 Caching
- Lyrics, Cover & Einstellungen werden lokal gespeichert
- Schnellerer Start bei wiederholtem Anhören
- Offline-Verfügbarkeit für bereits geladene Songs

### ⌨️ Keyboard Shortcuts
- `⌘ + Shift + L` – Panel öffnen/schließen

## 🛠️ Installation

### Voraussetzungen
- macOS (getestet mit macOS 12+)
- Safari
- Xcode (für die Konvertierung)
- Apple Developer Account (für unsignierte Extensions: Entwicklermodus in Safari aktivieren)

### Schritt-für-Schritt

**1. Repository klonen:**

```bash
git clone https://github.com/kl-patrickstar/youtube-lyrics.git
cd youtube-lyrics
```

**2. Xcode-Projekt generieren:**

```bash
xcrun safari-web-extension-converter ./youtube-lyrics-extension --project-location ~/YouTubeLyrics --app-name "YouTube Lyrics" --extension-name "YouTubeLyricsExtension"
```

**3. Projekt in Xcode öffnen:**

```bash
open ~/YouTubeLyrics/YouTube\ Lyrics.xcodeproj
```

**4. App bauen & starten:**
- `Cmd + R` drücken
- Safari öffnet sich automatisch

**5. Extension aktivieren:**
- Safari → Einstellungen → Erweiterungen
- "YouTube Lyrics" aktivieren
- Berechtigungen bestätigen

**6. Testen:**
- YouTube öffnen
- Ein Musikvideo abspielen
- Das 🎵-Icon rechts oben anklicken

## 📋 Verwendete APIs

Diese Extension nutzt folgende öffentliche APIs:

- **[LRCLIB](https://lrclib.net/)** – Synchronisierte Songtexte (LRC-Format)
- **[lyrics.ovh](https://lyrics.ovh/)** – Fallback für Plain-Text Lyrics
- **[iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)** – Album-Cover

Alle APIs sind kostenlos und erfordern keinen API-Key.

## 🏗️ Projektstruktur

```
youtube-lyrics-extension/
├── manifest.json       # Extension-Konfiguration (Manifest V3)
├── background.js       # Service Worker für API-Requests & Storage
├── content.js          # Hauptlogik & UI (Shadow DOM)
└── icons/              # Extension-Icons (16-512px)
```

## 🔒 Datenschutz

- Alle Daten werden **lokal** auf deinem Mac gespeichert
- Keine Server-Kommunikation außer zu den oben genannten APIs
- Keine Tracking-Analytics
- Keine Drittanbieter-Skripte

## 🐛 Bekannte Einschränkungen

- Funktioniert nur auf YouTube-Videos mit erkennbaren Song-Metadaten
- Bei manchen Videos muss das Timing manuell korrigiert werden
- Cover-Bilder sind nicht für alle Songs verfügbar

## 🚀 Roadmap (Ideen für die Zukunft)

- [ ] Übersetzungsfunktion (EN → DE)
- [ ] Fokus-/Kinomodus
- [ ] Cache-Verwaltung in den Settings
- [ ] iOS-Support testen

## 📄 Lizenz

Dieses Projekt ist für **private und educational Zwecke** gedacht.

Die Lyrics werden von Drittanbieter-APIs bereitgestellt. Die kommerzielle Nutzung von Songtexten erfordert entsprechende Lizenzen (z.B. Musixmatch, LyricFind).

Die Extension selbst ist Open Source und kann frei verwendet werden.

## 🙏 Credits

- Inspiration: Apple Music, Spotify Lyrics
- Icons: Custom SVG
- Design: Modern Dark UI mit Glassmorphism

---

**Made with ❤️ for music lovers**

Fragen oder Feedback? [Issue eröffnen](https://github.com/kl-patrickstar/youtube-lyrics/issues)
