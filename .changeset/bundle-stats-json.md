---
"@templatical/editor": patch
---

Emit `dist/bundle-stats.json` during the editor build with gzipped totals for the initial static bundle and the lazy chunks. Powers the bundle-size pill on templatical.com — the marketing site fetches the file from unpkg at its own build time so the published number reflects what real consumers see (Vite/webpack/Rollup preserve dynamic-import boundaries) instead of a bundler-server-side overcount.

File contract:

```json
{
  "version": "0.2.1",
  "initialGzipBytes": 211686,
  "initialRawBytes": 717015,
  "initialFileCount": 30,
  "lazyGzipBytes": 250763,
  "lazyRawBytes": 876728,
  "lazyFileCount": 43,
  "generatedAt": "2026-05-02T12:48:23.883Z"
}
```

Implemented as a small Vite `closeBundle` plugin in `packages/editor/vite.config.ts` — walks the static-import graph from `templatical-editor.js`, gzips each chunk individually, and treats every other `.js` in `dist/` as lazy. `dist/cdn/` (the separate script-tag distribution) is excluded.
