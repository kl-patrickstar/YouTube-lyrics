// ============================================================
//  popup.js
//  Logic for the toolbar popup (the small panel that opens
//  when you click the extension icon in the browser toolbar).
//
//  What it does:
//    1. Finds the currently active tab
//    2. Sends a "get-status" message to the content script
//    3. Displays the reply as a short status summary
//
//  The popup is READ-ONLY — it doesn't control the extension,
//  it just shows whether the content script is running and
//  what song/lyrics are currently loaded.
//
//  Possible responses:
//    - ok + title         → show song info + lyrics status
//    - ok + no title      → extension ready, but no song loaded
//    - !ok                 → YouTube page without a video
//    - no response         → content script not running (other site)
//    - error               → tab uses an old script version
// ============================================================

(() => {
   // --------------------------------------------------------
   //  Cross-browser API access
   //  Safari uses browser.*, Chrome uses chrome.*
   // --------------------------------------------------------
   const tabs = globalThis.browser?.tabs || globalThis.chrome?.tabs;

   // --------------------------------------------------------
   //  DOM references (elements defined in popup.html)
   // --------------------------------------------------------
   const titleEl = document.getElementById("title");
   const metaEl = document.getElementById("meta");
   const statusEl = document.getElementById("status");

   // --------------------------------------------------------
   //  Helper: update the popup's three text elements at once.
   //  `meta` is optional — pass "" or omit for no subtitle.
   // --------------------------------------------------------
   function show(title, meta, text) {
     titleEl.textContent = title;
     metaEl.textContent = meta || "";
     statusEl.textContent = text;
   }

   // --------------------------------------------------------
   //  Main flow
   //  1. Query the active tab
   //  2. Send a message to the content script asking for status
   //  3. Show the appropriate message
   // --------------------------------------------------------
   tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
     // No tab? Shouldn't happen, but guard anyway.
     if (!tab?.id) {
       show("Not active", "", "No active tab found.");
       return;
     }

     tabs
       .sendMessage(tab.id, { type: "get-status" })
       .then((status) => {
         // -------------------------------------------------
         //  Case 1: Content script answered, everything OK
         // -------------------------------------------------
         if (status && status.ok) {
           // 1a: No song parsed yet — extension is idle
           if (!status.title) {
             show(
               "YouTube Lyrics is active",
               "",
               "No song loaded yet — open the panel with ⌘⇧L or the mic button."
             );
             return;
           }

           // 1b: Song loaded → show title + artist + status line
           show(
             status.title,
             status.artist,
             status.hasLyrics
               ? `Lyrics loaded · Mode: ${status.mode === "text" ? "Text" : "Karaoke"} · Panel ${status.panelOpen ? "open" : "closed"}`
               : "No lyrics found — open the panel for manual search."
           );
           return;
         }

         // -------------------------------------------------
         //  Case 2: Content script ran but no video on the page
         // -------------------------------------------------
         if (status && !status.ok) {
           show(
             "YouTube Lyrics is active",
             "",
             "This YouTube page isn't showing a video — open one."
           );
           return;
         }

         // -------------------------------------------------
         //  Case 3: Empty response → tab is running an old
         //  content-script version that doesn't know "get-status"
         // -------------------------------------------------
         show(
           "Reload the tab",
           "",
           "The extension is running, but this tab is using an old script version. Press ⌘⇧R once."
         );
       })
       .catch(() => {
         // -------------------------------------------------
         //  Case 4: sendMessage threw → no content script at all
         //  (e.g. the tab is not a YouTube video page)
         // -------------------------------------------------
         show(
           "Not active",
           "",
           "YouTube Lyrics isn't running on this page (only YouTube video pages)."
         );
       });
   });
 })();
