---
title: Custom Fonts
description: Configure custom fonts for the email editor's font picker.
---

# Custom Fonts

By default, the editor includes a set of common web-safe fonts (Arial, Georgia, Verdana, etc.) in the font picker. You can extend this list with your own fonts — for example, loading custom typefaces from Google Fonts or your own CDN. When a custom font is used, it's automatically included as an `<mj-font>` declaration in the rendered MJML output.

Configure which fonts are available using the `fonts` option:

```ts
import type { FontsConfig } from '@templatical/types';

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
| `defaultFallback` | `string` | Fallback stack used when a custom font is unavailable |
| `customFonts` | `CustomFont[]` | List of custom fonts to register |
| `builtIns` | `boolean \| string[]` | Restrict which built-in fonts appear in the picker (see [below](#restricting-the-built-in-fonts)) |

## CustomFont

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Display name in the font picker |
| `url` | `string` | URL to the font CSS (e.g., Google Fonts link) |
| `fallback` | `string` | Optional fallback font stack for this font |

Custom fonts are automatically included as `<mj-font>` declarations in the rendered MJML output.

## Restricting the built-in fonts

By default the picker offers all seven built-in web-safe fonts (Arial, Helvetica, Georgia, Times New Roman, Verdana, Trebuchet MS, Courier New) alongside your `customFonts`. Use `builtIns` to narrow that list — useful when you embed the editor as a white-label / brand-kit tool and want authors to stay on approved typefaces.

```ts
const fonts: FontsConfig = {
  // Keep only these built-ins, plus any customFonts:
  builtIns: ['Georgia', 'Arial'],
  // Or drop the built-ins entirely and offer only your custom fonts:
  // builtIns: false,
  customFonts: [
    /* ... */
  ],
};
```

- `true` or omitted — all seven built-ins are offered (the default).
- `false` — no built-ins; the picker lists only your `customFonts`.
- `string[]` — an allowlist of built-in names to keep, matched case-insensitively. A name that isn't a built-in is logged with a warning and skipped.

Restricting the list only affects the picker. A custom font can still be the `defaultFont` when every built-in is excluded, and content already using a hidden built-in still renders with its proper fallback stack.

If you exclude the family that new templates start on — Arial by default, or whatever you set as `defaultFont` — the editor logs a development warning at startup, because authors would land on a font the picker can't reselect. Either keep that family in `builtIns`, or set `defaultFont` to one you do offer.

## Best practices

- **Always set a fallback** — Most email clients don't support custom fonts. The fallback stack ensures your email still looks good when the custom font doesn't load.
- **Limit font weights** — Only include the weights you actually need (e.g., `wght@400;700`). Extra weights increase load time for recipients.
- **Stick to 1-2 custom fonts** — Too many fonts slow down rendering and make the design inconsistent. One for headings and one for body text is a common pattern.
- **Test across clients** — Gmail, Outlook, and Apple Mail all handle fonts differently. Gmail supports Google Fonts in most cases, but Outlook falls back to system fonts.
