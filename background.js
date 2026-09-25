// ============================================================
//  background.js
//  Service worker for the YouTube Lyrics extension.
//
//  Runs in the background (no DOM access, no window), and its
//  main jobs are:
//
//    1. Proxy HTTP requests that content scripts can't make
//       directly (CORS workaround) — see "fetch-json" below.
//    2. Bridge storage calls to chrome.storage.local, since
//       storage isn't directly accessible from content scripts
//       in all browsers.
//    3. Handle the ⌘⇧L / Ctrl+Shift+L keyboard shortcut and
//       forward it to the active YouTube tab.
//
//  Message protocol (from content script → background):
//    { type: "storage-get",  key }         → returns stored value
//    { type: "storage-set",  key, value }  → returns true
//    { type: "fetch-json",   url, headers }→ returns { ok, status, data }
//
//  All handlers return `true` to keep the response channel open
//  for async replies (required by the WebExtension API).
// ============================================================

// ============================================================
//  GLOBAL CONSTANTS (declared ONCE!)
//  Cross-browser API access: Safari uses browser.*, Chrome uses
//  chrome.*. We prefer browser.* when available because it is
//  Promise-based; the Chrome fallback is handled per-call.
// ============================================================
const browserAPI = globalThis.browser || globalThis.chrome;
const runtime = browserAPI?.runtime;
const storage = browserAPI?.storage;
const tabs = browserAPI?.tabs;
const commands = browserAPI?.commands;

// Abort a fetch if it takes longer than 12 seconds.
// Prevents the extension from hanging on slow/unreachable APIs.
const FETCH_TIMEOUT_MS = 12000;

// ============================================================
//  INSTALL HOOK
//  Fires once when the extension is installed or updated.
//  Used here only for logging — no setup tasks required.
// ============================================================
if (runtime?.onInstalled) {
  runtime.onInstalled.addListener((details) => {
    console.log("YouTube Lyrics installed/updated:", details?.reason);
  });
}

// ============================================================
//  MESSAGE HANDLER
//  Single entry point for all messages from content scripts.
//  Each branch is identified by `message.type`.
// ============================================================
runtime?.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  // --------------------------------------------------------
  //  STORAGE GET
  //  Reads a single key from chrome.storage.local.
  //  Returns null when the key doesn't exist.
  // --------------------------------------------------------
  if (message.type === "storage-get") {
    storage.local
      .get(message.key)
      .then((result) => {
        sendResponse(result?.[message.key] ?? null);
      })
      .catch((error) => {
        sendResponse({ error: String(error) });
      });
    return true; // keep channel open for async reply
  }

  // --------------------------------------------------------
  //  STORAGE SET
  //  Writes a single key to chrome.storage.local.
  //  Returns true on success, { error } on failure.
  // --------------------------------------------------------
  if (message.type === "storage-set") {
    storage.local
      .set({ [message.key]: message.value })
      .then(() => {
        sendResponse(true);
      })
      .catch((error) => {
        sendResponse({ error: String(error) });
      });
    return true;
  }

  // --------------------------------------------------------
  //  JSON FETCH PROXY
  //  Performs an HTTP GET on behalf of the content script.
  //  Why: content scripts can't make cross-origin requests to
  //  most APIs (CORS), but the service worker can — because
  //  manifest.json declares host_permissions for those hosts.
  //
  //  Request body (from content script):
  //    { type: "fetch-json", url, headers? }
  //
  //  Response shape:
  //    { ok: boolean, status: number, data: any, error?: string }
  // --------------------------------------------------------
  if (message.type === "fetch-json" && message.url) {
    // Abort the request after FETCH_TIMEOUT_MS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(message.url, {
      headers: {
        Accept: "application/json",
        ...(message.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timeoutId);

        // Read as text first so we can handle both JSON and
        // non-JSON responses (some APIs return plain text or HTML
        // error pages with a 200 status).
        const text = await response.text();

        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          // Not JSON — pass the raw text through.
          data = text;
        }

        sendResponse({ ok: response.ok, status: response.status, data });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const isAbort = error?.name === "AbortError";
        sendResponse({
          ok: false,
          status: 0,
          error: isAbort ? "Request timeout" : String(error),
        });
      });

    return true;
  }

  // Unknown message type — nothing to do.
  return false;
});

// ============================================================
//  KEYBOARD SHORTCUT
//  Listens for the ⌘⇧L (macOS) / Ctrl+Shift+L (Win/Linux)
//  shortcut declared in manifest.json under "commands".
//
//  When fired:
//    1. Find the active tab
//    2. Skip if it's not a YouTube page
//    3. Forward a "toggle-panel" message to the content script
// ============================================================
if (commands?.onCommand) {
  commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-panel") return;

    try {
      const [tab] = await tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      if (!tab.url || !tab.url.includes("youtube.com")) return;

      try {
        await tabs.sendMessage(tab.id, { type: "toggle-panel" });
      } catch (err) {
        // Content script not yet injected on this tab — ignore.
        console.warn("toggle-panel: sendMessage failed:", err);
      }
    } catch (error) {
      console.warn("Command toggle-panel failed:", error);
    }
  });
}
