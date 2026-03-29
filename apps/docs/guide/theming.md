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

