---
"@templatical/editor": patch
"@templatical/media-library": patch
"@templatical/quality": patch
"@templatical/core": patch
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/import-beefree": patch
"@templatical/import-unlayer": patch
"@templatical/import-html": patch
---

Migrate all package builds to tsdown (Rolldown + Oxc)

Every library package now builds with [`tsdown`](https://tsdown.dev), unifying the
toolchain on Rolldown (Vite already uses it). This replaces tsup (esbuild + rollup)
for the six framework-agnostic packages and the Vite-library + api-extractor `.d.ts`
pipeline for `quality` and `media-library`. The `editor` builds its JS+CSS with
tsdown but keeps `vue-tsc` + api-extractor for its `.d.ts` (it bundles its full
third-party type surface in JS while keeping it external in types). CDN bundles
remain on Vite.

Published output is functionally equivalent (same ESM exports, same externals,
equivalent `.d.ts`). One fix: `@templatical/media-library`'s `./style.css` export
now resolves — the build emits `dist/style.css` (matching the export map) instead
of the previously mis-named `templatical-media-library.css`.
