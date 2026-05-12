---
title: Theming
description: Customize the editor's appearance with CSS variables, theme overrides, dark mode, and custom fonts.
---

# Theming

Templatical ships with a polished default theme. Two ways to override any color, radius, shadow, or font:

1. **CSS variables on the container** (`--tpl-user-*`) — the recommended approach. Works in both shadow DOM (default) and light DOM modes. Pure CSS — no JS round-trip.
2. **`ThemeOverrides` config** (JSON) — pass colors at `init()` time. Useful when colors come from runtime data (user preference, multi-tenant brand config).

Both approaches can be combined — the `ThemeOverrides` config takes precedence because it applies as inline styles, which beat class-bound variables.

## CSS variables on the container

Set `--tpl-user-*` variables on the container you pass to `init()` (or any ancestor). They inherit across the [shadow boundary](./shadow-dom) into the editor's root and override the built-in defaults:

```html
<div
  id="editor"
  style="
    --tpl-user-primary: oklch(65% 0.2 280);
    --tpl-user-primary-hover: oklch(58% 0.2 280);
    --tpl-user-primary-light: oklch(94% 0.05 280);
    --tpl-user-radius: 14px;
  "
></div>
```

Or in a stylesheet:

```css
#editor {
  --tpl-user-primary: oklch(65% 0.2 280);
  --tpl-user-primary-hover: oklch(58% 0.2 280);
  --tpl-user-primary-light: oklch(94% 0.05 280);
  --tpl-user-radius: 14px;
}
```

CSS-custom-property inheritance crosses shadow roots, so the variables you set in the host page reach the editor regardless of mount mode. You don't need separate code paths for `shadowDom: true` vs `shadowDom: false`.

### Light-mode tokens

Every token follows the same shape: declare `--tpl-user-<name>` on the container to override the SDK default.

| Override variable            | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `--tpl-user-bg`              | Main background                       |
| `--tpl-user-bg-elevated`     | Elevated surfaces (panels, dropdowns) |
| `--tpl-user-bg-hover`        | Hover state background                |
| `--tpl-user-bg-active`       | Active/pressed state background       |
| `--tpl-user-border`          | Default border color                  |
| `--tpl-user-border-light`    | Subtle border (dividers, separators)  |
| `--tpl-user-text`            | Primary text                          |
| `--tpl-user-text-muted`      | Secondary text                        |
| `--tpl-user-text-dim`        | Disabled or hint text                 |
| `--tpl-user-primary`         | Primary brand color (buttons, links)  |
| `--tpl-user-primary-hover`   | Primary hover state                   |
| `--tpl-user-primary-light`   | Primary tinted background             |
| `--tpl-user-secondary`       | Secondary accent color                |
| `--tpl-user-secondary-hover` | Secondary hover state                 |
| `--tpl-user-secondary-light` | Secondary tinted background           |
| `--tpl-user-success`         | Success state color                   |
| `--tpl-user-success-light`   | Success tinted background             |
| `--tpl-user-warning`         | Warning state color                   |
| `--tpl-user-warning-light`   | Warning tinted background             |
| `--tpl-user-danger`          | Danger/error state color              |
| `--tpl-user-danger-light`    | Danger tinted background              |
| `--tpl-user-canvas-bg`       | Canvas area behind the email template |
| `--tpl-user-radius`          | Default border radius (`10px`)        |
| `--tpl-user-radius-sm`       | Small border radius (`7px`)           |
| `--tpl-user-radius-lg`       | Large border radius (`14px`)          |
| `--tpl-user-font-family`     | UI font stack                         |
| `--tpl-user-shadow-sm`       | Subtle shadow                         |
| `--tpl-user-shadow`          | Default shadow                        |
| `--tpl-user-shadow-md`       | Medium shadow                         |
| `--tpl-user-shadow-lg`       | Large shadow                          |
| `--tpl-user-shadow-xl`       | Extra-large shadow                    |
| `--tpl-user-overlay`         | Modal backdrop overlay                |
| `--tpl-user-ring`            | Focus ring                            |
| `--tpl-user-transition`      | Spring easing transition              |

### Dark-mode tokens

Dark mode uses a parallel `--tpl-user-dark-*` namespace, so you can theme light and dark independently:

```css
#editor {
  /* Light overrides */
  --tpl-user-primary: oklch(65% 0.2 280);

  /* Dark overrides */
  --tpl-user-dark-primary: oklch(75% 0.16 280);
  --tpl-user-dark-bg: oklch(18% 0.005 280);
  --tpl-user-dark-text: oklch(94% 0.005 280);
}
```

Replace `--tpl-user-` with `--tpl-user-dark-` in any token name from the table above to target dark mode. The editor activates dark mode via `data-tpl-theme="dark"` on its root and reads the dark-namespace defaults; your `--tpl-user-dark-*` overrides plug in there.

Dark mode is opt-in via the `uiTheme` config — set `'dark'` or `'auto'` to enable. See [Dark mode](#dark-mode) below.

## ThemeOverrides config

Use the `theme` field of `init()` when you need to apply theme overrides programmatically (multi-tenant branding, user preference toggles, etc.):

```ts
import { init } from "@templatical/editor";

const editor = await init({
  container: "#editor",
  theme: {
    primary: "#6d28d9",
    primaryHover: "#5b21b6",
    primaryLight: "#ede9fe",
    bg: "#fafafa",
    text: "#1a1a1a",
  },
});
```

`ThemeOverrides` is applied as inline styles on the editor's `.tpl` root, so it wins over the class-bound defaults and over any `--tpl-user-*` variables you've set on the container.

### Available config keys

The JSON keys mirror the CSS variable names (camelCase instead of kebab-case). All keys are optional — unset keys fall back to `--tpl-user-*` or the built-in default.

| Token            | Purpose                               |
| ---------------- | ------------------------------------- |
| `bg`             | Main background                       |
| `bgElevated`     | Elevated surfaces                     |
| `bgHover`        | Hover state background                |
| `bgActive`       | Active/pressed state background       |
| `border`         | Default border color                  |
| `borderLight`    | Subtle border                         |
| `text`           | Primary text                          |
| `textMuted`      | Secondary text                        |
| `textDim`        | Disabled or hint text                 |
| `primary`        | Primary brand color                   |
| `primaryHover`   | Primary hover state                   |
| `primaryLight`   | Primary tinted background             |
| `secondary`      | Secondary accent color                |
| `secondaryHover` | Secondary hover state                 |
| `secondaryLight` | Secondary tinted background           |
| `success`        | Success state color                   |
| `successLight`   | Success tinted background             |
| `warning`        | Warning state color                   |
| `warningLight`   | Warning tinted background             |
| `danger`         | Danger/error state color              |
| `dangerLight`    | Danger tinted background              |
| `canvasBg`       | Canvas area behind the email template |

### TypeScript type

```ts
import type { ThemeOverrides } from "@templatical/types";
```

## Dark mode

The editor supports a dark theme for its UI chrome (header, sidebars, toolbar, modals). Dark mode is independent of the canvas dark-preview toggle, which simulates how emails look in recipients' dark-themed email clients.

### Activation

Set `uiTheme` in the init config. The default is `'auto'`, which follows the user's system preference via `prefers-color-scheme`.

```ts
const editor = await init({
  container: "#editor",
  uiTheme: "dark", // 'light' | 'dark' | 'auto'
});
```

### Runtime toggle

Switch the theme without re-initializing:

```ts
editor.setTheme("dark");
editor.setTheme("light");
editor.setTheme("auto"); // follow system preference
```

### Dark overrides via `ThemeOverrides`

Customize the dark palette separately using the `dark` key inside `theme`:

```ts
const editor = await init({
  container: "#editor",
  uiTheme: "auto",
  theme: {
    // Light mode overrides
    primary: "#6d28d9",
    primaryHover: "#5b21b6",
    // Dark mode overrides
    dark: {
      primary: "#a78bfa",
      primaryHover: "#c4b5fd",
      bg: "#1e1e2e",
      bgElevated: "#2a2a3c",
    },
  },
});
```

**Priority chain.** When dark mode is active, only `theme.dark` overrides are applied as inline styles. Unset dark tokens fall back through `--tpl-user-dark-*` (if set on the container) to the built-in dark defaults.

| Scenario                                    | What applies                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Light mode, no overrides                    | Built-in light defaults                                                          |
| Light mode, `--tpl-user-*` on container     | Container overrides + remaining light defaults                                   |
| Light mode, `theme` config                  | `theme` overrides + container `--tpl-user-*` + remaining light defaults          |
| Dark mode, no overrides                     | Built-in dark defaults                                                           |
| Dark mode, `--tpl-user-dark-*` on container | Container overrides + remaining dark defaults                                    |
| Dark mode, `theme.dark` config              | `theme.dark` overrides + container `--tpl-user-dark-*` + remaining dark defaults |

### TypeScript types

```ts
import type { ThemeOverrides, UiTheme } from "@templatical/types";

// UiTheme = 'light' | 'dark' | 'auto'
// ThemeOverrides includes a `dark?: Omit<ThemeOverrides, 'dark'>` key
```

## Why two override surfaces?

CSS variables on the container are simpler when:

- Theme colors are static or known at build time.
- You want the same theme tokens to apply to both the editor and your surrounding UI (set them on a shared wrapper).
- You're using CSS Modules, Tailwind, or another style system that already deals in CSS variables.

`ThemeOverrides` JSON is simpler when:

- Theme colors come from runtime data (user account preferences, multi-tenant branding).
- You're working in a framework that doesn't naturally expose a single styled container element.
- You want a single typed API surface and don't want to spell variable names by hand.

Both surfaces compose: container variables provide the default, `ThemeOverrides` patches specific tokens on top. The editor's `theme` config option always wins because it applies as inline styles.

## Matching your own UI to the editor's theme

If you want your surrounding chrome (e.g. a wrapper toolbar or status bar) to inherit the editor's palette, set the override variables on a wrapper that contains both your UI and the editor, then reference them from both:

```html
<div
  class="my-app"
  style="--tpl-user-primary: #6d28d9; --tpl-user-bg: #fafafa;"
>
  <header class="my-app__header">…</header>
  <div id="editor"></div>
</div>
```

```css
.my-app__header {
  background: var(--tpl-user-bg);
  color: var(--tpl-user-primary);
}
```

In shadow-DOM mode (the default), the editor's internal `--tpl-*` variables stay inside the shadow root and aren't visible to host CSS. Your host CSS reads from the `--tpl-user-*` variables you set yourself, so the two stay in sync.

See the [Shadow DOM guide](./shadow-dom) for the mechanics of how variables cross the boundary.
