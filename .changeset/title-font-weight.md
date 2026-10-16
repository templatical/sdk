---
"@templatical/types": minor
"@templatical/renderer": patch
"@templatical/editor": patch
---

Titles stay bold while you edit them. A title showed at weight 700 on the canvas and in the email, but its edit surface showed it at 400, so the text turned lighter, and could rewrap, the moment editing started. The canvas, the edit surface and the exported heading now all use 700, which `@templatical/types` exports as `TITLE_FONT_WEIGHT`. The renderer writes it onto the heading as `font-weight:700`, so emails look as before in clients that already bold headings, and a page that resets heading styles (Tailwind's preflight, for one) no longer shows the email's titles at regular weight. With `shadowDom: false` on such a page, the canvas title was regular too; it is now bold.
