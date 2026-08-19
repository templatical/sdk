---
title: Rendering & Export
description: Turn a template into MJML or sending-ready HTML — locally, on your own backend, or with a single mjml2html endpoint.
---

# Rendering & Export

Two methods on every editor instance:

```ts
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

## The two conversions

```
template JSON  ──▶  MJML  ──▶  HTML
```

**Template JSON → MJML** requires Templatical's block model: sections, columns, merge tags, display conditions, custom blocks. [`@templatical/renderer`](/api/renderer-typescript) does this, and it runs in the browser.

**MJML → HTML** requires an MJML compiler. It is generic — any compiler produces the same result, and none of them knows anything about Templatical. **The SDK does not bundle one**: compiling MJML is a separate, well-served concern and outside Templatical's scope, so `toHtml()` requires an implementation from you.

Each conversion can run in the browser or on your backend, which gives three arrangements:

<!-- prettier-ignore -->
| You provide | The SDK does | You get | Where `@templatical/renderer` runs |
| --- | --- | --- | --- |
| an MJML compiler endpoint | template → MJML, in the browser | `toMjml()` and `toHtml()` | **in your frontend bundle** |
| `toMjml` + `toHtml` | nothing | `toMjml()` and `toHtml()` | **on your backend**, if you use it there — never in the browser |
| nothing | template → MJML, in the browser | `toMjml()` only | **in your frontend bundle** |

## MJML → HTML on your backend

**You provide** one endpoint that takes MJML and returns HTML.
**The SDK** renders the template to MJML in the browser and hands it over.
**You get** `toMjml()` and `toHtml()`.
**You install** `@templatical/renderer` **in your frontend app**, next to the editor. Your backend needs only an MJML compiler — it never sees Templatical's block model.

Point one config key at any `mjml2html` endpoint and `toHtml()` starts working:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  render: {
    compileMjml: async (mjml) => {
      const res = await fetch('/api/mjml', { method: 'POST', body: mjml });
      return res.text();
    },
  },
});

const html = await editor.toHtml();
```

Your endpoint performs only the second conversion, which makes this the smallest thing a backend can do and still produce HTML. `mjml2html(input)` is the entire implementation — a hosted compiler, a container or an `mjml` CLI shell-out all satisfy it equally.

That matters most off Node: implementing `toMjml` means running our TypeScript renderer somewhere, while implementing `compileMjml` from Laravel, Rails, Django or Go is a few lines against a tool that already exists.

## Template → MJML → HTML on your backend

**You provide** `toMjml` and `toHtml`, each taking the template and returning finished markup.
**The SDK** renders nothing — the browser produces no email markup at all.
**You get** `toMjml()` and `toHtml()`.
**You install** nothing in the frontend. Your backend needs something that turns the block model into MJML: `@templatical/renderer` **server-side** if it runs Node (see [Headless rendering](#headless-rendering)), or your own implementation in any other language.

```ts
const editor = await init({
  container: '#editor',
  render: {
    toMjml: async (payload) => {
      const res = await fetch('/api/render/mjml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.text();
    },

    toHtml: async (payload) => {
      const res = await fetch('/api/render/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.text();
    },
  },
});
```

The package is never installed, imported or fetched: the local path sits behind a dynamic `import()` that only the fallback reaches, and a provider answering both calls means the fallback is never taken.

Pick this when your backend already renders email. You keep one renderer instead of two, and the MJML your users preview is the MJML you send.

`toMjml` alone moves the first conversion off the client. Pair it with `compileMjml` rather than `toHtml` if your backend produces MJML but leans on a separate tool to compile it.

## The contract

```ts
interface RenderPayload {
  /** Custom blocks already resolved into `renderedHtml`. */
  content: TemplateContent;
  fonts?: { customFonts: CustomFont[]; defaultFallback: string };
}

interface RenderProvider {
  toMjml?(payload: RenderPayload): Promise<string>;
  toHtml?(payload: RenderPayload): Promise<string>;
  compileMjml?(mjml: string): Promise<string>;
}
```

Every method is **independently optional**, and the editor resolves each on its own:

<!-- prettier-ignore -->
| Call | Order |
| --- | --- |
| `toMjml()` | `render.toMjml` → the local `@templatical/renderer` → reject |
| `toHtml()` | `render.toHtml` → `toMjml()`'s result + `render.compileMjml` → reject |

So the package requirement follows from **which methods you implement**, not from whether you configured `render` at all:

<!-- prettier-ignore -->
| Your provider | `@templatical/renderer` in the browser bundle? |
| --- | --- |
| *(no `render` key)* | **Yes** — `toMjml()` renders locally, `toHtml()` rejects |
| `{ compileMjml }` | **Yes** — the SDK renders the MJML, your endpoint compiles it |
| `{ toHtml }` | **Yes**, but only if you also call `toMjml()` |
| `{ toMjml }` | **No** — though `toHtml()` rejects |
| `{ toMjml, compileMjml }` | **No** |
| `{ toMjml, toHtml }` | **No** — nothing renders in the browser |

That table is about your **frontend** bundle. Whatever your backend uses to satisfy `toMjml` is a separate choice — often the same package, imported server-side.

`compileMjml` performs the second conversion only; something still has to produce the MJML, and without `render.toMjml` that is the local renderer. **`toMjml` is the method that moves rendering off the client.**

**There is no local HTML path.** With neither `toHtml` nor `compileMjml`, `toHtml()` rejects with an error naming the method to add, rather than guessing at a compiler that isn't there.

::: tip `toHtml()` composes through `toMjml()`
A provider supplying `toMjml` *and* `compileMjml` but not `toHtml` gets HTML built from **your** MJML, not the local renderer's. A backend that can render is authoritative and shouldn't be bypassed on the way to HTML.
:::

## The payload

A provider wins over the local renderer, so the editor hands over everything a backend cannot work out for itself. The payload is **render-complete**:

- **Custom blocks are already resolved.** `content` arrives with every custom block's `renderedHtml` filled in. Without this the failure is silent: a renderer given a custom block with neither a resolver nor `renderedHtml` **omits it from the output**. The HTML comes from your liquid template plus the block's field values, and the definition is registered in the browser, so there is nothing a server could do with it.
- **Fonts are resolved.** `fonts` carries the custom faces the editor is rendering with, plus the fallback stack for anything unmatched — assembled from `init({ fonts })`, which is not reconstructible from the template JSON.
- **`content` is a defensive copy.** Mutate it freely; the user's document is untouched.

## Template → MJML in the browser

**You provide** nothing.
**The SDK** renders the template to MJML in the browser.
**You get** `toMjml()`. `toHtml()` rejects, because no compiler is available.
**You install** `@templatical/renderer` **in your frontend app**.

With no `render` provider — or one implementing `compileMjml` alone — `toMjml()` uses [`@templatical/renderer`](/api/renderer-typescript), an optional peer dependency, MIT-licensed. Install it where you export from:

```bash
npm install @templatical/renderer
```

`toMjml()` lazy-imports it on first call and rejects with a clear error naming the package if it isn't installed. Custom blocks resolve through the editor's own registry, and your configured fonts are wired in automatically.

::: tip Loading from the CDN?
There is nothing to install. The CDN build is self-contained, so `@templatical/renderer` ships with it as a code-split chunk that loads on the first `toMjml()` call.
:::

## Headless rendering

Outside the editor, call the renderer directly:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content, {
  renderCustomBlock: async (block) => myLiquid.render(block),
});
```

### Overriding a block type

`blockRenderers` replaces the built-in renderer for a given `block.type`:

```ts
const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => `<mj-image src="${countdownGifUrl(block)}" />`,
    video: (block, ctx) => renderVideoWithPlayButton(block, ctx),
  },
});
```

It generalises `renderCustomBlock` from one block type to any. A backend whose output is a *superset* of the browser's can inject exactly that delta instead of forking the renderer, and parity for every other block type then holds by construction. Templatical Cloud uses it for two blocks: a server-generated animated countdown GIF and a composited video play button.

An override owns everything the built-in did, including the hidden-on-all-viewports early return.

### Blocks with no renderer

A block type with neither a built-in renderer nor a `blockRenderers` override emits a placeholder comment and logs a warning:

```html
<mj-raw><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw>
```

`countdown` is the only built-in block that lands here today. A block hidden on every viewport still renders nothing and warns about nothing, since that is what its author asked for.

::: tip Why a marker and not a throw
The renderer runs inside send pipelines, where killing an entire render over one block is worse than shipping a marked gap. Silence is worse still: a countdown vanishing from a marketing email reaches recipients as a missing section with nothing explaining why. The marker is greppable, so a pipeline can refuse to ship one.
:::

Both halves are exported, so nothing has to hardcode the marker text:

```ts
import {
  UNRENDERABLE_MARKER_PREFIX,
  renderUnrenderableBlock,
} from "@templatical/renderer";

if (mjml.includes(UNRENDERABLE_MARKER_PREFIX)) {
  throw new Error("Refusing to send: a block in this template rendered as a gap.");
}
```

`UNRENDERABLE_MARKER_PREFIX` is the marker's stable leading text — scan for it before shipping. `renderUnrenderableBlock(block)` emits one and logs the warning, so a `blockRenderers` override can degrade the same way for a variant it cannot handle, instead of returning `""` and reintroducing a silent drop.

## Reference

- [`@templatical/renderer` API](/api/renderer-typescript)
- [Saving & Loading](/backend/templates) — the save/load lifecycle, deliberately separate from this
- [Custom Blocks](/guide/custom-blocks) — why pre-rendering is part of the payload

**Using Templatical Cloud?** It implements this contract with nothing to configure — see [Rendering on Cloud](/cloud/rendering).
