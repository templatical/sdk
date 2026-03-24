---
title: Your First Template
description: Build email template content programmatically using factory functions.
---

# Your First Template

The editor starts empty by default. You can pass pre-built content to `init()` using factory functions from `@templatical/types`, or create a blank starting point with `createDefaultTemplateContent()`.

## Blank template

```ts
import { createDefaultTemplateContent } from '@templatical/types';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';

const content = createDefaultTemplateContent();
// { blocks: [], settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' } }

const editor = init({
  container: '#editor',
  content,
});
```

`createDefaultTemplateContent()` accepts an optional font family string:

```ts
const content = createDefaultTemplateContent('Georgia, serif');
```

## Adding blocks

Every block type has a corresponding `create*Block()` function. Each accepts an optional partial object to override defaults.

```ts
import {
  createDefaultTemplateContent,
  createTextBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSectionBlock,
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

## Using sections for multi-column layouts

Sections are the top-level container for columns. Use `createSectionBlock()` with a `columns` layout and `children` arrays -- one array per column.

```ts
import {
  createSectionBlock,
  createTextBlock,
  createImageBlock,
} from '@templatical/types';

const twoColumnSection = createSectionBlock({
  columns: '1-1',
  children: [
    // Left column
    [
      createImageBlock({
        src: 'https://example.com/feature-1.png',
        alt: 'Feature one',
      }),
      createTextBlock({ content: '<p>Feature one description.</p>' }),
    ],
    // Right column
    [
      createImageBlock({
        src: 'https://example.com/feature-2.png',
        alt: 'Feature two',
      }),
      createTextBlock({ content: '<p>Feature two description.</p>' }),
    ],
  ],
});
```

The `columns` property accepts layout strings: `'1'` (single), `'1-1'` (two equal), `'1-1-1'` (three equal), `'2-1'` (two-thirds / one-third), `'1-2'` (one-third / two-thirds), and more.

## Available factory functions

| Function | Block type |
|---|---|
| `createTextBlock()` | Rich text content |
| `createImageBlock()` | Image with alt text, width, alignment |
| `createButtonBlock()` | Call-to-action button |
| `createSectionBlock()` | Multi-column layout container |
| `createDividerBlock()` | Horizontal rule |
| `createSpacerBlock()` | Vertical spacing |
| `createSocialIconsBlock()` | Social media icon row |
| `createMenuBlock()` | Navigation menu links |
| `createTableBlock()` | Data table with header row |
| `createHtmlBlock()` | Raw HTML content |
| `createVideoBlock()` | Video thumbnail with play link |
| `createCountdownBlock()` | Countdown timer |
| `createCustomBlock()` | Custom block from a definition |

All factory functions auto-generate a unique `id` for each block using `crypto.randomUUID()`.

## Modifying template settings

Template settings control the global properties of the email. Modify them directly on the `TemplateContent` object before passing it to `init()`:

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

If you previously saved the output of `editor.getContent()`, pass it back as the `content` option:

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

- [Export](/getting-started/export) -- render your template to MJML and HTML.
- [Merge Tags](/guide/merge-tags) -- add dynamic placeholders like <code v-pre>{{ first_name }}</code>.
- [Custom Blocks](/guide/custom-blocks) -- define your own block types.
