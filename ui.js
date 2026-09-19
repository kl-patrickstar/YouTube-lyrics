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
       artistInput: root.getElementById("artist-input"),
       titleInput: root.getElementById("title-input"),
       search: root.getElementById("search"),
       status: root.getElementById("status"),
       lyrics: root.getElementById("lyrics"),
       autoScroll: root.getElementById("autoscroll"),
       settingsBtn: root.getElementById("settings-btn"),
       settings: root.getElementById("settings"),
       settingAutoOpen: root.getElementById("setting-autoopen"),
       settingTheme: root.getElementById("setting-theme"),
       fontMinus: root.getElementById("font-minus"),
       fontPlus: root.getElementById("font-plus"),
       fontValue: root.getElementById("font-value"),
       modeKaraoke: root.getElementById("mode-karaoke"),
       modeText: root.getElementById("mode-text"),
       headerModeKaraoke: root.getElementById("header-mode-karaoke"),
       headerModeText: root.getElementById("header-mode-text"),
       offsetRow: root.getElementById("offset-row"),
       offsetMinusFine: root.getElementById("offset-minus-fine"),
       offsetMinusCoarse: root.getElementById("offset-minus-coarse"),
       offsetPlusFine: root.getElementById("offset-plus-fine"),
       offsetPlusCoarse: root.getElementById("offset-plus-coarse"),
       offsetReset: root.getElementById("offset-reset"),
       offsetValue: root.getElementById("offset-value"),
       ugLink: root.getElementById("ug-link"),
       amLink: root.getElementById("am-link"),
       copyBtn: root.getElementById("copy-btn"),
       printBtn: root.getElementById("print-btn"),
       extSection: root.getElementById("ext-section"),
       trackArt: root.getElementById("track-art"),
       toast: root.getElementById("toast"),
       toastText: root.getElementById("toast-text"),
     };

     Y.state.ui = ui;

     // ---------- Event Wiring ----------
     ui.toggle.addEventListener("click", () => {
       if (suppressNextClick) {
         suppressNextClick = false;
         return;
       }
       togglePanel();
     });

     // ---------- Button-Drag ----------
     ui.toggle.addEventListener("pointerdown", (event) => {
       if (event.pointerType === "mouse" && event.button !== 0) return;
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

     // ---------- Panel-Drag (am Header) ----------
     if (ui.header) {
       ui.header.addEventListener("pointerdown", (event) => {
         const target = event.composedPath?.()[0] || event.target;
         if (target && target.closest && target.closest("button, a, input, select")) {
           return;
         }
         if (event.pointerType === "mouse" && event.button !== 0) return;

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
         const moved = panelDragState.moved;
         panelDragState = null;
         ui.panel.classList.remove("dragging");

         if (moved) {
           savePanelPosition();
         }
       });

       ui.header.addEventListener("pointercancel", () => {
         panelDragState = null;
         ui.panel.classList.remove("dragging");
       });
     }

     ui.close.addEventListener("click", () => {
       setPanelVisibility(false);
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

     ui.settingsBtn.addEventListener("click", () => {
       const willOpen = ui.settings.hidden;
       ui.settings.hidden = !willOpen;
       ui.editor.hidden = true;
       ui.settingsBtn.classList.toggle("active", willOpen);
       ui.edit.classList.remove("active");
     });

     ui.search.addEventListener("click", () => Y.controller.manualSearch());

     ui.settingAutoOpen.addEventListener("change", async () => {
       Y.state.settings.autoOpen = ui.settingAutoOpen.checked;
       await saveSettings();
     });

     ui.settingTheme.addEventListener("change", async () => {
       Y.state.settings.theme = ui.settingTheme.value;
       await saveSettings();
       applyTheme();
     });

     ui.fontMinus.addEventListener("click", () => changeFontSize(-1));
     ui.fontPlus.addEventListener("click", () => changeFontSize(1));

     // Karaoke/Text-Modus — Settings + Header
     ui.modeKaraoke.addEventListener("click", () => setMode("karaoke"));
     ui.modeText.addEventListener("click", () => setMode("text"));
     ui.headerModeKaraoke.addEventListener("click", () => setMode("karaoke"));
     ui.headerModeText.addEventListener("click", () => setMode("text"));

     ui.autoScroll.addEventListener("change", async () => {
       Y.state.settings.autoScroll = ui.autoScroll.checked;
       await saveSettings();
     });

     ui.offsetMinusFine.addEventListener("click", () => Y.sync.changeOffset(-0.5));
     ui.offsetMinusCoarse.addEventListener("click", () => Y.sync.changeOffset(-5));
     ui.offsetPlusFine.addEventListener("click", () => Y.sync.changeOffset(0.5));
     ui.offsetPlusCoarse.addEventListener("click", () => Y.sync.changeOffset(5));
     ui.offsetReset.addEventListener("click", () => Y.sync.resetOffset());

     // Copy-Button
     if (ui.copyBtn) {
       ui.copyBtn.addEventListener("click", () => copyLyricsToClipboard());
     }

     // Druck-Button
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
     loadPanelPosition();

     window.addEventListener("resize", () => {
       applyButtonPosition(clampPosition(buttonPos.x, buttonPos.y));
       if (panelPos) {
         applyPanelPosition(clampPanelPosition(panelPos.x, panelPos.y));
       }
     });

     return ui;
   }

   // ---------- Panel-Visibility ----------
   function setPanelVisibility(open) {
     if (!Y.state.ui) return;
     Y.state.ui.panel.hidden = !open;
     Y.state.ui.toggle.classList.toggle("is-hidden", open);

     if (open) {
       resetPanelPositionIfOffscreen();

       if (panelPos) {
         applyPanelPosition(clampPanelPosition(panelPos.x, panelPos.y));
       } else {
         positionPanel();
       }
     }
   }

   function togglePanel() {
     if (!Y.state.ui) return;
     const open = Y.state.ui.panel.hidden;
     setPanelVisibility(open);
     if (open) {
       Y.controller.refresh({ force: false });
     }
   }

   // ---------- Button-Position ----------
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

     if (!panelPos) {
       positionPanel();
     }
   }

   // ---------- Panel-Position ----------
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

     ui.panel.classList.remove("open-left", "open-above");
     ui.panel.style.left = `${pos.x}px`;
     ui.panel.style.top = `${pos.y}px`;
     ui.panel.style.right = "auto";
     ui.panel.style.bottom = "auto";
   }

   function positionPanel() {
     const ui = Y.state.ui;
     if (!ui || ui.panel.hidden) return;
     if (panelPos) return;

     ui.panel.style.left = "";
     ui.panel.style.top = "";
     ui.panel.style.right = "";
     ui.panel.style.bottom = "";

     const margin = 8;
     const w = ui.panel.offsetWidth;
     const h = ui.panel.offsetHeight;
     const vw = window.innerWidth;
     const vh = window.innerHeight;

     const openLeftward = buttonPos.x - w >= margin || buttonPos.x > vw / 2;
     ui.panel.classList.toggle("open-left", !openLeftward);

     const openAbove = buttonPos.y + h > vh - margin && buttonPos.y > vh / 2;
     ui.panel.classList.toggle("open-above", openAbove);
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

   async function loadPanelPosition() {
     const stored = await Y.bridge.getFromCache("ytlyrics_panelpos");
     if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
       panelPos = { x: stored.x, y: stored.y };
     }
   }

   function resetPanelPositionIfOffscreen() {
     if (!panelPos || !Y.state.ui) return;
     const { x, y } = panelPos;
     const w = Y.state.ui.panel.offsetWidth || 420;
     const h = Y.state.ui.panel.offsetHeight || 400;
     const vw = window.innerWidth;
     const vh = window.innerHeight;

     const isOffscreen =
       x + w < 50 ||
       y + h < 50 ||
       x > vw - 50 ||
       y > vh - 50;

     if (isOffscreen) {
       panelPos = null;
       Y.bridge.saveToCache("ytlyrics_panelpos", null);
     }
   }

   function savePanelPosition() {
     if (panelPos) {
       Y.bridge.saveToCache("ytlyrics_panelpos", panelPos);
     }
   }

   // ---------- Status & Loading ----------
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
     setStatus("Suche Songtext…");
   }

   // ---------- Toast ----------
   function showToast(text = "Lyrics kopiert") {
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

   // ---------- Settings ----------
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
       Y.state.ui.settingAutoOpen.checked = !!Y.state.settings.autoOpen;
       Y.state.ui.settingTheme.value = Y.state.settings.theme || "auto";
       Y.state.ui.autoScroll.checked = !!Y.state.settings.autoScroll;
     }
     applyFontSize();
     applyTheme();
     applyMode();
   }

   function applyMode() {
     if (!Y.state.ui) return;
     const karaoke = Y.state.settings.mode !== "text";

     // Settings-Drawer
     Y.state.ui.modeKaraoke.classList.toggle("active", karaoke);
     Y.state.ui.modeText.classList.toggle("active", !karaoke);
     Y.state.ui.modeKaraoke.setAttribute("aria-checked", String(karaoke));
     Y.state.ui.modeText.setAttribute("aria-checked", String(!karaoke));

     // Header-Zeile
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

   // ---------- External Links ----------
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
       Y.state.ui.amLink.href = `https://music.apple.com/de/search?term=${query}`;
       Y.state.ui.amLink.hidden = false;
     }
     updateExtSection();
   }

   function updateExtSection() {
     if (!Y.state.ui) return;

     const hasLyrics = !!Y.state.lastLyrics;

     // Copy-Button nur zeigen, wenn Lyrics geladen
     if (Y.state.ui.copyBtn) {
       Y.state.ui.copyBtn.hidden = !hasLyrics;
     }

     // Print-Button nur zeigen, wenn Lyrics geladen
     if (Y.state.ui.printBtn) {
       Y.state.ui.printBtn.hidden = !hasLyrics;
     }

     // Footer-Section sichtbar, wenn mind. ein Button sichtbar
     const ugVisible = !Y.state.ui.ugLink.hidden;
     const amVisible = !Y.state.ui.amLink.hidden;
     const copyVisible = !!Y.state.ui.copyBtn && !Y.state.ui.copyBtn.hidden;
     const printVisible = !!Y.state.ui.printBtn && !Y.state.ui.printBtn.hidden;

     Y.state.ui.extSection.hidden = !ugVisible && !amVisible && !copyVisible && !printVisible;
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

   // ---------- Offset Display ----------
   function updateOffsetDisplay() {
     if (!Y.state.ui) return;
     Y.state.ui.offsetValue.textContent = Y.sync.formatOffset(Y.state.lyricOffset);
     Y.state.ui.offsetValue.classList.toggle("nonzero", Y.state.lyricOffset !== 0);
   }

   // ---------- Lyrics Rendering ----------
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
     title.textContent = "Kein Songtext gefunden";

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
         "Dieses Video scheint instrumental zu sein – oder der Text ist bei unseren Quellen nicht verfügbar."
       );
       return;
     }

     const pre = document.createElement("pre");
     pre.textContent = text;
     Y.state.ui.lyrics.appendChild(pre);

     updateExtSection();
   }

   // ---------- Copy ----------
   async function copyLyricsToClipboard() {
     const lyrics = Y.state.lastLyrics;
     if (!lyrics) return;

     // Bevorzugt synced, sonst plain
     let text = "";

     if (lyrics.syncedLyrics) {
       text = Y.lyrics
         .parseLRC(lyrics.syncedLyrics)
         .map((line) => line.text)
         .join("\n");
     }

     if (!text && lyrics.plainLyrics) {
       text = lyrics.plainLyrics;
     }

     text = (text || "").trim();

     if (!text) {
       showToast("Kein Text zum Kopieren");
       return;
     }

     try {
       // Moderner Weg (funktioniert in Safari bei Klick)
       if (navigator.clipboard && navigator.clipboard.writeText) {
         await navigator.clipboard.writeText(text);
         showToast("Lyrics kopiert");
         return;
       }

       // Fallback: verstecktes Textarea + execCommand
       const ta = document.createElement("textarea");
       ta.value = text;
       ta.style.position = "fixed";
       ta.style.opacity = "0";
       ta.style.pointerEvents = "none";
       document.body.appendChild(ta);
       ta.select();
       ta.setSelectionRange(0, text.length);

       const ok = document.execCommand("copy");
       document.body.removeChild(ta);

       if (ok) {
         showToast("Lyrics kopiert");
       } else {
         showToast("Kopieren fehlgeschlagen");
       }
     } catch (error) {
       console.warn("Clipboard-Fehler:", error);
       showToast("Kopieren fehlgeschlagen");
     }
   }

   // ---------- Print / Export ----------
   function exportLyricsAsHTML() {
     const lyrics = Y.state.lastLyrics;
     if (!lyrics) return;

     const song = Y.state.currentSong || {};
     const title = song.title || "Songtext";
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
 <html lang="de">
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
       Gedruckt mit YouTube Lyrics · Quelle: LRCLIB · lyrics.ovh
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

   // ---------- Exports ----------
   Y.ui = {
     ensureUI,
     setPanelVisibility,
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
     updateArtwork,
     updateOffsetDisplay,
     updateExtSection,
     renderLyrics,
     renderEmptyState,
     loadButtonPosition,
     saveButtonPosition,
     applyButtonPosition,
     clampPosition,
     positionPanel,
     applyPanelPosition,
     clampPanelPosition,
     loadPanelPosition,
     savePanelPosition,
     resetPanelPositionIfOffscreen,
     copyLyricsToClipboard,
     exportLyricsAsHTML,
     showToast,
   };
 })();
