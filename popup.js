 (() => {
   const tabs = globalThis.browser?.tabs || globalThis.chrome?.tabs;

   const titleEl = document.getElementById("title");
   const metaEl = document.getElementById("meta");
   const statusEl = document.getElementById("status");

   function show(title, meta, text) {
     titleEl.textContent = title;
     metaEl.textContent = meta || "";
     statusEl.textContent = text;
   }

   tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
     if (!tab?.id) {
       show("Nicht aktiv", "", "Kein aktiver Tab gefunden.");
       return;
     }

     tabs
       .sendMessage(tab.id, { type: "get-status" })
       .then((status) => {
         // Fall 1: alles gut, echte Antwort
         if (status && status.ok) {
           if (!status.title) {
             show(
               "YouTube Lyrics ist aktiv",
               "",
               "Noch kein Song geladen – öffne das Panel über ⌘⇧L oder den Mikrofon-Button."
             );
             return;
           }
           show(
             status.title,
             status.artist,
             status.hasLyrics
               ? `Songtext geladen · Modus: ${status.mode === "text" ? "Text" : "Karaoke"} · Panel ${status.panelOpen ? "offen" : "geschlossen"}`
               : "Kein Songtext gefunden – öffne das Panel für die manuelle Suche."
           );
           return;
         }

         // Fall 2: Antwort "kein Video"
         if (status && !status.ok) {
           show(
             "YouTube Lyrics ist aktiv",
             "",
             "Diese YouTube-Seite zeigt gerade kein Video – öffne ein Video."
           );
           return;
         }

         // Fall 3: keine Antwort → alte Script-Version im Tab
         show(
           "Tab neu laden",
           "",
           "Die Extension läuft, aber dieser Tab nutzt noch eine alte Script-Version. Einmal ⌘⇧R drücken."
         );
       })
       .catch(() => {
         // Fall 4: gar kein Content Script (andere Seite)
         show(
           "Nicht aktiv",
           "",
           "Auf dieser Seite läuft YouTube Lyrics nicht (nur YouTube-Videoseiten)."
         );
       });
   });
 })();
