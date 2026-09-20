 (() => {
    const Y = (globalThis.YTLY ??= {});

    const sync = {
      lines: [],
      elements: [],
      activeIndex: -1,
      video: null,
      onTimeUpdate: null,
      rafId: null,
      frameCallbackId: null,
      videoObserver: null,
    };

    // ============================================================
    //  DETACH LISTENERS
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
    //  Fires on every video frame (~30-60x per second).
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
        // Request next frame
        sync.frameCallbackId = video.requestVideoFrameCallback(frameCallback);
      };

      sync.frameCallbackId = video.requestVideoFrameCallback(frameCallback);
    }

    // ============================================================
    //  COMPUTE ACTIVE LINE AND HIGHLIGHT IT
    // ============================================================
    function updateActiveLine() {
      const video = sync.video || Y.youtube.getVideoElement();
      if (!video || !sync.lines.length) return;

      const lyricsContainer = Y.state.ui?.lyrics;
      if (!lyricsContainer) return;

      const currentTime = video.currentTime;
      let newIndex = -1;

      for (let i = 0; i < sync.lines.length; i++) {
        if (sync.lines[i].time + Y.state.lyricOffset <= currentTime) {
          newIndex = i;
        } else {
          break;
        }
      }

      if (newIndex === sync.activeIndex) return;

      sync.activeIndex = newIndex;

      // Update classes on all rendered lines
      sync.elements.forEach((el, i) => {
        if (!el || !el.classList) return;
        el.classList.toggle("active", i === newIndex);
        el.classList.toggle("past", i < newIndex);
      });

      // Auto-scroll to the active line
      if (newIndex >= 0 && Y.state.settings.autoScroll) {
        const activeElement = sync.elements[newIndex];
        if (!activeElement) return;

        try {
          const containerRect = lyricsContainer.getBoundingClientRect();
          const lineRect = activeElement.getBoundingClientRect();

          const scrollOffset =
            lineRect.top -
            containerRect.top -
            containerRect.height / 2 +
            lineRect.height / 2;

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
    //  - timeupdate: for pause/seek/status updates
    //  - requestVideoFrameCallback: for precise live timing
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

      // Precise sync loop
      startPreciseSyncLoop(video);

      // Update once immediately
      updateActiveLine();
    }

    // ============================================================
    //  FALLBACK: wait for <video> via MutationObserver
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

      // Safety timeout: give up after 30 s
      setTimeout(() => {
        if (sync.videoObserver) {
          sync.videoObserver.disconnect();
          sync.videoObserver = null;
        }
      }, 30000);
    }

    // ============================================================
    //  SEEK TO A LINE
    // ============================================================
    function seekTo(time) {
      const video = Y.youtube.getVideoElement();
      if (!video) return;

      video.currentTime = time + Y.state.lyricOffset;
      const playPromise = video.play?.();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }

      // Update immediately (without waiting for next frame)
      setTimeout(() => updateActiveLine(), 50);
    }

    // ============================================================
    //  FORMAT OFFSET
    // ============================================================
    function formatOffset(value) {
      const rounded = Math.round(value * 10) / 10;
      const sign = rounded > 0 ? "+" : "";
      const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
      return `${sign}${text}s`;
    }

    // ============================================================
    //  LOAD / SAVE / CHANGE OFFSET
    // ============================================================
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

    async function persistOffset() {
      const videoId = Y.youtube.getVideoId();
      if (videoId) {
        await Y.bridge.saveToCache(`ytlyrics_offset_${videoId}`, Y.state.lyricOffset);
      }
    }

    async function changeOffset(delta) {
      Y.state.lyricOffset = Math.max(
        -120,
        Math.min(120, Math.round((Y.state.lyricOffset + delta) * 10) / 10)
      );
      Y.ui.updateOffsetDisplay();
      updateActiveLine();
      await persistOffset();
    }

    async function resetOffset() {
      Y.state.lyricOffset = 0;
      Y.ui.updateOffsetDisplay();
      updateActiveLine();
      await persistOffset();
    }

    // ============================================================
    //  REFINE OFFSET USING CHAPTERS
    // ============================================================
    async function refineOffsetWithChapters(sequence, songTitle) {
      for (let attempt = 0; attempt < 8; attempt++) {
        if (sequence !== Y.state.refreshSeq) return;

        const chapters = Y.youtube.readChaptersFromDom();

        if (chapters.length >= 2) {
          const offset = Y.youtube.computeOffsetFromChapters(chapters, songTitle);

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
    //  EXPORT
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
