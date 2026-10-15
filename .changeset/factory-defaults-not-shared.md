---
"@templatical/types": patch
---

Blocks no longer share nested objects with their defaults or with each other

Every button from `createButtonBlock()` or `createBlock("button")` held the same `buttonPadding` object as `BUTTON_BLOCK_DEFAULTS`, so changing one button's padding in place changed the built-in default and every other button made from it. Nested values in a `blockDefaults` entry, such as `section.wrapper`, `social.icons`, `menu.items` or `table.rows`, were shared the same way by every block `createBlock` made from them, which is how the editor inserts blocks. Every custom block of a type also shared its definition's repeatable `default` array. Each block now gets its own copy of these defaults. Values you pass to a factory directly are still used as given, so a block you place in a section's `children` is still the same object inside the section.

The `SectionWrapper` JSDoc no longer calls the wrapper a full-width band. It renders as an `mj-wrapper` without MJML's `full-width` attribute, so the band is as wide as the email body (`settings.width`), not the recipient's viewport.
