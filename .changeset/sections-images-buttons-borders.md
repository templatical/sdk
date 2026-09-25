---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
---

Sections, images and buttons take a border, and corners can be rounded one at a time

There was no way to draw a border around a block — an outlined card section, a framed product shot, or an outline ("ghost") button all needed an HTML block.

`SectionBlock`, `ImageBlock` and `ButtonBlock` gain an optional `border: BorderValue`. Like `SpacingValue`, it is described per side — `{ top, right, bottom, left }`, each a `{ width, style, color }` with `style` one of `"solid"`, `"dashed"` or `"dotted"`. A side with width `0` is not drawn, so a top rule, an underline or a thick accent on one side are all expressible. It renders as MJML's native `border` attribute when all four sides match, and as `border-top` / `-right` / `-bottom` / `-left` otherwise, on `mj-section`, `mj-image` and `mj-button`. Leave it out for no border, which is what every existing template already renders.

`borderRadius` on sections, section wrappers, images and buttons now also accepts a radius per corner — `{ topLeft, topRight, bottomRight, bottomLeft }` — rendered as the four-value `border-radius` shorthand (e.g. rounded top corners on a card that sits flush on the one below). A plain number still works and renders exactly as before.

**Type change:** `borderRadius` widens from `number` to `BorderRadiusValue` (`number | CornerRadius`). Code that only writes a number is unaffected; code that reads `borderRadius` and does arithmetic on it needs to handle the per-corner form (or use `toBorderRadiusCss()`).

The editor's section, image and button settings get a border control and a radius control, both working like the spacing control: linked, one set of values edits every side (or corner); unlinked, each side's width, style and color (or each corner's radius) is edited separately. Entering a width starts a solid black border; a width of `0` removes it.

`toBorderCss()`, `toBorderDeclarations()`, `toBorderRadiusCss()` and `uniformBorder()` are exported from `@templatical/types`, so the editor canvas and the renderer draw borders and radii identically.

For an outline button, set `backgroundColor` to the keyword `"transparent"` and set `textColor` too.

Other block types (text, menu, social, video) have no native MJML border and are not covered. Outlook on Windows ignores `border-radius` (including the per-corner form) and often paints dashed or dotted borders solid; image borders sit on the `<img>`, which Outlook often drops, while section and button borders sit on the `<td>`.
