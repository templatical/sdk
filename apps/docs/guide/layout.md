---
title: Layout
description: Pass a JSON shell with one slot. Preview and export wrap the author's email in it. Save does not.
---

# Layout

Pass a JSON document with exactly one `slot`. Preview and export wrap the author's email in that shell. Save does not: `getContent()` is the authored template only.

```ts
init({ layout?: TemplateContent; sectionWrapper?: boolean })
renderToMjml(content, { layout?: TemplateContent })
```

Build the shell with `createSlotBlock()` and, for a card, `createWrapperBlock()`. `createBlock('slot')` and `createBlock('wrapper')` throw. `sectionWrapper` is editor chrome and independent of `layout`. `renderToMjml` does not take `sectionWrapper`.

## Example

Grey page background, a "View in browser" line, the author's sections inside a white card, Imprint below the card. This is the wrap-around shell: preview and `toMjml()` / `toHtml()` compose it; the editing canvas and `getContent()` do not.

```ts
import {
  init,
  createSlotBlock,
  createWrapperBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
} from '@templatical/editor';

const layout = createDefaultTemplateContent();
layout.settings.backgroundColor = '#f3f4f6';
layout.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">View in browser</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: '#ffffff',
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Imprint</a></p>',
  }),
];

const editor = await init({
  container: '#editor',
  layout,
  sectionWrapper: false,
});
```

```
mj-body                         ← grey mat (layout.settings.backgroundColor)
  mj-section                    ← View in browser
  mj-wrapper                    ← white card
    [author sections…]
  mj-section                    ← Imprint
```

`sectionWrapper: false` hides **Add wrapper** on author sections. With the slot inside a `wrapper`, that control would emit `mj-wrapper` inside `mj-wrapper`, which MJML forbids. Omit `sectionWrapper` (or pass `true`) if you want the panel; the editor still disables turning it on for this card layout.

## The contract

`layout` is a `TemplateContent` with exactly one `slot`.

<!-- prettier-ignore -->
| Surface | With `layout` |
| --- | --- |
| `getContent()` / `setContent()` / load / save / `onChange` / history | authored template only |
| Editing canvas | authored template only |
| Section toolbar Wrapper panel | [In the editor](#in-the-editor) |
| `renderToMjml(content)` (no `layout` argument) | authored template only |
| Preview canvas | composed |
| `editor.toMjml()` / `toHtml()` | composed |
| `RenderPayload.content` | composed |

`init` runs `validateLayout` on the shell (after merge-tag normalization). `applyLayout` runs at preview and at `toMjml` / `toHtml` / `renderToMjml(content, { layout })`. It clones: authored block ids are left alone; layout block ids are new on the clone.

::: tip Saved JSON
`getContent()`, load, save, and the editing canvas never include layout blocks. Send with `toMjml()` / `toHtml()`, or call `applyLayout` on the server. Hiding Add wrapper does not strip `section.wrapper` from stored content.
:::

**`slot`** is where authored `content.blocks` land. Exactly one in the layout tree. Legal as a top-level `layout.blocks` child or as a `wrapper.children` child. Illegal in a section column, in a nested wrapper, and in editor content. The palette omits it. A `slot` that reaches `renderToMjml` without `layout` throws.

**`wrapper`** is the layout card: `styles.backgroundColor` / `styles.padding` / `borderRadius` map to `mj-wrapper`. Layout-only. Refused in editor content (`setContent` / `load` / `addBlock` / `createBlock('wrapper')`). Authors still use `section.wrapper` as the per-section shorthand.

Layout factories and helpers (`createSlotBlock`, `createWrapperBlock`, `createParagraphBlock`, `createDefaultTemplateContent`, `applyLayout`, `validateLayout`, `isSlot`, `isWrapper`, `layoutWrapsSlot`) are exported from `@templatical/editor`. Headless rendering can import `applyLayout` from `@templatical/types` without the editor.

`validateLayout` throws:

```
[Templatical] layout: must contain exactly one slot block
[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section
[Templatical] layout: a wrapper cannot contain a wrapper
```

`setContent` / `load` / `addBlock` refuse `slot` and `wrapper` in content.

MJML forbids `mj-wrapper` inside `mj-wrapper`. If the slot sits inside a wrapper, `applyLayout` walks the injected `content.blocks`. Any block that would emit `mj-wrapper` — `section.wrapper` set, or `type === 'wrapper'` — throws:

```
[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)
```

A slot in `children: [[slot]]` is `mj-section` inside `mj-column`, which MJML also forbids. Keep the slot as a body child or a wrapper child.

## Header and footer

No card: the slot is a sibling of the header and footer. Author `section.wrapper` is then a sibling `mj-wrapper` under `mj-body`, which is valid — leave `sectionWrapper` unset if authors should still get Add wrapper.

```ts
layout.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">View in browser</a></p>',
  }),
  createSlotBlock(),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Imprint</a></p>',
  }),
];
```

```
mj-body                         ← grey mat
  mj-section                    ← View in browser
  [author sections…]            ← may include section.wrapper
  mj-section                    ← Imprint
```

## In the editor

The Wrapper panel is the section toolbar's **Add wrapper** switch plus colour / padding / radius when it is on. Card-layout disable and `sectionWrapper` are independent: setting `layout` does not hide the panel. A header / slot / footer shell still offers Add wrapper.

When `layout` is set and the slot sits inside a `wrapper`, the switch cannot turn on. A muted line sits under it:

> This editor already frames the email. An extra frame on this section isn't supported — preview and export will fail.

If a loaded template already has `section.wrapper`, the switch stays on and enabled so it can be turned off. The note still shows.

```ts
init({ sectionWrapper?: boolean })
```

<!-- prettier-ignore -->
| Value | Panel |
| --- | --- |
| omitted / `true` | shown, plus the card-layout disable above |
| `false` | hidden, including where Add wrapper is legal (header / slot / footer, or no layout) |

`sectionWrapper: false` does not strip `section.wrapper` from content, does not refuse `updateBlock`, and does not change `getContent()`. Hiding never changes a value.

If `sectionWrapper === false` and the selected section already has `wrapper`, the panel still renders and the switch stays enabled so it can be turned off. Once it is off, the panel hides. The card-layout note still shows when the panel is visible.

## Settings

Layout `settings` is a full `TemplateSettings`. Only `backgroundColor` is read.

<!-- prettier-ignore -->
| Field | Winner |
| --- | --- |
| `backgroundColor` | layout → `mj-body` |
| `width`, `fontFamily`, `textColor`, `linkColor`, `linkUnderline`, `locale`, `preheaderText`, `direction` | content |

Content `settings.backgroundColor` is not mutated. Template Settings still edits it. It is not `mj-body` when a layout is applied. `direction` comes from the authored template. Layout does not set `dir`.

You can copy the content settings onto the layout and override `backgroundColor`.

## Headless use

```ts
import { renderToMjml } from '@templatical/renderer';
import { applyLayout } from '@templatical/types';

const mjml = await renderToMjml(content, { layout });
const composed = applyLayout(layout, content);
```

Preview, `toMjml`, and `toHtml` compose first, then optionally `resolvePreview`:

```
base = applyLayout(layout, content)
if (resolvePreview) base = await resolvePreview({ content: base, recipient })
```

The editing canvas never takes this path. Layout compose is synchronous.

When `layout` is set, `PreviewResolveContext.content` is the composed document. Return that shape. Returning only inner `content` drops the shell.

`renderToMjml(content)` with no `layout` argument does not call `applyLayout`.

Test email: `payload.content` is the authored template; MJML/HTML from `toMjml` / `toHtml` includes the shell.

Lint runs on editor content. The shell is not linted.

A send path that re-renders from stored JSON without `layout` will drop the shell. Pass the same `layout` to `renderToMjml` (or call `applyLayout`) on the server.

## In the playground

The **Layout** setup wraps the email in a card shell, which shows in preview and in the MJML export and never in the saved JSON.

[Open in playground](https://play.templatical.com/scenes/layout)
