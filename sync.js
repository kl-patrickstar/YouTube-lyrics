// ============================================================
//  sync.js
//  The timing engine. Keeps the active lyric line in sync with
//  the YouTube video player.
//
//  How it works:
//    1. Listen to a high-frequency callback on the <video> element
//       (requestVideoFrameCallback at 30–60 fps, or rAF as fallback).
//    2. On every tick, find which lyric line corresponds to the
//       current playback time (line.time + offset <= currentTime).
//    3. Highlight that line and (optionally) scroll it to center.
//
//  Why requestVideoFrameCallback instead of timeupdate?
//    - timeupdate fires only ~4×/second and can lag several
//      hundred ms behind the actual playback position.
//    - requestVideoFrameCallback fires on every rendered video
//      frame → frame-accurate synchronization.
//
//  Also handles the manual timing offset:
//    - loadOffset / persistOffset    – per-video storage
//    - changeOffset / resetOffset    – UI actions
//    - refineOffsetWithChapters      – auto-correct using chapters
//
//  Exports (Y.sync):
//    getSync, detachVideoListeners, attachVideoListeners,
//    updateActiveLine, seekTo, formatOffset, loadOffset,
//    changeOffset, resetOffset, refineOffsetWithChapters
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // --------------------------------------------------------
   //  INTERNAL SYNC STATE
   //  All mutable state lives in this object so it can be
   //  inspected and reset from outside (via Y.sync.getSync()).
   // --------------------------------------------------------
   const sync = {
     lines: [],              // [{ time, text }] from parseLRC
     elements: [],           // DOM nodes for each line, in same order
     activeIndex: -1,        // index of currently highlighted line
     video: null,            // reference to the <video> element
     onTimeUpdate: null,     // handler for the timeupdate event
     rafId: null,            // requestAnimationFrame id (fallback loop)
     frameCallbackId: null,  // requestVideoFrameCallback id (precise loop)
     videoObserver: null,    // MutationObserver while waiting for <video>
   };

   // ============================================================
   //  DETACH LISTENERS
   //  Removes all listeners, cancels both sync loops, and clears
   //  references. Must be called before re-attaching to avoid
   //  duplicate listeners (e.g. after a SPA navigation).
   // ============================================================
   function detachVideoListeners() {
     if (sync.video && sync.onTimeUpdate) {
       sync.video.removeEventListener("timeupdate", sync.onTimeUpdate);
     }

     // Cancel requestVideoFrameCallback (if active)
     if (sync.video && sync.frameCallbackId) {
       try {
         sync.video.cancelVideoFrameCallback(sync.frameCallbackId);
       } catch {
         // ignore — not all browsers support this
       }
       sync.frameCallbackId = null;
     }

     stopSyncLoop();
     sync.video = null;
     sync.onTimeUpdate = null;
   }

   // ============================================================
   //  rAF LOOP (Fallback)
   //  Used only when requestVideoFrameCallback isn't available.
   //  requestAnimationFrame fires ~60×/second regardless of the
   //  video's frame rate; combined with video.currentTime it's
   //  accurate enough for lyric highlighting.
   // ============================================================
   function startSyncLoop() {
     stopSyncLoop();
     const tick = () => {
       updateActiveLine();
       sync.rafId = requestAnimationFrame(tick);
     };
     sync.rafId = requestAnimationFrame(tick);
   }

   function stopSyncLoop() {
     if (sync.rafId) {
       cancelAnimationFrame(sync.rafId);
       sync.rafId = null;
     }
   }

   // ============================================================
   //  PRECISE SYNC LOOP via requestVideoFrameCallback
   //  Fires on every rendered video frame (~30-60×/second),
   //  which gives us frame-accurate lyric highlighting.
   //  Falls back to rAF if the API isn't available.
   // ============================================================
   function startPreciseSyncLoop(video) {
     if (typeof video.requestVideoFrameCallback !== "function") {
       // Fallback: regular rAF loop
       startSyncLoop();
       return;
     }

     const frameCallback = () => {
       updateActiveLine();
       // Request the next frame — this keeps the loop alive.
       sync.frameCallbackId = video.requestVideoFrameCallback(frameCallback);
     };

     sync.frameCallbackId = video.requestVideoFrameCallback(frameCallback);
   }

   // ============================================================
   //  COMPUTE ACTIVE LINE AND HIGHLIGHT IT
   //  Called on every sync tick. Compares video.currentTime
   //  (plus the user-set offset) against each line's timestamp
   //  to figure out which line is currently active.
   //
   //  Optimizations:
   //    - Bail out early if the line index hasn't changed.
   //    - Only mutate DOM classes when the active index changes.
   // ============================================================
   function updateActiveLine() {
     const video = sync.video || Y.youtube.getVideoElement();
     if (!video || !sync.lines.length) return;

     const lyricsContainer = Y.state.ui?.lyrics;
     if (!lyricsContainer) return;

     const currentTime = video.currentTime;
     let newIndex = -1;

     // Find the last line whose timestamp is <= currentTime.
     // Lines are sorted by time (see parseLRC in lyrics.js), so we
     // can stop at the first line that is still in the future.
     for (let i = 0; i < sync.lines.length; i++) {
       if (sync.lines[i].time + Y.state.lyricOffset <= currentTime) {
         newIndex = i;
       } else {
         break;
       }
     }

     // Nothing changed — skip DOM updates.
     if (newIndex === sync.activeIndex) return;

     sync.activeIndex = newIndex;

     // Update "active" / "past" classes on every rendered line.
     sync.elements.forEach((el, i) => {
       if (!el || !el.classList) return;
       el.classList.toggle("active", i === newIndex);
       el.classList.toggle("past", i < newIndex);
     });

     // Auto-scroll the active line to the vertical center.
     // Skipped when the user has disabled auto-scroll in settings.
     if (newIndex >= 0 && Y.state.settings.autoScroll) {
       const activeElement = sync.elements[newIndex];
       if (!activeElement) return;

       try {
         const containerRect = lyricsContainer.getBoundingClientRect();
         const lineRect = activeElement.getBoundingClientRect();

         // Scroll offset = distance from the line's top to the
         // container's center (accounting for the line's own height).
         const scrollOffset =
           lineRect.top -
           containerRect.top -
           containerRect.height / 2 +
           lineRect.height / 2;

         // Respect the user's "reduce motion" preference.
         const prefersReducedMotion = window.matchMedia(
           "(prefers-reduced-motion: reduce)"
         ).matches;

         lyricsContainer.scrollBy({
           top: scrollOffset,
           behavior: prefersReducedMotion ? "auto" : "smooth",
         });
       } catch {
         // ignore — no active element
       }
     }
   }

   // ============================================================
   //  ATTACH VIDEO LISTENERS
   //  Called whenever the lyrics are (re-)rendered.
   //
   //  Two listeners run in parallel:
   //    - timeupdate: coarse but always fires (used as backup)
   //    - requestVideoFrameCallback: high-frequency, precise
   //
   //  If the <video> element isn't ready yet, retry a few times,
   //  then fall back to a MutationObserver.
   // ============================================================
   function attachVideoListeners(retries = 5) {
     const video = Y.youtube.getVideoElement();

     if (!video) {
       if (retries > 0) {
         setTimeout(() => attachVideoListeners(retries - 1), 1000);
       } else {
         // Fallback: MutationObserver in case <video> appears later
         watchForVideo();
       }
       return;
     }

     detachVideoListeners();

     sync.video = video;
     sync.onTimeUpdate = () => updateActiveLine();
     video.addEventListener("timeupdate", sync.onTimeUpdate);

     // Start the high-frequency sync loop
     startPreciseSyncLoop(video);

     // Update once immediately so the current line gets highlighted
     // without waiting for the first frame callback.
     updateActiveLine();
   }

   // ============================================================
   //  FALLBACK: wait for <video> via MutationObserver
   //  Used when the <video> element is created after the lyrics
   //  are rendered (common on YouTube because of SPA navigation).
   // ============================================================
   function watchForVideo() {
     if (sync.videoObserver) return;

     sync.videoObserver = new MutationObserver(() => {
       const video = document.querySelector("video");
       if (video) {
         sync.videoObserver.disconnect();
         sync.videoObserver = null;
         attachVideoListeners(0);
       }
     });

     sync.videoObserver.observe(document.body, {
       childList: true,
       subtree: true,
     });

     // Safety timeout: stop watching after 30 s to avoid a
     // permanent observer on pages that never load a video.
     setTimeout(() => {
       if (sync.videoObserver) {
         sync.videoObserver.disconnect();
         sync.videoObserver = null;
       }
     }, 30000);
   }

   // ============================================================
   //  SEEK TO A LINE
   //  Called when the user clicks a lyric line. Sets the video
   //  time to the line's timestamp (plus the current offset).
   //
   //  The extra setTimeout ensures the UI updates immediately,
   //  without waiting for the next frame callback.
   // ============================================================
   function seekTo(time) {
     const video = Y.youtube.getVideoElement();
     if (!video) return;

     video.currentTime = time + Y.state.lyricOffset;

     // Try to auto-play — may be blocked by the browser if the
     // click wasn't a real user gesture. Errors are silently
     // ignored (the video just stays paused).
     const playPromise = video.play?.();
     if (playPromise && typeof playPromise.catch === "function") {
       playPromise.catch(() => {});
     }

     // Update immediately (without waiting for next frame)
     setTimeout(() => updateActiveLine(), 50);
   }

   // ============================================================
   //  FORMAT OFFSET
   //  Converts a numeric offset (in seconds) into a display string.
   //  Examples:
   //    0     → "0s"
   //    +0.5  → "+0.5s"
   //    -2.3  → "-2.3s"
   //  Integers are shown without a decimal point.
   // ============================================================
   function formatOffset(value) {
     const rounded = Math.round(value * 10) / 10;
     const sign = rounded > 0 ? "+" : "";
     const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
     return `${sign}${text}s`;
   }

   // ============================================================
   //  LOAD / SAVE / CHANGE OFFSET
   //  The manual offset (in seconds) shifts lyric timestamps so
   //  the user can correct the sync if the LRCLIB timing doesn't
   //  match the YouTube video.
   // ============================================================

   // Load the offset stored for a specific video ID.
   // Returns true if a stored value was found.
   async function loadOffset(videoId) {
     const stored = await Y.bridge.getFromCache(`ytlyrics_offset_${videoId}`);
     if (typeof stored === "number") {
       Y.state.lyricOffset = stored;
       Y.ui.updateOffsetDisplay();
       return true;
     }
     Y.state.lyricOffset = 0;
     Y.ui.updateOffsetDisplay();
     return false;
   }

   // Save the current offset for the current video ID.
   async function persistOffset() {
     const videoId = Y.youtube.getVideoId();
     if (videoId) {
       await Y.bridge.saveToCache(`ytlyrics_offset_${videoId}`, Y.state.lyricOffset);
     }
   }

   // Adjust the offset by `delta` seconds (positive or negative).
   // Clamped to ±120 seconds to avoid absurd values.
   async function changeOffset(delta) {
     Y.state.lyricOffset = Math.max(
       -120,
       Math.min(120, Math.round((Y.state.lyricOffset + delta) * 10) / 10)
     );
     Y.ui.updateOffsetDisplay();
     updateActiveLine();
     await persistOffset();
   }

   // Reset the offset to 0 for the current video.
   async function resetOffset() {
     Y.state.lyricOffset = 0;
     Y.ui.updateOffsetDisplay();
     updateActiveLine();
     await persistOffset();
   }

   // ============================================================
   //  REFINE OFFSET USING CHAPTERS
   //  YouTube chapters (if present) tell us where the song
   //  actually starts. If a chapter title matches the song title,
   //  its start time is a much better offset than the duration
   //  heuristic in content.js.
   //
   //  Chapters can be lazy-loaded by YouTube, so we retry up to
   //  8 times with 500 ms between attempts.
   // ============================================================
   async function refineOffsetWithChapters(sequence, songTitle) {
     for (let attempt = 0; attempt < 8; attempt++) {
       // Abort if a newer refresh was triggered while waiting.
       if (sequence !== Y.state.refreshSeq) return;

       const chapters = Y.youtube.readChaptersFromDom();

       if (chapters.length >= 2) {
         const offset = Y.youtube.computeOffsetFromChapters(chapters, songTitle);

         // Sanity check: only accept offsets between 0 and 120 s.
         if (
           offset !== null &&
           offset >= 0 &&
           offset <= 120 &&
           offset !== Y.state.lyricOffset
         ) {
           Y.state.lyricOffset = offset;
           Y.ui.updateOffsetDisplay();
           updateActiveLine();
           Y.ui.setStatus(
             `Chapter detected: timing set to ${formatOffset(Y.state.lyricOffset)}.`
           );
         }
         return;
       }

       await new Promise((resolve) => setTimeout(resolve, 500));
     }
   }

   // ============================================================
   //  EXPORTS
   // ============================================================
   function getSync() {
     return sync;
   }

   Y.sync = {
     getSync,
     detachVideoListeners,
     attachVideoListeners,
     updateActiveLine,
     seekTo,
     formatOffset,
     loadOffset,
     changeOffset,
     resetOffset,
     refineOffsetWithChapters,
   };
 })();
