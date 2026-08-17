---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/editor": minor
"@templatical/renderer": minor
---

Rendering becomes a bring-your-own provider, and the editor grows `toHtml()`.

`init()` and `initCloud()` both take a new `render?: RenderProvider` key with the same type, so moving an integration between the two tiers is a deletion rather than a rewrite. Every method is independently optional, and each is resolved on its own:

| Call | Order |
| --- | --- |
| `editor.toMjml()` | `render.toMjml` → the bundled `@templatical/renderer` → reject |
| `editor.toHtml()` | `render.toHtml` → `toMjml()`'s result + `render.compileMjml` → reject |

**`compileMjml` is the cheap tier and the point of the whole shape.** MJML compilation is a commodity — a hosted service, a container, a CLI shell-out — whereas rendering Templatical's block model is not. Wire up that one function and `toHtml()` works while the SDK keeps rendering the MJML itself, so a non-Node backend never has to stand up a Node sidecar. There is deliberately **no local HTML path**: with neither `toHtml` nor `compileMjml`, `toHtml()` rejects with an error naming the method to add.

Provider methods receive a **render-complete** payload — custom blocks already resolved into `renderedHtml`, plus the editor's effective fonts. Both are things a backend cannot reconstruct from the template JSON, and the custom-block case failed silently before (a renderer given one with neither a resolver nor `renderedHtml` omits it from the output).

**The Cloud editor now exposes `toMjml()` and `toHtml()`**, which it never did — Cloud consumers had to fish HTML out of the save result.

### Breaking — `SaveResult` is removed

`SaveResult` is deleted from `@templatical/types` (and its re-export from `@templatical/editor`). The Cloud editor's `save()` resolved to `{ templateId, html, mjml, content }`; it now resolves to the stored `Template`.

```ts
// Before
const { html, mjml } = await editor.save();

// After
const template = await editor.save();
const html = await editor.toHtml();
const mjml = await editor.toMjml();
```

It only ever existed because Cloud's save stitched `editor.save()` and its export endpoint together. Saving and rendering run at different frequencies — autosave was compiling MJML server-side on every debounce tick — and fail in different ways, so they are separate calls now.

### Breaking — `onSave` is removed from both entry points

`init({ onSave })` and `initCloud({ onSave })` are gone. The provider *is* the save.

- **OSS** — `onSave` meant "the user hit Cmd+S, you persist it". With a `templates` provider, Cmd+S now calls `save()`. Without one, Cmd+S flushes the `onChange` debounce immediately, so a consumer persisting from `onChange` still receives the keystroke:

  ```ts
  // Before
  init({ container, onChange: persist, onSave: persist });

  // After
  init({ container, onChange: persist });
  ```

- **Cloud** — `onSave` meant "a save completed", and carried the `SaveResult`. Use the resolved value of `await editor.save()`; `onCreate` and `onLoad` are unchanged.

### Breaking — `@templatical/renderer` marks unrenderable blocks instead of dropping them

A block type with no built-in renderer **and** no `blockRenderers` override now emits an `mj-raw` placeholder comment plus a `console.warn`, where it previously returned an empty string:

```html
<mj-raw><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw>
```

`countdown` is the only built-in block that lands here (Cloud renders it server-side as an animated GIF). Not a throw, because the renderer runs inside send pipelines and killing an entire render over one block is worse than shipping a marked gap; not silence either, because a countdown vanishing from a marketing email reaches recipients as a missing section with nothing anywhere explaining why. The marker survives an `mjml2html` compile under strict validation, and a block hidden on every viewport still renders nothing and warns about nothing.

Two new exports go with it, so a send pipeline never hardcodes the marker text:

```ts
import {
  UNRENDERABLE_MARKER_PREFIX,
  renderUnrenderableBlock,
} from "@templatical/renderer";

if (mjml.includes(UNRENDERABLE_MARKER_PREFIX)) {
  throw new Error("Refusing to send: a block in this template rendered as a gap.");
}
```

`UNRENDERABLE_MARKER_PREFIX` is the marker's stable leading text — scan for it before shipping. `renderUnrenderableBlock(block)` emits one and logs the warning, so a `blockRenderers` override can degrade the same way for a variant it decides it cannot handle, rather than returning `""` and reintroducing the silent drop.

### New — `blockRenderers` on `renderToMjml()`

A per-block-type override map that generalises `renderCustomBlock`:

```ts
renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => `<mj-image src="${countdownGifUrl(block)}" />`,
    video: (block, ctx) => renderVideoWithPlayButton(block, ctx),
  },
});
```

An entry replaces the built-in renderer for that type wholesale, including its hidden-on-all-viewports check. It exists so a backend whose output is a *superset* of the browser's can inject exactly that delta instead of forking the renderer — which is how Cloud now runs the published renderer rather than a copy of it.

`BlockRenderer` moved to `render-context.ts` next to the new `BlockRendererMap` and is re-exported from its previous path, so consumer imports are unaffected.

### Breaking — Cloud internals (`@templatical/core/cloud`)

Consumers using `initCloud()` are unaffected; these matter only if you import the cloud subpath directly.

- `useEditor({ templates })` is now required — Cloud persists through `createCloudTemplatesProvider(authManager)` rather than hardcoded `ApiClient` calls.
- `ApiClient.updateTemplate(id, patch)` takes a `TemplatePatch` instead of bare content; `createTemplate(content, name?)` gained an optional name.
- `useExport`'s methods take an explicit fonts payload and its options are now just `{ authManager }` — the `canUseCustomFonts` entitlement gate moved into `createCloudRenderProvider`, where plan gating belongs. New `resolveExportFonts()` helper.
- New exports: `createCloudTemplatesProvider`, `createCloudRenderProvider`.

`editor.toMjml()` / `toHtml()` also now pass the editor's resolved fonts to the bundled renderer. A template using a custom font family previously exported with no `<mj-font>` declaration and no fallback stack, so mail clients silently substituted.
