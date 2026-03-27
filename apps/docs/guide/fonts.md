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

const editor = init({
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

## CustomFont

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Display name in the font picker |
| `url` | `string` | URL to the font CSS (e.g., Google Fonts link) |
| `fallback` | `string` | Optional fallback font stack for this font |

Custom fonts are automatically included as `<mj-font>` declarations in the rendered MJML output.

## Best practices

- **Always set a fallback** — Most email clients don't support custom fonts. The fallback stack ensures your email still looks good when the custom font doesn't load.
- **Limit font weights** — Only include the weights you actually need (e.g., `wght@400;700`). Extra weights increase load time for recipients.
- **Stick to 1-2 custom fonts** — Too many fonts slow down rendering and make the design inconsistent. One for headings and one for body text is a common pattern.
- **Test across clients** — Gmail, Outlook, and Apple Mail all handle fonts differently. Gmail supports Google Fonts in most cases, but Outlook falls back to system fonts.
