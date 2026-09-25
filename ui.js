// ============================================================
//  ui.js
//  All UI logic for the lyrics panel.
//
//  Responsibilities:
//    - Build the Shadow DOM host + panel (see template.js for HTML)
//    - Wire up every button, input and drag handler
//    - Render lyrics, empty states, loading skeletons
//    - Manage settings (load, save, apply)
//    - Manage panel + button position (persisted per session)
//    - Handle the popover open/close animation
//
//  Architecture:
//    All state lives in the module-level variables below (buttonPos,
//    panelPos, dragState, …). Y.state.ui holds the DOM element
//    references so other modules can access them.
//
//  Exports (Y.ui):
//    ensureUI, setPanelVisibility, togglePanel, setStatus, hideStatus,
//    setLoading, loadSettings, applyTheme, applyFontSize, applyMode,
//    setMode, updateUgLink, updateAppleMusicLink, updateSpotifyLink,
//    updateArtwork, updateOffsetDisplay, updateExtSection, renderLyrics,
//    renderEmptyState, loadButtonPosition, saveButtonPosition,
//    applyButtonPosition, clampPosition, clampPanelPosition,
//    applyPanelPosition, copyLyricsToClipboard, showToast,
//    exportLyricsAsHTML
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // --------------------------------------------------------
   //  BUTTON POSITION & DRAG STATE
   //  Tracks where the floating mic button is, plus its drag.
   // --------------------------------------------------------
   let buttonPos = { x: 0, y: 0 };
   let dragState = null;
   let suppressNextClick = false;
   const DRAG_THRESHOLD = 5; // px before a click is treated as a drag

   // --------------------------------------------------------
   //  PANEL POSITION & DRAG STATE
   //  Tracks where the open panel is and its drag state.
   // --------------------------------------------------------
   let panelPos = null;
   let panelDragState = null;

   // --------------------------------------------------------
   //  PANEL DRAG rAF BATCHING
   //  During drag, we batch transform updates to one per frame.
   //  Without this, Chrome becomes sticky on high-refresh displays.
   // --------------------------------------------------------
   let dragRafId = null;
   let pendingDx = 0;
   let pendingDy = 0;

   // --------------------------------------------------------
   //  ANIMATION STATE
   //  panelAnimating = true while the popover open/close
   //  animation is running — prevents double-triggering.
   // --------------------------------------------------------
   let panelAnimating = false;
   const POPOVER_DURATION = 260; // must match CSS --popover-duration

   // --------------------------------------------------------
   //  TOAST TIMER
   //  Used to auto-hide the toast after a short delay.
   // --------------------------------------------------------
   let toastTimer = null;

   // ============================================================
   //  ENSURE UI
   //  Builds the Shadow DOM host + panel if it doesn't exist yet,
   //  and wires up all event listeners on the first call.
   //  Idempotent: safe to call from anywhere at any time.
   //
   //  Why Shadow DOM?
   //    Isolates our CSS from YouTube's, and vice versa. Nothing
   //    inside the panel can leak out, and YouTube's global styles
   //    can't accidentally affect us.
   // ============================================================
   function ensureUI() {
     // Reuse existing UI if still attached to the DOM.
     let host = document.getElementById("yt-lyrics-extension-host");
     if (host && host.isConnected && Y.state.ui) {
       return Y.state.ui;
     }

     // Remove stale host (YouTube SPA navigation can leave one behind).
     if (host && !host.isConnected) {
       host.remove();
     }

     // --- Create the host element ---
     // The host is a tiny zero-size anchor; all visible content
     // lives inside its shadow root.
     host = document.createElement("div");
     host.id = "yt-lyrics-extension-host";
     host.style.cssText =
       "position:fixed; top:84px; left:" + (window.innerWidth - 16) +
       "px; right:auto; z-index:2147483647; width:0; height:0; display:none;";

     document.documentElement.appendChild(host);

     // --- Attach Shadow DOM and inject template ---
     const root = host.attachShadow({ mode: "open" });
     root.innerHTML = Y.template.html;

     // --- Gather references to all UI elements ---
     // Every id here must exist in template.js's html string.
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
       statusText: root.getElementById("status-text"),
       statusClose: root.getElementById("status-close"),
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
       groupTiming: root.getElementById("group-timing"),
       sep0: root.getElementById("sep-0"),
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

     // ============================================================
     //  TOGGLE BUTTON — CLICK
     //  Opens or closes the panel. Suppressed if the click was
     //  actually the end of a drag gesture.
     // ============================================================
     ui.toggle.addEventListener("click", () => {
       if (suppressNextClick) {
         suppressNextClick = false;
         return;
       }
       togglePanel();
     });

     // ============================================================
     //  TOGGLE BUTTON — DRAG
     //  The mic button can be dragged anywhere on the viewport.
     //  Uses pointer events + setPointerCapture so the drag keeps
     //  working even if the pointer leaves the button.
     // ============================================================
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

       // Only start "real" dragging after the threshold — prevents
       // tiny mouse movements from accidentally triggering drag.
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
         // Drag ended — suppress the next click so it doesn't
         // accidentally open/close the panel.
         suppressNextClick = true;
         saveButtonPosition();
       }
     });

     ui.toggle.addEventListener("pointercancel", () => {
       dragState = null;
       ui.toggle.classList.remove("dragging");
     });

     // ============================================================
     //  PANEL — DRAG (via header)
     //  Dragging the header moves the entire panel. The transform
     //  is applied during the drag (rAF-batched for smoothness on
     //  Chrome); the final position is committed on pointerup.
     // ============================================================
     if (ui.header) {
       ui.header.addEventListener("pointerdown", (event) => {
         // Ignore clicks on interactive elements inside the header
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

         if (!panelDragState.moved) return;

         // rAF batching: only apply one transform update per frame
         pendingDx = dx;
         pendingDy = dy;
         if (dragRafId) return;

         dragRafId = requestAnimationFrame(() => {
           dragRafId = null;
           ui.panel.style.transform = `translate(${pendingDx}px, ${pendingDy}px)`;
         });
       });

       ui.header.addEventListener("pointerup", (event) => {
         if (!panelDragState || event.pointerId !== panelDragState.pointerId) return;

         if (dragRafId) {
           cancelAnimationFrame(dragRafId);
           dragRafId = null;
         }

         const moved = panelDragState.moved;
         const startX = panelDragState.originX;
         const startY = panelDragState.originY;
         const dx = event.clientX - panelDragState.startX;
         const dy = event.clientY - panelDragState.startY;

         panelDragState = null;
         ui.panel.classList.remove("dragging");

         if (moved) {
           // Commit: clear transform, apply final left/top once
           ui.panel.style.transform = "";
           applyPanelPosition(
             clampPanelPosition(startX + dx, startY + dy)
           );
         }
       });

       ui.header.addEventListener("pointercancel", () => {
         if (dragRafId) {
           cancelAnimationFrame(dragRafId);
           dragRafId = null;
         }
         panelDragState = null;
         ui.panel.classList.remove("dragging");
         ui.panel.style.transform = "";
       });
     }

     // ============================================================
     //  CLOSE BUTTON
     //  Closes the panel via the popover animation and marks
     //  this video as "manually closed" in sessionStorage so
     //  it doesn't re-open automatically on refresh.
     // ============================================================
     ui.close.addEventListener("click", () => {
       closePanelToButton();
       const currentId = Y.youtube.getVideoId();
       if (currentId) {
         try {
           sessionStorage.setItem(`ytlyrics_closed_${currentId}`, "true");
         } catch (e) {}
       }
     });

     // ============================================================
     //  RELOAD BUTTON
     //  Forces a full refresh (bypasses lyrics cache).
     // ============================================================
     ui.reload.addEventListener("click", () => Y.controller.refresh({ force: true }));

     // ============================================================
     //  EDIT (SEARCH) DRAWER — TOGGLE
     //  Opens the manual search form. Only one drawer can be open
     //  at a time, so opening it closes the settings drawer.
     // ============================================================
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

     // ============================================================
     //  SETTINGS DRAWER — TOGGLE
     // ============================================================
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

     // ============================================================
     //  SEARCH BUTTON — run manual search
     // ============================================================
     ui.search.addEventListener("click", () => Y.controller.manualSearch());

     // ============================================================
     //  STATUS DISMISS
     //  Allows the user to manually hide the info banner.
     // ============================================================
     if (ui.statusClose) {
       ui.statusClose.addEventListener("click", () => {
         hideStatus();
       });
     }

     // ============================================================
     //  SETTING: AUTO-SCROLL TOGGLE
     //  iOS-style switch — click toggles the aria-checked state.
     // ============================================================
     if (ui.settingAutoScroll) {
       ui.settingAutoScroll.addEventListener("click", async () => {
         const newVal = ui.settingAutoScroll.getAttribute("aria-checked") !== "true";
         ui.settingAutoScroll.setAttribute("aria-checked", String(newVal));
         Y.state.settings.autoScroll = newVal;
         await saveSettings();
       });
     }

     // ============================================================
     //  SETTING: THEME DROPDOWN
     // ============================================================
     ui.settingTheme.addEventListener("change", async () => {
       Y.state.settings.theme = ui.settingTheme.value;
       await saveSettings();
       applyTheme();
     });

     // ============================================================
     //  SETTING: FONT SIZE
     // ============================================================
     ui.fontMinus.addEventListener("click", () => changeFontSize(-1));
     ui.fontPlus.addEventListener("click", () => changeFontSize(1));

     // ============================================================
     //  SETTING: RESET ALL
     // ============================================================
     if (ui.settingsReset) {
       ui.settingsReset.addEventListener("click", async () => {
         resetAllSettings();
       });
     }

     // ============================================================
     //  MODE SWITCHER (header)
     //  Karaoke ↔ Full Lyrics
     // ============================================================
     ui.headerModeKaraoke.addEventListener("click", () => setMode("karaoke"));
     ui.headerModeText.addEventListener("click", () => setMode("text"));

     // ============================================================
     //  TIMING OFFSET PILL
     //  Tap = ±0.5s, hold = ±5s repeat. Value click resets.
     // ============================================================
     attachOffsetHold(ui.offsetMinus, -1);
     attachOffsetHold(ui.offsetPlus, 1);
     ui.offsetValue.addEventListener("click", () => Y.sync.resetOffset());

     // ============================================================
     //  COPY + PRINT BUTTONS
     // ============================================================
     if (ui.copyBtn) {
       ui.copyBtn.addEventListener("click", () => copyLyricsToClipboard());
     }

     if (ui.printBtn) {
       ui.printBtn.addEventListener("click", () => exportLyricsAsHTML());
     }

     // ============================================================
     //  SEARCH INPUTS — Enter to search
     // ============================================================
     [ui.artistInput, ui.titleInput].forEach((input) => {
       input.addEventListener("keydown", (event) => {
         if (event.key === "Enter") {
           Y.controller.manualSearch();
         }
       });
     });

     // ============================================================
     //  STOP KEYBOARD EVENTS FROM LEAKING TO YOUTUBE
     //  YouTube has global keyboard shortcuts (space = play/pause,
     //  k, j, l, etc.). We stop propagation from our shadow host
     //  (except for meta-key shortcuts like ⌘⇧L).
     // ============================================================
     ["keydown", "keyup", "keypress"].forEach((type) => {
       host.addEventListener(type, (event) => {
         if (event.metaKey) return;
         event.stopPropagation();
       });
     });

     // ============================================================
     //  INITIAL APPLY
     //  Apply stored settings and positions once the UI is built.
     // ============================================================
     applySettings();
     loadButtonPosition();

     // ============================================================
     //  RESIZE — keep the button inside the viewport
     // ============================================================
     window.addEventListener("resize", () => {
       applyButtonPosition(clampPosition(buttonPos.x, buttonPos.y));
     });

     return ui;
   }

    // ============================================================
    //  OFFSET PILL — TAP + HOLD HANDLER
    //  Tap (±button): change offset by 0.5s
    //  Hold (>400ms): after a short pause, repeat +5s every 130ms
    //
    //  The visual fill animation is driven by CSS classes
    //  (pressing, holding) — see template.js.
    // ============================================================
    function attachOffsetHold(button, direction) {
      const HOLD_DELAY = 400;      // ms before "hold mode" kicks in
      const REPEAT_INTERVAL = 130; // ms between repeat steps

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

        // Immediate fine step — gives instant feedback on tap.
        fireFine();

        // After HOLD_DELAY ms, switch to coarse repeat mode.
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

      // Keyboard support: Enter / Space → fine step
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fireFine();
        }
      });
    }

    // ============================================================
    //  TOAST
    //  Shows a small pill near the bottom of the panel with a
    //  status message ("Lyrics copied", "Settings reset", ...).
    //  Auto-hides after 1.5 s. Calling it again while visible
    //  resets the timer.
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
    //  COPY LYRICS TO CLIPBOARD
    //  Builds the final text (title — artist + blank line + lyrics)
    //  and copies it. Uses the modern Clipboard API first, and
    //  falls back to a hidden textarea + execCommand for older
    //  browsers or non-secure contexts.
    // ============================================================
    async function copyLyricsToClipboard() {
      const lyrics = Y.state.lastLyrics;
      if (!lyrics) return;

      // --- 1. Get the raw lyrics text (prefer synced over plain) ---
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

      // --- 2. Prepend a title/artist header ---
      const song = Y.state.currentSong || {};
      const title = song.title || "";
      const artist = song.artist && song.artist !== "Unknown" ? song.artist : "";

      const header = [title, artist].filter(Boolean).join(" — ");
      const fullText = header ? `${header}\n\n${bodyText}` : bodyText;

      // --- 3. Try the modern Clipboard API first ---
      let ok = false;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText);
          ok = true;
        }
      } catch {
        ok = false;
      }

      // --- 4. Fallback: hidden textarea + execCommand ---
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

      showToast(ok ? "Lyrics copied" : "Copy failed");
    }

    // ============================================================
    //  OPEN PANEL FROM BUTTON (popover in)
    //  Opens the panel to the LEFT of the button with an 8px gap.
    //  The panel grows out of the button using a scale animation
    //  with a dynamic transform-origin (see template.js keyframes).
    // ============================================================
    function openPanelFromButton() {
      const ui = Y.state.ui;
      if (!ui || panelAnimating) return;

      panelAnimating = true;

      // 1. Reveal panel invisibly to measure its size
      ui.panel.hidden = false;
      ui.panel.style.visibility = "hidden";
      ui.panel.classList.remove("popover-opening", "popover-closing");

      const w = ui.panel.offsetWidth;
      const h = ui.panel.offsetHeight;

      // 2. Compute target position: 8px to the LEFT of button
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = buttonPos.x - w - 8;
      let top = buttonPos.y;

      // Clamp to viewport
      if (left < margin) left = margin;
      if (left + w > vw - margin) left = vw - w - margin;
      if (top + h > vh - margin) top = vh - h - margin;
      if (top < margin) top = margin;

      // 3. Apply position
      ui.panel.style.left = `${left}px`;
      ui.panel.style.top = `${top}px`;
      ui.panel.style.right = "auto";
      ui.panel.style.bottom = "auto";

      // 4. Set transform-origin to the button's top-left corner
      //    (relative to the panel) so the scale animation starts
      //    from the button itself.
      const originX = buttonPos.x - left;
      const originY = buttonPos.y - top;
      ui.panel.style.transformOrigin = `${originX}px ${originY}px`;

      // 5. Hide the button, show the panel
      ui.toggle.classList.add("is-hidden");

      // 6. Play the opening animation
      ui.panel.style.visibility = "";
      ui.panel.classList.add("popover-opening");

      panelPos = { x: left, y: top };

      setTimeout(() => {
        ui.panel.classList.remove("popover-opening");
        panelAnimating = false;
      }, POPOVER_DURATION + 20);
    }

    // ============================================================
    //  CLOSE PANEL TO BUTTON (popover out)
    //  Panel shrinks back to its top-right corner + 8px.
    //  The button reappears at that exact point → no visible
    //  jump or drift, regardless of how the user moved the panel.
    // ============================================================
    function closePanelToButton() {
      const ui = Y.state.ui;
      if (!ui || panelAnimating) return;
      if (ui.panel.hidden) return;

      panelAnimating = true;

      // Shrink point: 8px to the right of the panel's top-right corner
      // (matches where the button will land)
      ui.panel.style.transformOrigin = "calc(100% + 8px) 0";

      // Play reverse animation
      ui.panel.classList.add("popover-closing");

      // Compute button landing point from panel's current position
      const rect = ui.panel.getBoundingClientRect();
      const newButtonX = rect.right + 8;
      const newButtonY = rect.top;
      buttonPos = clampPosition(newButtonX, newButtonY);

      setTimeout(() => {
        ui.panel.hidden = true;
        ui.panel.classList.remove("popover-closing");

        ui.toggle.classList.remove("is-hidden");
        applyButtonPosition(buttonPos);
        saveButtonPosition();

        panelPos = null;
        panelAnimating = false;

        // Close any open drawers
        if (ui.editor) ui.editor.hidden = true;
        if (ui.settings) ui.settings.hidden = true;
        if (ui.edit) ui.edit.classList.remove("active");
        if (ui.settingsBtn) ui.settingsBtn.classList.remove("active");
      }, POPOVER_DURATION + 20);
    }

    // ============================================================
    //  TOGGLE PANEL
    //  Opens or closes depending on current state.
    //  Ignores calls while an animation is running.
    // ============================================================
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
    //  BUTTON POSITION
    //  Clamp + apply the mic button position. Persisted via
    //  saveButtonPosition / loadButtonPosition.
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
    //  PANEL POSITION
    //  Clamp + apply the panel position.
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

    // ============================================================
    //  LOAD BUTTON POSITION
    //  Restores the last position from storage, or picks a
    //  sensible initial spot (right of the video) on first run.
    // ============================================================
    async function loadButtonPosition() {
      const stored = await Y.bridge.getFromCache("ytlyrics_buttonpos");

      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
        applyButtonPosition(clampPosition(stored.x, stored.y));
        return;
      }

      const smartPos = computeInitialButtonPosition();
      applyButtonPosition(clampPosition(smartPos.x, smartPos.y));
    }

    // ============================================================
    //  COMPUTE INITIAL BUTTON POSITION
    //  First-run placement: just right of the video player,
    //  slightly below its top edge. Falls back to a fixed spot
    //  if no <video> is found yet.
    // ============================================================
    function computeInitialButtonPosition() {
      const vw = window.innerWidth;
      const buttonSize = 44;
      const margin = 16;

      const video = document.querySelector("video");

      if (video) {
        const rect = video.getBoundingClientRect();

        let x = rect.right + margin;
        let y = rect.top + 24;

        // If the button would overflow the right edge, pull it in.
        if (x + buttonSize > vw - 16) {
          x = vw - buttonSize - 24;
        }

        // Keep below YouTube's header bar.
        if (y < 84) y = 84;

        return { x, y };
      }

      return { x: vw - buttonSize - 120, y: 120 };
    }

    function saveButtonPosition() {
      Y.bridge.saveToCache("ytlyrics_buttonpos", buttonPos);
    }

    // ============================================================
    //  STATUS & LOADING
    // ============================================================

    // Show the status banner. `isError` switches to the red style.
    // The optional close button is wired up in ensureUI.
    function setStatus(text, isError = false) {
      if (!Y.state.ui) return;
      Y.state.ui.status.hidden = false;
      if (Y.state.ui.statusText) {
        Y.state.ui.statusText.textContent = text;
      } else {
        // Fallback (in case the template hasn't got a #status-text)
        Y.state.ui.status.textContent = text;
      }
      Y.state.ui.status.classList.toggle("error", isError);
    }

    function hideStatus() {
      if (!Y.state.ui) return;
      Y.state.ui.status.hidden = true;
    }

    // Renders a shimmer skeleton while lyrics are being fetched.
    function setLoading() {
      if (!Y.state.ui) return;

      Y.state.ui.lyrics.textContent = "";

      const skeleton = document.createElement("div");
      skeleton.className = "skeleton";
      skeleton.setAttribute("aria-hidden", "true");

      // Different widths for a natural "text" look
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
    //  SETTINGS — LOAD / SAVE / APPLY
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

    // Pushes the current settings values into the UI controls.
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

    // Highlights the correct button in the mode switcher.
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

    // Change mode + persist + re-render lyrics with the new mode.
    async function setMode(mode) {
      if (Y.state.settings.mode === mode) return;
      Y.state.settings.mode = mode;
      applyMode();
      await saveSettings();
      if (Y.state.lastLyrics) renderLyrics(Y.state.lastLyrics);
    }

    // Apply font size to the panel via a CSS variable.
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

    // Toggle the theme-light class on the panel based on settings
    // and (for "auto") YouTube's own dark-mode attribute.
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

    // Reset all settings to defaults + re-render.
    async function resetAllSettings() {
      Y.state.settings.autoScroll = true;
      Y.state.settings.theme = "auto";
      Y.state.settings.fontSize = 17;
      Y.state.settings.mode = "karaoke";
      delete Y.state.settings.autoOpen; // legacy key
      await saveSettings();
      applySettings();
      if (Y.state.lastLyrics) renderLyrics(Y.state.lastLyrics);
      showToast("Settings reset");
    }

    // ============================================================
    //  EXTERNAL LINKS
    //  Ultimate Guitar (tabs), Apple Music, Spotify.
    //  Each link is hidden until the song metadata is known.
    // ============================================================

    // Ultimate Guitar search by artist + title
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

    // Apple Music — start with a search URL, then try to upgrade
    // it to a direct song URL via the iTunes Search API.
    function updateAppleMusicLink() {
      if (!Y.state.ui || !Y.state.currentSong) return;
      const { artist, title } = Y.state.currentSong;
      if (!artist || artist === "Unknown" || !title || title === "Unknown") {
        Y.state.ui.amLink.hidden = true;
      } else {
        const query = encodeURIComponent(`${artist} ${title}`);
        const locale = (navigator.language || "en-US").split("-")[1] || "US";
        const country = locale.toLowerCase();
        Y.state.ui.amLink.href = `https://music.apple.com/${country}/search?term=${query}`;
        Y.state.ui.amLink.hidden = false;

        // Async: try to replace the search URL with a direct song URL.
        resolveAppleMusicDirectLink(artist, title, country);
      }
      updateSpotifyLink();
      updateExtSection();
    }

    // Looks up a direct Apple Music song URL (album/track) via the
    // iTunes Search API, so the button opens the exact song.
    async function resolveAppleMusicDirectLink(artist, title, country) {
      try {
        const query = encodeURIComponent(`${artist} ${title}`);
        const url = `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=1&country=${country}`;
        const data = await Y.bridge.fetchJson(url);

        const result = data?.results?.[0];
        const trackViewUrl = result?.trackViewUrl;

        if (trackViewUrl && Y.state.ui && Y.state.ui.amLink) {
          Y.state.ui.amLink.href = trackViewUrl;
        }
      } catch {
        // Silent: keep the search fallback.
      }
    }

    // Spotify search by artist + title.
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

    // Show/hide the group containers + separators based on which
    // individual items are currently visible.
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

    // ============================================================
    //  ARTWORK
    //  Loads the album cover via iTunes Search (see api.js).
    //  Cached in memory + in chrome.storage.local.
    // ============================================================
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

      // Abort if a newer refresh superseded this one.
      if (sequence !== undefined && sequence !== Y.state.refreshSeq) return;

      if (url) {
        Y.state.ui.trackArt.src = url;
        Y.state.ui.trackArt.hidden = false;
      } else {
        Y.state.ui.trackArt.hidden = true;
      }
    }

    // ============================================================
    //  OFFSET DISPLAY
    //  Updates the timing pill's value and the "has-offset" state.
    // ============================================================
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
    //  LYRICS RENDERING
    // ============================================================

    // Renders a "no lyrics found" empty state.
    function renderEmptyState(message) {
      if (!Y.state.ui) return;

      if (Y.state.ui.offsetRow) {
        Y.state.ui.offsetRow.hidden = true;
      }
      if (Y.state.ui.groupTiming) {
        Y.state.ui.groupTiming.hidden = false;
      }
      if (Y.state.ui.sep0) {
        Y.state.ui.sep0.hidden = false;
      }

      Y.state.ui.lyrics.textContent = "";
      Y.state.ui.lyrics.scrollTop = 0;

      // Clear sync state so we don't keep ticking on stale data.
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

    // Main lyrics renderer. Chooses between synced (karaoke) and
    // plain (full lyrics) depending on the current mode and the
    // availability of synced data.
    function renderLyrics(lyrics) {
      if (!Y.state.ui) return;

      // Reset UI + sync state before rebuilding
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

      // --- Synced / karaoke path ---
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

            // Click a line to seek to its timestamp.
            div.addEventListener("click", () => {
              Y.sync.seekTo(line.time);
            });

            container.appendChild(div);
            sync.elements.push(div);
          });

          Y.state.ui.lyrics.appendChild(container);

          // Show the timing controls.
          if (Y.state.ui.offsetRow) Y.state.ui.offsetRow.hidden = false;
          if (Y.state.ui.groupTiming) Y.state.ui.groupTiming.hidden = false;
          if (Y.state.ui.sep0) Y.state.ui.sep0.hidden = false;

          // Attach listeners after layout so offsets are correct.
          requestAnimationFrame(() => {
            Y.sync.attachVideoListeners();
            Y.sync.updateActiveLine();
          });

          updateExtSection();
          return;
        }
      }

      // --- Plain text fallback ---
      let text = lyrics.plainLyrics?.trim();

      if (!text && lyrics.syncedLyrics) {
        // Strip timestamps from synced lyrics and use as plain text.
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

      // In plain mode, keep the actions bar visible (copy/print/links)
      // but hide the timing pill (it wouldn't do anything).
      if (Y.state.ui.offsetRow) Y.state.ui.offsetRow.hidden = false;
      if (Y.state.ui.groupTiming) Y.state.ui.groupTiming.hidden = true;
      if (Y.state.ui.sep0) Y.state.ui.sep0.hidden = true;

      updateExtSection();
    }

    // ============================================================
    //  PRINT / EXPORT
    //  Builds a standalone HTML document with the lyrics, opens it
    //  in a new tab. The user can then use the browser's print
    //  dialog (⌘P) to get a clean printout.
    // ============================================================
    function exportLyricsAsHTML() {
      const lyrics = Y.state.lastLyrics;
      if (!lyrics) return;

      const song = Y.state.currentSong || {};
      const title = song.title || "Lyrics";
      const artist = song.artist || "";
      const artwork = Y.state.ui?.trackArt?.src || "";

      // Get the plain text version (synced first, then plain).
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

      // Escape values for safe HTML interpolation.
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
    .page { max-width: 720px; margin: 0 auto; padding: 48px 32px 64px; }
    header {
      display: flex; align-items: flex-start; gap: 20px;
      margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #111;
    }
    .art { width: 96px; height: 96px; border-radius: 8px; object-fit: cover; flex: 0 0 auto; border: 1px solid #ddd; }
    h1 { margin: 0 0 6px; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; }
    .artist { margin: 0; font-size: 15px; color: #555; font-weight: 500; }
    .lyrics { font-size: 15px; line-height: 1.9; white-space: pre-wrap; word-wrap: break-word; color: #111; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11.5px; color: #777; text-align: center; }
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

      // Preferred: open in a new tab.
      const win = window.open(url, "_blank");

      // Fallback: download as HTML if the popup was blocked.
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title} - ${artist}.html`;
        a.click();
      }

      // Free the blob URL after 60 s (enough time for the tab to load).
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // Escape HTML special characters before injecting into the export template.
    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // ============================================================
    //  EXPORTS
    //  Public API used by other modules (content.js, popup.js, ...)
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
