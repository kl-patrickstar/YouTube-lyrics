 (() => {
    if (window.__ytLyricsLoaded) return;
    window.__ytLyricsLoaded = true;

    const Y = (globalThis.YTLY ??= {});


    // ============================================================
    //  REFRESH (orchestration)
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

      const sequence = ++Y.state.refreshSeq;

      if (
        !force &&
        Y.state.currentVideoId === videoId &&
        Y.state.currentSong &&
        !artist &&
        !title
      ) {
        return;
      }

      const hadStoredOffset = await Y.sync.loadOffset(videoId);
      if (sequence !== Y.state.refreshSeq) return;

      Y.ui.setLoading();

      try {
        const song = await resolveSong(videoId, artist, title, sequence);
        if (sequence !== Y.state.refreshSeq || !song) return;

        Y.state.currentVideoId = videoId;
        Y.state.currentSong = song;

        applySongToUI(song, videoId);

        const lyrics = await resolveLyrics(song, videoId, force, sequence);
        if (sequence !== Y.state.refreshSeq) return;

        const autoEstimated = applyAutoOffset(lyrics, hadStoredOffset);
        Y.ui.updateOffsetDisplay();

        mergeLyricsMetadata(song, lyrics);
        updateExternalLinksAndArt(sequence);

        if (!hadStoredOffset) {
          Y.sync.refineOffsetWithChapters(sequence, song.title);
        }

        if (autoEstimated) {
          Y.ui.setStatus(
            `Intro detected: timing auto-adjusted to ${Y.sync.formatOffset(
              Y.state.lyricOffset
            )}. If it's off, fine-tune it in the control bar or reset.`
          );
        } else {
          Y.ui.hideStatus();
        }

        Y.state.lastLyrics = lyrics;
        Y.ui.renderLyrics(lyrics);

      } catch (error) {
        if (sequence !== Y.state.refreshSeq) return;
        handleRefreshError(error);
      }
    }

    // ============================================================
    //  RESOLVE SONG METADATA
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
        rawTitle: metadata.title,
      };
    }

    function applySongToUI(song, videoId) {
      if (!Y.state.ui) return;

      Y.state.ui.artistInput.value = song.artist || "";
      Y.state.ui.titleInput.value = song.title || "";
      Y.state.ui.title.textContent = song.title || "Lyrics";
      Y.state.ui.meta.textContent = song.artist || "";

      // Auto-open removed — panel opens only via toolbar/shortcut
    }

    // ============================================================
    //  RESOLVE LYRICS
    // ============================================================
    async function resolveLyrics(song, videoId, force, sequence) {
      const cacheKey = `ytlyrics_${videoId}`;

      if (!force) {
        const cached = await Y.bridge.getFromCache(cacheKey);
        if (cached && (cached.plainLyrics || cached.syncedLyrics)) {
          return cached;
        }
      }

      const duration = Y.youtube.getVideoDuration();

      let lyrics = await Y.api.fetchLyricsWithVariants(
        song.artist,
        song.rawTitle || song.title,
        duration
      );
      if (sequence !== Y.state.refreshSeq) return null;

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

      await Y.bridge.saveToCache(cacheKey, lyrics);
      return lyrics;
    }

    // ============================================================
    //  AUTO OFFSET
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
    // ============================================================
    function mergeLyricsMetadata(song, lyrics) {
      if (!lyrics.artist && !lyrics.title) return;

      Y.state.currentSong = {
        ...song,
        artist: lyrics.artist || song.artist,
        title: lyrics.title || song.title,
      };

      if (Y.state.ui) {
        Y.state.ui.title.textContent = Y.state.currentSong.title;
        Y.state.ui.meta.textContent = Y.state.currentSong.artist;
      }
    }

    function updateExternalLinksAndArt(sequence) {
      Y.ui.updateUgLink();
      Y.ui.updateAppleMusicLink();
      Y.ui.updateArtwork(sequence);
    }

    // ============================================================
    //  ERROR HANDLING
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
        Y.state.currentVideoId = null;
        Y.state.currentSong = null;
        Y.state.lastLyrics = null;
        Y.state.lyricOffset = 0;

        if (!activeUi.panel.hidden) {
          refresh({ force: true });
        }
      } else if (!activeUi.panel.hidden) {
        refresh({ force: false });
      }
    }

    // ============================================================
    //  OBSERVE NAVIGATION
    // ============================================================
    function observeNavigation() {
      let timeout;

      const schedule = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          updateForCurrentUrl();
        }, 800);
      };

      ["yt-navigate-finish", "yt-page-data-updated", "popstate", "hashchange"].forEach(
        (eventName) => {
          window.addEventListener(eventName, schedule);
        }
      );

      const titleEl = document.querySelector("title");
      if (titleEl) {
        new MutationObserver(schedule).observe(titleEl, { childList: true });
      }

      let lastUrl = location.href;
      new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          schedule();
        }
      }).observe(document.body, { childList: true, subtree: true });

      observeVideoElement(schedule);
    }

    // ============================================================
    //  OBSERVE VIDEO ELEMENT
    // ============================================================
    function observeVideoElement(schedule) {
      let currentVideo = document.querySelector("video");

      const attach = (video) => {
        if (!video || video.__ytLyricsAttached) return;
        video.__ytLyricsAttached = true;

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
    //  OBSERVE THEME
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
    //  SHORTCUT (⌘⇧L / Ctrl+Shift+L)
    // ============================================================
    function registerShortcut() {
      window.addEventListener("keydown", (event) => {
        const modifier = event.metaKey || event.ctrlKey;
        if (!(modifier && event.shiftKey)) return;
        if ((event.key || "").toLowerCase() !== "l") return;

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
    // ============================================================
    async function init() {
      await Y.ui.loadSettings();
      observeNavigation();
      observeYouTubeTheme();
      registerShortcut();
      registerToolbarAction();
      updateForCurrentUrl();
    }

    Y.controller = { refresh, manualSearch };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
