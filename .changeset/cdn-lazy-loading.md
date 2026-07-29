---
"@templatical/editor": patch
---

Stop the CDN bundle eagerly shipping lazy-loaded components.

Two independent causes of the same bug: code behind `defineAsyncComponent` was ending up in the entry's static-import closure, so it downloaded on every editor load regardless of whether it was ever used.

**1. The `features` manual chunk.** `vite.cdn.config.ts` grouped six `defineAsyncComponent` cloud panels — AI chat, comments, design reference, template scoring, test email and snapshot history — into a single chunk that was statically reachable from the entry. Every Cloud session downloaded all **66.5 KB gzip** of it whether or not the user opened a single panel. `manualChunks` now groups third-party dependencies only; first-party source splits at its own dynamic-import boundaries.

**2. A duplicate countdown registration.** `countdown` requires Templatical Cloud (its animated GIF renders server-side), so `useEditorCore` registers it as a lazy `defineAsyncComponent`. `Canvas.vue` also listed it in its static `blockComponentMap` — the only one of the four fallback maps that did. Because `resolveBlockComponent` checks the registry first, that entry was unreachable at runtime, but its static `import` still pulled the module into the eager graph. The registry is now the single source, matching `SectionBlock`, `SavedBlockPreviewCanvas` and `PreviewSectionBlock`.

Measured on the CDN build:

- Eager payload (what every session fetches before opening anything): **337.1 → 329.5 KB gzip**.
- Opening one cloud panel: **0 KB (already paid up front) → 1.7–5.0 KB**, charged only to users who open it. All six in one session: **18.3 KB** across 7 chunks.
- Eager chunk count rises 14 → 27 while bytes fall, and waterfall depth only moves 5 → 6 — so the extra chunks are fetched in parallel rather than costing round-trips.

Removing only the `features` group would have made things worse: `media-library` becomes the next eager bridge and the eager payload grows 32.7 KB. Grouping first-party source is what creates the bridge, so the rule is a ban rather than a curated list. Guarded by a new `cdn-chunk-granularity` test — `bundle-topology` deliberately skips `dist/cdn/`, which is why this went unnoticed.

No API change and no behaviour change: countdown blocks and all six panels render exactly as before. CDN consumers get a smaller initial download and genuinely on-demand panels; npm consumers are unaffected (that build has no `manualChunks`).
