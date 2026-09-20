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

      throw new Error("WebExtension runtime not available.");
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
          throw new Error("Empty response.");
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status ?? "error"}`);
        }

        return response.data;
      } catch (error) {
        console.warn("Background fetch failed, trying direct fetch:", error);
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
        console.warn("Cache save failed:", error);
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
