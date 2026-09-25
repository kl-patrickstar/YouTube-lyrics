// ============================================================
//  bridge.js
//  Communication bridge between the content script and the
//  background service worker.
//
//  Why this module exists:
//    Content scripts can't make cross-origin HTTP requests to
//    most APIs (CORS restrictions). The background service
//    worker CAN, because it has broader permissions declared
//    in manifest.json (host_permissions).
//
//  Strategy:
//    1. Try the background service worker (preferred, avoids CORS)
//    2. Fall back to a direct fetch from the content script
//       (works for some APIs that allow CORS)
//
//  Also handles persistent storage in chrome.storage.local,
//  which is only accessible from the background worker.
//
//  Exports (Y.bridge):
//    - sendMessageAsync() – low-level message to the background
//    - fetchJson()        – fetch with background fallback
//    - fetchJsonDirect()  – plain fetch (no background)
//    - getFromCache()     – read from chrome.storage.local
//    - saveToCache()      – write to chrome.storage.local
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  SEND MESSAGE (cross-browser)
   //  Sends a message to the background service worker and
   //  returns a Promise with the response.
   //
   //  Safari: browser.runtime.sendMessage is already Promise-based.
   //  Chrome: chrome.runtime.sendMessage uses callbacks, so we
   //          wrap it in a Promise. We also check chrome.runtime
   //          .lastError because Chrome silently swallows errors
   //          in callback-style message passing.
   // ============================================================
   async function sendMessageAsync(message) {
     // --- Safari path ---
     if (globalThis.browser?.runtime?.sendMessage) {
       return globalThis.browser.runtime.sendMessage(message);
     }

     // --- Chrome path (callback API wrapped in a Promise) ---
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

     throw new Error("WebExtension runtime not available.");
   }

   // ============================================================
   //  DIRECT FETCH
   //  Plain fetch from the content script — used as a fallback
   //  when the background worker fails. Only works for APIs
   //  that send permissive CORS headers.
   //
   //  `cache: "no-store"` avoids stale responses from the
   //  browser HTTP cache (important for lyrics that may change).
   // ============================================================
   async function fetchJsonDirect(url) {
     const response = await fetch(url, {
       cache: "no-store",
       headers: { Accept: "application/json" },
     });

     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }

     return response.json();
   }

   // ============================================================
   //  FETCH JSON (with background fallback)
   //  Preferred way to fetch JSON in this extension:
   //    1. Ask the background worker to do the fetch
   //    2. If that fails (network error, CORS, 5xx), try a direct
   //       fetch from the content script
   //
   //  The background worker returns:
   //    { ok: boolean, status: number, data: any, error?: string }
   // ============================================================
   async function fetchJson(url) {
     try {
       const response = await sendMessageAsync({
         type: "fetch-json",
         url,
       });

       if (!response) {
         throw new Error("Empty response.");
       }

       if (!response.ok) {
         throw new Error(`HTTP ${response.status ?? "error"}`);
       }

       return response.data;
     } catch (error) {
       // Background failed — try direct fetch as fallback
       console.warn("Background fetch failed, trying direct fetch:", error);
       return fetchJsonDirect(url);
     }
   }

   // ============================================================
   //  READ FROM CACHE
   //  Reads a value from chrome.storage.local via the background
   //  worker. Returns null if the key doesn't exist or the
   //  request fails (fail-safe, never throws).
   // ============================================================
   async function getFromCache(key) {
     try {
       return await sendMessageAsync({ type: "storage-get", key });
     } catch {
       return null;
     }
   }

   // ============================================================
   //  WRITE TO CACHE
   //  Stores a value in chrome.storage.local via the background
   //  worker. Failures are logged but ignored (fail-safe) so a
   //  storage issue never breaks the main flow.
   // ============================================================
   async function saveToCache(key, value) {
     try {
       await sendMessageAsync({ type: "storage-set", key, value });
     } catch (error) {
       console.warn("Cache save failed:", error);
     }
   }

   // ============================================================
   //  EXPORTS
   // ============================================================
   Y.bridge = {
     sendMessageAsync,
     fetchJson,
     fetchJsonDirect,
     getFromCache,
     saveToCache,
   };
 })();
