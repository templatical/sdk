---
title: Sections and Columns
description: Multi-column layouts with the SectionBlock container in Templatical.
---

# Sections and Columns

The `SectionBlock` is the layout primitive in Templatical. Every multi-column layout is built by creating a section and placing blocks inside its columns.

## Column layouts

::: tip Email best practice
Stick to 1-2 columns for most emails. Three-column layouts become cramped on mobile when columns stack vertically, and some email clients handle 3-column layouts inconsistently. Four columns are tighter still.
:::

The `columns` property accepts one of these layout presets:

| Value | Description | Column widths |
|-------|-------------|---------------|
| `'1'` | Single column | 100% |
| `'2'` | Two equal columns | 50% / 50% |
| `'3'` | Three equal columns | 33% / 33% / 33% |
| `'4'` | Four equal columns | 25% / 25% / 25% / 25% |
| `'2-1'` | Two-thirds / one-third | 66% / 33% |
| `'1-2'` | One-third / two-thirds | 33% / 66% |
| `'3-1'` | Three-quarters / one-quarter | 75% / 25% |
| `'1-3'` | One-quarter / three-quarters | 25% / 75% |
| `'1-2-1'` | One-quarter / half / one-quarter | 25% / 50% / 25% |

```ts
type ColumnLayout = '1' | '2' | '3' | '4' | '2-1' | '1-2' | '3-1' | '1-3' | '1-2-1';
```

## Creating sections

Use `createSectionBlock` from `@templatical/types`:

```ts
import {
  createSectionBlock,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
} from '@templatical/types';

// Empty two-column section
const section = createSectionBlock({ columns: '2' });

// Section with pre-populated columns
const hero = createSectionBlock({
  columns: '1-2',
  children: [
    [createImageBlock({ src: 'https://cdn.example.com/logo.png', width: 120 })],
    [
      createTitleBlock({ content: '<h1>Welcome</h1>', level: 1 }),
      createParagraphBlock({ content: '<p>Get started in minutes.</p>' }),
    ],
  ],
});
```

## The children array

`children` is a `Block[][]` -- an array of arrays. Each inner array represents the blocks inside one column, ordered left to right.

```ts
// For a '2' layout:
section.children = [
  [blockA, blockB],  // Left column
  [blockC],          // Right column
];

// For a '3' layout:
section.children = [
  [blockA],  // Left
  [blockB],  // Center
  [blockC],  // Right
];
```

The length of `children` must match the number of columns in the chosen layout. When you change `columns`, the editor automatically adjusts `children` -- merging excess columns into the last column or adding empty arrays for new columns.

## Adding blocks to columns

To programmatically add a block to a specific column:

```ts
// Add a button to the second column (index 1)
section.children[1].push(
  createButtonBlock({
    text: 'Learn More',
    url: 'https://example.com/docs',
  }),
);
```

## Nesting

Sections cannot be nested inside other sections. Each section sits at the top level of the template's block list. Within a column, you can place any non-section block type: titles, paragraphs, images, buttons, tables, custom blocks, and so on.

## Responsive behavior

On desktop, columns render side-by-side at their defined widths. On smaller screens, columns stack vertically in source order (left column on top) — MJML's default.

`stackOnMobile` opts out. Omit it or set `true` to keep stacking. `false` wraps the columns in `<mj-group>` so they stay side by side on mobile. The section toolbar exposes the toggle on multi-column sections. A one-column section never emits `mj-group`.

```ts
const row = createSectionBlock({ columns: '2', stackOnMobile: false });
```

You can use the `visibility` property on individual blocks within columns to show or hide content per breakpoint:

```ts
const block = createParagraphBlock({
  content: '<p>Desktop only sidebar content</p>',
});

block.visibility = {
  desktop: true,
  mobile: false,
};
```

See [Styling](/guide/styling) for more on block visibility.

## Section-level styles

Sections support the same `BlockStyles` as other blocks. Common use cases include setting a background color or padding on the entire row:

```ts
const section = createSectionBlock({ columns: '1' });

section.styles = {
  backgroundColor: '#f8fafc',
  padding: { top: 32, right: 24, bottom: 32, left: 24 },
};
```

Sections also accept a `borderRadius` (in px, a section-specific property) for rounded corners — useful for a card-style section on a contrasting background:

```ts
const card = createSectionBlock({ columns: '1', borderRadius: 12 });

card.styles.backgroundColor = '#ffffff';
```

### Background image

A section's `backgroundImage` paints an image behind its columns. Set `styles.backgroundColor` as well, as the fallback while the image loads and in clients that don't show background images. In the editor's **Background** panel you also choose the size (Fill, Fit or Original), a nine-point position and whether the image repeats. See the [Section block](/guide/blocks#section) for the email client notes on background images.

### Hero

A one-column section with a background image can render as a hero — an `mj-hero`, where the image fills the box and the content sits on top of it. Set `hero`:

```ts
const banner = createSectionBlock({
  columns: '1',
  backgroundImage: {
    ...createBackgroundImage('https://cdn.example.com/hero.jpg'),
    naturalWidth: 1200,
    naturalHeight: 800,
  },
  hero: { height: 'image', verticalAlign: 'middle' },
});
banner.styles.backgroundColor = '#1f2937';
```

`height: 'image'` makes the box as tall as the image drawn across its desktop width, which needs the image file's size in `backgroundImage.naturalWidth` / `naturalHeight`. A phone keeps that height and crops the image at the sides to cover the narrower box. A media pick that knows the size (`width` / `height` on the asset or the `onRequestMedia` result) stores it with the URL; otherwise the editor measures the image. A number is a fixed height in px, padding included. In the editor, the **Background** panel's **Height** switches between **Fit content** (no hero), **Match image** and **Fixed**, and **Content position** places the content. The palette's **Hero** shortcut inserts one to fill in: a hero-mode section with a title, a paragraph and a button on a dark fill. See the [Section block](/guide/blocks#section) for the email client notes.

### Outer frame (wrapper)

To frame a section in a colored band — e.g. a white card sitting on a blue background — set `wrapper`. It renders an `mj-wrapper` around the section, with its own background, padding, and corner radius. The band is as wide as the email body (`settings.width`), unless `fullWidth` is set. `fullWidth: true` is MJML's `full-width="full-width"`: the band's background color and background image span the recipient's window, and the section stays at `settings.width`. A corner radius is ignored while `fullWidth` is on — a window-wide band has no visible corners — and the stored radius is used again when `fullWidth` is off:

```ts
const card = createSectionBlock({ columns: '1', borderRadius: 12 });
card.styles.backgroundColor = '#ffffff';

card.wrapper = {
  backgroundColor: '#1e3a8a',
  padding: { top: 24, right: 24, bottom: 24, left: 24 },
  borderRadius: 16,
};
```

The wrapper's padding is what makes the band show around the section. In the editor, enable it from the **Wrapper** panel in the section toolbar. **Full-width background** in the section's **Background** panel sets `fullWidth`. With no wrapper yet, turning it on moves the section's own background color and image onto a new wrapper and clears them on the section, so the content sits transparent over the band. While the switch is on, that panel's color and image edit the band (`wrapper.backgroundColor` and `wrapper.backgroundImage`), and **Content background** under them sets the section fill (`styles.backgroundColor`; empty leaves the content transparent over the band). The Wrapper panel shows the same band color and image. While the switch is off, color and image edit the section fill and **Content background** is hidden. Turning the switch off clears `fullWidth`. A wrapper that holds only that band is removed and its current color and image return to the section. If the section already has a content fill, the wrapper stays with `fullWidth` cleared so neither color is discarded. The wrapper is a styling layer, not a container — sections still cannot be nested. An embedder-owned card around the authored sections is a [layout](/guide/layout) overlay.
