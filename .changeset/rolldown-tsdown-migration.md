---
"@templatical/types": patch
"@templatical/core": patch
"@templatical/renderer": patch
"@templatical/import-beefree": patch
"@templatical/import-unlayer": patch
"@templatical/import-html": patch
---

Migrate the framework-agnostic packages from tsup to tsdown (Rolldown + Oxc)

The six framework-agnostic library packages — `types`, `core`, `renderer`,
`import-beefree`, `import-unlayer`, `import-html` — now build with
[`tsdown`](https://tsdown.dev) instead of tsup. This drops `rollup` /
`rollup-plugin-dts` from the build path and aligns these packages with Rolldown
(which Vite already uses). Published output is functionally equivalent: same ESM
exports, same externals, equivalent `.d.ts`.

The Vue/CSS packages (`editor`, `media-library`) and `quality` deliberately
remain on Vite + `vue-tsc`/`tsc` + `@microsoft/api-extractor` — `rolldown-plugin-dts`
inlines the editor's bundled-but-type-external third-party surface (~950 kB vs
~11 kB), and Vite's batteries-included handling (env replacement, CSS/Tailwind,
glob, dts externalization) isn't worth reconstructing manually there.
