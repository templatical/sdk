---
"@templatical/editor": patch
---

The rich-text link dialog no longer turns a relative path into a broken URL. `/contact`, `./pricing`, `../pricing` and `?ref=footer` are stored as typed (where they used to become `https:///contact`), matching what the button and image URL fields already did, and the new `link.relative-url` quality rule flags them. A protocol-relative `//cdn.example.com/x` becomes `https://cdn.example.com/x` (it used to become `https:////cdn.example.com/x`). The `paletteBlocks` JSDoc now says that an empty array shows the full default palette, as omitting the option does.
