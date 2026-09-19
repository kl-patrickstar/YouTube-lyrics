 (() => {
   const Y = (globalThis.YTLY ??= {});

   // --------------------------------------------------------
   //  oEmbed — Metadaten (Titel, Kanal) via YouTube
   // --------------------------------------------------------
   async function fetchOEmbed(videoId) {
     const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
     const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
       watchUrl
     )}&format=json`;
     return Y.bridge.fetchJson(url);
   }

   // --------------------------------------------------------
   //  LRCLIB — 3 Endpoints parallel via Promise.any
   // --------------------------------------------------------
   async function fetchLrclib(artist, title, duration) {
     const urls = [];

     // 1. Exakte Suche mit Duration
     const getUrl = new URL("https://lrclib.net/api/get");
     getUrl.searchParams.set("artist_name", artist);
     getUrl.searchParams.set("track_name", title);
     if (duration) {
       getUrl.searchParams.set("duration", String(Math.round(duration)));
     }
     urls.push(getUrl.toString());

     // 2. Freitext-Suche
     const qSearchUrl = new URL("https://lrclib.net/api/search");
     qSearchUrl.searchParams.set("q", `${artist} ${title}`);
     urls.push(qSearchUrl.toString());

     // 3. Feldbasierte Suche
     const fieldSearchUrl = new URL("https://lrclib.net/api/search");
     fieldSearchUrl.searchParams.set("artist_name", artist);
     fieldSearchUrl.searchParams.set("track_name", title);
     urls.push(fieldSearchUrl.toString());

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
       return await Promise.any(attempts);
     } catch {
       // AggregateError: alle Requests fehlgeschlagen
       return null;
     }
   }

   // --------------------------------------------------------
   //  lyrics.ovh — Fallback für Plain-Text-Lyrics
   // --------------------------------------------------------
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
       // stiller Fallback
     }

     return null;
   }

   // --------------------------------------------------------
   //  Kombinierte Suche: LRCLIB mit Titelvarianten
   // --------------------------------------------------------
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

   // --------------------------------------------------------
   //  iTunes — Artwork (Cover-Bild)
   // --------------------------------------------------------
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

   // --------------------------------------------------------
   //  EXPORT
   // --------------------------------------------------------
   Y.api = {
     fetchOEmbed,
     fetchLrclib,
     fetchLyricsOvh,
     fetchLyricsWithVariants,
     fetchArtworkFromItunes,
   };
 })();
