// ============================================================
//  youtube.js
//  Helpers for reading data out of the YouTube page itself.
//
//  Everything here is about the YouTube DOM or URL — no lyrics,
//  no UI, no networking beyond the oEmbed metadata call.
//
//  These helpers are used by content.js (for song metadata),
//  by sync.js (for the <video> element and chapter-based timing),
//  and by api.js indirectly via Y.bridge.fetchJson.
//
//  Exports (Y.youtube):
//    - getVideoId()               – video ID from the current URL
//    - getDomMetadata()           – title/author from the DOM
//    - getMetadata()              – oEmbed first, DOM as fallback
//    - getVideoDuration()         – duration of the current <video>
//    - getVideoElement()          – reference to the <video> tag
//    - parseChapterTime()         – "1:23" / "1:02:03" → seconds
//    - readChaptersFromDom()      – reads YouTube chapters from DOM
//    - computeOffsetFromChapters()- derives a timing offset from chapters
// ============================================================

(() => {
   const Y = (globalThis.YTLY ??= {});

   // ============================================================
   //  GET VIDEO ID
   //  Extracts the video ID from the current URL.
   //  Supports three YouTube URL formats:
   //    - /watch?v=XYZ            (normal videos)
   //    - /shorts/XYZ             (YouTube Shorts)
   //    - /embed/XYZ              (embedded videos)
   //  Returns null if no video ID is found.
   // ============================================================
   function getVideoId() {
     const url = new URL(location.href);
     const v = url.searchParams.get("v");
     if (v) return v;

     const parts = url.pathname.split("/").filter(Boolean);

     if (parts[0] === "shorts" && parts[1]) return parts[1];
     if (parts[0] === "embed" && parts[1]) return parts[1];

     return null;
   }

   // ============================================================
   //  GET DOM METADATA (fallback)
   //  Reads title and channel name from the YouTube page when
   //  the oEmbed API is unavailable. Several selectors are tried
   //  because YouTube changes the DOM frequently and uses
   //  different layouts on different pages (watch, shorts, ...).
   //
   //  Returns: { title: string, author_name: string }
   // ============================================================
   function getDomMetadata() {
     // --- Title ---
     // Prefer the og:title meta tag (stable), then fall back to
     // the visible <h1> in the watch metadata section.
     const ogTitle = document.querySelector('meta[property="og:title"]')?.content;

     const h1 =
       document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent ||
       document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string")?.textContent;

     const title = (ogTitle || h1 || document.title || "")
       .replace(/\s+-\s+YouTube$/i, "") // strip trailing "- YouTube"
       .trim();

     // --- Author (channel name) ---
     // Several selectors because YouTube's DOM changes between
     // layouts. Try watch page owner renderer, then channel link,
     // then the microdata link as a last resort.
     const author =
       document.querySelector("ytd-video-owner-renderer #text")?.textContent ||
       document.querySelector("ytd-channel-name a")?.textContent ||
       document.querySelector("#owner #channel-name #text")?.textContent ||
       document.querySelector('link[itemprop="name"]')?.content ||
       "";

     return {
       title: title.trim(),
       author_name: author.trim(),
     };
   }

   // ============================================================
   //  GET METADATA (oEmbed first, DOM fallback)
   //  The YouTube oEmbed endpoint returns clean title + channel
   //  data and works without an API key. If it fails (offline,
   //  rate limit, embed disabled), fall back to DOM scraping.
   // ============================================================
   async function getMetadata(videoId) {
     try {
       const data = await Y.api.fetchOEmbed(videoId);
       if (data?.title) {
         return data;
       }
     } catch (error) {
       console.warn("oEmbed failed, using DOM fallback:", error);
     }

     return getDomMetadata();
   }

   // ============================================================
   //  GET VIDEO DURATION
   //  Returns the duration of the current <video> in seconds.
   //  Returns 0 if no video is loaded yet or the duration isn't
   //  finite (e.g. for live streams it stays Infinity).
   // ============================================================
   function getVideoDuration() {
     const video = document.querySelector("video");
     if (!video || !Number.isFinite(video.duration)) {
       return 0;
     }
     return video.duration;
   }

   // ============================================================
   //  GET VIDEO ELEMENT
   //  Returns the current <video> tag. Used by sync.js for the
   //  timing loop (requestVideoFrameCallback / timeupdate).
   // ============================================================
   function getVideoElement() {
     return document.querySelector("video");
   }

   // ============================================================
   //  PARSE CHAPTER TIME
   //  Converts a chapter timestamp like "1:23" or "1:02:03"
   //  into seconds.
   //
   //  Accepted formats:
   //    "1:23"       → 83     (minutes:seconds)
   //    "1:02:03"    → 3723   (hours:minutes:seconds)
   //
   //  Returns null for unparseable input.
   // ============================================================
   function parseChapterTime(text) {
     const m = String(text || "")
       .trim()
       .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
     if (!m) return null;
     const h = m[1] ? Number(m[1]) : 0;
     return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
   }

   // ============================================================
   //  READ CHAPTERS FROM DOM
   //  Reads the list of chapters from the YouTube player's
   //  chapter panel. Two selectors are tried because YouTube
   //  uses different elements in different layouts.
   //
   //  Returns: [{ title: string, time: number }, ...] sorted by time
   // ============================================================
   function readChaptersFromDom() {
     const chapters = [];

     // Layout 1: macro-markers list (modern YouTube player)
     document.querySelectorAll("ytd-macro-markers-list-item-renderer").forEach((el) => {
       const title = el.querySelector("#title")?.textContent?.trim() || "";
       const timeText = el.querySelector("#time")?.textContent?.trim() || "";
       const time = parseChapterTime(timeText);
       if (title && time !== null) chapters.push({ title, time });
     });

     // Layout 2: legacy chapter renderer (older YouTube player)
     if (!chapters.length) {
       document.querySelectorAll("ytd-chapter-renderer").forEach((el) => {
         const title =
           el.querySelector("#chapter-title")?.textContent?.trim() ||
           el.querySelector(".yt-formatted-string")?.textContent?.trim() ||
           "";
         const timeText = el.querySelector("#timestamp")?.textContent?.trim() || "";
         const time = parseChapterTime(timeText);
         if (title && time !== null) chapters.push({ title, time });
       });
     }

     chapters.sort((a, b) => a.time - b.time);
     return chapters;
   }

   // ============================================================
   //  COMPUTE OFFSET FROM CHAPTERS
   //  Looks for the chapter whose title matches the song title,
   //  and returns its start time. This is used to align lyrics
   //  with the actual song start (skipping intros / skits).
   //
   //  Two strategies:
   //    1. Chapter title contains (or is contained in) the song
   //       title → use its start time
   //    2. First chapter is an intro (title matches intro/vorspann)
   //       and starts at 0 → use the second chapter's start time
   //
   //  Returns a time in seconds, or null if no offset is found.
   // ============================================================
   function computeOffsetFromChapters(chapters, songTitle) {
     const cleanTitle = (songTitle || "").toLowerCase().trim();

     // Strategy 1: match song title against chapter titles
     if (cleanTitle) {
       for (const ch of chapters) {
         const ct = ch.title.toLowerCase();
         // Use substring match with a minimum length to avoid
         // false positives on very short chapter titles.
         if (ct.length >= 3 && (ct.includes(cleanTitle) || cleanTitle.includes(ct))) {
           return ch.time;
         }
       }
     }

     // Strategy 2: skip a labelled intro at time 0
     const first = chapters[0];
     if (
       first &&
       first.time === 0 &&
       /intro|introduct|vorspann/i.test(first.title) &&
       chapters[1]
     ) {
       return chapters[1].time;
     }

     return null;
   }

   // ============================================================
   //  EXPORTS
   // ============================================================
   Y.youtube = {
     getVideoId,
     getDomMetadata,
     getMetadata,
     getVideoDuration,
     getVideoElement,
     parseChapterTime,
     readChaptersFromDom,
     computeOffsetFromChapters,
   };
 })();
