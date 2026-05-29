---
"@templatical/types": minor
"@templatical/renderer": minor
---

Custom blocks can now declare default block styles in their definition, and the renderer honors `block.styles.padding` on custom and HTML blocks.

**New `defaultStyles` on `CustomBlockDefinition`.** Custom block authors can now declare default `padding` and `backgroundColor` alongside `template` and `fields`. The value is a `Partial<BlockStyles>` deep-merged over the base defaults — specify only the fields you want to override. Controls both the editor canvas wrapper and the rendered MJML/email output.

```ts
customBlocks: [
  {
    type: 'pricing-table',
    template: '<table>…</table>',
    fields: [...],
    defaultStyles: {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  },
]
```

**`renderCustom` and `renderHtml` now honor `block.styles.padding`.** Previously the renderer emitted `<mj-text>` without an explicit `padding` attribute for custom and HTML blocks, so MJML's built-in `10px 25px` default applied regardless of `block.styles.padding`. Both renderers now pass `padding="..."` from the block's styles, matching how every other built-in renderer (paragraph, title, menu, table) already worked.

**Behavior change for existing custom and HTML blocks.** Previously, rendered email output used MJML's `mj-text` default of `10px 25px`. Now it uses `block.styles.padding`, which defaults to `10px` all around from `createDefaultStyles()`. To restore the old visual, set `defaultStyles: { padding: { top: 10, right: 25, bottom: 10, left: 25 } }` on the custom block definition, or override `padding` on the individual block instance via the editor.
