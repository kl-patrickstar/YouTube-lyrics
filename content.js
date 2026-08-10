(() => {
  if (window.__ytLyricsLoaded) return;
  window.__ytLyricsLoaded = true;

  let ui = null;
  let currentVideoId = null;
  let currentSong = null;
  let refreshSeq = 0;
  let lyricOffset = 0;
  let lastLyrics = null;

  let settings = {
    autoOpen: true,
    autoScroll: true,
    theme: "auto",
    fontSize: 17,
    mode: "karaoke",
  };

  const sync = {
    lines: [],
    elements: [],
    activeIndex: -1,
    video: null,
    onTimeUpdate: null,
    rafId: null,
  };

  const css = `
  :host {
    all: initial;

    font-family:
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "SF Pro Text",
      "Segoe UI",
      sans-serif;

    /* ---------- Design Tokens (Dark) ---------- */
    --bg-primary: rgba(15, 18, 23, 0.88);
    --bg-secondary: rgba(255, 255, 255, 0.04);
    --bg-surface: rgba(255, 255, 255, 0.07);
    --bg-hover: rgba(255, 255, 255, 0.10);
    --bg-active: rgba(255, 255, 255, 0.14);

    --text-primary: rgba(255, 255, 255, 0.96);
    --text-secondary: rgba(255, 255, 255, 0.66);
    --text-muted: rgba(255, 255, 255, 0.42);

    --border-subtle: rgba(255, 255, 255, 0.07);
    --border-strong: rgba(255, 255, 255, 0.12);

    --accent: #6ea8ff;
    --accent-soft: rgba(110, 168, 255, 0.16);
    --danger: #ff6b6b;
    --danger-soft: rgba(255, 107, 107, 0.14);

    --shadow-panel:
      0 24px 64px rgba(0, 0, 0, 0.5),
      0 4px 16px rgba(0, 0, 0, 0.3);

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;

    --transition-fast: 140ms cubic-bezier(0.2, 0.8, 0.4, 1);
    --transition-normal: 220ms cubic-bezier(0.2, 0.8, 0.4, 1);
  }

  * {
    box-sizing: border-box;
  }

  [hidden] {
    display: none !important;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button {
    color: inherit;
  }

  #toggle:focus-visible,
  #panel button:focus-visible,
  #panel a:focus-visible,
  #panel input:focus-visible,
  #panel select:focus-visible,
  .autoscroll input:focus-visible + .switch {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ---------- Toggle ---------- */

  #toggle {
    position: absolute;
    top: 0;
    right: 0;
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    border: 1px solid var(--border-strong);
    background: var(--bg-primary);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    backdrop-filter: blur(16px) saturate(150%);
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    transition:
      transform var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  #toggle:hover {
    transform: translateY(-1px);
    border-color: var(--accent);
  }

  #toggle:active {
    transform: scale(0.96);
  }

  /* ---------- Panel (fester App-Frame) ---------- */

  #panel {
    position: absolute;
    top: 54px;
    right: 0;
    width: min(420px, calc(100vw - 24px));
    max-height: min(78vh, 760px);
    display: flex;
    flex-direction: column;

    background: var(--bg-primary);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    backdrop-filter: blur(24px) saturate(150%);

    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 14px 14px 10px;
    color: var(--text-primary);
    box-shadow: var(--shadow-panel);
  }

  /* ---------- Header ---------- */

  .panel-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 2px 2px 12px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .track-art {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    flex: 0 0 auto;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
  }

  h2 {
    margin: 0;
    font-size: 16px;
    line-height: 1.3;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    overflow-wrap: break-word;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    margin: 3px 0 0;
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--text-secondary);
    overflow-wrap: break-word;

    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .header-text {
    flex: 0 1 auto;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    gap: 2px;
    flex: 0 0 auto;
  }

  .header-actions.right {
    margin-left: auto;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast);
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .icon-btn:active {
    transform: scale(0.92);
  }

  .icon-btn.active {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  a.icon-btn {
    text-decoration: none;
  }

  .ug-logo {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  /* ---------- Drawer (Suche / Settings) ---------- */

  .drawer {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 12px;
    margin: 0 2px 10px;
  }

  .drawer-title {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
    user-select: none;
  }

  #editor .drawer-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .field {
    display: grid;
    gap: 5px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-muted);
    user-select: none;
  }

  #editor input {
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: 13px;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  #editor input::placeholder {
    color: var(--text-muted);
  }

  #editor input:focus {
    outline: none;
    border-color: var(--accent);
  }

  #editor button {
    appearance: none;
    border: none;
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: var(--radius-sm);
    width: 100%;
    padding: 9px 12px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      transform var(--transition-fast);
  }

  #editor button:hover {
    background: var(--bg-hover);
  }

  #editor button:active {
    transform: scale(0.97);
  }

  #settings {
    display: grid;
    gap: 10px;
  }

  #settings .drawer-title {
    margin-bottom: 0;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 13px;
    user-select: none;
  }

  .setting-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: var(--accent);
  }

  #settings select {
    margin-left: auto;
    appearance: none;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 5px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  #settings select:hover {
    border-color: var(--border-strong);
  }

  #settings button {
    appearance: none;
    border: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  #settings button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .setting-row.actions {
    gap: 6px;
  }

  .setting-row.actions button {
    flex: 1;
  }

  #font-value {
    min-width: 38px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    font-size: 12px;
  }

  .segmented {
    margin-left: auto;
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
  }

  #settings .seg-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  #settings .seg-btn:hover {
    color: var(--text-primary);
  }

  #settings .seg-btn.active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  /* ---------- Status ---------- */

  #status {
    margin: 0 2px 10px;
    padding: 9px 12px;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 12.5px;
    line-height: 1.5;
  }

  #status.error {
    background: var(--danger-soft);
    border-color: transparent;
    color: var(--danger);
  }

  /* ---------- Lyrics (scrollbarer Fokus-Bereich) ---------- */

  #lyrics {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 6px 12px 2px;

    scrollbar-width: thin;
    scrollbar-color: var(--bg-active) transparent;
  }

  #lyrics::-webkit-scrollbar {
    width: 6px;
  }

  #lyrics::-webkit-scrollbar-track {
    background: transparent;
  }

  #lyrics::-webkit-scrollbar-thumb {
    background: var(--bg-active);
    border-radius: 999px;
  }

  #lyrics::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  #lyrics pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    font-size: var(--lyrics-font-size, 17px);
    line-height: 1.8;
    color: var(--text-secondary);
    -webkit-font-smoothing: antialiased;
  }

  .line {
    margin: 2px 0;
    padding: 9px 12px;
    border-radius: var(--radius-md);

    color: var(--text-secondary);
    opacity: 0.5;
    font-size: var(--lyrics-font-size, 17px);
    line-height: 1.6;

    cursor: pointer;

    transition:
      opacity var(--transition-normal),
      color var(--transition-normal),
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .line:hover {
    opacity: 0.85;
    color: var(--text-primary);
  }

  .line.past {
    opacity: 0.68;
  }

  .line.active {
    opacity: 1;
    color: var(--text-primary);
    font-weight: 600;
    background: var(--bg-surface);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  /* ---------- Control-Bar (unten) ---------- */

  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
  }

  .timing-group {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
  }

  .timing-group button {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 4px 7px;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .timing-group button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .timing-group button:active {
    transform: scale(0.95);
  }

  #offset-value {
    min-width: 46px;
    text-align: center;
    font-size: 11.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    padding: 4px 6px;
    border-radius: 8px;
    background: var(--bg-surface);
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  #offset-value.nonzero {
    background: var(--accent-soft);
    color: var(--accent);
  }

  #offset-reset {
    margin-left: 4px;
    padding-left: 8px;
    border-left: 1px solid var(--border-subtle);
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
  }

  /* ---------- Auto-Scroll Switch ---------- */

  .autoscroll {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
  }

  .autoscroll input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }

  .switch {
    width: 32px;
    height: 18px;
    border-radius: 999px;
    background: var(--bg-active);
    position: relative;
    flex: 0 0 auto;
    transition: background var(--transition-fast);
  }

  .switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--text-secondary);
    transition:
      transform var(--transition-fast),
      background var(--transition-fast);
  }

  .autoscroll input:checked + .switch {
    background: var(--accent);
  }

  .autoscroll input:checked + .switch::after {
    transform: translateX(14px);
    background: #fff;
  }

  /* ---------- Footer & Externe Links ---------- */

  .footer {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
    font-size: 10.5px;
    color: var(--text-muted);
    user-select: none;
  }

  .footer-section {
    display: grid;
    justify-items: center;
    gap: 6px;
  }

  .footer-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .footer-links {
    display: flex;
    gap: 6px;
  }

  .ext-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 26px;
    border-radius: 8px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .ext-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .ext-btn svg {
    width: 14px;
    height: 14px;
  }

  /* ---------- Empty State ---------- */

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 36px 16px;
    text-align: center;
  }

  .empty-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--bg-surface);
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-text {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    max-width: 260px;
  }

  /* ---------- Skeleton ---------- */

  .skeleton {
    display: grid;
    gap: 12px;
    padding: 6px 2px;
  }

  .skeleton-line {
    height: 14px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 0%,
      var(--bg-active) 50%,
      var(--bg-secondary) 100%
    );
    background-size: 220% 100%;
    animation: ytly-shimmer 1.25s linear infinite;
  }

  @keyframes ytly-shimmer {
    0% {
      background-position: 190% 0;
    }
    100% {
      background-position: -90% 0;
    }
  }

  /* ---------- Light Theme (nur Token-Override) ---------- */

  #panel.theme-light {
    --bg-primary: rgba(252, 252, 254, 0.92);
    --bg-secondary: rgba(0, 0, 0, 0.03);
    --bg-surface: rgba(0, 0, 0, 0.05);
    --bg-hover: rgba(0, 0, 0, 0.08);
    --bg-active: rgba(0, 0, 0, 0.12);

    --text-primary: rgba(20, 22, 26, 0.96);
    --text-secondary: rgba(20, 22, 26, 0.64);
    --text-muted: rgba(20, 22, 26, 0.40);

    --border-subtle: rgba(0, 0, 0, 0.07);
    --border-strong: rgba(0, 0, 0, 0.12);

    --accent: #2f6fed;
    --accent-soft: rgba(47, 111, 237, 0.12);
    --danger: #d33131;
    --danger-soft: rgba(211, 49, 49, 0.10);

    --shadow-panel:
      0 24px 64px rgba(0, 0, 0, 0.18),
      0 4px 16px rgba(0, 0, 0, 0.10);
  }

  /* ---------- Responsive ---------- */

  @media (max-width: 640px) {
    #panel {
      width: calc(100vw - 20px);
      max-height: min(72vh, 640px);
      padding: 12px 12px 8px;
    }

    #toggle {
      width: 40px;
      height: 40px;
      border-radius: 12px;
    }

    .controls-bar {
      flex-wrap: wrap;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
      transition: none !important;
    }
  }
`;

  const ICONS = {
    mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    reload:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    search:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    settings:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    close:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    reset:
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    apple:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
    noMusic:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
  };

  function getVideoId() {
    const url = new URL(location.href);

    const v = url.searchParams.get("v");
    if (v) return v;

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "shorts" && parts[1]) return parts[1];
    if (parts[0] === "embed" && parts[1]) return parts[1];

    return null;
  }

  function ensureUI() {
    let host = document.getElementById("yt-lyrics-extension-host");

    if (host && host.isConnected && ui) {
      return ui;
    }

    if (host && !host.isConnected) {
      host.remove();
    }

    host = document.createElement("div");
    host.id = "yt-lyrics-extension-host";
    host.style.cssText =
      "position:fixed; top:84px; right:16px; z-index:2147483647; width:0; height:0; display:none;";

    document.documentElement.appendChild(host);

    const root = host.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>${css}</style>

      <button id="toggle" title="Songtext anzeigen (⌘⇧L)" aria-label="Songtext anzeigen">${ICONS.mic}</button>

      <section id="panel" hidden aria-label="Songtext">
        <header class="panel-header">
          <img id="track-art" class="track-art" alt="" hidden />
          <div class="header-text">
            <h2 id="track-title">Lyrics</h2>
            <p id="track-meta" class="meta"></p>
          </div>
          <div class="header-actions">
            <button id="reload" class="icon-btn" title="Neu laden" aria-label="Lyrics neu laden">${ICONS.reload}</button>
            <button id="edit" class="icon-btn" title="Suche" aria-label="Manuelle Suche">${ICONS.search}</button>
          </div>
          <div class="header-actions right">
            <button id="settings-btn" class="icon-btn" title="Einstellungen" aria-label="Einstellungen">${ICONS.settings}</button>
            <button id="close" class="icon-btn" title="Schließen" aria-label="Schließen">${ICONS.close}</button>
          </div>
        </header>

        <div id="editor" class="drawer" hidden>
          <div class="drawer-grid">
            <label class="field">
              <span class="field-label">Interpret</span>
              <input id="artist-input" placeholder="z. B. Taylor Swift" aria-label="Interpret" />
            </label>
            <label class="field">
              <span class="field-label">Titel</span>
              <input id="title-input" placeholder="z. B. Hey Stephen" aria-label="Titel" />
            </label>
            <button id="search">Suchen</button>
          </div>
        </div>

        <div id="settings" class="drawer" hidden>
          <div class="drawer-title">Einstellungen</div>
          <label class="setting-row">
            <input type="checkbox" id="setting-autoopen" />
            Auto-Open bei Musikvideos
          </label>
          <label class="setting-row">
            Theme
            <select id="setting-theme" aria-label="Theme">
              <option value="dark">Dunkel</option>
              <option value="light">Hell</option>
              <option value="auto">Auto</option>
            </select>
          </label>
          <div class="setting-row">
            Modus
            <div class="segmented" role="radiogroup" aria-label="Lyrics-Modus">
              <button id="mode-karaoke" class="seg-btn" role="radio" aria-checked="true">Karaoke</button>
              <button id="mode-text" class="seg-btn" role="radio" aria-checked="false">Text</button>
            </div>
          </div>
          <div class="setting-row">
            Schriftgröße
            <button id="font-minus" title="Schrift verkleinern" aria-label="Schrift verkleinern">A−</button>
            <span id="font-value">17px</span>
            <button id="font-plus" title="Schrift vergrößern" aria-label="Schrift vergrößern">A+</button>
          </div>
        </div>

        <div id="status" hidden role="status" aria-live="polite"></div>

        <div id="lyrics"></div>

        <div id="offset-row" class="controls-bar" hidden>
          <div class="timing-group" role="group" aria-label="Timing anpassen">
            <button id="offset-minus-coarse" title="5 Sekunden früher" aria-label="5 Sekunden früher">−5s</button>
            <button id="offset-minus-fine" title="0,5 Sekunden früher" aria-label="0,5 Sekunden früher">−0,5</button>
            <span id="offset-value">0s</span>
            <button id="offset-plus-fine" title="0,5 Sekunden später" aria-label="0,5 Sekunden später">+0,5</button>
            <button id="offset-plus-coarse" title="5 Sekunden später" aria-label="5 Sekunden später">+5s</button>
            <button id="offset-reset" title="Timing zurücksetzen" aria-label="Timing zurücksetzen">${ICONS.reset}</button>
          </div>
          <label class="autoscroll">
            <input type="checkbox" id="autoscroll" checked />
            <span class="switch" aria-hidden="true"></span>
            <span>Auto-Scroll</span>
          </label>
        </div>

        <footer class="footer">
          <div id="ext-section" class="footer-section" hidden>
            <div class="footer-title">Externe Links</div>
            <div class="footer-links">
              <a id="ug-link" class="ext-btn" href="#" target="_blank" rel="noopener noreferrer" hidden title="Tab auf Ultimate Guitar öffnen" aria-label="Tab auf Ultimate Guitar öffnen"><span class="ug-logo">UG</span></a>
              <a id="am-link" class="ext-btn" href="#" target="_blank" rel="noopener noreferrer" hidden title="Auf Apple Music öffnen" aria-label="Auf Apple Music öffnen">${ICONS.apple}</a>
            </div>
          </div>
          <span>Lyrics: LRCLIB · lyrics.ovh</span>
        </footer>
      </section>
    `;

    ui = {
      host,
      root,
      panel: root.getElementById("panel"),
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
      offsetRow: root.getElementById("offset-row"),
      offsetMinusFine: root.getElementById("offset-minus-fine"),
      offsetMinusCoarse: root.getElementById("offset-minus-coarse"),
      offsetPlusFine: root.getElementById("offset-plus-fine"),
      offsetPlusCoarse: root.getElementById("offset-plus-coarse"),
      offsetReset: root.getElementById("offset-reset"),
      offsetValue: root.getElementById("offset-value"),
      ugLink: root.getElementById("ug-link"),
      amLink: root.getElementById("am-link"),
      extSection: root.getElementById("ext-section"),
      trackArt: root.getElementById("track-art"),
    };

    ui.toggle.addEventListener("click", () => {
      togglePanel();
    });

    ui.close.addEventListener("click", () => {
      ui.panel.hidden = true;
      const currentId = getVideoId();
      if (currentId) {
        try {
          sessionStorage.setItem(`ytlyrics_closed_${currentId}`, "true");
        } catch (e) {}
      }
    });

    ui.reload.addEventListener("click", () => {
      refresh({ force: true });
    });

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

    ui.search.addEventListener("click", () => {
      manualSearch();
    });

    ui.settingAutoOpen.addEventListener("change", async () => {
      settings.autoOpen = ui.settingAutoOpen.checked;
      await saveSettings();
    });

    ui.settingTheme.addEventListener("change", async () => {
      settings.theme = ui.settingTheme.value;
      await saveSettings();
      applyTheme();
    });

    ui.fontMinus.addEventListener("click", () => changeFontSize(-1));
    ui.fontPlus.addEventListener("click", () => changeFontSize(1));

    ui.modeKaraoke.addEventListener("click", async () => {
      if (settings.mode === "karaoke") return;
      settings.mode = "karaoke";
      applyMode();
      await saveSettings();
      if (lastLyrics) renderLyrics(lastLyrics);
    });

    ui.modeText.addEventListener("click", async () => {
      if (settings.mode === "text") return;
      settings.mode = "text";
      applyMode();
      await saveSettings();
      if (lastLyrics) renderLyrics(lastLyrics);
    });

    ui.autoScroll.addEventListener("change", async () => {
      settings.autoScroll = ui.autoScroll.checked;
      await saveSettings();
    });

    ui.offsetMinusFine.addEventListener("click", () => changeOffset(-0.5));
    ui.offsetMinusCoarse.addEventListener("click", () => changeOffset(-5));
    ui.offsetPlusFine.addEventListener("click", () => changeOffset(0.5));
    ui.offsetPlusCoarse.addEventListener("click", () => changeOffset(5));
    ui.offsetReset.addEventListener("click", () => resetOffset());

    [ui.artistInput, ui.titleInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          manualSearch();
        }
      });
    });

    // Verhindert, dass YouTube-Shortcuts (M, Space, /, k …) auslösen,
    // während im Panel getippt wird. Events werden am Host gestoppt,
    // bevor sie zu YouTubes document-Listener durchdringen.
    ["keydown", "keyup", "keypress"].forEach((type) => {
      host.addEventListener(type, (event) => {
        if (event.metaKey) return; // ⌘⇧L bleibt weiterhin funktionieren
        event.stopPropagation();
      });
    });

    applySettings();

    return ui;
  }

  function togglePanel() {
    if (!ui) return;
    ui.panel.hidden = !ui.panel.hidden;

    if (!ui.panel.hidden) {
      refresh({ force: false });
    }
  }

  function setStatus(text, isError = false) {
    if (!ui) return;

    ui.status.hidden = false;
    ui.status.textContent = text;
    ui.status.classList.toggle("error", isError);
  }

  function hideStatus() {
    if (!ui) return;
    ui.status.hidden = true;
  }

  function setLoading() {
    if (!ui) return;

    ui.lyrics.textContent = "";

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

    ui.lyrics.appendChild(skeleton);

    setStatus("Suche Songtext…");
  }

  async function loadSettings() {
    const stored = await getFromCache("ytlyrics_settings");

    if (stored && typeof stored === "object") {
      settings = { ...settings, ...stored };
    }

    applySettings();
  }

  async function saveSettings() {
    await saveToCache("ytlyrics_settings", settings);
  }

  function applySettings() {
    if (ui) {
      ui.settingAutoOpen.checked = !!settings.autoOpen;
      ui.settingTheme.value = settings.theme || "auto";
      ui.autoScroll.checked = !!settings.autoScroll;
    }

    applyFontSize();
    applyTheme();
    applyMode();
  }

  function applyMode() {
    if (!ui) return;

    const karaoke = settings.mode !== "text";

    ui.modeKaraoke.classList.toggle("active", karaoke);
    ui.modeText.classList.toggle("active", !karaoke);
    ui.modeKaraoke.setAttribute("aria-checked", String(karaoke));
    ui.modeText.setAttribute("aria-checked", String(!karaoke));
  }

  function updateUgLink() {
    if (!ui || !currentSong) return;

    const { artist, title } = currentSong;

    if (!artist || artist === "Unknown" || !title || title === "Unknown") {
      ui.ugLink.hidden = true;
    } else {
      const artistParam = encodeURIComponent(artist);
      const titleParam = encodeURIComponent(title);
      ui.ugLink.href = `https://www.ultimate-guitar.com/search.php?title=${titleParam}&artist=${artistParam}`;
      ui.ugLink.hidden = false;
    }

    updateExtSection();
  }

  function updateAppleMusicLink() {
    if (!ui || !currentSong) return;

    const { artist, title } = currentSong;

    if (!artist || artist === "Unknown" || !title || title === "Unknown") {
      ui.amLink.hidden = true;
    } else {
      const query = encodeURIComponent(`${artist} ${title}`);
      ui.amLink.href = `https://music.apple.com/de/search?term=${query}`;
      ui.amLink.hidden = false;
    }

    updateExtSection();
  }

  function updateExtSection() {
    if (!ui) return;
    ui.extSection.hidden = ui.ugLink.hidden && ui.amLink.hidden;
  }

  function renderEmptyState(message) {
    if (!ui) return;

    if (ui.offsetRow) {
      ui.offsetRow.hidden = true;
    }

    ui.lyrics.textContent = "";
    ui.lyrics.scrollTop = 0;

    sync.lines = [];
    sync.elements = [];
    sync.activeIndex = -1;

    detachVideoListeners();

    const wrap = document.createElement("div");
    wrap.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.innerHTML = ICONS.noMusic;

    const title = document.createElement("div");
    title.className = "empty-title";
    title.textContent = "Kein Songtext gefunden";

    const text = document.createElement("div");
    text.className = "empty-text";
    text.textContent = message;

    wrap.appendChild(icon);
    wrap.appendChild(title);
    wrap.appendChild(text);

    ui.lyrics.appendChild(wrap);
  }
  const artMemory = new Map();

  async function fetchArtworkFromItunes(artist, title) {
    const term = encodeURIComponent(`${artist} ${title}`);
    const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`;

    try {
      const data = await fetchJson(url);
      const art = data?.results?.[0]?.artworkUrl100;
      return art ? art.replace("100x100", "300x300") : null;
    } catch (error) {
      console.warn("Artwork-Load fehlgeschlagen:", error);
      return null;
    }
  }

  async function updateArtwork(sequence) {
    if (!ui || !currentSong) return;

    const { artist, title } = currentSong;

    if (!artist || artist === "Unknown" || !title || title === "Unknown") {
      ui.trackArt.hidden = true;
      return;
    }

    const key = `ytlyrics_art_${artist.toLowerCase()}_${title.toLowerCase()}`;

    let url = artMemory.get(key);

    if (url === undefined) {
      const stored = await getFromCache(key);

      if (stored) {
        url = stored;
      } else {
        url = await fetchArtworkFromItunes(artist, title);
        if (url) await saveToCache(key, url);
      }

      artMemory.set(key, url || "");
    }

    if (sequence !== undefined && sequence !== refreshSeq) return;

    if (url) {
      ui.trackArt.src = url;
      ui.trackArt.hidden = false;
    } else {
      ui.trackArt.hidden = true;
    }
  }

  function parseChapterTime(text) {
    const m = String(text || "")
      .trim()
      .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const h = m[1] ? Number(m[1]) : 0;
    return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  function readChaptersFromDom() {
    const chapters = [];

    document
      .querySelectorAll("ytd-macro-markers-list-item-renderer")
      .forEach((el) => {
        const title = el.querySelector("#title")?.textContent?.trim() || "";
        const timeText = el.querySelector("#time")?.textContent?.trim() || "";
        const time = parseChapterTime(timeText);
        if (title && time !== null) chapters.push({ title, time });
      });

    if (!chapters.length) {
      document.querySelectorAll("ytd-chapter-renderer").forEach((el) => {
        const title =
          el.querySelector("#chapter-title")?.textContent?.trim() ||
          el.querySelector(".yt-formatted-string")?.textContent?.trim() ||
          "";
        const timeText =
          el.querySelector("#timestamp")?.textContent?.trim() || "";
        const time = parseChapterTime(timeText);
        if (title && time !== null) chapters.push({ title, time });
      });
    }

    chapters.sort((a, b) => a.time - b.time);
    return chapters;
  }

  function computeOffsetFromChapters(chapters, songTitle) {
    const cleanTitle = (songTitle || "").toLowerCase().trim();

    if (cleanTitle) {
      for (const ch of chapters) {
        const ct = ch.title.toLowerCase();
        if (
          ct.length >= 3 &&
          (ct.includes(cleanTitle) || cleanTitle.includes(ct))
        ) {
          return ch.time;
        }
      }
    }

    const first = chapters[0];
    if (
      first &&
      first.time === 0 &&
      /intro|introduct|vorspann/i.test(first.title) &&
      chapters[1]
    ) {
      return chapters[1].time;
    }

    return null;
  }

  async function refineOffsetWithChapters(sequence, songTitle) {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (sequence !== refreshSeq) return;

      const chapters = readChaptersFromDom();

      if (chapters.length >= 2) {
        const offset = computeOffsetFromChapters(chapters, songTitle);

        if (
          offset !== null &&
          offset >= 0 &&
          offset <= 120 &&
          offset !== lyricOffset
        ) {
          lyricOffset = offset;
          updateOffsetDisplay();
          updateActiveLine();
          setStatus(
            `Kapitel erkannt: Timing auf ${formatOffset(lyricOffset)} gesetzt.`
          );
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  function applyFontSize() {
    if (!ui) return;
    ui.panel.style.setProperty("--lyrics-font-size", `${settings.fontSize}px`);
    ui.fontValue.textContent = `${settings.fontSize}px`;
  }

  async function changeFontSize(delta) {
    settings.fontSize = Math.max(14, Math.min(26, settings.fontSize + delta));
    applyFontSize();
    await saveSettings();
  }

  function applyTheme() {
    if (!ui) return;

    let light = false;

    if (settings.theme === "light") {
      light = true;
    } else if (settings.theme === "auto") {
      light = !document.documentElement.hasAttribute("dark");
    }

    ui.panel.classList.toggle("theme-light", light);
  }

  function formatOffset(value) {
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    const text =
      rounded % 1 === 0
        ? String(rounded)
        : rounded.toFixed(1).replace(".", ",");
    return `${sign}${text}s`;
  }

  function updateOffsetDisplay() {
    if (!ui) return;
    ui.offsetValue.textContent = formatOffset(lyricOffset);
    ui.offsetValue.classList.toggle("nonzero", lyricOffset !== 0);
  }

  async function loadOffset(videoId) {
    const stored = await getFromCache(`ytlyrics_offset_${videoId}`);

    if (typeof stored === "number") {
      lyricOffset = stored;
      updateOffsetDisplay();
      return true;
    }

    lyricOffset = 0;
    updateOffsetDisplay();
    return false;
  }

  async function persistOffset() {
    const videoId = getVideoId();
    if (videoId) {
      await saveToCache(`ytlyrics_offset_${videoId}`, lyricOffset);
    }
  }

  async function changeOffset(delta) {
    lyricOffset = Math.max(
      -120,
      Math.min(120, Math.round((lyricOffset + delta) * 10) / 10)
    );
    updateOffsetDisplay();
    updateActiveLine();
    await persistOffset();
  }

  async function resetOffset() {
    lyricOffset = 0;
    updateOffsetDisplay();
    updateActiveLine();
    await persistOffset();
  }

  async function fetchJsonDirect(url) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function sendMessageAsync(message) {
    if (globalThis.browser?.runtime?.sendMessage) {
      return globalThis.browser.runtime.sendMessage(message);
    }

    if (globalThis.chrome?.runtime?.sendMessage) {
      return new Promise((resolve, reject) => {
        globalThis.chrome.runtime.sendMessage(message, (response) => {
          const lastError = globalThis.chrome.runtime.lastError;

          if (lastError) {
            reject(new Error(lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }

    throw new Error("WebExtension runtime nicht verfügbar.");
  }

  async function fetchJson(url) {
    try {
      const response = await sendMessageAsync({
        type: "fetch-json",
        url,
      });

      if (!response) {
        throw new Error("Leere Antwort.");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status ?? "Fehler"}`);
      }

      return response.data;
    } catch (error) {
      console.warn("Background-Fetch fehlgeschlagen, direkter Fetch:", error);
      return fetchJsonDirect(url);
    }
  }

  async function getFromCache(key) {
    try {
      return await sendMessageAsync({ type: "storage-get", key });
    } catch {
      return null;
    }
  }

  async function saveToCache(key, value) {
    try {
      await sendMessageAsync({ type: "storage-set", key, value });
    } catch (error) {
      console.warn("Cache-Speichern fehlgeschlagen:", error);
    }
  }

  async function fetchOEmbed(videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(
      videoId
    )}`;
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      watchUrl
    )}&format=json`;

    return fetchJson(url);
  }

  function getDomMetadata() {
    const ogTitle = document.querySelector(
      'meta[property="og:title"]'
    )?.content;

    const h1 =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
        ?.textContent ||
      document.querySelector(
        "h1.ytd-video-primary-info-renderer yt-formatted-string"
      )?.textContent;

    const title = (ogTitle || h1 || document.title || "")
      .replace(/\s+-\s+YouTube$/i, "")
      .trim();

    const author =
      document.querySelector("ytd-video-owner-renderer #text")?.textContent ||
      document.querySelector("ytd-channel-name a")?.textContent ||
      document.querySelector("#owner #channel-name #text")?.textContent ||
      document.querySelector('link[itemprop="name"]')?.content ||
      "";

    return {
      title: title.trim(),
      author_name: author.trim(),
    };
  }

  async function getMetadata(videoId) {
    try {
      const data = await fetchOEmbed(videoId);

      if (data?.title) {
        return data;
      }
    } catch (error) {
      console.warn("oEmbed fehlgeschlagen, DOM-Fallback:", error);
    }

    return getDomMetadata();
  }

  function cleanArtist(name) {
    return (name || "")
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/VEVO$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function cleanTrack(name) {
    return (name || "")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(
        /\([^)]*(official|video|lyric|lyrics|audio|visualizer|visualiser|hd|hq|4k|uhd|8k|live|performance|mv|music video|trailer|explicit|clean|remaster|remastered|lyric video|official audio|official video|official music video|color coded|color-coded|premiere|premier|with lyrics|full song)[^)]*\)/gi,
        " "
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function buildTitleVariants(rawTitle, artistName) {
    const variants = [];
    const seen = new Set();

    const add = (title) => {
      const t = (title || "").replace(/\s{2,}/g, " ").trim();
      if (t && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        variants.push(t);
      }
    };

    const noiseWords = [
      "HD",
      "HQ",
      "4K",
      "UHD",
      "8K",
      "Lyrics",
      "Lyric",
      "Lyrical",
      "Official",
      "Video",
      "Audio",
      "MV",
      "Explicit",
      "Clean",
      "Premiere",
      "Premier",
    ];

    let aggressive = cleanTrack(rawTitle);
    for (const word of noiseWords) {
      const regexEnd = new RegExp(`\\s+${word}\\s*$`, "i");
      const regexFront = new RegExp(`^${word}\\s+`, "i");
      aggressive = aggressive.replace(regexEnd, "");
      aggressive = aggressive.replace(regexFront, "");
    }
    add(aggressive);

    add(cleanTrack(rawTitle));

    if (artistName) {
      const escapedArtist = artistName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const withoutArtist = rawTitle
        .replace(new RegExp(escapedArtist, "gi"), "")
        .trim();
      add(cleanTrack(withoutArtist).replace(/^[\s\-\–\—:]+/, ""));
    }

    const original = rawTitle
      .replace(/\([^)]*\)/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .trim();
    add(original);

    return variants;
  }

  function parseSongInfo(rawTitle, rawAuthor) {
    const originalTitle = (rawTitle || "").trim();
    const author = (rawAuthor || "").trim();

    if (/\s*-\s*Topic$/i.test(author)) {
      return {
        artist: cleanArtist(author),
        title: cleanTrack(originalTitle),
        source: "topic",
      };
    }

    const separators = [" - ", " – ", " — ", ": "];

    for (const separator of separators) {
      const index = originalTitle.indexOf(separator);

      if (index > 0 && index < originalTitle.length - separator.length) {
        const left = originalTitle.slice(0, index).trim();
        const right = originalTitle.slice(index + separator.length).trim();

        if (left && right) {
          return {
            artist: cleanArtist(left),
            title: cleanTrack(right),
            source: "title-split",
          };
        }
      }
    }

    return {
      artist: cleanArtist(author) || "Unknown",
      title: cleanTrack(originalTitle) || "Unknown",
      source: "fallback",
    };
  }

  function getVideoDuration() {
    const video = document.querySelector("video");

    if (!video || !Number.isFinite(video.duration)) {
      return 0;
    }

    return video.duration;
  }

  function firstLyricItem(data) {
    if (!data) return null;

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && (item.plainLyrics || item.syncedLyrics)) {
          return item;
        }
      }

      return null;
    }

    if (typeof data === "object") {
      if (data.plainLyrics || data.syncedLyrics) {
        return data;
      }

      if (Array.isArray(data.data)) {
        return firstLyricItem(data.data);
      }
    }

    return null;
  }

  async function fetchLrclib(artist, title, duration) {
    const requests = [];

    const getUrl = new URL("https://lrclib.net/api/get");
    getUrl.searchParams.set("artist_name", artist);
    getUrl.searchParams.set("track_name", title);

    if (duration) {
      getUrl.searchParams.set("duration", String(Math.round(duration)));
    }

    requests.push(getUrl.toString());

    const qSearchUrl = new URL("https://lrclib.net/api/search");
    qSearchUrl.searchParams.set("q", `${artist} ${title}`);
    requests.push(qSearchUrl.toString());

    const fieldSearchUrl = new URL("https://lrclib.net/api/search");
    fieldSearchUrl.searchParams.set("artist_name", artist);
    fieldSearchUrl.searchParams.set("track_name", title);
    requests.push(fieldSearchUrl.toString());

    for (const url of requests) {
      try {
        const data = await fetchJson(url);
        const item = firstLyricItem(data);

        if (item) {
          return {
            artist: item.artistName || artist,
            title: item.trackName || title,
            plainLyrics: item.plainLyrics || "",
            syncedLyrics: item.syncedLyrics || "",
            trackDuration: item.duration || 0,
          };
        }
      } catch (error) {
        console.warn("LRCLIB request fehlgeschlagen:", url, error);
      }
    }

    return null;
  }

  async function fetchLyricsOvh(artist, title) {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(
      artist
    )}/${encodeURIComponent(title)}`;

    try {
      const data = await fetchJson(url);

      if (data?.lyrics) {
        return {
          artist,
          title,
          plainLyrics: data.lyrics,
          syncedLyrics: "",
          trackDuration: 0,
        };
      }
    } catch (error) {
      console.warn("lyrics.ovh request fehlgeschlagen:", error);
    }

    return null;
  }

  async function fetchLyricsWithVariants(artist, rawTitle, duration) {
    const variants = buildTitleVariants(rawTitle, artist);

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const lyrics = await fetchLrclib(artist, variant, duration);

      if (lyrics && (lyrics.plainLyrics || lyrics.syncedLyrics)) {
        return lyrics;
      }
    }

    return null;
  }

  function parseLRC(lrc) {
    const output = [];
    const lines = String(lrc || "").split(/\r?\n/);
    const timeTagRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

    for (const rawLine of lines) {
      timeTagRegex.lastIndex = 0;

      const matches = [...rawLine.matchAll(timeTagRegex)];

      if (!matches.length) continue;

      timeTagRegex.lastIndex = 0;

      const text = rawLine.replace(timeTagRegex, "").trim();

      for (const match of matches) {
        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const fractionRaw = match[3];

        let fraction = 0;

        if (fractionRaw) {
          fraction =
            Number(fractionRaw) /
            (fractionRaw.length === 3
              ? 1000
              : fractionRaw.length === 2
              ? 100
              : 10);
        }

        const time = minutes * 60 + seconds + fraction;

        if (Number.isFinite(time)) {
          output.push({
            time,
            text,
          });
        }
      }
    }

    output.sort((a, b) => a.time - b.time);

    return output;
  }

  function detachVideoListeners() {
    if (sync.video && sync.onTimeUpdate) {
      sync.video.removeEventListener("timeupdate", sync.onTimeUpdate);
    }

    stopSyncLoop();

    sync.video = null;
    sync.onTimeUpdate = null;
  }

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

  function updateActiveLine() {
    const video = sync.video || document.querySelector("video");

    if (!video || !sync.lines.length || !ui?.lyrics) return;

    const currentTime = video.currentTime;

    let newIndex = -1;

    for (let i = 0; i < sync.lines.length; i++) {
      if (sync.lines[i].time + lyricOffset <= currentTime) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex === sync.activeIndex) return;

    sync.activeIndex = newIndex;

    sync.elements.forEach((el, i) => {
      el.classList.toggle("active", i === newIndex);
      el.classList.toggle("past", i < newIndex);
    });

    if (newIndex >= 0 && ui.autoScroll?.checked) {
      const activeElement = sync.elements[newIndex];
      const containerRect = ui.lyrics.getBoundingClientRect();
      const lineRect = activeElement.getBoundingClientRect();

      const scrollOffset =
        lineRect.top -
        containerRect.top -
        containerRect.height / 2 +
        lineRect.height / 2;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      ui.lyrics.scrollBy({
        top: scrollOffset,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }
  }

  function attachVideoListeners(retries = 5) {
    const video = document.querySelector("video");

    if (!video) {
      if (retries > 0) {
        setTimeout(() => attachVideoListeners(retries - 1), 1000);
      }

      return;
    }

    detachVideoListeners();

    sync.video = video;
    sync.onTimeUpdate = () => updateActiveLine();

    video.addEventListener("timeupdate", sync.onTimeUpdate);

    startSyncLoop();

    updateActiveLine();
  }

  function seekTo(time) {
    const video = document.querySelector("video");

    if (!video) return;

    video.currentTime = time + lyricOffset;

    const playPromise = video.play?.();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }

    updateActiveLine();
  }

  function renderLyrics(lyrics) {
    if (!ui) return;

    if (ui.offsetRow) {
      ui.offsetRow.hidden = true;
    }

    ui.lyrics.textContent = "";
    ui.lyrics.scrollTop = 0;

    sync.lines = [];
    sync.elements = [];
    sync.activeIndex = -1;

    detachVideoListeners();

    const wantSynced = settings.mode !== "text" && lyrics.syncedLyrics;

    if (wantSynced) {
      const lines = parseLRC(lyrics.syncedLyrics);

      if (lines.length) {
        sync.lines = lines;

        const container = document.createElement("div");

        lines.forEach((line, index) => {
          const div = document.createElement("div");

          div.className = "line";
          div.textContent = line.text || "…";
          div.dataset.index = String(index);

          div.addEventListener("click", () => {
            seekTo(line.time);
          });

          container.appendChild(div);
          sync.elements.push(div);
        });

        ui.lyrics.appendChild(container);

        if (ui.offsetRow) {
          ui.offsetRow.hidden = false;
        }

        attachVideoListeners();

        return;
      }
    }

    let text = lyrics.plainLyrics?.trim();

    if (!text && lyrics.syncedLyrics) {
      text = parseLRC(lyrics.syncedLyrics)
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

    ui.lyrics.appendChild(pre);
  }

  async function refresh(options = {}) {
    const { force = false, artist = null, title = null } = options;

    const videoId = getVideoId();

    if (!videoId) {
      if (ui) {
        setStatus("Kein YouTube-Video erkannt.", true);
      }

      return;
    }

    ensureUI();

    const sequence = ++refreshSeq;

    if (
      !force &&
      currentVideoId === videoId &&
      currentSong &&
      !artist &&
      !title
    ) {
      return;
    }

    const hadStoredOffset = await loadOffset(videoId);

    if (sequence !== refreshSeq) return;

    setLoading();

    try {
      let song;
      const cacheKey = `ytlyrics_${videoId}`;

      if (artist && title) {
        song = {
          artist,
          title,
          rawTitle: title,
          source: "manual",
        };
      } else {
        const metadata = await getMetadata(videoId);

        if (sequence !== refreshSeq) return;

        const parsed = parseSongInfo(metadata.title, metadata.author_name);
        song = {
          ...parsed,
          rawTitle: metadata.title,
        };
      }

      currentVideoId = videoId;
      currentSong = song;

      if (ui) {
        ui.artistInput.value = song.artist || "";
        ui.titleInput.value = song.title || "";
        ui.title.textContent = song.title || "Lyrics";
        ui.meta.textContent = song.artist || "";

        if (
          settings.autoOpen &&
          song.source === "topic" &&
          ui.panel.hidden &&
          !sessionStorage.getItem(`ytlyrics_closed_${videoId}`)
        ) {
          ui.panel.hidden = false;
        }
      }

      let lyrics = null;
      if (!force) {
        lyrics = await getFromCache(cacheKey);
        if (lyrics && (lyrics.plainLyrics || lyrics.syncedLyrics)) {
          console.log("✅ Lyrics aus dem Cache geladen!");
        } else {
          lyrics = null;
        }
      }

      let autoEstimated = false;

      if (!lyrics) {
        const duration = getVideoDuration();

        lyrics = await fetchLyricsWithVariants(
          song.artist,
          song.rawTitle || song.title,
          duration
        );

        if (sequence !== refreshSeq) return;

        if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
          const variants = buildTitleVariants(
            song.rawTitle || song.title,
            song.artist
          );
          for (const variant of variants) {
            lyrics = await fetchLyricsOvh(song.artist, variant);
            if (lyrics && lyrics.plainLyrics) break;
          }
        }

        if (sequence !== refreshSeq) return;

        if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
          const notFound = new Error("Kein Songtext gefunden.");
          notFound.code = "not-found";
          throw notFound;
        }

        await saveToCache(cacheKey, lyrics);
      }

      if (!hadStoredOffset) {
        const videoDuration = getVideoDuration();
        const trackDuration = lyrics.trackDuration || 0;

        if (videoDuration && trackDuration) {
          const diff = Math.round(videoDuration - trackDuration);

          if (diff >= 4 && diff <= 60) {
            lyricOffset = diff;
            autoEstimated = true;
          }
        }
      }

      updateOffsetDisplay();

      if (lyrics.artist || lyrics.title) {
        currentSong = {
          ...song,
          artist: lyrics.artist || song.artist,
          title: lyrics.title || song.title,
        };

        if (ui) {
          ui.title.textContent = currentSong.title;
          ui.meta.textContent = currentSong.artist;
        }
      }

      updateUgLink();
      updateAppleMusicLink();
      updateArtwork(sequence);

      if (!hadStoredOffset) {
        refineOffsetWithChapters(sequence, song.title);
      }

      if (autoEstimated) {
        setStatus(
          `Intro vermutet: Timing automatisch auf ${formatOffset(
            lyricOffset
          )} gesetzt. Falls es nicht passt, in der Control-Bar anpassen oder zurücksetzen.`
        );
      } else {
        hideStatus();
      }

      lastLyrics = lyrics;
      renderLyrics(lyrics);
    } catch (error) {
      if (sequence !== refreshSeq) return;

      console.error("YouTube Lyrics:", error);

      if (error?.code === "not-found") {
        hideStatus();
        renderEmptyState(
          "Dieses Video scheint instrumental zu sein – oder der Text ist bei unseren Quellen nicht verfügbar. Über ✎ Suche kannst du Interpret & Titel manuell anpassen."
        );
        return;
      }

      if (ui) {
        ui.lyrics.textContent = "";
      }

      setStatus(error?.message || "Unbekannter Fehler.", true);
    }
  }

  function manualSearch() {
    const artist = ui?.artistInput?.value.trim();
    const title = ui?.titleInput?.value.trim();

    if (!artist || !title) {
      setStatus("Bitte Interpret und Titel eingeben.", true);
      return;
    }

    refresh({
      force: true,
      artist,
      title,
    });
  }

  function updateForCurrentUrl() {
    const videoId = getVideoId();

    if (!videoId) {
      if (ui?.host) {
        ui.host.style.display = "none";
      }

      return;
    }

    const activeUi = ensureUI();

    activeUi.host.style.display = "block";

    if (videoId !== currentVideoId) {
      currentVideoId = null;
      currentSong = null;

      if (!activeUi.panel.hidden) {
        refresh({ force: true });
      }
    } else if (!activeUi.panel.hidden) {
      refresh({ force: false });
    }
  }

  function observeNavigation() {
    let timeout;

    const schedule = () => {
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        updateForCurrentUrl();
      }, 400);
    };

    [
      "yt-navigate-finish",
      "yt-page-data-updated",
      "popstate",
      "hashchange",
    ].forEach((eventName) => {
      window.addEventListener(eventName, schedule);
    });

    setInterval(schedule, 1200);
  }

  function observeYouTubeTheme() {
    const observer = new MutationObserver(() => {
      if (settings.theme === "auto") {
        applyTheme();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark"],
    });
  }

  function registerShortcut() {
    window.addEventListener("keydown", (event) => {
      if (!(event.metaKey && event.shiftKey)) return;
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

      if (!ui) return;

      togglePanel();
    });
  }

  function init() {
    loadSettings();
    observeNavigation();
    observeYouTubeTheme();
    registerShortcut();
    updateForCurrentUrl();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
