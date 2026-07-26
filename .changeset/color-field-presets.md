---
"@templatical/types": minor
"@templatical/editor": minor
---

Add per-field color presets to custom-block color fields.

A `color` field in a `CustomBlockDefinition` now accepts the same `presets` / `allowCustom` pair as the editor-wide `colors` config, applied to that one field — so a field can be scoped to a color role (an accent/ink pair, say) while every other picker keeps the global palette. Entries are validated as `#rgb` / `#rrggbb` hex, exactly like editor-level presets.

A field's `presets` **replace** the editor-wide palette for that field rather than intersecting it, so a locked field can carry colors the global grid doesn't list; what a field can never do is unlock a locked editor. Setting neither inherits the editor's palette and its `allowCustom`; `allowCustom: false` locks one field while the rest of the editor stays free-form; `allowCustom: true` cannot unlock a field when `colors.allowCustom` is `false`. An empty `presets: []` — or one whose entries are all invalid — narrows nothing, so the field inherits the editor's palette.

Field configs that can't be honoured are reported once per block definition, naming both the block type and the field key: invalid preset entries, an ignored empty list, an ignored `allowCustom: true`, and a locked field whose `default` its own palette can't reselect. Non-breaking — color fields that set neither option render exactly as before.
