// ============================================================
//  api.js
//  All outbound HTTP requests for the extension.
//
//  Every request goes through Y.bridge.fetchJson(), which:
//    - uses the background service worker first (avoids CORS issues)
//    - falls back to a direct fetch if the service worker fails
//
//  Endpoints used:
//    - YouTube oEmbed     → video metadata (title, channel)
//    - LRCLIB             → synced lyrics (primary source)
//    - lyrics.ovh         → plain-text lyrics (fallback)
//    - iTunes Search      → album artwork
//
//  Exports (Y.api):
//    - fetchOEmbed()              – YouTube metadata
//    - fetchLrclib()              – synced lyrics from LRCLIB
//    - fetchLyricsOvh()           – plain-text fallback
//    - fetchLyricsWithVariants()  – tries multiple title variants
//    - fetchArtworkFromItunes()   – album cover
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  YOUTUBE OEMBED
   //  Fetches basic metadata (title, author_name) for a video ID.
   //  Much more reliable than scraping the YouTube DOM, and it
   //  works without any API key.
   // ============================================================
   async function fetchOEmbed(videoId) {
     const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
     const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
       watchUrl
     )}&format=json`;
     return Y.bridge.fetchJson(url);
   }

   // ============================================================
   //  LRCLIB
   //  Primary lyrics source. Queries three endpoints in parallel
   //  via Promise.any() — whichever responds first with usable
   //  lyrics wins.
   //
   //  Endpoints:
   //    1. /api/get         – exact match with artist+title+duration
   //                          (most accurate but strict)
   //    2. /api/search?q=   – free-text search
   //                          (loose match, catches typos)
   //    3. /api/search      – field-based search with artist_name
   //       ?artist_name=...   and track_name separately
   //       &track_name=...
   //
   //  Returns null if all three fail or no item has lyrics.
   // ============================================================
   async function fetchLrclib(artist, title, duration) {
     const urls = [];

     // 1. Exact lookup with duration (best match if it hits)
     const getUrl = new URL("https://lrclib.net/api/get");
     getUrl.searchParams.set("artist_name", artist);
     getUrl.searchParams.set("track_name", title);
     if (duration) {
       getUrl.searchParams.set("duration", String(Math.round(duration)));
     }
     urls.push(getUrl.toString());

     // 2. Free-text search
     const qSearchUrl = new URL("https://lrclib.net/api/search");
     qSearchUrl.searchParams.set("q", `${artist} ${title}`);
     urls.push(qSearchUrl.toString());

     // 3. Field-based search (artist and track separate)
     const fieldSearchUrl = new URL("https://lrclib.net/api/search");
     fieldSearchUrl.searchParams.set("artist_name", artist);
     fieldSearchUrl.searchParams.set("track_name", title);
     urls.push(fieldSearchUrl.toString());

     // Fire all three requests in parallel
     const attempts = urls.map(async (url) => {
       const data = await Y.bridge.fetchJson(url);
       const item = Y.lyrics.firstLyricItem(data);

       if (!item) {
         throw new Error("no-item");
       }

       return {
         artist: item.artistName || artist,
         title: item.trackName || title,
         plainLyrics: item.plainLyrics || "",
         syncedLyrics: item.syncedLyrics || "",
         trackDuration: item.duration || 0,
       };
     });

     try {
       // Promise.any resolves with the first successful result
       return await Promise.any(attempts);
     } catch {
       // All three failed → AggregateError → return null
       return null;
     }
   }

   // ============================================================
   //  LYRICS.OVH (FALLBACK)
   //  Simple plain-text lyrics endpoint. Only used when LRCLIB
   //  doesn't find anything. No timestamps, no sync.
   // ============================================================
   async function fetchLyricsOvh(artist, title) {
     const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(
       artist
     )}/${encodeURIComponent(title)}`;

     try {
       const data = await Y.bridge.fetchJson(url);

       if (data?.lyrics) {
         return {
           artist,
           title,
           plainLyrics: data.lyrics,
           syncedLyrics: "",
           trackDuration: 0,
         };
       }
     } catch {
       // Silent fail — caller will try the next variant
     }

     return null;
   }

   // ============================================================
   //  LYRICS WITH VARIANTS
   //  Tries the LRCLIB lookup with multiple cleaned-up title
   //  variants (generated by Y.lyrics.buildTitleVariants).
   //  Example: "Song (Official Video) [HD]" tries:
   //    - "Song (Official Video) [HD]"
   //    - "Song (Official Video)"
   //    - "Song"
   //  Returns the first variant that yields lyrics.
   // ============================================================
   async function fetchLyricsWithVariants(artist, rawTitle, duration) {
     const variants = Y.lyrics.buildTitleVariants(rawTitle, artist);

     for (const variant of variants) {
       const lyrics = await fetchLrclib(artist, variant, duration);

       if (lyrics && (lyrics.plainLyrics || lyrics.syncedLyrics)) {
         return lyrics;
       }
     }

     return null;
   }

   // ============================================================
   //  ITUNES ARTWORK
   //  Looks up the album cover for the given artist+title.
   //  The API returns a 100×100 thumbnail URL — we upgrade it to
   //  300×300 by string replacement (Apple uses the same URL
   //  pattern for all sizes).
   // ============================================================
   async function fetchArtworkFromItunes(artist, title) {
     const term = encodeURIComponent(`${artist} ${title}`);
     const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`;

     try {
       const data = await Y.bridge.fetchJson(url);
       const art = data?.results?.[0]?.artworkUrl100;
       return art ? art.replace("100x100", "300x300") : null;
     } catch {
       return null;
     }
   }

   // ============================================================
   //  EXPORTS
   // ============================================================
   Y.api = {
     fetchOEmbed,
     fetchLrclib,
     fetchLyricsOvh,
     fetchLyricsWithVariants,
     fetchArtworkFromItunes,
   };
 })();
