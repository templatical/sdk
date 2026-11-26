---
title: Custom Fonts
description: Configure font choices and fallbacks for the editor canvas and exported email.
---

# Custom Fonts

Configure font choices with `fonts`; a font selected for a block or for text in the paragraph toolbar uses the same fallback stack on the canvas and in the exported email. Custom fonts also produce an `<mj-font>` declaration in the rendered MJML output. The toolbar stores the selected family in the template, so changing its configured fallback affects later renders.

Configure which fonts are available using the `fonts` option:

```ts
import type { FontsConfig } from '@templatical/types';
import { init } from '@templatical/editor';

const fonts: FontsConfig = {
  defaultFont: 'Inter',
  defaultFallback: 'Arial, sans-serif',
  customFonts: [
    {
      name: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
      fallback: 'Helvetica, Arial, sans-serif',
    },
    {
      name: 'Merriweather',
      url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
      fallback: 'Georgia, serif',
    },
  ],
};

const editor = await init({
  container: '#editor',
  fonts,
});
```

## FontsConfig

| Property | Type | Description |
|---|---|---|
| `defaultFont` | `string` | Font name selected by default in new templates |
| `defaultFallback` | `string` | Fallback stack added after a font that has none of its own: a custom font without a `fallback`, or any single family that isn't a built-in (such as `Helvetica Neue`). A full stack is used as written. The editor canvas applies the same fallbacks, so it previews the font as recipients get it. |
| `customFonts` | `CustomFont[]` | List of custom fonts to register |
| `builtIns` | `boolean \| string[]` | Restrict which built-in fonts appear in the picker (see [below](#restricting-the-built-in-fonts)) |

## CustomFont

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Display name in the font picker |
| `url` | `string` | URL to the font CSS (e.g., Google Fonts link) |
| `fallback` | `string` | Optional fallback font stack for this font |

Custom fonts are automatically included as `<mj-font>` declarations in the rendered MJML output.

## Inline font fallbacks

The paragraph text toolbar stores a selected font as an inline `font-family` on the selected text. A custom font uses its `fallback`, or `defaultFallback` when it has none; a built-in uses its built-in stack. A complete inline stack keeps its own fallbacks. The editor canvas, edit surface and exported email apply the same resolved stack. For example, selecting `Inter` from the configuration above renders that text with `'Inter', Helvetica, Arial, sans-serif` as its font family. Check it by selecting text in a paragraph, choosing `Inter`, and comparing the canvas with the exported HTML.

## Restricting the built-in fonts {#restricting-the-built-in-fonts}

By default the picker offers all seven built-in web-safe fonts (Arial, Helvetica, Georgia, Times New Roman, Verdana, Trebuchet MS, Courier New) alongside your `customFonts`. Use `builtIns` to narrow that list — useful when you embed the editor as a white-label / brand-kit tool and want authors to stay on approved typefaces.

```ts
import type { FontsConfig } from '@templatical/types';

const fonts: FontsConfig = {
  builtIns: ['Georgia', 'Arial'],
};
```

[Open in playground](https://play.templatical.com/scenes/fonts)

- `true` or omitted — all seven built-ins are offered (the default).
- `false` — no built-ins; the picker lists only your `customFonts`.
- `string[]` — an allowlist of built-in names to keep, matched case-insensitively. A name that isn't a built-in is logged with a warning and skipped.

Restricting the list doesn't change existing content. A custom font can still be the `defaultFont` when every built-in is excluded, and content already using a hidden built-in still renders with its proper fallback stack. Its picker shows that font too, so the select matches what the email renders: the block, the selected text or Template Settings lists it until the author picks an offered font, and it can't be chosen anywhere else.

If you exclude the family that new templates start on — Arial by default, or whatever you set as `defaultFont` — the editor logs a development warning at startup, because authors would land on a font the picker can't reselect. Either keep that family in `builtIns`, or set `defaultFont` to one you do offer.

## Best practices

- **Always set a fallback** — Most email clients don't support custom fonts. The fallback stack ensures your email still looks good when the custom font doesn't load.
- **Limit font weights** — Only include the weights you actually need (e.g., `wght@400;700`). Extra weights increase load time for recipients.
- **Stick to 1-2 custom fonts** — Too many fonts slow down rendering and make the design inconsistent. One for headings and one for body text is a common pattern.
- **Test across clients** — Gmail, Outlook, and Apple Mail all handle fonts differently. [caniemail reports no `@font-face` support in Gmail](https://www.caniemail.com/features/css-at-font-face/), and Outlook also falls back to system fonts.
