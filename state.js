// ============================================================
//  state.js
//  Central state container for the entire extension.
//
//  This module is loaded FIRST (see manifest.json / content_scripts
//  order) so all other modules can access Y.state immediately.
//
//  Why a getter/setter pattern instead of plain properties?
//    - Allows future validation or side effects when a value changes
//    - Keeps the API consistent across modules
//    - Prevents accidental overwrites from outside the module
//
//  Exports (Y.state):
//    - ui              – reference to the panel/UI object (set by ui.js)
//    - currentVideoId  – video ID currently being processed
//    - currentSong     – { artist, title, rawTitle, source } of current track
//    - refreshSeq      – counter to invalidate stale async operations
//    - lyricOffset     – manual timing offset in seconds
//    - lastLyrics      – the most recently fetched lyrics object
//    - settings        – user preferences (persisted via bridge.js)
//    - artMemory       – in-memory cache for artwork URLs
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // --------------------------------------------------------
   //  PRIVATE STATE
   //  These variables are hidden inside the IIFE closure.
   //  Outside access is only possible through Y.state below.
   // --------------------------------------------------------

   // Reference to the UI object (built by ui.js)
   let ui = null;

   // ID of the YouTube video currently shown in the panel
   let currentVideoId = null;

   // Parsed song info for the current video:
   //   { artist, title, rawTitle, source }
   let currentSong = null;

   // Incremented on every new refresh() call.
   // Async operations compare their captured value against this
   // to detect if they've been superseded by a newer request.
   // (Prevents old responses overwriting new ones.)
   let refreshSeq = 0;

   // Manual timing offset in seconds.
   // Applied to every lyric line: active line = line.time + offset
   // Positive = lyrics appear earlier, negative = later.
   let lyricOffset = 0;

   // Most recently fetched lyrics object:
   //   { plainLyrics, syncedLyrics, artist, title, trackDuration }
   let lastLyrics = null;

   // --------------------------------------------------------
   //  SETTINGS
   //  User preferences. Loaded from chrome.storage.local on
   //  startup, saved whenever the user changes something.
   // --------------------------------------------------------
   const settings = {
     autoScroll: true,   // Scroll the active line to center
     theme: "auto",      // "dark" | "light" | "auto"
     fontSize: 17,       // Lyrics font size in px (14–26)
     mode: "karaoke",    // "karaoke" (highlighted) | "text" (plain)
   };

   // --------------------------------------------------------
   //  ARTWORK MEMORY CACHE
   //  In-memory cache for artwork URLs (key = "artist_title").
   //  Avoids re-fetching the same cover during one session.
   //  Persistent cache lives in chrome.storage.local.
   // --------------------------------------------------------
   const artMemory = new Map();

   // --------------------------------------------------------
   //  PUBLIC API
   //  Y.state exposes everything via getters/setters so that
   //  internal variables can't be reassigned from outside
   //  without going through the setter.
   // --------------------------------------------------------
   Y.state = {
     // --- UI reference ---
     get ui() { return ui; },
     set ui(value) { ui = value; },

     // --- Current video ID ---
     get currentVideoId() { return currentVideoId; },
     set currentVideoId(value) { currentVideoId = value; },

     // --- Current song metadata ---
     get currentSong() { return currentSong; },
     set currentSong(value) { currentSong = value; },

     // --- Refresh sequence counter (stale-request detection) ---
     get refreshSeq() { return refreshSeq; },
     set refreshSeq(value) { refreshSeq = value; },

     // --- Manual lyric timing offset (seconds) ---
     get lyricOffset() { return lyricOffset; },
     set lyricOffset(value) { lyricOffset = value; },

     // --- Last fetched lyrics ---
     get lastLyrics() { return lastLyrics; },
     set lastLyrics(value) { lastLyrics = value; },

     // --- Directly accessible (plain objects) ---
     settings,
     artMemory,
   };
 })();
