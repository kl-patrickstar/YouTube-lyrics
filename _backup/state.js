 (() => {
   const Y = (globalThis.YTLY ??= {});

   let ui = null;
   let currentVideoId = null;
   let currentSong = null;
   let refreshSeq = 0;
   let lyricOffset = 0;
   let lastLyrics = null;

   const settings = {
     autoOpen: true,
     autoScroll: true,
     theme: "auto",
     fontSize: 17,
     mode: "karaoke",
   };

   const artMemory = new Map();

   Y.state = {
     get ui() { return ui; },
     set ui(value) { ui = value; },
     
     get currentVideoId() { return currentVideoId; },
     set currentVideoId(value) { currentVideoId = value; },
     
     get currentSong() { return currentSong; },
     set currentSong(value) { currentSong = value; },
     
     get refreshSeq() { return refreshSeq; },
     set refreshSeq(value) { refreshSeq = value; },
     
     get lyricOffset() { return lyricOffset; },
     set lyricOffset(value) { lyricOffset = value; },
     
     get lastLyrics() { return lastLyrics; },
     set lastLyrics(value) { lastLyrics = value; },
     
     settings,
     artMemory,
   };
 })();
