 (() => {
    const Y = (globalThis.YTLY ??= {});

    // ---------- Button-Position & Drag-State ----------
    let buttonPos = { x: 0, y: 0 };
    let dragState = null;
    let suppressNextClick = false;
    const DRAG_THRESHOLD = 5;

    // ---------- Panel-Position & Drag-State ----------
    let panelPos = null;
    let panelDragState = null;
    let savedButtonPos = null;

    // ---------- Animation-State ----------
    let panelAnimating = false;
    const POPOVER_DURATION = 260;

    // ---------- Toast ----------
    let toastTimer = null;

    function ensureUI() {
      let host = document.getElementById("yt-lyrics-extension-host");

      if (host && host.isConnected && Y.state.ui) {
        return Y.state.ui;
      }

      if (host && !host.isConnected) {
        host.remove();
      }

      host = document.createElement("div");
      host.id = "yt-lyrics-extension-host";
      host.style.cssText =
        "position:fixed; top:84px; left:" + (window.innerWidth - 16) +
        "px; right:auto; z-index:2147483647; width:0; height:0; display:none;";

      document.documentElement.appendChild(host);

      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = Y.template.html;

      const ui = {
        host,
        root,
        panel: root.getElementById("panel"),
        header: root.querySelector(".panel-header"),
        toggle: root.getElementById("toggle"),
        close: root.getElementById("close"),
        title: root.getElementById("track-title"),
        meta: root.getElementById("track-meta"),
        reload: root.getElementById("reload"),
        edit: root.getElementById("edit"),
        editor: root.getElementById("editor"),
        editorClose: root.getElementById("editor-close"),
        artistInput: root.getElementById("artist-input"),
        titleInput: root.getElementById("title-input"),
        search: root.getElementById("search"),
        status: root.getElementById("status"),
        lyrics: root.getElementById("lyrics"),
        settingsBtn: root.getElementById("settings-btn"),
        settings: root.getElementById("settings"),
        settingsClose: root.getElementById("settings-close"),
        settingsReset: root.getElementById("settings-reset"),
        settingAutoScroll: root.getElementById("setting-autoscroll"),
        settingTheme: root.getElementById("setting-theme"),
        fontMinus: root.getElementById("font-minus"),
        fontPlus: root.getElementById("font-plus"),
        fontValue: root.getElementById("font-value"),
        headerModeKaraoke: root.getElementById("header-mode-karaoke"),
        headerModeText: root.getElementById("header-mode-text"),
        offsetRow: root.getElementById("offset-row"),
        timingPill: root.getElementById("timing-pill"),
        offsetMinus: root.getElementById("offset-minus"),
        offsetPlus: root.getElementById("offset-plus"),
        offsetValue: root.getElementById("offset-value"),
        groupListen: root.getElementById("group-listen"),
        groupTabs: root.getElementById("group-tabs"),
        groupActions: root.getElementById("group-actions"),
        sep1: root.getElementById("sep-1"),
        sep2: root.getElementById("sep-2"),
        ugLink: root.getElementById("ug-link"),
        amLink: root.getElementById("am-link"),
        spLink: root.getElementById("sp-link"),
        copyBtn: root.getElementById("copy-btn"),
        printBtn: root.getElementById("print-btn"),
        trackArt: root.getElementById("track-art"),
        toast: root.getElementById("toast"),
        toastText: root.getElementById("toast-text"),
      };

      Y.state.ui = ui;

      // ---------- Toggle Button ----------
      ui.toggle.addEventListener("click", () => {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        togglePanel();
      });

      // ---------- Toggle Drag ----------
      ui.toggle.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (panelAnimating) return;
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: buttonPos.x,
          originY: buttonPos.y,
          moved: false,
        };
        ui.toggle.setPointerCapture(event.pointerId);
      });

      ui.toggle.addEventListener("pointermove", (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;

        if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          dragState.moved = true;
          ui.toggle.classList.add("dragging");
        }

        if (dragState.moved) {
          applyButtonPosition(
            clampPosition(dragState.originX + dx, dragState.originY + dy)
          );
        }
      });

      ui.toggle.addEventListener("pointerup", (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const moved = dragState.moved;
        dragState = null;
        ui.toggle.classList.remove("dragging");

        if (moved) {
          suppressNextClick = true;
          saveButtonPosition();
        }
      });

      ui.toggle.addEventListener("pointercancel", () => {
        dragState = null;
        ui.toggle.classList.remove("dragging");
      });

      // ---------- Panel Drag ----------
      if (ui.header) {
        ui.header.addEventListener("pointerdown", (event) => {
          const target = event.composedPath?.()[0] || event.target;
          if (target && target.closest && target.closest("button, a, input, select")) {
            return;
          }
          if (event.pointerType === "mouse" && event.button !== 0) return;
          if (panelAnimating) return;

          const rect = ui.panel.getBoundingClientRect();
          panelDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: rect.left,
            originY: rect.top,
            moved: false,
          };
          ui.header.setPointerCapture(event.pointerId);
        });

        ui.header.addEventListener("pointermove", (event) => {
          if (!panelDragState || event.pointerId !== panelDragState.pointerId) return;
          const dx = event.clientX - panelDragState.startX;
          const dy = event.clientY - panelDragState.startY;

          if (!panelDragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            panelDragState.moved = true;
            ui.panel.classList.add("dragging");
          }

          if (panelDragState.moved) {
            applyPanelPosition(
              clampPanelPosition(
                panelDragState.originX + dx,
                panelDragState.originY + dy
              )
            );
          }
        });

        ui.header.addEventListener("pointerup", (event) => {
          if (!panelDragState || event.pointerId !== panelDragState.pointerId) return;
          panelDragState = null;
          ui.panel.classList.remove("dragging");
        });

        ui.header.addEventListener("pointercancel", () => {
          panelDragState = null;
          ui.panel.classList.remove("dragging");
        });
      }

      ui.close.addEventListener("click", () => {
        closePanelToButton();
        const currentId = Y.youtube.getVideoId();
        if (currentId) {
          try {
            sessionStorage.setItem(`ytlyrics_closed_${currentId}`, "true");
          } catch (e) {}
        }
      });

      ui.reload.addEventListener("click", () => Y.controller.refresh({ force: true }));

      ui.edit.addEventListener("click", () => {
        const willOpen = ui.editor.hidden;
        ui.editor.hidden = !willOpen;
        ui.settings.hidden = true;
        ui.edit.classList.toggle("active", willOpen);
        ui.settingsBtn.classList.remove("active");
      });

      if (ui.editorClose) {
        ui.editorClose.addEventListener("click", () => {
          ui.editor.hidden = true;
          ui.edit.classList.remove("active");
        });
      }

      ui.settingsBtn.addEventListener("click", () => {
        const willOpen = ui.settings.hidden;
        ui.settings.hidden = !willOpen;
        ui.editor.hidden = true;
        ui.settingsBtn.classList.toggle("active", willOpen);
        ui.edit.classList.remove("active");
      });

      if (ui.settingsClose) {
        ui.settingsClose.addEventListener("click", () => {
          ui.settings.hidden = true;
          ui.settingsBtn.classList.remove("active");
        });
      }

      ui.search.addEventListener("click", () => Y.controller.manualSearch());

      if (ui.settingAutoScroll) {
        ui.settingAutoScroll.addEventListener("click", async () => {
          const newVal = ui.settingAutoScroll.getAttribute("aria-checked") !== "true";
          ui.settingAutoScroll.setAttribute("aria-checked", String(newVal));
          Y.state.settings.autoScroll = newVal;
          await saveSettings();
        });
      }

      ui.settingTheme.addEventListener("change", async () => {
        Y.state.settings.theme = ui.settingTheme.value;
        await saveSettings();
        applyTheme();
      });

      ui.fontMinus.addEventListener("click", () => changeFontSize(-1));
      ui.fontPlus.addEventListener("click", () => changeFontSize(1));

      if (ui.settingsReset) {
        ui.settingsReset.addEventListener("click", async () => {
          resetAllSettings();
        });
      }

      ui.headerModeKaraoke.addEventListener("click", () => setMode("karaoke"));
      ui.headerModeText.addEventListener("click", () => setMode("text"));

      attachOffsetHold(ui.offsetMinus, -1);
      attachOffsetHold(ui.offsetPlus, 1);
      ui.offsetValue.addEventListener("click", () => Y.sync.resetOffset());

      if (ui.copyBtn) {
        ui.copyBtn.addEventListener("click", () => copyLyricsToClipboard());
      }

      if (ui.printBtn) {
        ui.printBtn.addEventListener("click", () => exportLyricsAsHTML());
      }

      [ui.artistInput, ui.titleInput].forEach((input) => {
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            Y.controller.manualSearch();
          }
        });
      });

      ["keydown", "keyup", "keypress"].forEach((type) => {
        host.addEventListener(type, (event) => {
          if (event.metaKey) return;
          event.stopPropagation();
        });
      });

      applySettings();
      loadButtonPosition();

      window.addEventListener("resize", () => {
        applyButtonPosition(clampPosition(buttonPos.x, buttonPos.y));
      });

      return ui;
    }

    // ============================================================
    //  Offset Pill
    // ============================================================
    function attachOffsetHold(button, direction) {
      const HOLD_DELAY = 400;
      const REPEAT_INTERVAL = 130;

      let holdTimer = null;
      let repeatTimer = null;

      function cleanup() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
        button.classList.remove("holding", "pressing");
      }

      function fireFine() { Y.sync.changeOffset(direction * 0.5); }
      function fireCoarse() { Y.sync.changeOffset(direction * 5); }

      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        cleanup();
        button.classList.add("pressing");

        fireFine();

        holdTimer = setTimeout(() => {
          holdTimer = null;
          button.classList.remove("pressing");
          button.classList.add("holding");
          fireCoarse();
          repeatTimer = setInterval(fireCoarse, REPEAT_INTERVAL);
        }, HOLD_DELAY);

        try { button.setPointerCapture(event.pointerId); } catch {}
      });

      button.addEventListener("pointerup", cleanup);
      button.addEventListener("pointercancel", cleanup);

      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fireFine();
        }
      });
    }

    // ============================================================
    //  Toast
    // ============================================================
    function showToast(text) {
      const ui = Y.state.ui;
      if (!ui || !ui.toast) return;

      if (ui.toastText) {
        ui.toastText.textContent = text;
      }

      ui.toast.classList.add("show");
      ui.toast.setAttribute("aria-hidden", "false");

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        ui.toast.classList.remove("show");
        ui.toast.setAttribute("aria-hidden", "true");
      }, 1500);
    }

    // ============================================================
    //  Copy
    // ============================================================
    async function copyLyricsToClipboard() {
      const lyrics = Y.state.lastLyrics;
      if (!lyrics) return;

      let bodyText = "";

      if (lyrics.syncedLyrics) {
        bodyText = Y.lyrics
          .parseLRC(lyrics.syncedLyrics)
          .map((line) => line.text)
          .join("\n");
      }

      if (!bodyText && lyrics.plainLyrics) {
        bodyText = lyrics.plainLyrics;
      }

      bodyText = (bodyText || "").trim();
      if (!bodyText) return;

      const song = Y.state.currentSong || {};
      const title = song.title || "";
      const artist = song.artist && song.artist !== "Unknown" ? song.artist : "";

      const header = [title, artist].filter(Boolean).join(" — ");
      const fullText = header ? `${header}\n\n${bodyText}` : bodyText;

      let ok = false;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText);
          ok = true;
        }
      } catch {
        ok = false;
      }

      if (!ok) {
        try {
          const ta = document.createElement("textarea");
          ta.value = fullText;
          ta.setAttribute("readonly", "");
          ta.style.cssText =
            "position:fixed; top:0; left:-9999px; opacity:0; pointer-events:none;";

          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch {
          ok = false;
        }
      }

      if (ok) {
        showToast("Lyrics copied");
      } else {
        showToast("Copy failed");
      }
    }

    // ============================================================
    //  OPEN PANEL FROM BUTTON (popover in)
    // ============================================================
    function openPanelFromButton() {
      const ui = Y.state.ui;
      if (!ui || panelAnimating) return;

      panelAnimating = true;

      // Save current button position so we can restore it on close
      savedButtonPos = { ...buttonPos };

      // 1. Reveal panel invisibly to measure size
      ui.panel.hidden = false;
      ui.panel.style.visibility = "hidden";
      ui.panel.classList.remove("popover-opening", "popover-closing");

      const w = ui.panel.offsetWidth;
      const h = ui.panel.offsetHeight;

      // 2. Compute target position: panel to the LEFT of button
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = buttonPos.x - w - 8;
      let top = buttonPos.y;

      if (left < margin) left = margin;
      if (left + w > vw - margin) left = vw - w - margin;
      if (top + h > vh - margin) top = vh - h - margin;
      if (top < margin) top = margin;

      // 3. Position panel
      ui.panel.style.left = `${left}px`;
      ui.panel.style.top = `${top}px`;
      ui.panel.style.right = "auto";
      ui.panel.style.bottom = "auto";

      // 4. transform-origin = button's top-left corner, relative to panel
      const originX = buttonPos.x - left;
      const originY = buttonPos.y - top;
      ui.panel.style.transformOrigin = `${originX}px ${originY}px`;

      // 5. Hide button
      ui.toggle.classList.add("is-hidden");

      // 6. Play animation
      ui.panel.style.visibility = "";
      ui.panel.classList.add("popover-opening");

      // 7. Store final position in memory
      panelPos = { x: left, y: top };

      setTimeout(() => {
        ui.panel.classList.remove("popover-opening");
        panelAnimating = false;
      }, POPOVER_DURATION + 20);
    }

    // ============================================================
    //  CLOSE PANEL TO BUTTON (popover out)
    //  Panel shrinks toward its top-right corner.
    //  Button restores to its previous position (no drift).
    // ============================================================
    function closePanelToButton() {
      const ui = Y.state.ui;
      if (!ui || panelAnimating) return;
      if (ui.panel.hidden) return;

      panelAnimating = true;

      // Set transform-origin to the TOP-RIGHT corner of the panel
      ui.panel.style.transformOrigin = "100% 0";

      // Play reverse animation
      ui.panel.classList.add("popover-closing");

      // Button will restore to its saved position (no drift)
      if (savedButtonPos) {
        buttonPos = savedButtonPos;
      }

      setTimeout(() => {
        ui.panel.hidden = true;
        ui.panel.classList.remove("popover-closing");

        ui.toggle.classList.remove("is-hidden");
        applyButtonPosition(buttonPos);

        panelPos = null;
        savedButtonPos = null;
        panelAnimating = false;

        if (ui.editor) ui.editor.hidden = true;
        if (ui.settings) ui.settings.hidden = true;
        if (ui.edit) ui.edit.classList.remove("active");
        if (ui.settingsBtn) ui.settingsBtn.classList.remove("active");
      }, POPOVER_DURATION + 20);
    }

    function togglePanel() {
      const ui = Y.state.ui;
      if (!ui || panelAnimating) return;

      if (ui.panel.hidden) {
        openPanelFromButton();
        Y.controller.refresh({ force: false });
      } else {
        closePanelToButton();
      }
    }

    // ============================================================
    //  Button Position
    // ============================================================
    function clampPosition(x, y) {
      const margin = 8;
      const btn = 44;
      return {
        x: Math.max(btn + margin, Math.min(window.innerWidth - margin, x)),
        y: Math.max(margin, Math.min(window.innerHeight - btn - margin, y)),
      };
    }

    function applyButtonPosition(pos) {
      buttonPos = pos;
      const ui = Y.state.ui;
      if (!ui) return;
      ui.host.style.left = `${pos.x}px`;
      ui.host.style.top = `${pos.y}px`;
      ui.host.style.right = "auto";
    }

    // ============================================================
    //  Panel Position
    // ============================================================
    function clampPanelPosition(x, y) {
      const ui = Y.state.ui;
      if (!ui) return { x, y };

      const margin = 8;
      const w = ui.panel.offsetWidth || 420;
      const h = ui.panel.offsetHeight || 400;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      return {
        x: Math.max(margin, Math.min(vw - w - margin, x)),
        y: Math.max(margin, Math.min(vh - h - margin, y)),
      };
    }

    function applyPanelPosition(pos) {
      panelPos = pos;
      const ui = Y.state.ui;
      if (!ui || !ui.panel) return;

      ui.panel.style.left = `${pos.x}px`;
      ui.panel.style.top = `${pos.y}px`;
      ui.panel.style.right = "auto";
      ui.panel.style.bottom = "auto";
    }

    async function loadButtonPosition() {
      const stored = await Y.bridge.getFromCache("ytlyrics_buttonpos");

      const pos =
        stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)
          ? clampPosition(stored.x, stored.y)
          : clampPosition(window.innerWidth - 16, 84);

      applyButtonPosition(pos);
    }

    function saveButtonPosition() {
      Y.bridge.saveToCache("ytlyrics_buttonpos", buttonPos);
    }

    // ============================================================
    //  Status & Loading
    // ============================================================
    function setStatus(text, isError = false) {
      if (!Y.state.ui) return;
      Y.state.ui.status.hidden = false;
      Y.state.ui.status.textContent = text;
      Y.state.ui.status.classList.toggle("error", isError);
    }

    function hideStatus() {
      if (!Y.state.ui) return;
      Y.state.ui.status.hidden = true;
    }

    function setLoading() {
      if (!Y.state.ui) return;

      Y.state.ui.lyrics.textContent = "";

      const skeleton = document.createElement("div");
      skeleton.className = "skeleton";
      skeleton.setAttribute("aria-hidden", "true");

      const widths = [94, 82, 88, 68, 90, 74, 62];
      widths.forEach((width) => {
        const line = document.createElement("div");
        line.className = "skeleton-line";
        line.style.width = `${width}%`;
        skeleton.appendChild(line);
      });

      Y.state.ui.lyrics.appendChild(skeleton);
      setStatus("Searching for lyrics…");
    }

    // ============================================================
    //  Settings
    // ============================================================
    async function loadSettings() {
      const stored = await Y.bridge.getFromCache("ytlyrics_settings");
      if (stored && typeof stored === "object") {
        Object.assign(Y.state.settings, stored);
      }
      applySettings();
    }

    async function saveSettings() {
      await Y.bridge.saveToCache("ytlyrics_settings", Y.state.settings);
    }

    function applySettings() {
      if (Y.state.ui) {
        if (Y.state.ui.settingAutoScroll) {
          Y.state.ui.settingAutoScroll.setAttribute(
            "aria-checked",
            String(!!Y.state.settings.autoScroll)
          );
        }
        Y.state.ui.settingTheme.value = Y.state.settings.theme || "auto";
      }
      applyFontSize();
      applyTheme();
      applyMode();
    }

    function applyMode() {
      if (!Y.state.ui) return;
      const karaoke = Y.state.settings.mode !== "text";

      if (Y.state.ui.headerModeKaraoke) {
        Y.state.ui.headerModeKaraoke.classList.toggle("active", karaoke);
        Y.state.ui.headerModeKaraoke.setAttribute("aria-checked", String(karaoke));
      }
      if (Y.state.ui.headerModeText) {
        Y.state.ui.headerModeText.classList.toggle("active", !karaoke);
        Y.state.ui.headerModeText.setAttribute("aria-checked", String(!karaoke));
      }
    }

    async function setMode(mode) {
      if (Y.state.settings.mode === mode) return;
      Y.state.settings.mode = mode;
      applyMode();
      await saveSettings();
      if (Y.state.lastLyrics) renderLyrics(Y.state.lastLyrics);
    }

    function applyFontSize() {
      if (!Y.state.ui) return;
      Y.state.ui.panel.style.setProperty("--lyrics-font-size", `${Y.state.settings.fontSize}px`);
      Y.state.ui.fontValue.textContent = `${Y.state.settings.fontSize}px`;
    }

    async function changeFontSize(delta) {
      Y.state.settings.fontSize = Math.max(14, Math.min(26, Y.state.settings.fontSize + delta));
      applyFontSize();
      await saveSettings();
    }

    function applyTheme() {
      if (!Y.state.ui) return;
      let light = false;
      if (Y.state.settings.theme === "light") {
        light = true;
      } else if (Y.state.settings.theme === "auto") {
        light = !document.documentElement.hasAttribute("dark");
      }
      Y.state.ui.panel.classList.toggle("theme-light", light);
    }

    async function resetAllSettings() {
      Y.state.settings.autoScroll = true;
      Y.state.settings.theme = "auto";
      Y.state.settings.fontSize = 17;
      Y.state.settings.mode = "karaoke";
      delete Y.state.settings.autoOpen;
      await saveSettings();
      applySettings();
      if (Y.state.lastLyrics) renderLyrics(Y.state.lastLyrics);
      showToast("Settings reset");
    }

    // ============================================================
    //  External Links
    // ============================================================
    function updateUgLink() {
      if (!Y.state.ui || !Y.state.currentSong) return;
      const { artist, title } = Y.state.currentSong;
      if (!artist || artist === "Unknown" || !title || title === "Unknown") {
        Y.state.ui.ugLink.hidden = true;
      } else {
        const artistParam = encodeURIComponent(artist);
        const titleParam = encodeURIComponent(title);
        Y.state.ui.ugLink.href = `https://www.ultimate-guitar.com/search.php?title=${titleParam}&artist=${artistParam}`;
        Y.state.ui.ugLink.hidden = false;
      }
      updateExtSection();
    }

    function updateAppleMusicLink() {
      if (!Y.state.ui || !Y.state.currentSong) return;
      const { artist, title } = Y.state.currentSong;
      if (!artist || artist === "Unknown" || !title || title === "Unknown") {
        Y.state.ui.amLink.hidden = true;
      } else {
        const query = encodeURIComponent(`${artist} ${title}`);
        Y.state.ui.amLink.href = `https://music.apple.com/search?term=${query}`;
        Y.state.ui.amLink.hidden = false;
      }
      updateSpotifyLink();
      updateExtSection();
    }

    function updateSpotifyLink() {
      if (!Y.state.ui || !Y.state.ui.spLink || !Y.state.currentSong) return;
      const { artist, title } = Y.state.currentSong;
      if (!artist || artist === "Unknown" || !title || title === "Unknown") {
        Y.state.ui.spLink.hidden = true;
      } else {
        const query = encodeURIComponent(`${artist} ${title}`);
        Y.state.ui.spLink.href = `https://open.spotify.com/search/${query}`;
        Y.state.ui.spLink.hidden = false;
      }
      updateExtSection();
    }

    function updateExtSection() {
      if (!Y.state.ui) return;

      const hasLyrics = !!Y.state.lastLyrics;

      if (Y.state.ui.copyBtn) {
        Y.state.ui.copyBtn.hidden = !hasLyrics;
      }
      if (Y.state.ui.printBtn) {
        Y.state.ui.printBtn.hidden = !hasLyrics;
      }

      const listenVisible =
        (Y.state.ui.amLink && !Y.state.ui.amLink.hidden) ||
        (Y.state.ui.spLink && !Y.state.ui.spLink.hidden);

      const tabsVisible = Y.state.ui.ugLink && !Y.state.ui.ugLink.hidden;

      const actionsVisible =
        (Y.state.ui.copyBtn && !Y.state.ui.copyBtn.hidden) ||
        (Y.state.ui.printBtn && !Y.state.ui.printBtn.hidden);

      if (Y.state.ui.groupListen) Y.state.ui.groupListen.hidden = !listenVisible;
      if (Y.state.ui.groupTabs) Y.state.ui.groupTabs.hidden = !tabsVisible;
      if (Y.state.ui.groupActions) Y.state.ui.groupActions.hidden = !actionsVisible;

      if (Y.state.ui.sep1) Y.state.ui.sep1.hidden = !(listenVisible && tabsVisible);
      if (Y.state.ui.sep2) Y.state.ui.sep2.hidden = !(tabsVisible && actionsVisible);
    }

    async function updateArtwork(sequence) {
      if (!Y.state.ui || !Y.state.currentSong) return;
      const { artist, title } = Y.state.currentSong;
      if (!artist || artist === "Unknown" || !title || title === "Unknown") {
        Y.state.ui.trackArt.hidden = true;
        return;
      }

      const key = `ytlyrics_art_${artist.toLowerCase()}_${title.toLowerCase()}`;
      let url = Y.state.artMemory.get(key);

      if (url === undefined) {
        const stored = await Y.bridge.getFromCache(key);
        if (stored) {
          url = stored;
        } else {
          url = await Y.api.fetchArtworkFromItunes(artist, title);
          if (url) await Y.bridge.saveToCache(key, url);
        }
        Y.state.artMemory.set(key, url || "");
      }

      if (sequence !== undefined && sequence !== Y.state.refreshSeq) return;

      if (url) {
        Y.state.ui.trackArt.src = url;
        Y.state.ui.trackArt.hidden = false;
      } else {
        Y.state.ui.trackArt.hidden = true;
      }
    }

    function updateOffsetDisplay() {
      if (!Y.state.ui) return;
      const offset = Y.state.lyricOffset;
      const nonzero = offset !== 0;

      Y.state.ui.offsetValue.textContent = Y.sync.formatOffset(offset);
      Y.state.ui.offsetValue.classList.toggle("has-offset", nonzero);

      if (Y.state.ui.timingPill) {
        Y.state.ui.timingPill.classList.toggle("has-offset", nonzero);
      }
    }

    // ============================================================
    //  Lyrics Rendering
    // ============================================================
    function renderEmptyState(message) {
      if (!Y.state.ui) return;

      if (Y.state.ui.offsetRow) {
        Y.state.ui.offsetRow.hidden = true;
      }

      Y.state.ui.lyrics.textContent = "";
      Y.state.ui.lyrics.scrollTop = 0;

      const sync = Y.sync.getSync();
      sync.lines = [];
      sync.elements = [];
      sync.activeIndex = -1;
      Y.sync.detachVideoListeners();

      const wrap = document.createElement("div");
      wrap.className = "empty-state";

      const icon = document.createElement("div");
      icon.className = "empty-icon";
      icon.innerHTML = Y.template.ICONS.noMusic;

      const title = document.createElement("div");
      title.className = "empty-title";
      title.textContent = "No lyrics found";

      const text = document.createElement("div");
      text.className = "empty-text";
      text.textContent = message;

      wrap.appendChild(icon);
      wrap.appendChild(title);
      wrap.appendChild(text);

      Y.state.ui.lyrics.appendChild(wrap);
    }

    function renderLyrics(lyrics) {
      if (!Y.state.ui) return;

      if (Y.state.ui.offsetRow) {
        Y.state.ui.offsetRow.hidden = true;
      }

      Y.state.ui.lyrics.textContent = "";
      Y.state.ui.lyrics.scrollTop = 0;

      const sync = Y.sync.getSync();
      sync.lines = [];
      sync.elements = [];
      sync.activeIndex = -1;
      Y.sync.detachVideoListeners();

      const wantSynced = Y.state.settings.mode !== "text" && lyrics.syncedLyrics;

      if (wantSynced) {
        const lines = Y.lyrics.parseLRC(lyrics.syncedLyrics);

        if (lines.length) {
          sync.lines = lines;

          const container = document.createElement("div");

          lines.forEach((line, index) => {
            const div = document.createElement("div");
            div.className = "line";
            div.textContent = line.text || "…";
            div.dataset.index = String(index);

            div.addEventListener("click", () => {
              Y.sync.seekTo(line.time);
            });

            container.appendChild(div);
            sync.elements.push(div);
          });

          Y.state.ui.lyrics.appendChild(container);

          if (Y.state.ui.offsetRow) {
            Y.state.ui.offsetRow.hidden = false;
          }

          requestAnimationFrame(() => {
            Y.sync.attachVideoListeners();
            Y.sync.updateActiveLine();
          });

          updateExtSection();
          return;
        }
      }

      let text = lyrics.plainLyrics?.trim();

      if (!text && lyrics.syncedLyrics) {
        text = Y.lyrics
          .parseLRC(lyrics.syncedLyrics)
          .map((line) => line.text)
          .join("\n")
          .trim();
      }

      if (!text) {
        renderEmptyState(
          "This video appears to be instrumental — or lyrics aren't available from our sources."
        );
        return;
      }

      const pre = document.createElement("pre");
      pre.textContent = text;
      Y.state.ui.lyrics.appendChild(pre);

      updateExtSection();
    }

    // ============================================================
    //  Print / Export
    // ============================================================
    function exportLyricsAsHTML() {
      const lyrics = Y.state.lastLyrics;
      if (!lyrics) return;

      const song = Y.state.currentSong || {};
      const title = song.title || "Lyrics";
      const artist = song.artist || "";
      const artwork = Y.state.ui?.trackArt?.src || "";

      let lyricsText = "";

      if (lyrics.syncedLyrics) {
        lyricsText = Y.lyrics
          .parseLRC(lyrics.syncedLyrics)
          .map((line) => line.text)
          .join("\n");
      }

      if (!lyricsText && lyrics.plainLyrics) {
        lyricsText = lyrics.plainLyrics;
      }

      lyricsText = (lyricsText || "").trim();

      const safeTitle = escapeHtml(title);
      const safeArtist = escapeHtml(artist);
      const safeLyrics = escapeHtml(lyricsText).replace(/\n/g, "<br>");
      const safeArtwork = artwork ? escapeHtml(artwork) : "";

      const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <title>${safeTitle}${artist ? " — " + safeArtist : ""}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 32px 64px;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid #111;
    }
    .art {
      width: 96px;
      height: 96px;
      border-radius: 8px;
      object-fit: cover;
      flex: 0 0 auto;
      border: 1px solid #ddd;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.25;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .artist {
      margin: 0;
      font-size: 15px;
      color: #555;
      font-weight: 500;
    }
    .lyrics {
      font-size: 15px;
      line-height: 1.9;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #111;
    }
    footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 11.5px;
      color: #777;
      text-align: center;
    }
    @media print {
      .page { padding: 24px 16px; }
      header { margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 20px; }
      .lyrics { font-size: 13.5px; line-height: 1.8; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
  </head>
  <body>
    <div class="page">
      <header>
        ${safeArtwork ? `<img class="art" src="${safeArtwork}" alt="" />` : ""}
        <div>
          <h1>${safeTitle}</h1>
          ${safeArtist ? `<p class="artist">${safeArtist}</p>` : ""}
        </div>
      </header>
      <div class="lyrics">${safeLyrics}</div>
      <footer>
        Printed with YouTube Lyrics · Source: LRCLIB · lyrics.ovh
      </footer>
    </div>
  </body>
  </html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const win = window.open(url, "_blank");

      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title} - ${artist}.html`;
        a.click();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // ============================================================
    //  Exports
    // ============================================================
    Y.ui = {
      ensureUI,
      setPanelVisibility: (open) => {
        if (open) openPanelFromButton();
        else closePanelToButton();
      },
      togglePanel,
      setStatus,
      hideStatus,
      setLoading,
      loadSettings,
      applyTheme,
      applyFontSize,
      applyMode,
      setMode,
      updateUgLink,
      updateAppleMusicLink,
      updateSpotifyLink,
      updateArtwork,
      updateOffsetDisplay,
      updateExtSection,
      renderLyrics,
      renderEmptyState,
      loadButtonPosition,
      saveButtonPosition,
      applyButtonPosition,
      clampPosition,
      clampPanelPosition,
      applyPanelPosition,
      copyLyricsToClipboard,
      showToast,
      exportLyricsAsHTML,
    };
  })();
