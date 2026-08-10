const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;

runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "fetch-json" || !message.url) {
    return false;
  }

  fetch(message.url, {
    headers: {
      Accept: "application/json",
      ...(message.headers || {})
    },
    cache: "no-store"
  })
    .then(async (response) => {
      const text = await response.text();

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      sendResponse({
        ok: response.ok,
        status: response.status,
        data
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        error: String(error)
      });
    });

  return true;
});
