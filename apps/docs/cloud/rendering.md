---
title: Rendering
description: How Templatical Cloud renders a template to MJML and HTML, and why it does not take a render provider.
---

# Rendering

Rendering is an [open contract](/backend/render). Templatical Cloud implements it — and it is the one provider `initCloud()` does **not** let you replace.

```ts
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

Nothing to configure, and nothing to install: no `@templatical/renderer` on your side, no MJML compiler, no render host.

## The adapter

| Method | Cloud |
| --- | --- |
| `toMjml` | Renders the saved template to MJML server-side |
| `toHtml` | Renders and compiles it to sending-ready HTML in one call |
| `compileMjml` | Compiles MJML you already have |

## What Cloud adds

Two things a browser cannot produce at render time:

- a **countdown block** resolves to a live, server-generated animated GIF;
- a **video block** gets a composited play button over the poster frame.

Everything else is identical, because Cloud runs the *published* `@templatical/renderer` with exactly those two functions injected. Nothing else can diverge.

## Constraints

- **Cloud renders the saved template**, so each `toMjml()` / `toHtml()` call saves first. A session that has never created a template gets a clear rejection instead of an export of nothing.
- **Rendering is not plan-gated.** Every plan renders the fonts the canvas is using.

## Bringing your own

You can't, inside `initCloud()`.

Cloud renders **server-side for delivery too**: test email, scheduled sends and API exports all go through its own renderer. A provider here would change `toMjml()` and `toHtml()` and nothing else, so what you preview and export would not be what Cloud sends.

Note this is a different rule from the one covering [templates](/cloud/templates), [version history](/cloud/version-history) and [comments](/cloud/comments) — rendering is stateless and needs no template id.

`initCloud({ render })` is therefore not on the config type, and a provider passed from JavaScript is ignored with a console warning.

If you want your own MJML on Cloud, call the renderer directly — it is a plain function over the content the editor already holds:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(editor.getContent());
```

That renders the *current* canvas rather than the stored copy, and produces the browser-side output rather than Cloud's superset. To own the whole pipeline, use [`init()`](/backend/render).

## Headless use

Render outside the editor entirely with the [headless API](/cloud/headless-api#export).
