---
title: Theming
description: Customize the editor appearance with theme overrides, dark mode, CSS variables, and custom fonts.
---

# Theming

Templatical ships with a polished default theme that works in both light and dark mode. You can override any color token to match your product's brand.

## Theme Overrides

Pass a `ThemeOverrides` object to `init()` to customize the editor's color palette:

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  theme: {
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    primaryLight: '#ede9fe',
    bg: '#fafafa',
    text: '#1a1a1a',
  },
});
```

### Available Tokens

All tokens are optional. Unset tokens fall back to the built-in defaults.

| Token | Purpose |
|---|---|
| `bg` | Main background |
| `bgElevated` | Elevated surfaces (panels, dropdowns) |
| `bgHover` | Hover state background |
| `bgActive` | Active/pressed state background |
| `border` | Default border color |
| `borderLight` | Subtle border (dividers, separators) |
| `text` | Primary text |
| `textMuted` | Secondary text |
| `textDim` | Disabled or hint text |
| `primary` | Primary brand color (buttons, links) |
| `primaryHover` | Primary hover state |
| `primaryLight` | Primary tinted background |
| `secondary` | Secondary accent color |
| `secondaryHover` | Secondary hover state |
| `secondaryLight` | Secondary tinted background |
| `success` | Success state color |
| `successLight` | Success tinted background |
| `warning` | Warning state color |
| `warningLight` | Warning tinted background |
| `danger` | Danger/error state color |
| `dangerLight` | Danger tinted background |
| `canvasBg` | Canvas area behind the email template |

### TypeScript Type

```ts
import type { ThemeOverrides } from '@templatical/types';
```

## Dark Mode

Control the editor's color scheme with the `darkMode` option:

```ts
const editor = init({
  container: '#editor',
  darkMode: 'auto', // 'auto' | true | false
});
```

| Value | Behavior |
|---|---|
| `false` | Always light mode (default) |
| `true` | Always dark mode |
| `'auto'` | Follows the user's system preference via `prefers-color-scheme` |

Theme overrides apply regardless of the dark mode setting. If you provide overrides, make sure they work well in the active mode.

::: tip
If you provide custom theme overrides, test them in both light and dark mode to make sure your colors work well in both. Use `darkMode: 'auto'` during development to quickly toggle between modes via your OS settings.
:::

## CSS Custom Properties

Every theme token maps to a CSS custom property prefixed with `--tpl-`. The `tpl-` prefix prevents conflicts with your application's own CSS variables, making the editor safe to embed in any page. You can use these variables in your own stylesheets to keep your surrounding UI consistent with the editor:

```css
.my-wrapper {
  background: var(--tpl-bg);
  color: var(--tpl-text);
  border: 1px solid var(--tpl-border);
}
```

The full list of CSS variables follows the token names: `--tpl-bg`, `--tpl-bg-elevated`, `--tpl-bg-hover`, `--tpl-bg-active`, `--tpl-border`, `--tpl-border-light`, `--tpl-text`, `--tpl-text-muted`, `--tpl-text-dim`, `--tpl-primary`, `--tpl-primary-hover`, `--tpl-primary-light`, `--tpl-secondary`, `--tpl-secondary-hover`, `--tpl-secondary-light`, `--tpl-success`, `--tpl-success-light`, `--tpl-warning`, `--tpl-warning-light`, `--tpl-danger`, `--tpl-danger-light`, `--tpl-canvas-bg`.

## Custom Fonts

Configure which fonts are available in the editor's font picker using the `fonts` option:

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

### FontsConfig

| Property | Type | Description |
|---|---|---|
| `defaultFont` | `string` | Font name selected by default in new templates |
| `defaultFallback` | `string` | Fallback stack used when a custom font is unavailable |
| `customFonts` | `CustomFont[]` | List of custom fonts to register |

### CustomFont

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Display name in the font picker |
| `url` | `string` | URL to the font CSS (e.g., Google Fonts link) |
| `fallback` | `string` | Optional fallback font stack for this font |

Custom fonts are automatically included as `<mj-font>` declarations in the rendered MJML output.

## Example: Branded Theme

A complete example combining theme overrides, dark mode, and custom fonts:

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  darkMode: 'auto',
  theme: {
    primary: '#0066cc',
    primaryHover: '#0052a3',
    primaryLight: '#e6f0ff',
    canvasBg: '#f0f0f0',
  },
  fonts: {
    defaultFont: 'Outfit',
    defaultFallback: 'Arial, sans-serif',
    customFonts: [
      {
        name: 'Outfit',
        url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap',
        fallback: 'Helvetica, Arial, sans-serif',
      },
    ],
  },
});
```
