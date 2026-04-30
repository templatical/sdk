# @templatical/types

> Shared TypeScript types, block factory functions, and type guards for the Templatical email editor.

[![npm version](https://img.shields.io/npm/v/@templatical/types?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/types)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

Zero-dependency package containing all shared types for the [Templatical](https://github.com/templatical/sdk) email editor ecosystem. Block schemas, template config, factory helpers, and type guards.

Use this directly if you need to programmatically create or transform Templatical templates — for example, in a backend service, codegen pipeline, or migration script.

## Install

```bash
npm install @templatical/types
```

## Usage

```ts
import {
  createTitleBlock,
  createParagraphBlock,
  createButtonBlock,
  isImage,
  isSection,
} from '@templatical/types';
import type { TemplateContent, Block } from '@templatical/types';

// Build a template programmatically
const content: TemplateContent = {
  blocks: [
    createTitleBlock({ text: 'Welcome to Templatical', level: 1 }),
    createParagraphBlock({ text: 'Build email templates visually.' }),
    createButtonBlock({ text: 'Get started', href: 'https://templatical.com' }),
  ],
  settings: { width: 600, backgroundColor: '#ffffff' },
};

// Type-narrow blocks safely
function describeBlock(block: Block): string {
  if (isImage(block)) return `Image: ${block.src}`;
  if (isSection(block)) return `Section with ${block.columns.length} columns`;
  return block.type;
}
```

## What's exported

- **Block types** — `Block`, `TitleBlock`, `ParagraphBlock`, `ImageBlock`, `ButtonBlock`, `SectionBlock`, `DividerBlock`, `SpacerBlock`, `SocialIconsBlock`, `MenuBlock`, `TableBlock`, `HtmlBlock`, `VideoBlock`, `CountdownBlock`, `CustomBlock`
- **Factory functions** — `createTitleBlock()`, `createParagraphBlock()`, etc. for every block type
- **Type guards** — `isTitle()`, `isParagraph()`, `isImage()`, `isSection()`, etc.
- **Template types** — `Template`, `TemplateContent`, `TemplateSettings`
- **Theme types** — `ThemeOverrides`, `UiTheme`, `BlockDefaults`, `FontsConfig`
- **Config types** — `MergeTagsConfig`, `DisplayConditionsConfig`, `CustomBlockDefinition`
- **Event emitter** — `EventEmitter` (used internally by core)
- **Merge tag presets** — common merge tag definitions (Mailchimp, etc.)

## Documentation

- [Block reference](https://docs.templatical.com/guide/blocks)
- [Types API](https://docs.templatical.com/api/types)
- [Programmatic templates](https://docs.templatical.com/guide/programmatic-templates)

Full reference at **[docs.templatical.com](https://docs.templatical.com)**.

## License

MIT
