---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/import-mjml": patch
"@templatical/import-topol": patch
---

Social icons take a tone, separate from their shape

`SocialIconsBlock` gains an optional `iconTone`: `"brand"` (each platform's own color, the default and what an absent value means), `"dark"` or `"light"`. `iconStyle` stays the shape and gains `"plain"`, the glyph alone with no badge or outline. A filled shape draws the glyph white on the tone, or near-black on `"light"`; `outlined` and `plain` draw in the tone. The editor offers both as separate selects, Style and Color.

The renderer ships a PNG set for every style and tone: 6 × 3 sets of 17 platforms, about 1.9 MB in the package. A brand-colored icon keeps its URL, `{style}/{platform}.png`, byte for byte; a tone lives at `{style}-{tone}/{platform}.png`. If you self-host the icons through `socialIconsBaseUrl`, copy the new folders before using a tone or `plain`.

`@templatical/types` exports `SocialIconTone`, `SOCIAL_ICON_STYLES`, `SOCIAL_ICON_TONES`, `SOCIAL_ICON_TONE_COLORS`, `socialIconColors()` and `socialIconAssetDir()`, the rules the editor, the renderer and the PNG build share.

The MJML importer reads the style and tone back from a tone's folder, and the Topol importer maps its black-and-white `outlinedbw` set to `outlined` in `"dark"`.
