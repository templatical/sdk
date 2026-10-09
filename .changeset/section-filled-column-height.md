---
"@templatical/editor": patch
---

A section column with blocks in it is now as tall as its blocks on the canvas. Every column kept the 60px drop-zone minimum, so a short band, such as a one-line strip or a footer note, looked taller while editing than in the sent email. A column showing no blocks keeps the 60px drop target: an empty column, one whose blocks the condition preview hides, and one whose only block is being dragged out.
