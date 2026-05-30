---
"@templatical/editor": patch
"@templatical/core": patch
"@templatical/renderer": patch
"@templatical/media-library": patch
"@templatical/import-beefree": patch
"@templatical/import-html": patch
---

Fix a batch of correctness and data-loss bugs found during an audit

Each fix ships with a regression test that fails without the change.

- **`@templatical/editor` — rich-text URL sanitizer XSS bypass.** `isSafeUrl`
  only `.trim()`-ed the value before scheme matching, so payloads with embedded
  tab/newline/CR or leading control characters (e.g. `java\tscript:…`,
  `\x01javascript:…`) matched no scheme and were treated as safe, yet re-formed a
  live `javascript:` URL once rendered. The value is now normalized the way the
  WHATWG URL parser does (strip ASCII tab/LF/CR anywhere, strip leading
  C0-control/space) before the scheme check.
- **`@templatical/core` (cloud) — `moveBlock` data loss.** The cloud editor
  spliced a block out of its parent before resolving the destination, so an
  invalid/stale `targetSectionId`, a non-section target, or an out-of-range
  `columnIndex` (all reachable via remote MCP/collaboration `move_block`
  payloads) dropped the block irrecoverably. It now resolves and validates the
  target before mutating the source, mirroring the OSS editor.
- **`@templatical/core` (cloud) — collaboration broadcast positioning.** The
  `addBlock` broadcast wrapper dropped the 4th `index` argument, so duplicating a
  block or inserting a saved module at a position appended it to the end and
  desynced collaborators. The wrapper now forwards `index` and includes it in the
  broadcast payload.
- **`@templatical/editor` — table cell edits clobbered in shadow DOM.** The
  `v-cell-content` guard compared `el.ownerDocument.activeElement`, which returns
  the shadow host (never the inner `<td>`) in the default shadow-DOM mount, so a
  concurrent external `update_block` overwrote in-progress keystrokes. It now
  resolves the focused element via `el.getRootNode().activeElement`.
- **`@templatical/renderer` — display conditions dropped on nested blocks.**
  Blocks inside a section column never received their `{% if %}`/`{% endif %}`
  display-condition guards, so conditional content in a multi-column layout
  rendered unconditionally for every recipient. Display-condition wrapping is now
  applied to nested blocks too.
- **`@templatical/editor` — snapshot restore failure left wrong content.** When a
  snapshot restore failed, the editor was left showing the previewed snapshot as
  the live document with the banner gone and the backup discarded. The content is
  now rolled back to the pre-preview state on failure, and the restore is no
  longer an unhandled promise rejection.
- **`@templatical/media-library` — crop resize aspect-ratio distortion.**
  `resizeCanvas` injected a spurious factor when `maxWidth` was set but only
  `maxHeight` clamped, squishing the image horizontally and disagreeing with the
  on-screen preview. It now scales width by `maxHeight / targetHeight`.
- **`@templatical/import-html` — wrapper-div content reordering.** Loose content
  appearing before a table inside a wrapping `<div>`/`<center>`/`<main>` was
  emitted after the table-derived sections, reordering the document. Pending loose
  content is now flushed before each nested table.
- **`@templatical/import-html` — paragraph alignment dropped.** A container's
  `text-align` was lost when the inner `<p>` carried a non-style attribute
  (`class`/`id`/`dir`/…). Alignment is now applied with an attribute-tolerant
  matcher that merges into any existing `style`.
- **`@templatical/import-beefree` — single-column row background dropped.** A
  single-column row's background color was discarded because only multi-column
  rows were wrapped in a section. Single-column rows with a non-transparent
  background are now wrapped in a one-column section carrying the background.
