---
title: Layout
description: Wrap every email in an embedder-owned shell — header, footer, mat, and an optional card — applied at preview and render, never written into the template.
---

# Layout

An embedder-owned shell around every email — view-in-browser line, Impressum, brand header, grey mat, and optionally a card around the author sections — defined as Templatical JSON. Applied at preview and render. Never written into the template.

Authored content stays as it is today. Layout is the overlay.

## The contract

```ts
init({ layout?: TemplateContent; sectionWrapper?: boolean })
initCloud({ layout?: TemplateContent; sectionWrapper?: boolean })
renderToMjml(content, { layout?: TemplateContent })
```

`layout` is a `TemplateContent` with exactly one `slot`. Build it with `createSlotBlock()` and, for a card, `createWrapperBlock()`. `createBlock('slot')` and `createBlock('wrapper')` throw. `sectionWrapper` is editor chrome, independent of `layout`. `renderToMjml` does not take it.

<!-- prettier-ignore -->
| Surface | With `layout` |
| --- | --- |
| `getContent()` / `setContent()` / load / save / `onChange` / history | unchanged |
| Editing canvas | unchanged |
| Section toolbar Wrapper panel | [In the editor](#in-the-editor) |
| `renderToMjml(content)` (no `layout` argument) | unchanged |
| Preview canvas | composed |
| `editor.toMjml()` / `toHtml()` | composed |
| `RenderPayload.content` | composed |
| Cloud send | no client splice |

`init` / `initCloud` normalize merge tags in the shell, then `validateLayout`. `applyLayout` runs at preview and at `toMjml` / `toHtml` / `renderToMjml(content, { layout })`. It clones. Content block ids are left alone; layout block ids are reminted on the clone.

::: tip Overlay
A bug that puts layout blocks into `getContent()`, or that rewrites `section.wrapper` on save, breaks this contract. Hiding the Wrapper panel is presentation; it does not strip the field.
:::

`slot` is the hole. Exactly one in the layout tree. Legal as a top-level `layout.blocks` child or a `wrapper.children` child. Illegal in a section column, in a nested wrapper, and in editor content. The palette omits it. A `slot` that reaches `renderToMjml` without `layout` throws.

`wrapper` is the band: `styles.backgroundColor` / `styles.padding` / `borderRadius` → `mj-wrapper`. Layout-only. Refused in editor content (`setContent` / `load` / `addBlock` / `createBlock('wrapper')`). `section.wrapper` stays the one-section shorthand.

`applyLayout`, `validateLayout`, `createSlotBlock`, `createWrapperBlock`, `isSlot`, `isWrapper`, and `layoutWrapsSlot` are exported from `@templatical/types` and re-exported from `@templatical/editor`.

## In the editor

The Wrapper panel is the section toolbar's **Add wrapper** switch plus the colour / padding / radius fields when on. The card-layout disable and `sectionWrapper` compose; neither infers the other. Setting `layout` does not hide the panel — a sibling-slot layout still wants Add wrapper.

When `layout` is set and the slot sits inside a `wrapper`, the toggle is disabled for turning on. A muted line sits under it:

> This editor already frames the email. An extra frame on this section isn't supported — preview and export will fail.

If a loaded template already has `section.wrapper`, the toggle stays on and enabled so it can be turned off. The note still shows. Sibling-slot layouts (header / slot / footer, no card): the toggle stays fully usable.

```ts
init({ sectionWrapper?: boolean })
initCloud({ sectionWrapper?: boolean })
```

<!-- prettier-ignore -->
| Value | Panel |
| --- | --- |
| omitted / `true` | today's UI, plus the card-layout disable above |
| `false` | hidden, including where Add wrapper is legal (sibling layout, or no layout) |

`false` does not strip `section.wrapper` from content, does not refuse `updateBlock`, and does not change `getContent()`. Hiding never changes a value.

Already-on is always reachable. If `sectionWrapper === false` and the selected section already has `wrapper`, the panel still renders and the toggle stays enabled so it can be turned off. Once it is off, the panel hides. The card-layout note still shows when the panel is visible.

## A card around the content

Sibling shell — header, slot, footer, grey mat. Author `section.wrapper` is a sibling `mj-wrapper` under `mj-body`.

```ts
import { init } from '@templatical/editor';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
} from '@templatical/types';

const layout = createDefaultTemplateContent();
layout.settings.backgroundColor = '#f3f4f6';
layout.blocks = [
  createParagraphBlock({
    content: '<p><a href="https://example.com/view">View in browser</a></p>',
  }),
  createSlotBlock(),
  createParagraphBlock({ content: '<p>Impressum</p>' }),
];

const editor = await init({
  container: '#editor',
  layout,
});
```

```
mj-body                         ← layout.settings.backgroundColor
  [layout blocks above the slot]
  [content.blocks, untouched]
  [layout blocks below the slot]
```

Card around the slot — the wrapper is the card:

```ts
import { createWrapperBlock } from '@templatical/types';

layout.blocks = [
  createParagraphBlock({
    content: '<p><a href="https://example.com/view">View in browser</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: '#ffffff',
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({ content: '<p>Impressum</p>' }),
];
```

```
mj-body                         ← grey mat
  mj-section                    ← view in browser
  mj-wrapper                    ← white card
    [author sections…]
  mj-section                    ← Impressum
```

Valid MJML if the injected blocks do not emit `mj-wrapper`. The slot is a hole in a `Block[]` — body children or wrapper children. A slot in `children: [[slot]]` is `mj-section` in `mj-column`.

## Settings

Layout is the document; content is the message. Layout `settings` is a full `TemplateSettings`. Only `backgroundColor` is read.

<!-- prettier-ignore -->
| Field | Winner |
| --- | --- |
| `backgroundColor` | layout → `mj-body` |
| `width`, `fontFamily`, `textColor`, `linkColor`, `linkUnderline`, `locale`, `preheaderText`, `direction` | content |

Content `settings.backgroundColor` is not mutated. Template Settings still edits it. It is not `mj-body` when a layout is applied. `direction` is first-party template content. Layout does not set `dir`.

Embedders can copy content's settings and override `backgroundColor`.

## Compose

```
base = applyLayout(layout, content)
if (resolvePreview) base = await resolvePreview({ content: base, recipient })
```

Preview canvas, `toMjml`, and `toHtml` use `base`. The editing canvas never takes this path. Layout compose is synchronous — no skeleton for layout-only preview. `supersedesSamples` stays `resolvePreview`-only.

When `layout` is set, `PreviewResolveContext.content` is the composed document. Return that shape. Returning only inner `content` drops the chrome.

Headless:

```ts
import { renderToMjml } from '@templatical/renderer';
import { applyLayout } from '@templatical/types';

const mjml = await renderToMjml(content, { layout });
const composed = applyLayout(layout, content);
```

When the slot sits inside a wrapper, `applyLayout` walks the injected `content.blocks`. If any block would emit `mj-wrapper` — `section.wrapper` set, or `type === 'wrapper'` — it throws. No inline, no drop, no preview of a lie.

```
[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)
```

If the slot is top-level, injected `section.wrapper` is a sibling under `mj-body`.

Outs: sibling slot (no card); authors leave Add wrapper off; `sectionWrapper: false` so the control is not offered.

`validateLayout` throws:

```
[Templatical] layout: must contain exactly one slot block
[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section
[Templatical] layout: a wrapper cannot contain a wrapper
```

`setContent` / `load` / `addBlock` refuse `slot` and `wrapper` in content. `renderToMjml(content)` with no `layout` argument must not call `applyLayout`.

## Caveats

1. **Editing canvas.** Chrome is preview + render only.
2. **Mat colour.** Template Settings "background" is not `mj-body` when `layout` is set.
3. **Layout card vs `section.wrapper`.** Slot inside a wrapper + injected `mj-wrapper` throws. The editor disables turning Add wrapper on in that case. Embedders who do not want the control at all set `sectionWrapper: false` — that hide is presentation; it does not strip an existing `wrapper` field.
4. **Saved JSON.** `getContent()` has no shell. Send must use `toMjml` / `toHtml` (or the same splice on the server).
5. **Cloud send.** Preview applies layout; Cloud send does not until the backend splices.
6. **`resolvePreview`.** Receives the composed document.
7. **Test email.** `payload.content` is unshelled; MJML/HTML from `toMjml` / `toHtml` is shelled.
8. **Lint.** Runs on editor content. Chrome is the embedder's problem.
9. **Slot shape.** Exactly one; top-level or wrapper child. Zero, two, or in a column → throw at `init` / `renderToMjml`.
10. **Palette `wrapper` later.** Same type, enabled for content. Wrappers still must not nest. Import still approximates until then.
