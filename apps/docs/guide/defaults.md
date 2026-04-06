---
title: Block & Template Defaults
description: Customize default properties for newly created blocks and template settings with blockDefaults and templateDefaults.
---

# Block & Template Defaults

Block properties (colors, font sizes, padding, placeholder text, etc.) are hardcoded in factory functions. `blockDefaults` and `templateDefaults` let you override these so every new block and template matches your brand out of the box.

## Block Defaults

Pass a `blockDefaults` object to `init()`. Each key maps to a block type and accepts a partial override of that block's properties:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  blockDefaults: {
    title: { color: '#000000' },
    paragraph: {},
    button: {
      backgroundColor: '#ff6600',
      textColor: '#ffffff',
      styles: { padding: { top: 20, bottom: 20 } },
    },
    divider: { color: '#eeeeee', thickness: 2 },
    image: { alt: 'Brand image' },
  },
});
```

Defaults apply when:
- Dragging a block from the sidebar
- Calling `createAndAddBlock()` programmatically

Defaults do **not** apply when:
- Duplicating an existing block (the source block's values are preserved)
- Loading saved content from the API

### Deep Merge Behavior

Nested objects are **deep-merged**, not shallow-replaced. This means you can override a single padding value without losing the rest:

```ts
blockDefaults: {
  button: {
    // Only top padding changes. right/bottom/left keep their defaults.
    styles: { padding: { top: 20 } },
    // Same for buttonPadding — only top changes.
    buttonPadding: { top: 16 },
  },
}
```

Arrays are **replaced**, not merged. For example, setting `table.rows` replaces the entire default rows array.

### Supported Block Types

| Key | Block Type |
|-----|-----------|
| `title` | Title |
| `paragraph` | Paragraph |
| `image` | Image |
| `button` | Button |
| `divider` | Divider |
| `section` | Section |
| `video` | Video |
| `social` | Social Icons |
| `spacer` | Spacer |
| `html` | HTML |
| `menu` | Menu |
| `table` | Table |

Custom blocks are not affected by `blockDefaults`. They use their own `default` values defined in the `CustomBlockDefinition` field configuration.

### TypeScript Type

```ts
import type { BlockDefaults } from '@templatical/editor';
// or
import type { BlockDefaults } from '@templatical/types';
```

Each block type key accepts `Partial<Omit<BlockType, 'id' | 'type'>>` — you can override any property except `id` and `type`, which are always generated automatically. See [Block Types](/guide/blocks) for the full list of available properties per block.

## Template Defaults

Pass a `templateDefaults` object to override the default template settings used when creating a new empty template:

```ts
const editor = await init({
  container: '#editor',
  templateDefaults: {
    width: 640,
    backgroundColor: '#f5f5f5',
    fontFamily: 'Helvetica, sans-serif',
    preheaderText: 'Check out our latest news',
  },
});
```

### When Template Defaults Apply

- **No content provided** — `templateDefaults` override the hardcoded factory defaults (width: 600, bg: #ffffff, etc.).
- **Content provided** — The provided content's settings are used as-is. `templateDefaults` have no effect.

In other words, `templateDefaults` are fallbacks for missing content, not overrides for existing content.

### Available Settings

| Property | Default | Description |
|----------|---------|-------------|
| `width` | `600` | Template width in pixels |
| `backgroundColor` | `#ffffff` | Template background color |
| `fontFamily` | `Arial, sans-serif` | Default font family |
| `preheaderText` | — | Email preheader text |

### TypeScript Type

```ts
import type { TemplateDefaults } from '@templatical/editor';
// or
import type { TemplateDefaults } from '@templatical/types';
```

## Built-in Default Constants

The SDK exports the built-in default values for every block type and template settings as constants. Use these to inspect current defaults, extend them, or build custom presets:

```ts
import {
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  BUTTON_BLOCK_DEFAULTS,
} from '@templatical/types';

// Inspect the defaults for a single block type
console.log(TITLE_BLOCK_DEFAULTS);
// { content: '<h1>Enter your heading here</h1>', level: 1, color: '#333333', ... }

// Inspect template defaults
console.log(DEFAULT_TEMPLATE_DEFAULTS);
// { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }

// Build a custom preset by extending a single block's defaults
const myButtonDefaults = {
  ...BUTTON_BLOCK_DEFAULTS,
  backgroundColor: '#ff6600',
  borderRadius: 8,
};
```

### Available Constants

**Per-block constants** — each contains the default property values for that block type (excluding `id`, `type`, and `styles`):

| Constant | Block Type |
|----------|-----------|
| `TITLE_BLOCK_DEFAULTS` | Title |
| `PARAGRAPH_BLOCK_DEFAULTS` | Paragraph |
| `IMAGE_BLOCK_DEFAULTS` | Image |
| `BUTTON_BLOCK_DEFAULTS` | Button |
| `DIVIDER_BLOCK_DEFAULTS` | Divider |
| `SECTION_BLOCK_DEFAULTS` | Section |
| `VIDEO_BLOCK_DEFAULTS` | Video |
| `SOCIAL_ICONS_BLOCK_DEFAULTS` | Social Icons |
| `SPACER_BLOCK_DEFAULTS` | Spacer |
| `HTML_BLOCK_DEFAULTS` | HTML |
| `MENU_BLOCK_DEFAULTS` | Menu |
| `TABLE_BLOCK_DEFAULTS` | Table |

**Combined constants:**

| Constant | Description |
|----------|-------------|
| `DEFAULT_BLOCK_DEFAULTS` | All block type defaults in a single object (keys match `BlockDefaults` interface) |
| `DEFAULT_TEMPLATE_DEFAULTS` | Template settings defaults (`width`, `backgroundColor`, `fontFamily`) |

These constants are the single source of truth used internally by the factory functions. If you only need to override a few properties, you don't need to reference them — just pass your overrides to `blockDefaults` and they'll be deep-merged with these values.

## Programmatic Usage

The underlying factory functions also accept defaults directly:

```ts
import { createBlock, createTitleBlock, createParagraphBlock, createDefaultTemplateContent } from '@templatical/types';
import type { BlockDefaults } from '@templatical/types';

// Single block with partial overrides
const title = createTitleBlock({ level: 2, color: '#000' });
const paragraph = createParagraphBlock({ content: '<p>Hello</p>' });

// Via createBlock with full defaults map
const defaults: BlockDefaults = {
  title: { color: '#000000' },
  button: { backgroundColor: '#ff6600' },
};
const block = createBlock('title', defaults);

// Template with custom settings
const content = createDefaultTemplateContent('Helvetica, sans-serif', {
  width: 640,
  backgroundColor: '#f5f5f5',
});
```
