---
"@templatical/editor": patch
---

Four field indicators that were translated but rendered nothing now say what they mean.

Each had its string sitting in all seven locales, bound nowhere — a control on screen carrying no text:

- **The required asterisk** (`FieldWrapper`) was a bare `<span>*</span>`. An asterisk announces as "asterisk" or as nothing, so a screen reader user could not tell a field was required. The glyph is now `aria-hidden` with `customBlocks.fields.required` carried alongside it and on `title`.
- **The read-only lock** was a bare icon. It reuses `customBlocks.dataSource.readOnlyTooltip` — the string the seven field components already put on the input — rather than a new key, because `readOnly` here is only ever `field.readOnly && block.dataSourceFetched`, so "loaded from your data source" is the actual reason and a generic "Read-only" would say less.
- **The minimum-items message** (`RepeatableField`) never appeared: `!canAdd` rendered `maxItemsReached`, while `!canRemove` silently dropped the Remove button. `customBlocks.fields.minItemsRequired` now mirrors it, with its `{count}` filled in. Both render together for a fixed-length list (`minItems === maxItems`) — that pair is what says the length is fixed.
- **The image placeholder tooltip** (`ImageToolbar`) bound `placeholderUrl` and `placeholderUrlPlaceholder` but not `placeholderUrlTooltip`, which `VideoToolbar` had carried on its own placeholder field all along. The field explains itself now: the real image comes from the merge tag at send time, so this is a design-time stand-in that never ships.

`image.optional` is a new key. The hint beside that same field was a hardcoded `"(optional)"` — the last hardcoded UI string in the editor — so every non-English locale showed English there. It copies each locale's existing `video.optional`, so no translation was invented.

Nothing changes for anyone whose custom blocks set neither `required`, `readOnly`, nor `minItems`.
