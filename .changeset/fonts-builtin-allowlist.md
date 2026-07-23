---
"@templatical/types": minor
"@templatical/editor": minor
---

Add a `fonts.builtIns` option to restrict which of the seven built-in fonts the font picker offers.

`builtIns: true` (or omitting it) keeps all seven built-ins — the current behaviour. `builtIns: false` drops them all so the picker lists only `customFonts`. A `builtIns: string[]` allowlist keeps just the named families, matched case-insensitively; a name that isn't a built-in is logged with a warning and skipped, the same way `paletteBlocks` treats an unknown entry.

Filtering only affects the picker: excluding a built-in never removes a custom font, a custom font stays usable as `defaultFont` when every built-in is excluded, and content already using an excluded family still resolves to its proper fallback stack. Non-breaking — the default is unchanged.
