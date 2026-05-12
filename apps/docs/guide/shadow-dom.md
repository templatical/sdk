---
title: Shadow DOM
description: How Templatical isolates the editor from host page CSS using Shadow DOM, and when to opt out.
---

# Shadow DOM

Templatical mounts inside a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) by default. The shadow boundary isolates the editor's chrome, canvas, and rich-text content from your host page's CSS — even global resets like `* { color: red !important }` cannot cascade past it.

This page is the canonical reference for the isolation model. If you just want to theme the editor, jump to the [theming guide](./theming).

## How it works

When you call `init()` or `initCloud()` and pass a container element, Templatical:

1. Calls `container.attachShadow({ mode: 'open' })` to create a shadow root on your element.
2. Mounts the Vue app inside the shadow root instead of replacing the container's children directly.
3. Adopts a single shared `CSSStyleSheet` containing every Tailwind utility, every SFC `<style>` block, and `styles/index.css` via `adoptedStyleSheets`.

All editor styles live inside the shadow root, so they cannot leak out. All host-page styles stop at the shadow boundary, so they cannot leak in. The mode is **`open`** — `container.shadowRoot` is non-null, and DevTools can fully inspect the tree.

## Default behavior

You get the boundary for free with no configuration:

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  // shadowDom: true is the default — omit unless you want light DOM
});
```

After mount, the DOM looks like this:

```html
<div id="editor">
  #shadow-root (open)
  <link rel="stylesheet" href="…" />
  <!-- adopted stylesheet -->
  <div class="tpl tpl-editor-host">
    <!-- editor chrome, sidebars, canvas, toolbars -->
  </div>
</div>
```

The editor's `tpl:` Tailwind prefix and `.tpl-*` SDK classes are still in use under the hood, but the shadow boundary makes them functionally redundant for collision protection. They remain in place so the [opt-out mode](#opt-out-shadowdom-false) keeps working.

## Why this exists

The `tpl:` prefix only protects one direction: editor utilities can never collide with host classes. It does **nothing** to stop the other direction — a host-page rule like `p { font-family: Comic Sans }` will cascade into every paragraph inside the editor, including ones inside the canvas preview.

Shadow DOM is the only standards-based way to block that cascade. The same approach is used by Stripe Elements, Intercom widgets, and most embeddable third-party UIs. See [issue #70](https://github.com/templatical/sdk/issues/70) for the original report.

## Why it's the default

Shadow DOM guarantees no style leaks between the host page and the editor UI — host CSS cannot cascade into the editor, and editor CSS cannot bleed into your app. Templatical enables that guarantee by default, rather than as an opt-in, because the conditions that make it necessary apply to nearly every host page:

- **Global resets, design systems, and framework preflight are everywhere.** Tailwind, Bootstrap, Material UI, Chakra, Mantine — every modern stack ships rules like `* { box-sizing: border-box }` and `body { font-family: … }`. Without the shadow boundary, every editor element would inherit whatever your host page declares.
- **The canvas renders email-like content, where typography and spacing matter most.** A host `body { font-family: Comic Sans }` cascading into the preview corrupts every template before it is exported.
- **Each editor on the page gets its own scope.** With multiple editors mounted side by side (e.g. draft + preview, A/B comparison), each shadow root isolates theming and host targeting per instance — host overrides on one don't reach the other.
- **Form controls in toolbars and dialogs would inherit host styling.** Text inputs, select dropdowns, and buttons would render with the host page's padding, fonts, and focus rings — different per consumer.

## Trade-offs

What you give up by mounting inside a shadow root:

- **Host-side `document.querySelector` cannot see editor internals.** Walk the shadow root: `container.shadowRoot.querySelector(...)`.
- **Browser minimums bump up.** The adopted-stylesheet path needs Chrome 80+, Edge 80+, Firefox 101+, and Safari 16.4+. If you need older Firefox or Safari, [opt out](#opt-out-shadowdom-false).
- **The container must be eligible to host a shadow root.** The HTML spec restricts `attachShadow()` to a specific element list — `<div>`, `<span>`, `<section>`, `<article>`, `<aside>`, `<header>`, `<footer>`, `<main>`, `<nav>`, `<p>`, `<blockquote>`, and custom elements with a hyphenated name. `<table>`, `<tr>`, `<td>`, `<form>`, `<input>`, `<button>`, `<select>`, list elements (`<ul>`, `<ol>`, `<li>`), `<iframe>`, and replaced elements (`<img>`, `<video>`, etc.) are not allowed. Use a `<div>`.
- **Fonts are the one intentional global escape.** Web fonts inside shadow roots are unreliable across browsers (Safari's `@font-face` resolution from inside a shadow root has historically been broken). Templatical's font loader still appends `<link>` tags to `document.head` so font requests resolve at document level. This is the only side effect on the host page.

## Theming via `:host`

Host-page CSS can set CSS variables on the container, and the values inherit across the shadow boundary into the editor. Templatical defines every design token as `var(--tpl-user-<name>, <default>)`, so any `--tpl-user-*` override on the container (or any ancestor) wins over the default.

```css
/* Override the editor's primary color from the host page */
#editor {
  --tpl-user-primary: oklch(65% 0.2 280);
  --tpl-user-primary-hover: oklch(58% 0.2 280);
  --tpl-user-primary-light: oklch(94% 0.05 280);

  /* Dark-mode equivalents live in the --tpl-user-dark-* namespace */
  --tpl-user-dark-primary: oklch(75% 0.16 280);
}
```

Set the variables on the container that you pass to `init()` (or any ancestor) and the editor inherits them.

See the [theming guide](./theming) for the full token list and dark-mode handling.

## Opt-out: `shadowDom: false`

When you'd opt out:

- Your host integration relies on light-DOM `document.querySelector` to reach into the editor (for testing harnesses, third-party widget wiring on custom blocks, etc.).
- You need to support Firefox 80–100 or Safari 14–16.3 — the `adoptedStyleSheets` API is missing there.
- Your container is locked to an element type that cannot host a shadow root (table cell, form field, etc.).

```ts
const editor = await init({
  container: "#editor",
  shadowDom: false,
});
```

What you lose:

- Host CSS cascades into the editor again. The `tpl:` prefix protects class-name collisions; the hand-rolled `.tpl` reset block in `styles/index.css` protects font, button, and form defaults, but **arbitrary host rules targeting bare tags (`p`, `a`, `input`) will bleed in**.

What still works:

- Every other feature is identical: same blocks, same i18n, same cloud features, same API surface. The boundary is the only change.

### Hardening light-DOM mode against host CSS

If you opt out of shadow DOM, mount the editor inside a container that explicitly resets inherited host declarations before they reach the editor. The editor's built-in `.tpl` reset covers chrome font, button, scrollbar, and focus styles — but host rules that target bare tags (`p`, `a`, `input`, `*`) still cascade into the canvas in light-DOM mode.

The simplest mitigation is one CSS line on the container:

```css
#editor {
  /* Nullify author-layer host styles on this boundary so the editor's
     own .tpl stylesheet is the only thing that applies inside. */
  all: revert-layer;
}
```

`all: revert-layer` is the most surgical option — it strips author-layer styles (host CSS, framework resets, CSS-in-JS injections) on the container while preserving the browser's user-agent defaults. The editor's own scoped styles inside `.tpl` then apply normally.

Other options:

- **Scope aggressive global rules.** Rewrite `* { … }` or bare-tag rules so they don't match descendants of the editor container — e.g. `.my-app:not(#editor *) p { … }`.
- **Reset on a wrapper that excludes the editor.** Apply your CSS reset to a wrapper that contains your app chrome but NOT the editor container.
- **Avoid `!important` on tag-selector rules.** `p { font: … !important }` is the worst offender for light-DOM mode because it overrides the editor's own font-family declarations.

In default shadow-DOM mode none of this is necessary — the boundary handles it for you. The `all: revert-layer` line is harmless to add even when `shadowDom: true` (it applies to the container, not the editor's internals).

## Targeting editor internals from the host

In shadow DOM mode, the container exposes a non-null `shadowRoot`. Pierce it explicitly:

```ts
const container = document.querySelector("#editor");
const block = container.shadowRoot?.querySelector('[data-block-id="abc-123"]');
```

Built-in browser tooling that walks light DOM (e.g. `document.querySelectorAll('.tpl-block')`) returns an empty set in shadow mode — you must enter the shadow root explicitly. Custom-block integrations that need host-side access should either:

1. Use `container.shadowRoot.querySelector(...)` (works without opt-out), or
2. Pass `shadowDom: false` if the integration cannot be rewritten.

## Debugging tips

**DevTools.** The shadow root is `open`, so the Elements panel renders it inline with a `#shadow-root (open)` label. Click to expand. Computed styles, layout, and inspect-on-hover all work normally.

**Playwright.** Locators built with `page.locator()` and `page.getByTestId()` automatically pierce open shadow roots. No `>>>` shadow-pierce selector is needed for `data-testid` matches. CSS selectors that walk shadow boundaries explicitly (`#editor >>> .tpl-canvas`) also work.

**ProseMirror selection.** The TipTap rich-text editor uses ProseMirror under the hood. ProseMirror 1.41+ detects shadow roots automatically and reads selection via `view.root.getSelection()`. No additional wiring is needed.

**Host stylesheet experiments.** To prove the boundary is doing its job, open DevTools on the playground (`https://play.templatical.com`) and inject:

```js
const style = document.createElement("style");
style.textContent =
  "* { color: red !important; font-family: Comic Sans !important; }";
document.head.appendChild(style);
```

The host page goes red and ugly; the editor canvas and chrome remain untouched.

## FAQ

**Do web fonts loaded via `fonts` config work?**
Yes. The font loader explicitly injects `<link>` tags into `document.head` instead of the shadow root because `@font-face` resolution from inside shadow roots is unreliable. This is the one intentional global side effect.

**Does printing work?**
Yes. Adopted stylesheets honor `@media print` rules, and the editor's print layout is unaffected by the shadow boundary.

**Does TipTap text selection work across the shadow boundary?**
Yes. ProseMirror-view 1.41+ uses `view.root` (the shadow root in shadow mode) for selection APIs.

**Can I mount more than one editor on the page?**
Yes. Each `init()` call attaches a shadow root to its own container, and the per-container instance map keeps state isolated. Two editors on the same page do not share content, history, or selection state.

**Does the editor work inside an iframe?**
Yes. The iframe's `document` becomes the host, and the shadow root attaches as usual.

**Does CSS-in-JS (styled-components, emotion) from the host affect the editor?**
No. Host-side runtime style injection lands in `document.head`, which sits outside the shadow boundary.

**Does the host's Tailwind preflight reset the editor's typography?**
No. Tailwind preflight is global, so it lives in `document.head`, which the shadow boundary blocks.

**What if my framework's CSS reset (e.g. Bootstrap, Foundation) is present?**
Same answer — anything in `document.head` (or `document.body` `<style>` tags) is blocked.

## See also

- [Theming](./theming) — full design token list, dark mode, `:host` override patterns
- [API reference](../api/editor) — `shadowDom` config field and container element requirements
- [Custom blocks](./custom-blocks) — host-side query caveat for integrations
- [Installation](../getting-started/installation) — browser support tiers for default vs opt-out mode
