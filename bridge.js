 (() => {
   const Y = (globalThis.YTLY ??= {});

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

   Y.bridge = {
     sendMessageAsync,
     fetchJson,
     fetchJsonDirect,
     getFromCache,
     saveToCache,
   };
 })();
