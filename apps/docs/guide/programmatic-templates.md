---
title: Programmatic Templates
description: Build email template content programmatically using factory functions.
---

# Programmatic Templates

Most users will design templates visually in the drag-and-drop editor. But sometimes you need to create templates in code -- seeding default content, building templates from API data, or generating emails programmatically on the server.

Templatical provides factory functions for every block type. Use them to build templates in code, then pass them to `init()` or render them directly with the renderer.

## Blank template

```ts
import { createDefaultTemplateContent } from '@templatical/types';

const content = createDefaultTemplateContent();
// { blocks: [], settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' } }
```

`createDefaultTemplateContent()` accepts an optional font family string:

```ts
const content = createDefaultTemplateContent('Georgia, serif');
```

## Building a template

Every block type has a corresponding `create*Block()` function. Each accepts an optional partial object to override defaults. All factory functions auto-generate a unique `id` for each block.

```ts
import {
  createDefaultTemplateContent,
  createTextBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
} from '@templatical/types';

const content = createDefaultTemplateContent();

content.blocks = [
  createTextBlock({
    content: '<h1 style="text-align: center;">Welcome aboard</h1>',
    fontSize: 24,
  }),
  createImageBlock({
    src: 'https://example.com/hero.jpg',
    alt: 'Welcome hero image',
    width: 'full',
  }),
  createDividerBlock(),
  createTextBlock({
    content: '<p>Thanks for signing up. Here is what happens next.</p>',
  }),
  createButtonBlock({
    text: 'Get Started',
    url: 'https://example.com/dashboard',
    backgroundColor: '#1a73e8',
    textColor: '#ffffff',
    borderRadius: 6,
  }),
];
```

## Block factory reference

### Text

```ts
createTextBlock({
  content: '<p>Welcome, {{name}}!</p>',
  fontSize: 18,
  textAlign: 'center',
})
```

### Image

```ts
createImageBlock({
  src: 'https://cdn.example.com/hero.png',
  alt: 'Hero banner',
  width: 560,
  linkUrl: 'https://example.com',
})
```

### Button

```ts
createButtonBlock({
  text: 'Get Started',
  url: 'https://example.com/signup',
  backgroundColor: '#6366f1',
  borderRadius: 8,
})
```

### Divider

```ts
createDividerBlock({
  lineStyle: 'dashed',
  color: '#e5e7eb',
  thickness: 2,
})
```

### Spacer

```ts
createSpacerBlock({ height: 40 })
```

### HTML

```ts
createHtmlBlock({
  content: '<div style="text-align:center;">Custom markup</div>',
})
```

### Social Icons

```ts
createSocialIconsBlock({
  iconStyle: 'circle',
  iconSize: 'large',
  icons: [
    { platform: 'twitter', url: 'https://x.com/acme' },
    { platform: 'github', url: 'https://github.com/acme' },
  ],
})
```

### Menu

```ts
createMenuBlock({
  items: [
    { text: 'Home', url: 'https://example.com' },
    { text: 'Blog', url: 'https://example.com/blog' },
    { text: 'Docs', url: 'https://docs.example.com' },
  ],
  separator: '-',
})
```

### Table

```ts
createTableBlock({
  hasHeaderRow: true,
  rows: [
    { cells: [{ content: 'Plan' }, { content: 'Price' }] },
    { cells: [{ content: 'Starter' }, { content: '$9/mo' }] },
    { cells: [{ content: 'Pro' }, { content: '$29/mo' }] },
  ],
})
```

### Video

```ts
createVideoBlock({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  alt: 'Product demo video',
})
```

### Section

```ts
createSectionBlock({
  columns: '2',
  children: [
    [createTextBlock({ content: '<p>Left column</p>' })],
    [createImageBlock({ src: 'https://cdn.example.com/photo.jpg' })],
  ],
})
```

The `columns` property accepts: `'1'` (single), `'2'` (two equal), `'3'` (three equal), `'2-1'` (two-thirds / one-third), `'1-2'` (one-third / two-thirds). See [Sections and Columns](/guide/sections-and-columns) for full details.

### Custom

```ts
createCustomBlock({
  customType: 'product-card',
  fieldValues: {
    title: 'Wireless Headphones',
    price: 79.99,
    imageUrl: 'https://cdn.example.com/headphones.jpg',
  },
})
```

## Utilities

### Generic factory

Create any block by type string:

```ts
import { createBlock } from '@templatical/types';

const block = createBlock('text'); // TextBlock with defaults
```

### Cloning

Deep-clone a block with a new ID:

```ts
import { cloneBlock } from '@templatical/types';

const copy = cloneBlock(existingBlock);
// copy.id !== existingBlock.id
```

### Type guards

Narrow a `Block` union to a specific type:

```ts
import { isText, isImage, isButton, isSection } from '@templatical/types';

if (isText(block)) {
  console.log(block.content); // TypeScript knows this is TextBlock
}

if (isImage(block)) {
  console.log(block.src);
}
```

Every block type has a corresponding guard: `isText()`, `isImage()`, `isButton()`, `isDivider()`, `isSpacer()`, `isHtml()`, `isSocialIcons()`, `isMenu()`, `isTable()`, `isVideo()`, `isSection()`, `isCustom()`.

## Template settings

Template settings control the global properties of the email:

```ts
const content = createDefaultTemplateContent();

content.settings.width = 640;
content.settings.backgroundColor = '#f5f5f5';
content.settings.fontFamily = 'Helvetica, Arial, sans-serif';
content.settings.preheaderText = 'Your weekly digest is here';
```

| Setting | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `600` | Email width in pixels |
| `backgroundColor` | `string` | `'#ffffff'` | Outer background color |
| `fontFamily` | `string` | `'Arial, sans-serif'` | Default font stack |
| `preheaderText` | `string` | `undefined` | Preview text shown in inbox list |

## Loading saved content

Pass previously saved JSON back to the editor:

```ts
const saved = await fetch('/api/templates/123').then(r => r.json());

const editor = init({
  container: '#editor',
  content: saved,
});
```

You can also update content after initialization:

```ts
editor.setContent(newContent);
```

## Next steps

- [Block Types](/guide/blocks) -- properties reference for all 12 block types.
- [How Rendering Works](/getting-started/how-rendering-works) -- the JSON → MJML pipeline.
- [Custom Blocks](/guide/custom-blocks) -- define your own block types.
