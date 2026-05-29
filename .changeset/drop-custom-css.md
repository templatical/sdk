---
"@templatical/types": minor
"@templatical/editor": minor
---

Remove the unimplemented `BaseBlock.customCss` per-block CSS surface.

`BaseBlock.customCss?: string` was a typed field with a "Custom CSS" textarea in the block settings panel, but no renderer ever read it — the field was dead data (same shape as the `styles.responsive` removal in #154). The editor textarea, the type field, and the three locale strings (`customCss` / `css` / `cssPlaceholder`) plus the docs section are removed.

Per-block free-form CSS is the wrong shape for an email editor: it targets end-users (who typically aren't email-CSS fluent), it doesn't dedupe across instances, and there is no reliable rendering surface for it that survives email-client variance. Custom-block-scoped CSS belongs at the definition level (developer-authored, deduped, emitted to `<mj-head><mj-style>…</mj-style></mj-head>`) — tracked separately in #155.

**Migration:** saved templates carrying a `customCss` string keep parsing — the extra key is ignored at runtime. No data migration is required; nothing read the field before this change, so no rendered output changes.
