---
title: Sections and Columns
description: Multi-column layouts with the SectionBlock container in Templatical.
---

# Sections and Columns

The `SectionBlock` is the layout primitive in Templatical. Every multi-column layout is built by creating a section and placing blocks inside its columns.

## Column layouts

::: tip Email best practice
Stick to 1-2 columns for most emails. Three-column layouts become cramped on mobile when columns stack vertically, and some email clients handle 3-column layouts inconsistently.
:::

The `columns` property accepts one of five layout presets:

| Value | Description | Column widths |
|-------|-------------|---------------|
| `'1'` | Single column | 100% |
| `'2'` | Two equal columns | 50% / 50% |
| `'3'` | Three equal columns | 33% / 33% / 33% |
| `'2-1'` | Two-thirds / one-third | 66% / 33% |
| `'1-2'` | One-third / two-thirds | 33% / 66% |

```ts
type ColumnLayout = '1' | '2' | '3' | '2-1' | '1-2';
```

## Creating sections

Use `createSectionBlock` from `@templatical/types`:

```ts
import {
  createSectionBlock,
  createTextBlock,
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
      createTextBlock({ content: '<h1>Welcome</h1>', fontSize: 28 }),
      createTextBlock({ content: '<p>Get started in minutes.</p>' }),
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

Sections cannot be nested inside other sections. Each section sits at the top level of the template's block list. Within a column, you can place any non-section block type: text, images, buttons, tables, custom blocks, and so on.

## Responsive behavior

On desktop, columns render side-by-side at their defined widths. On smaller screens, columns stack vertically in source order (left column on top). This stacking behavior is automatic and handled by the MJML output.

You can use the `visibility` property on individual blocks within columns to show or hide content per breakpoint:

```ts
const block = createTextBlock({
  content: '<p>Desktop only sidebar content</p>',
});

block.visibility = {
  desktop: true,
  tablet: true,
  mobile: false,
};
```

See [Styling](/guide/styling) for more on responsive overrides and block visibility.

## Section-level styles

Sections support the same `BlockStyles` as other blocks. Common use cases include setting a background color or padding on the entire row:

```ts
const section = createSectionBlock({ columns: '1' });

section.styles = {
  backgroundColor: '#f8fafc',
  padding: { top: 32, right: 24, bottom: 32, left: 24 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};
```
