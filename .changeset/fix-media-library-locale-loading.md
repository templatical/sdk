---
"@templatical/media-library": patch
---

Fix `es` (Spanish) and `ca` (Catalan) translations not loading in the media library. The locale loader now auto-discovers every locale file via `import.meta.glob` (matching the editor) instead of a hardcoded supported-locales list that omitted them, so both languages resolve correctly instead of falling back to English.
