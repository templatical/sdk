---
"@templatical/types": patch
"@templatical/editor": patch
"@templatical/renderer": patch
---

Centralize social-icon glyph data (SVG path + brand color) into a single `SOCIAL_ICON_GLYPHS` map in `@templatical/types`, shared by the editor's inline-SVG renderer and the renderer's PNG rasterizer (which previously each kept their own copy). Adding a platform to the `SocialPlatform` union is now a compile error until its glyph exists, so the editor and renderer can no longer drift out of sync. Social platform dropdown labels now resolve through i18n (`social.platforms`) instead of a hardcoded English name.
