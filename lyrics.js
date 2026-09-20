 (() => {
   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  KÜNSTLER-BEREINIGUNG
   // ============================================================
   function cleanArtist(name) {
     return (name || "")
       .replace(/\s*-\s*Topic$/i, "")
       .replace(/VEVO$/i, "")
       .replace(/\s{2,}/g, " ")
       .trim();
   }

   // ============================================================
   //  TITEL-BEREINIGUNG
   //  Entfernt typische YouTube-Zusätze wie "(Official Video)",
   //  "[HD]", "(Lyric Video)", " - sped up" etc.
   // ============================================================
   const TITLE_NOISE_REGEX =
     /\([^)]*(official|video|lyric|lyrics|audio|visualizer|visualiser|hd|hq|4k|uhd|8k|live|performance|mv|music video|trailer|explicit|clean|remaster|remastered|lyric video|official audio|official video|official music video|color coded|color-coded|premiere|premier|with lyrics|full song|sped up|slowed|reverb)[^)]*\)/gi;

   function cleanTrack(name) {
     return (name || "")
       .replace(/\[[^\]]*\]/g, " ")
       .replace(TITLE_NOISE_REGEX, " ")
       .replace(/\s*[-–—]\s*(sped\s*up|slowed(?:\s*\+?\s*reverb)?|reverb|nightcore)\s*$/i, "")
       .replace(/\s{2,}/g, " ")
       .trim();
   }

   // ============================================================
   //  TITEL-VARIANTEN
   // ============================================================
   function buildTitleVariants(rawTitle, artistName) {
     const variants = [];
     const seen = new Set();

     const add = (title) => {
       const t = (title || "").replace(/\s{2,}/g, " ").trim();
       if (t && !seen.has(t.toLowerCase())) {
         seen.add(t.toLowerCase());
         variants.push(t);
       }
     };

     const noiseWords = [
       "HD", "HQ", "4K", "UHD", "8K",
       "Lyrics", "Lyric", "Lyrical",
       "Official", "Video", "Audio", "MV",
       "Explicit", "Clean", "Premiere", "Premier",
       "Sped Up", "Slowed", "Reverb", "Nightcore",
     ];

     let aggressive = cleanTrack(rawTitle);
     for (const word of noiseWords) {
       const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       const regexEnd = new RegExp(`\\s+${escaped}\\s*$`, "i");
       const regexFront = new RegExp(`^${escaped}\\s+`, "i");
       aggressive = aggressive.replace(regexEnd, "");
       aggressive = aggressive.replace(regexFront, "");
     }
     add(aggressive);

     add(cleanTrack(rawTitle));

     if (artistName) {
       const escapedArtist = artistName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       const withoutArtist = rawTitle
         .replace(new RegExp(escapedArtist, "gi"), "")
         .trim();
       add(cleanTrack(withoutArtist).replace(/^[\s\-\–\—:|]+/, ""));
     }

     const original = rawTitle
       .replace(/\([^)]*\)/g, "")
       .replace(/\[[^\]]*\]/g, "")
       .trim();
     add(original);

     return variants;
   }

   // ============================================================
   //  SONG-INFO PARSEN
   //  Erkennt Künstler + Titel aus YouTube-Metadaten.
   //
   //  Strategie (in dieser Reihenfolge):
   //   1. Topic-Kanal → Kanalname = Künstler, Video-Titel = Song
   //   2. Video-Titel mit " - " → links = Künstler, rechts = Song
   //   3. Video-Titel mit "ft."/"feat." UND Kanalname ist NICHT
   //      generisch → Kanalname = Song, Künstler = vor "ft."
   //   4. Theme-Kanal (Music/Vevo/Records) → Kanal = "Unknown"
   //   5. Fallback → Kanalname = Künstler, Video-Titel = Song
   // ============================================================
   function parseSongInfo(rawTitle, rawAuthor) {
     const originalTitle = (rawTitle || "").trim();
     const author = (rawAuthor || "").trim();

     // --------------------------------------------------------
     //  1. Topic-Kanal
     // --------------------------------------------------------
       if (/\s*-\s*Topic$/i.test(author)) {
         const artist = cleanArtist(author);
         let title = cleanTrack(originalTitle);

         // Normalize whitespace (YouTube uses non-breaking spaces)
         title = title.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");
         title = title.replace(/\s{2,}/g, " ").trim();

         // Strip "Artist - " prefix if present (all dash variants)
         const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
         const dashChars = "\\-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\uFE58\\uFE63\\uFF0D|:·•";
         const prefixRegex = new RegExp("^\\s*" + escaped + "\\s*[" + dashChars + "]\\s*", "i");
         const stripped = title.replace(prefixRegex, "").trim();
         if (stripped) title = stripped;

         return {
           artist,
           title,
           source: "topic",
         };
       }

     // --------------------------------------------------------
     //  2. Video-Titel mit Trenner
     // --------------------------------------------------------
     const separators = [" - ", " – ", " — ", " | ", ": "];

     for (const separator of separators) {
       const index = originalTitle.indexOf(separator);

       if (index > 0 && index < originalTitle.length - separator.length) {
         const left = originalTitle.slice(0, index).trim();
         const right = originalTitle.slice(index + separator.length).trim();

         if (left && right) {
           return {
             artist: cleanArtist(left),
             title: cleanTrack(right),
             source: "title-split",
           };
         }
       }
     }

     // --------------------------------------------------------
     //  3. "ft." / "feat." im Video-Titel UND Kanalname nicht generisch
     //     → Kanalname = Song-Titel, Künstler = alles vor "ft."
     // --------------------------------------------------------
     const ftMatch = originalTitle.match(
       /^(.+?)\s+(?:ft\.?|feat\.?|featuring)\s+/i
     );

     const isGenericChannel = /\b(music|lyrics|songs|vevo|topic|records|official|soundtrack|ost|soundtracks|hits|charts|channel|media|entertainment)\b/i.test(
       author
     );

     if (ftMatch && !isGenericChannel && author) {
       return {
         artist: cleanArtist(ftMatch[1]),
         title: cleanTrack(author),
         source: "channel-is-title",
       };
     }

     // --------------------------------------------------------
     //  4. Theme-Kanal: Kanalname ist kein Künstler
     // --------------------------------------------------------
     if (isGenericChannel && !/\s*-\s*Topic$/i.test(author)) {
       return {
         artist: "Unknown",
         title: cleanTrack(originalTitle),
         source: "theme-channel",
       };
     }

     // --------------------------------------------------------
     //  5. Fallback
     // --------------------------------------------------------
     return {
       artist: cleanArtist(author) || "Unknown",
       title: cleanTrack(originalTitle) || "Unknown",
       source: "fallback",
     };
   }

   // ============================================================
   //  LRC PARSER
   //  Unterstützt:
   //    [mm:ss.xx]  [mm:ss.xxx]  [mm:ss:xx]
   //    [offset: +500]  → verschiebt alle Zeiten um 0.5 s
   // ============================================================
   function parseLRC(lrc) {
     const output = [];
     const text = String(lrc || "");
     const lines = text.split(/\r?\n/);
     const timeTagRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

     let globalOffset = 0;
     const offsetMatch = text.match(/\[offset:\s*([+-]?\d+)\]/i);
     if (offsetMatch) {
       globalOffset = Number(offsetMatch[1]) / 1000;
     }

     for (const rawLine of lines) {
       timeTagRegex.lastIndex = 0;
       const matches = [...rawLine.matchAll(timeTagRegex)];
       if (!matches.length) continue;

       timeTagRegex.lastIndex = 0;
       const lineText = rawLine.replace(timeTagRegex, "").trim();

       for (const match of matches) {
         const minutes = Number(match[1]);
         const seconds = Number(match[2]);
         const fractionRaw = match[3];

         let fraction = 0;
         if (fractionRaw) {
           fraction =
             Number(fractionRaw) /
             (fractionRaw.length === 3 ? 1000 : fractionRaw.length === 2 ? 100 : 10);
         }

         const time = minutes * 60 + seconds + fraction + globalOffset;

         if (Number.isFinite(time)) {
           output.push({ time, text: lineText });
         }
       }
     }

     output.sort((a, b) => a.time - b.time);
     return output;
   }

   // ============================================================
   //  ERSTES LYRIC-ITEM AUS LRCLIB-ANTWORT
   // ============================================================
   function firstLyricItem(data) {
     if (!data) return null;

     if (Array.isArray(data)) {
       for (const item of data) {
         if (item && (item.plainLyrics || item.syncedLyrics)) {
           return item;
         }
       }
       return null;
     }

     if (typeof data === "object") {
       if (data.plainLyrics || data.syncedLyrics) {
         return data;
       }
       if (Array.isArray(data.data)) {
         return firstLyricItem(data.data);
       }
     }

     return null;
   }

   // ============================================================
   //  EXPORT
   // ============================================================
   Y.lyrics = {
     cleanArtist,
     cleanTrack,
     buildTitleVariants,
     parseSongInfo,
     parseLRC,
     firstLyricItem,
   };
 })();
