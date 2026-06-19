---
"@templatical/editor": minor
---

Add a `paletteBlocks` config option to reorder and filter the block palette (#232)

`init({ paletteBlocks: [...] })` now accepts an allowlist that controls which block types appear in the sidebar palette and in what order. Only the listed types are shown, in the given order — unlisted built-ins (e.g. `video`, `table`) are hidden. Reference built-ins by their bare type (`"image"`) and custom blocks by their `custom:`-prefixed type (`"custom:qrcode"`), so the two can be interleaved freely. Unknown entries (a typo, an unregistered custom block) are logged with a warning and skipped. Filtering the palette never affects rendering — existing content that uses a hidden block type still renders correctly. Omit `paletteBlocks` for the full default palette.
