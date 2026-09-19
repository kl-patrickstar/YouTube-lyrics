// ============================================================
//  GLOBALE KONSTANTEN (nur EINMAL deklariert!)
// ============================================================
const browserAPI = globalThis.browser || globalThis.chrome;
const runtime = browserAPI?.runtime;
const storage = browserAPI?.storage;
const tabs = browserAPI?.tabs;
const commands = browserAPI?.commands;

const FETCH_TIMEOUT_MS = 12000;

// ============================================================
//  INSTALL-HOOK
// ============================================================
if (runtime?.onInstalled) {
  runtime.onInstalled.addListener((details) => {
    console.log("YouTube Lyrics installiert/aktualisiert:", details?.reason);
  });
}

// ============================================================
//  MESSAGE-HANDLER
// ============================================================
runtime?.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  // --------------------------------------------------------
  //  STORAGE GET
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
    return true;
  }

  // --------------------------------------------------------
  //  STORAGE SET
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
  //  JSON-FETCH-PROXY
  // --------------------------------------------------------
  if (message.type === "fetch-json" && message.url) {
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
        const text = await response.text();

        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
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
          error: isAbort ? "Request-Timeout" : String(error),
        });
      });

    return true;
  }

  return false;
});

// ============================================================
//  SHORTCUT (⌘⇧L / Ctrl+Shift+L)
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
        console.warn("toggle-panel: sendMessage fehlgeschlagen:", err);
      }
    } catch (error) {
      console.warn("Command toggle-panel fehlgeschlagen:", error);
    }
  });
}
