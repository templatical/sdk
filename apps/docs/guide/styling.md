---
title: Styling
description: Block styles, spacing, visibility, and template-level settings in Templatical.
---

# Styling

Every block in Templatical carries a `styles` property for layout and appearance, plus `visibility` for per-viewport control.

## BlockStyles

The `BlockStyles` interface controls padding and background.

```ts
interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}
```

```ts
import { createParagraphBlock } from '@templatical/types';

const block = createParagraphBlock({
  content: '<p>Styled text</p>',
});

block.styles = {
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
  backgroundColor: '#f0f9ff',
};
```

## SpacingValue

Padding uses the `SpacingValue` type with four directional values in pixels.

```ts
interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

All four properties are required. Use `0` for sides that need no spacing:

```ts
block.styles = {
  padding: { top: 0, right: 16, bottom: 0, left: 16 },
};
```

## Block visibility

The `visibility` property on any block controls whether it renders at each breakpoint.

```ts
interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}
```

Both default to `true`. Set a breakpoint to `false` to hide the block at that size:

```ts
// Show only on desktop
block.visibility = {
  desktop: true,
  mobile: false,
};
```

This is useful for showing different content at different screen sizes -- for example, a detailed table on desktop and a simplified list on mobile.

## Template-level settings

Beyond individual block styles, the template itself has global settings that affect the overall layout.

| Setting | Type | Description |
|---------|------|-------------|
| `width` | `number` | Template content width in px (typically 600) |
| `backgroundColor` | `string` | Outer background color behind the template |
| `textColor` | `string` | Default text color, inherited by every text block (Title, Paragraph, Menu, Table) unless the block sets its own color or an inline text-color mark. Defaults to `#1a1a1a`. |
| `linkColor` | `string` | Document-level link color applied to every link (rich-text and menu). Optional — when unset, links inherit the surrounding text color. A per-block or per-item color still overrides. |
| `linkUnderline` | `boolean` | Whether body (rich-text) links are underlined. Defaults to `true`. Buttons and menu items keep their own text-decoration. |
| `fontFamily` | `string` | Default font family for all blocks |

These are configured through the editor's `init()` config or by modifying the template JSON directly:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  content: {
    settings: {
      width: 640,
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    blocks: [],
  },
});
```

Individual blocks can override the template-level `fontFamily` by setting their own `fontFamily` property. When a block does not specify a font family, it inherits from the template settings.

Text color works the same way: text blocks (Title, Paragraph, Menu, Table) inherit `textColor` from the template settings, and any block that sets its own color overrides it. Customize the document default through `init({ templateDefaults: { textColor } })`.

Links follow the same cascade: set a document `linkColor` to apply one color to every link (rich-text and menu), or leave it unset so links inherit the surrounding text color. `linkUnderline` (on by default) underlines body links — buttons and menu items keep their own text-decoration. A per-block or per-item color (e.g. a Menu item's color) still overrides the document link color.
