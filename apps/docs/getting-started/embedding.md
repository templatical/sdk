---
title: Embedding the editor
description: CSS constraints on the container you mount the editor into, and what breaks when an ancestor violates them.
---

# Embedding the editor

The editor is a component you mount into an element of your own page. Almost everything that goes wrong at that seam is a CSS interaction between your page and the editor's overlays, and a small set of properties causes all of it.

Nothing here is Templatical-specific — these are plain CSS rules that affect any library positioning overlays with `position: fixed`. See also [Shadow DOM](../guide/shadow-dom) for how the editor isolates its own styles, and [Theming](../guide/theming) for the `--tpl-user-*` surface.

## The editor's container

The editor mounts its dialogs into a popover root at `z-index: 10000`, inside the container you pass to `init()`. A z-index only competes within its own stacking context, so **the container must not establish one** — otherwise every editor dialog is confined to it, and any chrome of yours with a higher z-index in the parent context paints over them.

These properties on the container, or on any ancestor between it and the stacking context your chrome lives in, create one:

| Property | Creating value |
| -------- | -------------- |
| `isolation` | `isolate` |
| `transform` / `translate` / `rotate` / `scale` | anything but `none` |
| `filter` / `backdrop-filter` | anything but `none` |
| `perspective` | anything but `none` |
| `opacity` | less than `1` |
| `will-change` | `transform`, `filter`, `opacity`, `perspective` |
| `contain` | `paint`, `layout`, `content`, `strict` |
| `mix-blend-mode` | anything but `normal` |
| `position: fixed` / `sticky` | always |
| `position: relative` / `absolute` | with any `z-index` other than `auto` |

If one of them is unavoidable — a route transition that animates `transform`, a wrapper you do not control — give that element a `z-index` higher than your own header, sidebar, or toast layer:

```css
#your-editor-container {
  /* Above your own chrome, so the editor's dialogs are too. */
  z-index: 200;
  position: relative;
}
```

::: tip Why a higher z-index on the dialog will not help
A `fixed` descendant cannot escape a stacking context at any z-index — the comparison happens between the context's root and your chrome, and the descendant's own value never enters it. So the value has to go on the container, not on the dialog. Raising the container is safe because its own box does not overlap your chrome; only the dialogs, which are `fixed` and cover the viewport, are affected.
:::

### The same properties also move things

`transform`, `filter`, `perspective`, `will-change` and `contain` do two jobs at once: alongside the stacking context above, each establishes a **containing block for `position: fixed`**. A fixed descendant then resolves its coordinates against that ancestor instead of the viewport — and this applies even while the computed `transform` reads `none`, because a running or animated transform still promotes the element.

What that means for the editor:

| Overlay | Under a transformed ancestor |
| ------- | ---------------------------- |
| Color pickers, rich-text toolbars, merge-tag autocomplete | Unaffected. They anchor `absolute` inside the popover root and convert viewport coordinates to root-local ones, so the ancestor's offset cancels out. |
| Dialog height | Unaffected. Every dialog caps against its own backdrop rather than the viewport, so it stays inside whatever box it is given. |
| Drag-and-drop ghost | **Offset.** The ghost is `position: fixed` and placed from viewport coordinates, so it drifts away from the cursor by the ancestor's offset. |

So if you use drag-and-drop, keep `transform` off every ancestor of the container.

::: warning Do not substitute `opacity`
Animating `opacity` instead of `transform` avoids the containing-block problem and walks straight into the stacking one — `opacity` below `1` creates a stacking context, so your chrome starts painting over the editor's dialogs. There is no property that dodges both. For a scroll or entrance effect, put it on an element that does not wrap the editor's container.
:::

### Clipping ancestors in Safari

`overflow: hidden`, `clip`, `auto` or `scroll` on an ancestor of the container creates neither a stacking context nor a containing block, so it is absent from the table above — and in Safari it still clips the dialogs.

Safari paints a `position: fixed` descendant clipped to such an ancestor's box while resolving its layout against the viewport. A dialog is placed correctly and then cut off at that ancestor's edge, and its dimming backdrop covers only that ancestor's area. Chrome and Firefox paint it across the viewport.

The editor keeps its own clip off the dialogs' ancestor chain, so its container may sit in a scrollable or clipped layout. An ancestor **of** the container is outside what the editor can reach:

```css
.your-app-shell {
  /* Clips the editor's dialogs in Safari. */
  overflow: hidden;
}
```

If the element only needs to contain its own children, `overflow: clip` with `overflow-clip-margin` will not help — every value clips. Move the property to an element that does not wrap the container, or let the page scroll normally.

## Host typography cannot leak in

The editor neutralizes every inheritable typography property at its root, so your page's global type styles do not reach its chrome or its canvas:

`letter-spacing` · `word-spacing` · `text-transform` · `font-style` · `font-weight` · `text-indent` · `text-align` · `white-space` · `list-style-type` · `cursor` · `font-variant-numeric` · `text-shadow` — alongside `font-family`, `font-size`, `line-height` and `color`.

This matters most for the canvas. A page-wide `text-transform: uppercase` reaching the preview would show you an email the recipient never receives, so the guarantee covers email content, not just editor chrome.

::: tip Why shadow DOM alone is not enough
Shadow DOM blocks host *rules* — a selector in your stylesheet never matches inside the editor's shadow root. It does not block *inheritance*, which follows the flattened tree, so inheritable properties cross the boundary regardless. The editor's own reset is what stops them, and it works identically with `shadowDom: false`.
:::

**`direction` is deliberately allowed to inherit.** An RTL page propagates its writing direction into the editor, which is what an RTL embedder wants. `visibility` is likewise left alone.

### You do not need a CSS reset on the container

Resetting the container is not necessary, and an aggressive reset is harmful: `all: initial` or `all: revert` there wipes the `--tpl-user-*` custom properties that [Theming](../guide/theming) relies on, and can break the `height: 100%` chain the editor sizes against. Style the container's box — size, position, border — and leave its inherited values alone.
