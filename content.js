// ============================================================
//  content.js
//  The orchestrator. Runs on every YouTube page and ties all
//  the other modules together.
//
//  Responsibilities:
//    1. Init: load settings, set up observers, register listeners.
//    2. Detect the current video and resolve its song metadata.
//    3. Fetch lyrics (via api.js) and render them (via ui.js).
//    4. React to YouTube SPA navigation (URL / video changes).
//    5. Expose the public controller API (refresh, manualSearch).
//
//  The main entry point is refresh(): it runs the whole
//  pipeline every time the user opens the panel or switches
//  to a different video.
//
//  Stale-request protection:
//    Every call to refresh() increments Y.state.refreshSeq.
//    Long-running async steps compare their captured sequence
//    value against the current one and abort if a newer refresh
//    was triggered while they were waiting. This prevents old
//    responses from overwriting new state.
//
//  Exports (Y.controller):
//    - refresh()       – full pipeline (resolve → fetch → render)
//    - manualSearch()  – refresh using artist/title from the search UI
// ============================================================

(() => {
   // Guard against double-injection (e.g. if the script is loaded
   // twice on the same page for any reason).
   if (window.__ytLyricsLoaded) return;
   window.__ytLyricsLoaded = true;

   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  REFRESH (orchestration)
   //  The core pipeline. Called when:
   //    - the panel opens
   //    - the URL changes
   //    - the user clicks reload / manual search
   //
   //  Options:
   //    force:  boolean – ignore caches, always re-fetch lyrics
   //    artist: string? – manual artist override
   //    title:  string? – manual title override
   // ============================================================
   async function refresh(options = {}) {
     const { force = false, artist = null, title = null } = options;

     const videoId = Y.youtube.getVideoId();

     if (!videoId) {
       if (Y.state.ui) {
         Y.ui.setStatus("No YouTube video detected.", true);
       }
       return;
     }

     Y.ui.ensureUI();

     // Every refresh gets a new sequence number. Any async step
     // can check whether it's still the "current" refresh by
     // comparing its captured sequence value.
     const sequence = ++Y.state.refreshSeq;

     // Early exit: same video, same song, no forced refresh.
     if (
       !force &&
       Y.state.currentVideoId === videoId &&
       Y.state.currentSong &&
       !artist &&
       !title
     ) {
       return;
     }

     // Load any previously stored timing offset for this video.
     // (If stored, we skip the auto-offset guess later.)
     const hadStoredOffset = await Y.sync.loadOffset(videoId);
     if (sequence !== Y.state.refreshSeq) return;

     Y.ui.setLoading();

     try {
       // --- Step 1: resolve song metadata ---
       const song = await resolveSong(videoId, artist, title, sequence);
       if (sequence !== Y.state.refreshSeq || !song) return;

       Y.state.currentVideoId = videoId;
       Y.state.currentSong = song;

       applySongToUI(song, videoId);

       // --- Step 2: fetch lyrics ---
       const lyrics = await resolveLyrics(song, videoId, force, sequence);
       if (sequence !== Y.state.refreshSeq) return;

       // --- Step 3: timing ---
       const autoEstimated = applyAutoOffset(lyrics, hadStoredOffset);
       Y.ui.updateOffsetDisplay();

       mergeLyricsMetadata(song, lyrics);
       updateExternalLinksAndArt(sequence);

       // Chapters can refine the offset further (only if the
       // user hasn't set one manually for this video).
       if (!hadStoredOffset) {
         Y.sync.refineOffsetWithChapters(sequence, song.title);
       }

       // Show an info banner if we auto-adjusted the timing.
       if (autoEstimated) {
         Y.ui.setStatus(
           `Intro detected: timing auto-adjusted to ${Y.sync.formatOffset(
             Y.state.lyricOffset
           )}. If it's off, fine-tune it in the control bar or reset.`
         );
       } else {
         Y.ui.hideStatus();
       }

       // --- Step 4: render ---
       Y.state.lastLyrics = lyrics;
       Y.ui.renderLyrics(lyrics);

     } catch (error) {
       if (sequence !== Y.state.refreshSeq) return;
       handleRefreshError(error);
     }
   }

   // ============================================================
   //  RESOLVE SONG METADATA
   //  Returns { artist, title, rawTitle, source }.
   //
   //  Two paths:
   //    - Manual: user provided artist + title → use as-is.
   //    - Automatic: fetch YouTube metadata (oEmbed / DOM) and
   //      run it through lyrics.js's parseSongInfo heuristics.
   // ============================================================
   async function resolveSong(videoId, artist, title, sequence) {
     if (artist && title) {
       return {
         artist,
         title,
         rawTitle: title,
         source: "manual",
       };
     }

     const metadata = await Y.youtube.getMetadata(videoId);
     if (sequence !== Y.state.refreshSeq) return null;

     const parsed = Y.lyrics.parseSongInfo(metadata.title, metadata.author_name);
     return {
       ...parsed,
       // rawTitle = the untouched YouTube title, used for API
       // queries (some APIs match better on the original title).
       rawTitle: metadata.title,
     };
   }

   // ============================================================
   //  APPLY SONG TO UI
   //  Writes the resolved metadata into the panel header and the
   //  search inputs, so the user sees what was detected.
   // ============================================================
   function applySongToUI(song, videoId) {
     if (!Y.state.ui) return;

     Y.state.ui.artistInput.value = song.artist || "";
     Y.state.ui.titleInput.value = song.title || "";
     Y.state.ui.title.textContent = song.title || "Lyrics";
     Y.state.ui.meta.textContent = song.artist || "";

     // Note: auto-open of the panel was removed — the panel is
     // now opened only via the toolbar button or the shortcut.
   }

   // ============================================================
   //  RESOLVE LYRICS
   //  Tries to find lyrics for the given song. Steps:
   //    1. Check the persistent cache (unless force is set).
   //    2. Try LRCLIB with multiple title variants (synced first).
   //    3. Fall back to lyrics.ovh (plain text only).
   //  Throws { code: "not-found" } if nothing is found.
   // ============================================================
   async function resolveLyrics(song, videoId, force, sequence) {
     const cacheKey = `ytlyrics_${videoId}`;

     // --- Step 1: cache ---
     if (!force) {
       const cached = await Y.bridge.getFromCache(cacheKey);
       if (cached && (cached.plainLyrics || cached.syncedLyrics)) {
         return cached;
       }
     }

     const duration = Y.youtube.getVideoDuration();

     // --- Step 2: LRCLIB with title variants ---
     let lyrics = await Y.api.fetchLyricsWithVariants(
       song.artist,
       song.rawTitle || song.title,
       duration
     );
     if (sequence !== Y.state.refreshSeq) return null;

     // --- Step 3: lyrics.ovh fallback ---
     if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
       const variants = Y.lyrics.buildTitleVariants(
         song.rawTitle || song.title,
         song.artist
       );

       for (const variant of variants) {
         lyrics = await Y.api.fetchLyricsOvh(song.artist, variant);
         if (lyrics && lyrics.plainLyrics) break;
       }
     }
     if (sequence !== Y.state.refreshSeq) return null;

     if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
       const notFound = new Error("No lyrics found.");
       notFound.code = "not-found";
       throw notFound;
     }

     // Cache the successful result for future visits.
     await Y.bridge.saveToCache(cacheKey, lyrics);
     return lyrics;
   }

   // ============================================================
   //  AUTO OFFSET
   //  Uses the duration difference between the YouTube video and
   //  the LRCLIB track as a rough estimate of intro/outro length.
   //  Only applied if the user hasn't stored a manual offset.
   //
   //  Heuristic: 4–60 s difference is treated as intro/outro.
   //  Anything else is ignored (too short to matter, or too long
   //  to be a simple intro — e.g. a full music video edit).
   // ============================================================
   function applyAutoOffset(lyrics, hadStoredOffset) {
     if (hadStoredOffset) return false;

     const videoDuration = Y.youtube.getVideoDuration();
     const trackDuration = lyrics.trackDuration || 0;

     if (!videoDuration || !trackDuration) return false;

     const diff = Math.round(videoDuration - trackDuration);

     if (diff >= 4 && diff <= 60) {
       Y.state.lyricOffset = diff;
       return true;
     }

     return false;
   }

   // ============================================================
   //  MERGE METADATA
   //  Combines the parsed song info with the metadata returned by
   //  the lyrics API. We prefer our own parsed values when they
   //  look reliable (i.e. not "Unknown"), because LRCLIB's fields
   //  sometimes contain noise (feat., remaster tags, etc.).
   // ============================================================
   function mergeLyricsMetadata(song, lyrics) {
     if (!lyrics.artist && !lyrics.title) return;

     const finalArtist =
       song.artist && song.artist !== "Unknown"
         ? song.artist
         : (lyrics.artist || song.artist);

     const finalTitle =
       song.title && song.title !== "Unknown"
         ? song.title
         : (lyrics.title || song.title);

     Y.state.currentSong = {
       ...song,
       artist: finalArtist,
       title: finalTitle,
     };

     if (Y.state.ui) {
       Y.state.ui.title.textContent = Y.state.currentSong.title;
       Y.state.ui.meta.textContent = Y.state.currentSong.artist;
     }
   }

   // ============================================================
   //  UPDATE EXTERNAL LINKS AND ARTWORK
   //  Convenience wrapper: triggers the three UI updates that
   //  depend on the current song.
   // ============================================================
   function updateExternalLinksAndArt(sequence) {
     Y.ui.updateUgLink();
     Y.ui.updateAppleMusicLink();
     Y.ui.updateArtwork(sequence);
   }

   // ============================================================
   //  ERROR HANDLING
   //  "not-found" errors get a friendly empty state.
   //  Everything else gets a red status message.
   // ============================================================
   function handleRefreshError(error) {
     console.error("YouTube Lyrics:", error);

     if (error?.code === "not-found") {
       Y.ui.hideStatus();
       Y.ui.renderEmptyState(
         "This video appears to be instrumental — or lyrics aren't available from our sources. Use the ✎ search to set artist & title manually."
       );
       return;
     }

     if (Y.state.ui) {
       Y.state.ui.lyrics.textContent = "";
     }

     Y.ui.setStatus(error?.message || "Unknown error.", true);
   }

   // ============================================================
   //  MANUAL SEARCH
   //  Triggered by the "Search" button in the editor drawer.
   //  Uses the artist/title currently typed in the two inputs.
   // ============================================================
   function manualSearch() {
     const artist = Y.state.ui?.artistInput?.value.trim();
     const title = Y.state.ui?.titleInput?.value.trim();

     if (!artist || !title) {
       Y.ui.setStatus("Please enter both artist and title.", true);
       return;
     }

     refresh({
       force: true,
       artist,
       title,
     });
   }

   // ============================================================
   //  URL CHANGE DETECTION
   //  Called whenever the URL might have changed (SPA navigation).
   //  - Hides the UI if the new page has no video.
   //  - Resets state if the video ID changed.
   //  - Refreshes if the panel is open.
   // ============================================================
   function updateForCurrentUrl() {
     const videoId = Y.youtube.getVideoId();

     if (!videoId) {
       if (Y.state.ui?.host) {
         Y.state.ui.host.style.display = "none";
       }
       return;
     }

     const activeUi = Y.ui.ensureUI();
     activeUi.host.style.display = "block";

     if (videoId !== Y.state.currentVideoId) {
       // New video — clear everything that's tied to the old one.
       Y.state.currentVideoId = null;
       Y.state.currentSong = null;
       Y.state.lastLyrics = null;
       Y.state.lyricOffset = 0;

       if (!activeUi.panel.hidden) {
         refresh({ force: true });
       }
     } else if (!activeUi.panel.hidden) {
       // Same video, panel open — do a light refresh (no force).
       refresh({ force: false });
     }
   }

   // ============================================================
   //  OBSERVE NAVIGATION
   //  YouTube is a SPA — no full page reloads. We listen to
   //  several signals so we don't miss a navigation:
   //    - yt-navigate-finish     – YouTube's own event
   //    - yt-page-data-updated   – fires on new data
   //    - popstate / hashchange  – browser history
   //    - <title> mutations      – YouTube updates the title
   //    - URL changes            – watcher on document.body
   //    - <video> element swap   – see observeVideoElement()
   //
   //  All signals funnel into schedule(), which debounces for
   //  800 ms to avoid firing refresh() multiple times in a row.
   // ============================================================
   function observeNavigation() {
     let timeout;

     const schedule = () => {
       clearTimeout(timeout);
       timeout = setTimeout(() => {
         updateForCurrentUrl();
       }, 800);
     };

     // YouTube's own navigation events + browser history
     ["yt-navigate-finish", "yt-page-data-updated", "popstate", "hashchange"].forEach(
       (eventName) => {
         window.addEventListener(eventName, schedule);
       }
     );

     // <title> element changes
     const titleEl = document.querySelector("title");
     if (titleEl) {
       new MutationObserver(schedule).observe(titleEl, { childList: true });
     }

     // URL changes (covers cases YouTube doesn't emit events for)
     let lastUrl = location.href;
     new MutationObserver(() => {
       if (location.href !== lastUrl) {
         lastUrl = location.href;
         schedule();
       }
     }).observe(document.body, { childList: true, subtree: true });

     // <video> element swaps
     observeVideoElement(schedule);
   }

   // ============================================================
   //  OBSERVE VIDEO ELEMENT
   //  Watches for the <video> element being created or replaced
   //  (happens on YouTube SPA navigations). Fires `schedule`
   //  whenever a new video element appears.
   // ============================================================
   function observeVideoElement(schedule) {
     let currentVideo = document.querySelector("video");

     const attach = (video) => {
       if (!video || video.__ytLyricsAttached) return;
       video.__ytLyricsAttached = true;

       // These events indicate that YouTube has loaded a new video.
       video.addEventListener("loadedmetadata", schedule);
       video.addEventListener("loadstart", schedule);
     };

     attach(currentVideo);

     const observer = new MutationObserver(() => {
       const video = document.querySelector("video");
       if (video !== currentVideo) {
         currentVideo = video;
         attach(video);
         schedule();
       }
     });

     observer.observe(document.body, { childList: true, subtree: true });
   }

   // ============================================================
   //  OBSERVE YOUTUBE THEME
   //  Watches the `dark` attribute on <html> so we can re-apply
   //  our theme automatically when YouTube switches between
   //  light and dark mode (only relevant when theme === "auto").
   // ============================================================
   function observeYouTubeTheme() {
     const observer = new MutationObserver(() => {
       if (Y.state.settings.theme === "auto") {
         Y.ui.applyTheme();
       }
     });

     observer.observe(document.documentElement, {
       attributes: true,
       attributeFilter: ["dark"],
     });
   }

   // ============================================================
   //  KEYBOARD SHORTCUT (⌘⇧L / Ctrl+Shift+L)
   //  Direct handler in the content script. The service worker
   //  (background.js) has its own handler for the manifest-declared
   //  command; this one works even if the command routing fails.
   // ============================================================
   function registerShortcut() {
     window.addEventListener("keydown", (event) => {
       const modifier = event.metaKey || event.ctrlKey;
       if (!(modifier && event.shiftKey)) return;
       if ((event.key || "").toLowerCase() !== "l") return;

       // Ignore key presses while the user is typing in an input.
       const target = event.composedPath?.()[0] || event.target;
       if (
         target &&
         (target.tagName === "INPUT" ||
           target.tagName === "TEXTAREA" ||
           target.isContentEditable)
       ) {
         return;
       }

       event.preventDefault();

       if (!Y.state.ui) return;

       Y.ui.setPanelVisibility(Y.state.ui.panel.hidden);
       if (!Y.state.ui.panel.hidden) {
         refresh({ force: false });
       }
     });
   }

   // ============================================================
   //  TOOLBAR ACTION
   //  Message listener for the popup and the service worker.
   //  Two message types:
   //    - "toggle-panel"  – open/close the panel
   //    - "get-status"    – return current state for the popup
   // ============================================================
   function registerToolbarAction() {
     const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;

     runtime?.onMessage.addListener((message, sender, sendResponse) => {
       if (message?.type === "toggle-panel") {
         const videoId = Y.youtube.getVideoId();
         if (!videoId) return true;
         const activeUi = Y.ui.ensureUI();
         activeUi.host.style.display = "block";
         Y.ui.togglePanel();
         return true;
       }

       if (message?.type === "get-status") {
         const videoId = Y.youtube.getVideoId();
         if (!videoId) {
           sendResponse({ ok: false, reason: "no-video" });
           return true;
         }

         const song = Y.state.currentSong;
         sendResponse({
           ok: true,
           title: song?.title || null,
           artist: song?.artist || null,
           hasLyrics: !!Y.state.lastLyrics,
           mode: Y.state.settings.mode,
           panelOpen: !!Y.state.ui && !Y.state.ui.panel.hidden,
         });
         return true;
       }

       return false;
     });
   }

   // ============================================================
   //  INIT
   //  Runs once when the content script loads. Everything else
   //  is driven by observers / events from here on.
   // ============================================================
   async function init() {
     await Y.ui.loadSettings();  // must run before applyTheme etc.
     observeNavigation();
     observeYouTubeTheme();
     registerShortcut();
     registerToolbarAction();
     updateForCurrentUrl();
   }

   // Public API used by other modules (ui.js, popup.js, ...).
   Y.controller = { refresh, manualSearch };

   // DOMContentLoaded vs. already-loaded — handles both cases.
   if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", init);
   } else {
     init();
   }
 })();
