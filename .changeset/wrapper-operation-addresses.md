---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/ai-kit": minor
"@templatical/template-tools": minor
---

Breaking changes:

- `addBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Add wrappers at the top level with `parent: null`.
- `moveBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Move wrappers to the top level with `parent: null`.
- A malformed `moveBlock.expect.parent` is refused as `invalid_operation` at the shape check instead of failing as `precondition_failed`. Send `null`, `{ sectionId, column }` or `{ wrapperId }`.
- `addBlock`, `moveBlock` and `updateBlock` refuse a section with `section.wrapper` inside a layout wrapper. Keep the section at the top level or remove its own wrapper before placing it inside one. `validateLayout` rejects the same nesting.

Operations can address wrapper children with `{ wrapperId }` while existing section-column addresses keep their wire shape. The engine, inverses, collaboration diffs, AI feedback and CLI apply wrapper-child edits with placement, lock and hidden-slot checks.
