---
"@templatical/editor": patch
---

The video toolbar's Width control now shows a width that isn't one of its presets. A video with any other width, such as the 600px the BeeFree importer writes for a video with no explicit width, or an integer in API- or agent-written JSON, showed a blank select, and touching it overwrote the width. Width now works like the image toolbar's: Full Width, 300px, 400px, 500px or Custom, with a px input for Custom. Any other width reads as Custom with its value in the input, so authors can see it and type any width.
