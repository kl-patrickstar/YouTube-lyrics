 (() => {
   const Y = (globalThis.YTLY ??= {});

   const css = `
   :host {
     all: initial;
     font-family: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;

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
     --success: #4ade80;
     --success-soft: rgba(74, 222, 128, 0.16);

     --shadow-panel: 0 24px 64px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3);

     --radius-sm: 8px;
     --radius-md: 12px;
     --radius-lg: 18px;

     --transition-fast: 140ms cubic-bezier(0.2, 0.8, 0.4, 1);
     --transition-normal: 220ms cubic-bezier(0.2, 0.8, 0.4, 1);
   }

   * { box-sizing: border-box; }
   [hidden] { display: none !important; }
   button, input, select { font: inherit; }
   button { color: inherit; }

   #toggle:focus-visible,
   #panel button:focus-visible,
   #panel a:focus-visible,
   #panel input:focus-visible,
   #panel select:focus-visible,
   .autoscroll input:focus-visible + .switch {
     outline: 2px solid var(--accent);
     outline-offset: 2px;
   }

   /* ============================================================
      TOGGLE-BUTTON
      ============================================================ */
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
     cursor: grab;
     touch-action: none;
     box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
     transition: transform var(--transition-fast), background var(--transition-fast),
       border-color var(--transition-fast), opacity var(--transition-normal),
       visibility var(--transition-normal);
   }

   #toggle.is-hidden {
     opacity: 0;
     visibility: hidden;
     pointer-events: none;
     transform: scale(0.9);
   }

   #toggle:hover { transform: translateY(-1px); border-color: var(--accent); }
   #toggle:active { transform: scale(0.96); }
   #toggle.dragging { cursor: grabbing; }

   /* ============================================================
      PANEL
      ============================================================ */
   #panel.open-left { right: auto; left: 0; }
   #panel.open-above { top: auto; bottom: 0; }

   #panel {
     position: fixed;
     top: 0;
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
     will-change: top, left;
     transition: opacity var(--transition-normal), visibility var(--transition-normal);
   }

   #panel[hidden] {
     display: flex !important;
     opacity: 0;
     visibility: hidden;
     pointer-events: none;
   }

   /* ============================================================
      HEADER — 2 Spalten
      ============================================================ */
   .panel-header {
     display: flex;
     align-items: flex-start;
     gap: 10px;
     padding: 4px 2px 12px;
     margin-bottom: 10px;
     border-bottom: 1px solid var(--border-subtle);
     cursor: grab;
     user-select: none;
     touch-action: none;
   }

   .panel-header.dragging {
     cursor: grabbing;
   }

   .panel-header button,
   .panel-header a,
   .panel-header input,
   .panel-header select {
     cursor: pointer;
   }

   .header-left {
     display: flex;
     align-items: flex-start;
     gap: 10px;
     flex: 1 1 auto;
     min-width: 0;
   }

   .header-right {
     display: flex;
     flex-direction: column;
     align-items: flex-end;
     gap: 6px;
     flex: 0 0 auto;
   }

   .header-actions {
     display: flex;
     gap: 2px;
     flex: 0 0 auto;
   }

   /* ============================================================
      SEGMENT-CONTROL (Karaoke/Text)
      ============================================================ */
   .header-segmented {
     margin: 0;
     padding: 2px;
     background: var(--bg-secondary);
     border: 1px solid var(--border-subtle);
     border-radius: 8px;
     display: flex;
     gap: 2px;
   }

   .header-segmented .seg-btn {
     font-size: 10.5px;
     padding: 3px 8px;
     border-radius: 6px;
     font-weight: 600;
     border: none;
     background: transparent;
     color: var(--text-secondary);
     cursor: pointer;
     transition: background var(--transition-fast), color var(--transition-fast);
   }

   .header-segmented .seg-btn:hover { color: var(--text-primary); }
   .header-segmented .seg-btn.active {
     background: var(--accent-soft);
     color: var(--accent);
   }

   /* ============================================================
      HEADER-INHALT
      ============================================================ */
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

   .header-text { flex: 1 1 auto; min-width: 0; }

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
     transition: background var(--transition-fast), color var(--transition-fast),
       transform var(--transition-fast);
   }

   .icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
   .icon-btn:active { transform: scale(0.92); }
   .icon-btn.active { background: var(--bg-active); color: var(--text-primary); }

   a.icon-btn { text-decoration: none; }

   .ug-logo {
     font-size: 10px;
     font-weight: 800;
     letter-spacing: 0.05em;
     line-height: 1;
   }

   /* ============================================================
      DRAWER (Editor + Settings)
      ============================================================ */
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

   #editor .drawer-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }

   .field { display: grid; gap: 5px; }

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
     transition: border-color var(--transition-fast), background var(--transition-fast);
   }

   #editor input::placeholder { color: var(--text-muted); }
   #editor input:focus { outline: none; border-color: var(--accent); }

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
     transition: background var(--transition-fast), transform var(--transition-fast);
   }

   #editor button:hover { background: var(--bg-hover); }
   #editor button:active { transform: scale(0.97); }

   #settings { display: grid; gap: 10px; }
   #settings .drawer-title { margin-bottom: 0; }

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

   #settings select:hover { border-color: var(--border-strong); }

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
     transition: background var(--transition-fast), color var(--transition-fast);
   }

   #settings button:hover { background: var(--bg-hover); color: var(--text-primary); }

   .setting-row.actions { gap: 6px; }
   .setting-row.actions button { flex: 1; }

   #font-value {
     min-width: 38px;
     text-align: center;
     font-variant-numeric: tabular-nums;
     color: var(--text-primary);
     font-size: 12px;
   }

   /* ============================================================
      SEGMENT-CONTROL — Settings-Variante
      ============================================================ */
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
     transition: background var(--transition-fast), color var(--transition-fast);
   }

   #settings .seg-btn:hover { color: var(--text-primary); }
   #settings .seg-btn.active { background: var(--accent-soft); color: var(--accent); }

   /* ============================================================
      STATUS
      ============================================================ */
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

   /* ============================================================
      LYRICS-CONTAINER
      ============================================================ */
   #lyrics {
     flex: 1;
     min-height: 0;
     overflow-y: auto;
     overscroll-behavior: contain;
     padding: 4px 6px 12px 2px;
     scrollbar-width: thin;
     scrollbar-color: var(--bg-active) transparent;
   }

   #lyrics::-webkit-scrollbar { width: 6px; }
   #lyrics::-webkit-scrollbar-track { background: transparent; }
   #lyrics::-webkit-scrollbar-thumb { background: var(--bg-active); border-radius: 999px; }
   #lyrics::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

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

   /* ==========================================================
      Lyrics-Zeilen
      ========================================================== */
   .line {
     margin: 2px 0;
     padding: 9px 12px;
     border-radius: var(--radius-md);
     color: var(--text-muted);
     background-color: transparent;
     opacity: 0.42;
     font-size: var(--lyrics-font-size, 17px);
     font-weight: 400;
     line-height: 1.6;
     cursor: pointer;
     border-left: 3px solid transparent;
     transition: opacity 100ms ease, color 100ms ease,
                 background-color 100ms ease, border-color 100ms ease,
                 font-weight 100ms ease;
   }

   .line:hover {
     opacity: 0.75;
     color: var(--text-secondary);
   }

   .line.past {
     opacity: 0.32;
     color: var(--text-muted);
   }

   .line.active {
     opacity: 1;
     color: var(--text-primary);
     font-weight: 700;
     background-color: var(--accent-soft);
     border-left-color: var(--accent);
     will-change: opacity, color, background-color;
   }

   /* ============================================================
      CONTROLS-BAR (Offset + Autoscroll)
      ============================================================ */
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
     transition: background var(--transition-fast), color var(--transition-fast);
   }

   .timing-group button:hover { background: var(--bg-hover); color: var(--text-primary); }
   .timing-group button:active { transform: scale(0.95); }

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
     transition: background var(--transition-fast), color var(--transition-fast);
   }

   #offset-value.nonzero { background: var(--accent-soft); color: var(--accent); }

   #offset-reset {
     margin-left: 4px;
     padding-left: 8px;
     border-left: 1px solid var(--border-subtle);
     border-radius: 8px;
     display: inline-flex;
     align-items: center;
   }

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
     transition: transform var(--transition-fast), background var(--transition-fast);
   }

   .autoscroll input:checked + .switch { background: var(--accent); }

   .autoscroll input:checked + .switch::after {
     transform: translateX(14px);
     background: #fff;
   }

   /* ============================================================
      FOOTER
      ============================================================ */
   .footer {
     display: flex;
     align-items: center;
     flex-wrap: wrap;
     gap: 6px 12px;
     margin-top: 8px;
     padding-top: 8px;
     border-top: 1px solid var(--border-subtle);
     font-size: 10.5px;
     color: var(--text-muted);
     user-select: none;
     position: relative;
   }

   .footer-credit {
     min-width: 0;
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }

   .footer-links { display: flex; gap: 6px; margin-left: auto; }

   .ext-btn {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     width: 38px;
     height: 28px;
     border-radius: var(--radius-sm);
     background: var(--bg-surface);
     border: 1px solid var(--border-subtle);
     color: var(--text-secondary);
     text-decoration: none;
     cursor: pointer;
     transition: background var(--transition-fast), color var(--transition-fast),
       border-color var(--transition-fast);
   }

   .ext-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-strong); }
   .ext-btn svg { width: 14px; height: 14px; }

   /* ============================================================
      TOAST (Bestätigung für Copy)
      ============================================================ */
   .toast {
     position: absolute;
     left: 50%;
     bottom: 56px;
     transform: translateX(-50%) translateY(6px);
     display: inline-flex;
     align-items: center;
     gap: 6px;
     padding: 8px 14px;
     border-radius: 999px;
     background: var(--success-soft);
     border: 1px solid rgba(74, 222, 128, 0.35);
     color: var(--success);
     font-size: 12px;
     font-weight: 600;
     letter-spacing: 0.01em;
     pointer-events: none;
     opacity: 0;
     transition: opacity 200ms ease, transform 200ms ease;
     z-index: 10;
     -webkit-backdrop-filter: blur(8px);
     backdrop-filter: blur(8px);
   }

   .toast.show {
     opacity: 1;
     transform: translateX(-50%) translateY(0);
   }

   .toast svg {
     width: 14px;
     height: 14px;
   }

   /* ============================================================
      EMPTY STATE
      ============================================================ */
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

   .empty-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }

   .empty-text {
     font-size: 12.5px;
     line-height: 1.5;
     color: var(--text-secondary);
     max-width: 260px;
   }

   /* ============================================================
      SKELETON (Loading)
      ============================================================ */
   .skeleton { display: grid; gap: 12px; padding: 6px 2px; }

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
     0% { background-position: 190% 0; }
     100% { background-position: -90% 0; }
   }

   /* ============================================================
      LIGHT-THEME
      ============================================================ */
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
     --success: #16a34a;
     --success-soft: rgba(22, 163, 74, 0.14);

     --shadow-panel: 0 24px 64px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.10);
   }

   /* ============================================================
      RESPONSIVE
      ============================================================ */
   @media (max-width: 640px) {
     #panel { width: calc(100vw - 20px); max-height: min(72vh, 640px); padding: 12px 12px 8px; }
     #toggle { width: 40px; height: 40px; border-radius: 12px; }
     .controls-bar { flex-wrap: wrap; }
   }

   @media (prefers-reduced-motion: reduce) {
     * { animation: none !important; transition: none !important; }
   }
   `;

   const ICONS = {
     mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
     reload: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
     search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
     settings: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
     close: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
     reset: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
     apple: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
     print: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
     copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
     check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
     noMusic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
   };

   const html = `
     <style>${css}</style>

     <button id="toggle" title="Songtext anzeigen (⌘⇧L)" aria-label="Songtext anzeigen">${ICONS.mic}</button>

     <section id="panel" hidden aria-label="Songtext">
       <header class="panel-header">
         <div class="header-left">
           <img id="track-art" class="track-art" alt="" hidden />
           <div class="header-text">
             <h2 id="track-title">Lyrics</h2>
             <p id="track-meta" class="meta"></p>
           </div>
         </div>

         <div class="header-right">
           <div class="header-actions">
             <button id="reload" class="icon-btn" title="Neu laden" aria-label="Lyrics neu laden">${ICONS.reload}</button>
             <button id="edit" class="icon-btn" title="Suche" aria-label="Manuelle Suche">${ICONS.search}</button>
             <button id="settings-btn" class="icon-btn" title="Einstellungen" aria-label="Einstellungen">${ICONS.settings}</button>
             <button id="close" class="icon-btn" title="Schließen" aria-label="Schließen">${ICONS.close}</button>
           </div>
           <div class="segmented header-segmented" role="radiogroup" aria-label="Lyrics-Modus">
             <button id="header-mode-karaoke" class="seg-btn" role="radio" aria-checked="true" title="Karaoke-Modus">Karaoke</button>
             <button id="header-mode-text" class="seg-btn" role="radio" aria-checked="false" title="Text-Modus">Text</button>
           </div>
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
         <span class="footer-credit">Lyrics: LRCLIB · lyrics.ovh</span>
         <div id="ext-section" class="footer-links" role="group" aria-label="Externe Links" hidden>
           <a id="ug-link" class="ext-btn" href="#" target="_blank" rel="noopener noreferrer" hidden title="Tab auf Ultimate Guitar öffnen" aria-label="Tab auf Ultimate Guitar öffnen"><span class="ug-logo">UG</span></a>
           <a id="am-link" class="ext-btn" href="#" target="_blank" rel="noopener noreferrer" hidden title="Auf Apple Music öffnen" aria-label="Auf Apple Music öffnen">${ICONS.apple}</a>
           <button id="copy-btn" class="ext-btn" title="Songtext kopieren" aria-label="Songtext kopieren" hidden>${ICONS.copy}</button>
           <button id="print-btn" class="ext-btn" title="Songtext drucken" aria-label="Songtext drucken" hidden>${ICONS.print}</button>
         </div>

         <div id="toast" class="toast" role="status" aria-live="polite" aria-hidden="true">
           ${ICONS.check}
           <span id="toast-text">Lyrics kopiert</span>
         </div>
       </footer>
     </section>
   `;

   Y.template = { css, ICONS, html };
 })();
