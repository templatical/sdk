---
"@templatical/editor": patch
---

Fix the inline "Browse media" button not inserting an image when the image is nested inside a section (#219)

`SectionBlock` rendered each nested child block with only a `@fetch-data` listener, whereas `Canvas` (top-level blocks) also forwards `@update`. `ImageBlock` signals a media pick by emitting `update` and holds no editor reference of its own, so an image *inside a section* emitted into the void and the picked media never landed. The content-sidebar path was unaffected because it updates the selected block by id, independent of nesting. `SectionBlock` now forwards the child's `@update` to `editor.updateBlock`, matching `Canvas`.
