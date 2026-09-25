 (() => {
    const Y = (globalThis.YTLY ??= {});

    const css = `
    :host {
      all: initial;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;

      --bg-primary: rgba(10, 12, 16, 0.94); 
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
      --spotify: #1db954;

      --tooltip-bg: rgba(28, 32, 40, 0.96);
      --tooltip-text: rgba(255, 255, 255, 0.94);
      --tooltip-border: rgba(255, 255, 255, 0.10);

      --shadow-panel: 0 32px 80px rgba(0, 0, 0, 0.65), 0 8px 24px rgba(0, 0, 0, 0.4);
      --shadow-overlay: 0 16px 40px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3);

      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 18px;

      --transition-fast: 140ms cubic-bezier(0.2, 0.8, 0.4, 1);
      --transition-normal: 220ms cubic-bezier(0.2, 0.8, 0.4, 1);

      --popover-duration: 260ms;
      --popover-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button, input, select { font: inherit; }
    button { color: inherit; }

    #toggle:focus-visible,
    #panel button:focus-visible,
    #panel a:focus-visible,
    #panel input:focus-visible,
    #panel select:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* ============================================================
       TOGGLE BUTTON
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
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      backdrop-filter: blur(12px) saturate(140%);
      color: var(--text-primary);
      cursor: grab;
      touch-action: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      transition: transform var(--transition-fast), background var(--transition-fast),
        border-color var(--transition-fast), opacity 180ms ease,
        visibility 180ms ease;
    }

    #toggle.is-hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: scale(0.8);
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
      contain: layout;
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      padding: 14px 14px 10px;
      color: var(--text-primary);
      box-shadow: var(--shadow-panel), 0 8px 24px rgba(110, 168, 255, 0.06);
      will-change: transform, opacity;
      transform-origin: 0 0;
    }
    
    #panel::before {
      content: "";
      position: absolute;
      top: 0;
      left: 10%;
      right: 10%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
      border-radius: 999px;
      pointer-events: none;
      z-index: 10;
    }

    #panel.theme-light::before {
      background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.2), transparent);
    }

    #panel[hidden] {
      display: flex !important;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    /* ============================================================
       DRAGGING STATE — Chrome speedups (no content hiding)
       ============================================================ */

    /* During drag: disable backdrop-filter (huge Chrome speedup) */
    #panel.dragging {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      background: rgba(15, 18, 23, 0.96);
      will-change: transform;
      transition: none;
      box-shadow: var(--shadow-panel), 0 8px 32px rgba(110, 168, 255, 0.15);
    }

    #panel.theme-light.dragging {
      background: rgba(252, 252, 254, 0.98);
    }

    /* ============================================================
       POPOVER ANIMATIONS
       ============================================================ */
    #panel.popover-opening {
      animation: ytly-popover-in var(--popover-duration) var(--popover-easing) forwards;
    }

    #panel.popover-closing {
      animation: ytly-popover-out var(--popover-duration) var(--popover-easing) forwards;
    }

    @keyframes ytly-popover-in {
      0% {
        opacity: 0;
        transform: scale(0.15);
      }
      60% {
        opacity: 1;
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes ytly-popover-out {
      0% {
        opacity: 1;
        transform: scale(1);
      }
      40% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: scale(0.15);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #panel.popover-opening,
      #panel.popover-closing {
        animation: none !important;
      }
    }

    /* ============================================================
       HEADER
       ============================================================ */
    .panel-header {
      display: flex;
      align-items: stretch;
      gap: 12px;
      padding: 4px 2px 12px;
      margin-bottom: 10px;
      border-bottom: 1px solid var(--border-subtle);
      cursor: grab;
      user-select: none;
      touch-action: none;
    }

    .panel-header.dragging { cursor: grabbing; }

    .panel-header button,
    .panel-header a,
    .panel-header input,
    .panel-header select {
      cursor: pointer;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
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

    .track-art {
      width: 52px;
      height: 52px;
      border-radius: 10px;
      object-fit: cover;
      flex: 0 0 auto;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
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
      transition: background var(--transition-fast), color var(--transition-fast),
        transform var(--transition-fast);
    }

    .icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .icon-btn:active { transform: scale(0.92); }
    .icon-btn.active { background: var(--bg-active); color: var(--text-primary); }

    a.icon-btn { text-decoration: none; }

    /* ============================================================
       DRAWER (Editor + Settings) — overlay
       ============================================================ */
    .drawer {
      position: absolute;
      top: 72px;
      left: 12px;
      right: 12px;
      z-index: 30;
      background: rgba(20, 24, 30, 0.96);
      -webkit-backdrop-filter: blur(28px) saturate(160%);
      backdrop-filter: blur(28px) saturate(160%);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 14px;
      box-shadow: var(--shadow-overlay);
      animation: ytly-drawer-in 180ms cubic-bezier(0.2, 0.8, 0.4, 1);
    }

    #panel.theme-light .drawer {
      background: rgba(252, 252, 254, 0.98);
    }

    @keyframes ytly-drawer-in {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .drawer-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 12px;
      user-select: none;
      width: 100%;
    }

    .drawer-close {
      width: 22px;
      height: 22px;
      min-width: 22px;
      max-width: 22px;
      flex: 0 0 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .drawer-close:hover { background: var(--bg-hover); color: var(--text-primary); }
    .drawer-close svg { width: 13px; height: 13px; }

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

    #editor .drawer-grid button {
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

    #editor .drawer-grid button:hover { background: var(--bg-hover); }
    #editor .drawer-grid button:active { transform: scale(0.97); }

    #settings { display: flex; flex-direction: column; gap: 4px; }

    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 0 12px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 10px;
    }

    .settings-section:last-of-type {
      border-bottom: none;
      margin-bottom: 4px;
    }

    .settings-section-title {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-secondary);
      opacity: 1;
      user-select: none;
    }

    .setting-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-secondary);
      font-size: 13px;
      user-select: none;
      min-height: 28px;
    }

    .setting-row .setting-label {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .setting-row .setting-label .title {
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
    }

    .setting-row .setting-label .hint {
      color: var(--text-muted);
      font-size: 10.5px;
      line-height: 1.3;
    }

    .switch-toggle {
      position: relative;
      width: 36px;
      height: 22px;
      border-radius: 999px;
      background: var(--bg-active);
      cursor: pointer;
      flex: 0 0 auto;
      transition: background var(--transition-fast);
      border: none;
      padding: 0;
    }

    .switch-toggle::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      transition: transform var(--transition-fast);
    }

    .switch-toggle[aria-checked="true"] { background: var(--accent); }
    .switch-toggle[aria-checked="true"]::after { transform: translateX(14px); }

    #settings select {
      appearance: none;
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: border-color var(--transition-fast);
      flex: 0 0 auto;
    }

    #settings select:hover { border-color: var(--border-strong); }

    .font-size-control {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
    }

    .font-size-control button {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      color: var(--text-secondary);
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .font-size-control button:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    #font-value {
      min-width: 34px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 600;
    }

    .settings-reset {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 9px 12px;
      border: 1px solid var(--border-subtle);
      background: transparent;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 6px;
      transition: background var(--transition-fast), color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .settings-reset:hover {
      background: var(--danger-soft);
      color: var(--danger);
      border-color: transparent;
    }

    .settings-reset svg { width: 13px; height: 13px; }

    #status {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 2px 10px;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 12.5px;
      line-height: 1.5;
    }

    #status-text {
      flex: 1 1 auto;
      min-width: 0;
    }

    .status-close {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
      margin-top: 1px;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .status-close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .status-close svg {
      width: 12px;
      height: 12px;
    }

    #status.error {
      background: var(--danger-soft);
      border-color: transparent;
      color: var(--danger);
    }

    #status.error .status-close {
      color: var(--danger);
    }

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
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }

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
      animation: ytly-line-in 220ms ease backwards;
    }

    @keyframes ytly-line-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 0.42;
        transform: translateY(0);
      }
    }

    .line:hover { opacity: 0.75; color: var(--text-secondary); }
    .line.past { opacity: 0.32; color: var(--text-muted); }

    .line.active {
      opacity: 1;
      color: var(--text-primary);
      font-weight: 700;
      background-color: var(--accent-soft);
      border-left-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(110, 168, 255, 0.15);
    }

    .controls-bar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding-top: 10px;
      margin-top: 10px;
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }

    .ctrl-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .ctrl-group .ctrl-label {
      font-size: 8px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
      opacity: 0.9;
      padding: 0 2px;
      user-select: none;
      line-height: 1;
    }

    .group-sep {
      width: 1px;
      height: 24px;
      background: var(--border-subtle);
      flex: 0 0 auto;
      margin: 20px 4px 0;
      align-self: flex-start;
      opacity: 0.6;
    }

    .timing-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      transition: border-color var(--transition-fast), background var(--transition-fast),
        box-shadow var(--transition-normal);
    }

    .timing-pill.has-offset {
      border-color: rgba(110, 168, 255, 0.45);
      background: var(--accent-soft);
      box-shadow: 0 0 0 3px rgba(110, 168, 255, 0.08);
    }

    #panel.theme-light .timing-pill.has-offset {
      border-color: rgba(47, 111, 237, 0.45);
      box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.08);
    }

    .pill-btn {
      position: relative;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      border-radius: 999px;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast),
        transform var(--transition-fast);
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }

    .pill-btn::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: var(--accent-soft);
      transform: scaleX(0);
      transform-origin: center center;
      pointer-events: none;
    }

    .pill-btn.pressing::before {
      transform: scaleX(1);
      transition: transform 400ms linear;
    }

    .pill-btn svg { position: relative; z-index: 1; }
    .pill-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .pill-btn:active { transform: scale(0.9); }
    .pill-btn.holding { background: var(--accent-soft); color: var(--accent); }

    #offset-value {
      min-width: 52px;
      height: 26px;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
      border-radius: 999px;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
      -webkit-tap-highlight-color: transparent;
    }

    #offset-value:hover { background: var(--bg-hover); }
    #offset-value.has-offset { color: var(--accent); }

    .has-tooltip { position: relative; }

    .has-tooltip .tooltip {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(2px);
      background: var(--tooltip-bg);
      color: var(--tooltip-text);
      border: 1px solid var(--tooltip-border);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.35;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 140ms ease, transform 140ms ease, visibility 140ms;
      z-index: 100;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      letter-spacing: 0.005em;
    }

    .has-tooltip .tooltip::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: var(--tooltip-bg);
      margin-top: -1px;
    }

    .has-tooltip:hover .tooltip,
    .has-tooltip:focus-visible .tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    .has-tooltip.tooltip-end .tooltip {
      left: auto;
      right: 0;
      transform: translateX(0) translateY(2px);
    }
    .has-tooltip.tooltip-end:hover .tooltip,
    .has-tooltip.tooltip-end:focus-visible .tooltip {
      transform: translateX(0) translateY(0);
    }
    .has-tooltip.tooltip-end .tooltip::after {
      left: auto;
      right: 14px;
      transform: translateX(0);
    }

    .ext-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      text-decoration: none;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast),
        border-color var(--transition-fast), transform var(--transition-fast);
    }

    .ext-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--border-strong);
    }

    .ext-btn:active { transform: scale(0.94); }
    .ext-btn svg { width: 15px; height: 15px; }

    .ug-logo {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1;
    }

    .ext-btn.spotify-btn:hover {
      color: var(--spotify);
      border-color: var(--spotify);
      background: rgba(29, 185, 84, 0.12);
    }

    .btn-group { display: inline-flex; gap: 5px; align-items: center; }

    .source-line {
      font-size: 9.5px;
      color: var(--text-muted);
      letter-spacing: 0.01em;
      padding-top: 8px;
      user-select: none;
    }

    .toast {
      position: absolute;
      left: 50%;
      bottom: 60px;
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

    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .toast svg { width: 14px; height: 14px; }

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

    #panel.theme-light {
      --bg-primary: rgba(252, 252, 254, 0.92);
      --bg-secondary: rgba(0, 0, 0, 0.03);
      --bg-surface: rgba(0, 0, 0, 0.05);
      --bg-hover: rgba(0, 0, 0, 0.08);
      --bg-active: rgba(0, 0, 0, 0.12);

     --text-primary: rgba(10, 12, 16, 1);
     --text-secondary: rgba(10, 12, 16, 0.82);
     --text-muted: rgba(10, 12, 16, 0.60);    

      --border-subtle: rgba(0, 0, 0, 0.07);
      --border-strong: rgba(0, 0, 0, 0.12);

      --accent: #2f6fed;
      --accent-soft: rgba(47, 111, 237, 0.12);
      --danger: #d33131;
      --danger-soft: rgba(211, 49, 49, 0.10);
      --success: #16a34a;
      --success-soft: rgba(22, 163, 74, 0.14);
      --spotify: #15803d;

      --tooltip-bg: rgba(255, 255, 255, 0.98);
      --tooltip-text: rgba(10, 12, 16, 1);
      --tooltip-border: rgba(0, 0, 0, 0.08);

      --shadow-panel: 0 24px 64px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.10);
    }

    #panel.theme-light .has-tooltip .tooltip {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    @media (max-width: 640px) {
      #panel { width: calc(100vw - 20px); max-height: min(72vh, 640px); padding: 12px 12px 8px; }
      #toggle { width: 40px; height: 40px; border-radius: 12px; }
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
      apple: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
      spotify: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
      print: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
      copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
      noMusic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
      minus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    };

    const html = `
      <style>${css}</style>

      <button id="toggle" class="has-tooltip" title="Show lyrics (⌘⇧L)" aria-label="Show lyrics">
        ${ICONS.mic}
        <span class="tooltip" role="tooltip">Show lyrics (⌘⇧L)</span>
      </button>

      <section id="panel" hidden aria-label="Lyrics">
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
              <button id="reload" class="icon-btn has-tooltip tooltip-end" title="Reload" aria-label="Reload lyrics">
                ${ICONS.reload}
                <span class="tooltip" role="tooltip">Reload</span>
              </button>
              <button id="edit" class="icon-btn has-tooltip tooltip-end" title="Search" aria-label="Search for a different song">
                ${ICONS.search}
                <span class="tooltip" role="tooltip">Search for a different song</span>
              </button>
              <button id="settings-btn" class="icon-btn has-tooltip tooltip-end" title="Settings" aria-label="Settings">
                ${ICONS.settings}
                <span class="tooltip" role="tooltip">Settings</span>
              </button>
              <button id="close" class="icon-btn has-tooltip tooltip-end" title="Close" aria-label="Close">
                ${ICONS.close}
                <span class="tooltip" role="tooltip">Close</span>
              </button>
            </div>
            <div class="segmented header-segmented" role="radiogroup" aria-label="Lyrics mode">
            <button id="header-mode-karaoke" class="seg-btn" role="radio" aria-checked="true" title="Sing along mode">Sing Along</button>
            <button id="header-mode-text" class="seg-btn" role="radio" aria-checked="false" title="Full lyrics mode">Full Lyrics</button>
            </div>
          </div>
        </header>

        <div id="editor" class="drawer" hidden>
          <div class="drawer-title">
            Search song
            <button id="editor-close" class="drawer-close" type="button" aria-label="Close search">${ICONS.close}</button>
          </div>
          <div class="drawer-grid">
            <label class="field">
              <span class="field-label">Artist</span>
              <input id="artist-input" placeholder="e.g. Taylor Swift" aria-label="Artist" />
            </label>
            <label class="field">
              <span class="field-label">Title</span>
              <input id="title-input" placeholder="e.g. Hey Stephen" aria-label="Title" />
            </label>
            <button id="search">Search</button>
          </div>
        </div>

        <div id="settings" class="drawer" hidden>
          <div class="drawer-title">
            Settings
            <button id="settings-close" class="drawer-close" type="button" aria-label="Close settings">${ICONS.close}</button>
          </div>

          <div class="settings-section">
            <div class="settings-section-title">Behavior</div>
            <div class="setting-row">
              <div class="setting-label">
                <span class="title">Auto-scroll</span>
                <span class="hint">Keep the active line centered</span>
              </div>
              <button id="setting-autoscroll" class="switch-toggle" role="switch" aria-checked="true" aria-label="Auto-scroll"></button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section-title">Appearance</div>
            <div class="setting-row">
              <div class="setting-label">
                <span class="title">Theme</span>
              </div>
              <select id="setting-theme" aria-label="Theme">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-label">
                <span class="title">Font size</span>
              </div>
              <div class="font-size-control">
                <button id="font-minus" type="button" title="Decrease font size" aria-label="Decrease font size">A−</button>
                <span id="font-value">17px</span>
                <button id="font-plus" type="button" title="Increase font size" aria-label="Increase font size">A+</button>
              </div>
            </div>
          </div>

          <button id="settings-reset" class="settings-reset" type="button">
            ${ICONS.trash}
            <span>Reset all settings</span>
          </button>
        </div>

        <div id="status" hidden role="status" aria-live="polite">
          <span id="status-text"></span>
          <button id="status-close" class="status-close" type="button" aria-label="Dismiss">${ICONS.close}</button>
        </div>

        <div id="lyrics"></div>

        <div id="offset-row" class="controls-bar" hidden>
          <div class="ctrl-group" id="group-timing">
            <div class="ctrl-label">Timing</div>
            <div id="timing-pill" class="timing-pill" role="group" aria-label="Adjust timing">
              <button id="offset-minus" class="pill-btn has-tooltip" title="0.5s earlier" aria-label="Earlier">
                ${ICONS.minus}
                <span class="tooltip" role="tooltip">0.5s earlier</span>
              </button>
              <button id="offset-value" class="has-tooltip" title="Reset" aria-label="Reset timing">
                0,0s
                <span class="tooltip" role="tooltip">Reset</span>
              </button>
              <button id="offset-plus" class="pill-btn has-tooltip" title="0.5s later" aria-label="Later">
                ${ICONS.plus}
                <span class="tooltip" role="tooltip">0.5s later</span>
              </button>
            </div>
          </div>

          <div class="group-sep" id="sep-0" aria-hidden="true"></div>

          <div class="ctrl-group" id="group-listen" hidden>
            <div class="ctrl-label">Listen</div>
            <div class="btn-group">
              <a id="am-link" class="ext-btn has-tooltip" href="#" target="_blank" rel="noopener noreferrer" title="Open in Apple Music" aria-label="Open in Apple Music">
                ${ICONS.apple}
                <span class="tooltip" role="tooltip">Open in Apple Music</span>
              </a>
              <a id="sp-link" class="ext-btn spotify-btn has-tooltip" href="#" target="_blank" rel="noopener noreferrer" title="Open in Spotify" aria-label="Open in Spotify">
                ${ICONS.spotify}
                <span class="tooltip" role="tooltip">Open in Spotify</span>
              </a>
            </div>
          </div>

          <div class="group-sep" id="sep-1" aria-hidden="true" hidden></div>

          <div class="ctrl-group" id="group-tabs" hidden>
            <div class="ctrl-label">Tabs</div>
            <a id="ug-link" class="ext-btn has-tooltip" href="#" target="_blank" rel="noopener noreferrer" title="Open guitar tabs on Ultimate Guitar" aria-label="Open guitar tabs on Ultimate Guitar">
              <span class="ug-logo">UG</span>
              <span class="tooltip" role="tooltip">Open guitar tabs</span>
            </a>
          </div>

          <div class="group-sep" id="sep-2" aria-hidden="true" hidden></div>

          <div class="ctrl-group" id="group-actions" hidden>
            <div class="ctrl-label">Actions</div>
            <div class="btn-group">
              <button id="copy-btn" class="ext-btn has-tooltip" title="Copy lyrics" aria-label="Copy lyrics">
                ${ICONS.copy}
                <span class="tooltip" role="tooltip">Copy lyrics</span>
              </button>
              <button id="print-btn" class="ext-btn has-tooltip" title="Print lyrics" aria-label="Print lyrics">
                ${ICONS.print}
                <span class="tooltip" role="tooltip">Print lyrics</span>
              </button>
            </div>
          </div>
        </div>

        <div class="source-line">Source: LRCLIB · lyrics.ovh</div>

        <div id="toast" class="toast" role="status" aria-live="polite" aria-hidden="true">
          ${ICONS.check}
          <span id="toast-text">Lyrics copied</span>
        </div>
      </section>
    `;

    Y.template = { css, ICONS, html };
  })();
