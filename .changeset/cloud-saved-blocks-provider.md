---
"@templatical/editor": patch
"@templatical/types": patch
---

`initCloud()` now accepts a saved-blocks provider, and two unused types are removed.

**`savedBlocks` accepts `boolean | SavedBlocksProvider` on `initCloud()`.** Previously Cloud took a boolean and OSS took a provider — the same key with a different type on each entry point, so moving an OSS integration to Cloud meant rewriting that line. Now:

- omitted or `true` — backed by Templatical Cloud, gated on the `saved_modules` plan feature (unchanged);
- `false` — off entirely (unchanged);
- a `SavedBlocksProvider` — backed by your own store instead of Cloud's, and **not** plan-gated, because the plan feature licenses Cloud's storage rather than the editor's UI.

Pure type widening, so existing Cloud consumers passing a boolean are unaffected. The practical effect is that upgrading from OSS to Cloud is now a deletion — drop the key to adopt Cloud's store, or leave it exactly as it is to keep your own.

**Removed the unused `TemplaticalConfig` and `TemplaticalInstance` types from `@templatical/types`.** They duplicated the cloud editor's config and instance types and had drifted from them — `modules` was never renamed to `savedBlocks`, and later options were never added — so they described a config the SDK does not accept. The authoritative types are `TemplaticalCloudEditorConfig` and `TemplaticalCloudEditor`, both already exported from `@templatical/editor`, which is where `initCloud()` reads its config.

No runtime impact, and in practice nothing to migrate: the types were never re-exported from `@templatical/editor`, were absent from the documentation, and described Cloud configuration. If you did import either name directly from `@templatical/types`, switch to the two above — TypeScript will point at the line.
