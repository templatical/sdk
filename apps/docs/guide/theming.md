---
title: Theming
description: Customize the editor appearance with theme overrides, dark mode, CSS variables, and custom fonts.
---

# Theming

Templatical ships with a polished default theme. You can override any color token to match your product's brand.

## Theme Overrides

Pass a `ThemeOverrides` object to `init()` to customize the editor's color palette:

```ts
import { init } from '@templatical/editor';

const editor = await init({
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

The editor supports a dark theme for its UI chrome (header, sidebars, toolbar, modals). Dark mode is independent of the canvas dark preview toggle, which simulates how emails look in recipients' dark-themed email clients.

### Activation

Set `uiTheme` in the init config. The default is `'auto'`, which follows the user's system preference via `prefers-color-scheme`.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  uiTheme: 'dark', // 'light' | 'dark' | 'auto'
});
```

### Runtime Toggle

Switch the theme at runtime without re-initializing the editor:

```ts
editor.setTheme('dark');
editor.setTheme('light');
editor.setTheme('auto'); // follow system preference
```

### Dark Theme Overrides

Customize the dark palette separately from the light palette using the `dark` key inside `theme`:

```ts
const editor = await init({
  container: '#editor',
  uiTheme: 'auto',
  theme: {
    // Light mode overrides
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    // Dark mode overrides
    dark: {
      primary: '#a78bfa',
      primaryHover: '#c4b5fd',
      bg: '#1e1e2e',
      bgElevated: '#2a2a3c',
    },
  },
});
```

**Priority chain:** When dark mode is active, only `theme.dark` overrides are applied as inline styles. Unset dark tokens fall back to the built-in dark defaults. The base `theme` overrides (light) are only applied when in light mode.

| Scenario | What applies |
|---|---|
| Light mode, no overrides | Built-in light defaults |
| Light mode, with `theme` | `theme` overrides + remaining light defaults |
| Dark mode, no overrides | Built-in dark defaults |
| Dark mode, with `theme.dark` | `theme.dark` overrides + remaining dark defaults |

### TypeScript Types

```ts
import type { ThemeOverrides, UiTheme } from '@templatical/types';

// UiTheme = 'light' | 'dark' | 'auto'
// ThemeOverrides includes a `dark?: Omit<ThemeOverrides, 'dark'>` key
```

## CSS Custom Properties

Every theme token maps to a CSS custom property prefixed with `--tpl-`. The `tpl-` prefix prevents conflicts with your application's own CSS variables, making the editor safe to embed in any page. You can use these variables in your own stylesheets to keep your surrounding UI consistent with the editor:

```css
.my-wrapper {
  background: var(--tpl-bg);
  color: var(--tpl-text);
  border: 1px solid var(--tpl-border);
}
```

Each token maps to a CSS variable using the pattern `--tpl-{tokenName}` in kebab-case. For example, `bgElevated` becomes `--tpl-bg-elevated`.

In dark mode, the editor sets `data-tpl-theme="dark"` on its root element and reassigns all `--tpl-*` variables to dark values. If you reference these variables in your surrounding UI, they will automatically update when the editor switches themes.

