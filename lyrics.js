// ============================================================
//  lyrics.js
//  Parses YouTube metadata into clean artist/title pairs,
//  handles LRC timestamps, and generates title variants for
//  lyrics lookups.
//
//  Exports (Y.lyrics):
//    - cleanArtist()        – strips "- Topic", "VEVO" from names
//    - cleanTrack()         – strips "(Official Video)", "[HD]" etc.
//    - stripArtistPrefix()  – removes "Artist - " from a title
//    - normalizeWhitespace()– converts fancy spaces to plain ones
//    - buildTitleVariants() – generates alt titles for API search
//    - parseSongInfo()      – main metadata parser (5 strategies)
//    - parseLRC()           – parses LRC text to [{time, text}]
//    - firstLyricItem()     – picks first usable entry from an API list
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  WHITESPACE NORMALIZATION
   //  YouTube sometimes uses non-breaking spaces (\u00A0) and
   //  other unicode whitespace. Normalize everything to plain
   //  spaces so regex and comparisons behave predictably.
   // ============================================================
   function normalizeWhitespace(str) {
     return String(str || "")
       .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
       .replace(/\s{2,}/g, " ")
       .trim();
   }

   // ============================================================
   //  ARTIST CLEANUP
   //  Removes suffixes like "- Topic" and "VEVO".
   //  Example: "Avril Lavigne - Topic" → "Avril Lavigne"
   // ============================================================
   function cleanArtist(name) {
     return normalizeWhitespace(name)
       .replace(/\s*-\s*Topic$/i, "")
       .replace(/VEVO$/i, "")
       .trim();
   }

   // ============================================================
   //  TITLE CLEANUP
   //  Removes common YouTube noise:
   //    - Bracketed tags: [HD], [4K]
   //    - Parenthesised noise: (Official Video), (Lyric Video),
   //      (Audio), (Visualizer), (Explicit), (Sped Up) etc.
   //    - Trailing suffixes: "- sped up", "- slowed + reverb"
   // ============================================================
   const TITLE_NOISE_REGEX =
     /\([^)]*(official|video|lyric|lyrics|audio|visualizer|visualiser|hd|hq|4k|uhd|8k|live|performance|mv|music video|trailer|explicit|clean|remaster|remastered|lyric video|official audio|official video|official music video|color coded|color-coded|premiere|premier|with lyrics|full song|sped up|slowed|reverb)[^)]*\)/gi;

   function cleanTrack(name) {
     return normalizeWhitespace(name)
       .replace(/\[[^\]]*\]/g, " ")
       .replace(TITLE_NOISE_REGEX, " ")
       .replace(/\s*[-–—]\s*(sped\s*up|slowed(?:\s*\+?\s*reverb)?|reverb|nightcore)\s*$/i, "")
       .trim();
   }

   // ============================================================
   //  DASH / SEPARATOR CHARACTERS
   //  Covers all dash-like characters used by YouTube titles:
   //    -   normal hyphen              \u2010 non-breaking hyphen
   //    –   en dash                    —   em dash
   //    −   minus sign                 |   pipe
   //    :   colon                      ·   middle dot
   //    •   bullet
   // ============================================================
   const DASH_CHARS = "\\-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\uFE58\\uFE63\\uFF0D|:·•";

   // ============================================================
   //  STRIP ARTIST PREFIX FROM TITLE
   //  Removes "Artist - " prefix from a title if present.
   //  Example: "Avril Lavigne - What The Hell" + "Avril Lavigne"
   //    → "What The Hell"
   //  Returns the original title if stripping would empty it.
   // ============================================================
   function stripArtistPrefix(title, artist) {
     if (!title || !artist || artist === "Unknown") return title;

     const t = normalizeWhitespace(title);
     const a = normalizeWhitespace(artist);

     const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
     const regex = new RegExp(`^\\s*${escaped}\\s*[${DASH_CHARS}]\\s*`, "i");

     const stripped = t.replace(regex, "").trim();
     return stripped || title;
   }

   // ============================================================
   //  TITLE VARIANTS
   //  Generates alternative titles to try against lyrics APIs.
   //  Example: "Song (Official Video) [HD]" might generate:
   //    - "Song"
   //    - "Song (Official Video) [HD]"
   //    - "Song (Official Video)"
   //    - "Song [HD]"
   //  Used by api.js when the primary lookup fails.
   // ============================================================
   function buildTitleVariants(rawTitle, artistName) {
     const variants = [];
     const seen = new Set();

     const add = (title) => {
       const t = normalizeWhitespace(title);
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

     // Aggressive variant: strip noise words from start and end
     let aggressive = cleanTrack(rawTitle);
     for (const word of noiseWords) {
       const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       const regexEnd = new RegExp(`\\s+${escaped}\\s*$`, "i");
       const regexFront = new RegExp(`^${escaped}\\s+`, "i");
       aggressive = aggressive.replace(regexEnd, "");
       aggressive = aggressive.replace(regexFront, "");
     }
     add(aggressive);

     // Standard cleaned variant
     add(cleanTrack(rawTitle));

     // Variant with artist name removed (if artist is known)
     if (artistName) {
       const escapedArtist = artistName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       const withoutArtist = rawTitle
         .replace(new RegExp(escapedArtist, "gi"), "")
         .trim();
       add(cleanTrack(withoutArtist).replace(/^[\s\-\–\—:|·•]+/, ""));
     }

     // Original title without brackets/parentheses
     const original = rawTitle
       .replace(/\([^)]*\)/g, "")
       .replace(/\[[^\]]*\]/g, "")
       .trim();
     add(original);

     return variants;
   }

   // ============================================================
   //  PARSE SONG INFO
   //  Main metadata parser. Given a YouTube video title + channel
   //  name, it returns { artist, title, source }.
   //
   //  Strategies (in order):
   //    1. Topic channel ("Artist - Topic")
   //       → channel = artist, video title = song
   //    2. Video title with " - " / " – " / " | " / ": " separator
   //       → left = artist, right = song
   //    3. "ft." / "feat." / "featuring" in video title AND
   //       channel name is NOT generic
   //       → channel = song title, artist = part before "ft."
   //    4. Theme channel ("Music", "Records", "Vevo", etc.)
   //       → channel isn't an artist, artist = "Unknown"
   //    5. Fallback
   //       → channel = artist, video title = song
   //
   //  The `source` field tells which strategy matched (useful for
   //  debugging and for deciding whether to auto-open the panel).
   // ============================================================
   function parseSongInfo(rawTitle, rawAuthor) {
     const originalTitle = normalizeWhitespace(rawTitle);
     const author = normalizeWhitespace(rawAuthor);

     // --------------------------------------------------------
     //  Strategy 1: Topic channel
     //  Example channel: "Avril Lavigne - Topic"
     // --------------------------------------------------------
     if (/\s*-\s*Topic$/i.test(author)) {
       const artist = cleanArtist(author);
       let title = cleanTrack(originalTitle);
       title = stripArtistPrefix(title, artist);

       return {
         artist,
         title,
         source: "topic",
       };
     }

     // --------------------------------------------------------
     //  Strategy 2: Video title with a separator
     //  Example: "Avril Lavigne - What The Hell"
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
     //  Strategy 3: "ft." / "feat." in title AND non-generic channel
     //  Example: "Song Title ft. Other Artist" on a personal channel
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
     //  Strategy 4: Theme channel — channel name is not an artist
     //  Example: "TopPop", "MusicVideos", "Charts 2024"
     // --------------------------------------------------------
     if (isGenericChannel && !/\s*-\s*Topic$/i.test(author)) {
       const title = cleanTrack(originalTitle);
       return {
         artist: "Unknown",
         title,
         source: "theme-channel",
       };
     }

     // --------------------------------------------------------
     //  Strategy 5: Fallback — trust the channel name as artist
     // --------------------------------------------------------
     const artist = cleanArtist(author) || "Unknown";
     let title = cleanTrack(originalTitle) || "Unknown";

     // Safety: strip artist prefix if it slipped through
     title = stripArtistPrefix(title, artist);

     return {
       artist,
       title,
       source: "fallback",
     };
   }

   // ============================================================
   //  LRC PARSER
   //  Converts LRC text into a sorted array of timed lines.
   //
   //  Supported timestamp formats:
   //    [mm:ss.xx]     – centiseconds
   //    [mm:ss.xxx]    – milliseconds
   //    [mm:ss:xx]     – colon as decimal separator
   //
   //  Also handles the [offset:+500] metadata tag: it shifts all
   //  timestamps by the given number of milliseconds.
   //
   //  Returns: [{ time: number, text: string }, ...] sorted by time
   // ============================================================
   function parseLRC(lrc) {
     const output = [];
     const text = String(lrc || "");
     const lines = text.split(/\r?\n/);
     const timeTagRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

     // Read the global [offset: ...] tag if present
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

         // Fraction can be 1, 2, or 3 digits — normalize to seconds
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
   //  FIRST LYRIC ITEM
   //  LRCLIB responses can be:
   //    - an object with { plainLyrics, syncedLyrics }
   //    - an array of such objects
   //    - an object with a nested .data array
   //  This helper picks the first item that actually has lyrics.
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
   //  EXPORTS
   // ============================================================
   Y.lyrics = {
     cleanArtist,
     cleanTrack,
     stripArtistPrefix,
     normalizeWhitespace,
     buildTitleVariants,
     parseSongInfo,
     parseLRC,
     firstLyricItem,
   };
 })();
