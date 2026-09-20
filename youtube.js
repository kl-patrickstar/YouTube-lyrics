 (() => {
   const Y = (globalThis.YTLY ??= {});

   function getVideoId() {
     const url = new URL(location.href);
     const v = url.searchParams.get("v");
     if (v) return v;

     const parts = url.pathname.split("/").filter(Boolean);

     if (parts[0] === "shorts" && parts[1]) return parts[1];
     if (parts[0] === "embed" && parts[1]) return parts[1];

     return null;
   }

   function getDomMetadata() {
     const ogTitle = document.querySelector('meta[property="og:title"]')?.content;

     const h1 =
       document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent ||
       document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string")?.textContent;

     const title = (ogTitle || h1 || document.title || "")
       .replace(/\s+-\s+YouTube$/i, "")
       .trim();

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

   async function getMetadata(videoId) {
     try {
       const data = await Y.api.fetchOEmbed(videoId);
       if (data?.title) {
         return data;
       }
     } catch (error) {
       console.warn("oEmbed fehlgeschlagen, DOM-Fallback:", error);
     }

     return getDomMetadata();
   }

   function getVideoDuration() {
     const video = document.querySelector("video");
     if (!video || !Number.isFinite(video.duration)) {
       return 0;
     }
     return video.duration;
   }

   function getVideoElement() {
     return document.querySelector("video");
   }

   function parseChapterTime(text) {
     const m = String(text || "")
       .trim()
       .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
     if (!m) return null;
     const h = m[1] ? Number(m[1]) : 0;
     return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
   }

   function readChaptersFromDom() {
     const chapters = [];

     document.querySelectorAll("ytd-macro-markers-list-item-renderer").forEach((el) => {
       const title = el.querySelector("#title")?.textContent?.trim() || "";
       const timeText = el.querySelector("#time")?.textContent?.trim() || "";
       const time = parseChapterTime(timeText);
       if (title && time !== null) chapters.push({ title, time });
     });

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

   function computeOffsetFromChapters(chapters, songTitle) {
     const cleanTitle = (songTitle || "").toLowerCase().trim();

     if (cleanTitle) {
       for (const ch of chapters) {
         const ct = ch.title.toLowerCase();
         if (ct.length >= 3 && (ct.includes(cleanTitle) || cleanTitle.includes(ct))) {
           return ch.time;
         }
       }
     }

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
