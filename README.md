# 🎵 YouTube Lyrics – Safari Extension

Eine schlanke Safari-Web-Extension für macOS, die **synchronisierte Songtexte** zu YouTube-Videos anzeigt – im Stil moderner Music-Apps wie Apple Music oder Spotify.

> **Status:** v1.0.0 · Aktiv in Entwicklung  
> **Plattform:** macOS (iOS-Support in Vorbereitung)  
> **Browser:** Safari

---

## ✨ Features

### 🎤 Karaoke-Modus
- Automatische Zeilen-Hervorhebung **synchron zum Video** (Frame-genau via `requestVideoFrameCallback`)
- Sanftes Auto-Scrolling (ein-/ausschaltbar)
- Klick auf eine Zeile springt zur entsprechenden Song-Position

### 📖 Text-Modus
- Ruhige Lese-Ansicht ohne Hervorhebung
- Ideal zum Mitsingen oder Nachlesen

### ⏱️ Intelligentes Timing
- Auto-Offset-Erkennung via **YouTube-Kapitel** (Intro/Song/Outro)
- Dauer-basierte Heuristik für Videos ohne Kapitel
- Manuelle Feinjustierung (±0,5s / ±5s)
- **LRC-Offset-Tag** (`[offset: +500]`) wird unterstützt

### 🎨 Premium-UI
- Modernes Dark-Theme mit Glassmorphism
- Automatische Light/Dark-Erkennung basierend auf YouTube
- Frei verschiebbares Panel und Button
- Smooth Animations

### 🖼️ Album-Cover
- Automatische Cover-Suche via iTunes Search API
- Angezeigt im Header neben Songtitel & Künstler

### 🔗 Externe Links
- **Ultimate Guitar** – Tabs & Chords
- **Apple Music** – Song öffnen
- **Drucken** – Sauber formatierte Druckvorschau in neuem Tab
- **Kopieren** – Songtext in die Zwischenablage

### 💾 Caching
- Lyrics, Cover & Einstellungen werden **lokal** gespeichert
- Sofortiger Start bei wiederholtem Anhören
- Cache-Timeout: 60 Minuten

### ⚙️ Einstellungen
- Auto-Open bei Musikvideos (Topic-Kanäle)
- Theme: Dunkel / Hell / Auto
- Schriftgröße (14–26 px)
- Karaoke- oder Text-Modus

### ⌨️ Keyboard Shortcut
- `⌘ + Shift + L` – Panel öffnen/schließen

---

## 📸 Screenshots

> _Screenshots folgen in Kürze._

<!--
![Karaoke-Modus](screenshots/karaoke.png)
![Panel mit Songtext](screenshots/panel.png)
-->

---

## 🛠️ Installation

### Voraussetzungen
- macOS 12 oder neuer
- Safari
- Xcode (für die Konvertierung)
- Apple Developer Account
  _(Für unsignierte Extensions: **Entwicklermodus in Safari aktivieren**)_

### Schritt-für-Schritt

**1. Repository klonen:**

```bash
git clone https://github.com/kl-patrickstar/YouTube-lyrics.git
cd YouTube-lyrics
