---
title: Styling
description: Block styles, spacing, visibility, and template-level settings in Templatical.
---

# Styling

Every block in Templatical carries a `styles` property for layout and appearance, plus `visibility` and `customCss` for fine-grained control.

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

## Custom CSS

Every block has an optional `customCss` string property for injecting arbitrary CSS. The CSS is scoped to the block in the rendered output.

```ts
block.customCss = `
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;
```

::: warning
Most CSS properties don't work reliably across email clients. Properties like `display: flex`, `grid`, `position`, `box-shadow`, and CSS animations are ignored by many clients (especially Outlook). Stick to `padding`, `margin`, `border`, `border-radius`, `background-color`, and `text-align` for the best compatibility. Always test in real email clients before sending.
:::

## Template-level settings

Beyond individual block styles, the template itself has global settings that affect the overall layout.

| Setting | Type | Description |
|---------|------|-------------|
| `width` | `number` | Template content width in px (typically 600) |
| `backgroundColor` | `string` | Outer background color behind the template |
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
