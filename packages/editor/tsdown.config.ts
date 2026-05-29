import { defineConfig } from 'tsdown'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import Vue from 'unplugin-vue/rolldown'
import { importGlobPlugin } from 'rolldown/experimental'
import tailwindcss from '@tailwindcss/postcss'
import { inlineStyleCssRolldownPlugin } from './scripts/inline-style-css-plugin.ts'
import { bundleStatsRolldownPlugin } from './scripts/bundle-stats-plugin.ts'

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'),
) as { version: string }

const dist = resolve(import.meta.dirname, 'dist')

export default defineConfig({
  // Entry key 'templatical-editor' keeps the published main chunk named
  // templatical-editor.js (asserted by bundle-topology.test.ts + the
  // e2e-consumer preflight). The .d.ts follows the same base name.
  entry: { 'templatical-editor': 'src/index.ts' },
  format: ['esm'],
  // 'browser' (not 'neutral'): the editor bundles browser libs that expose only
  // a "main" field (@lucide/vue, @vue/reactivity); 'neutral' ignores "main" and
  // would externalize them, breaking the self-contained bundle + reactivity dedupe.
  platform: 'browser',
  // Vite replaces import.meta.env.* at build time; tsdown does not. The editor
  // guards its dev-only shadow-DOM style mirror with `import.meta.env?.DEV`
  // (src/index.ts) — if left unreplaced, a consumer's *dev server* evaluates it
  // as truthy and mirrors host <style> tags into the shadow root, breaking the
  // isolation guarantee (issue #70). Inject the production values so the dev
  // branch is dead. An object define covers both `.DEV` and `?.DEV` access.
  define: {
    'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }),
  },
  target: 'es2022',
  sourcemap: true,
  clean: true,
  plugins: [
    Vue({
      isProduction: true,
      template: {
        compilerOptions: {
          // vanilla-colorful registers <hex-color-picker> as a native web component
          isCustomElement: (tag: string) => tag === 'hex-color-picker',
        },
      },
    }),
    // i18n auto-discovers OSS + cloud locale files via import.meta.glob('./locales/*.ts').
    importGlobPlugin({ root: import.meta.dirname }),
    // Inlines the compiled CSS string into virtual:editor-css for shadow-DOM adoption.
    inlineStyleCssRolldownPlugin({
      fallbackSourcePath: resolve(import.meta.dirname, 'src/styles/index.css'),
    }),
    // Writes dist/bundle-stats.json (fetched by the marketing site). Runs in
    // closeBundle, after the entry chunk (templatical-editor.js) is on disk.
    bundleStatsRolldownPlugin({
      distDir: dist,
      entry: 'templatical-editor.js',
      pkgVersion: pkg.version,
    }),
  ],
  // The editor is self-contained: vue, @templatical/core, @templatical/types,
  // @vueuse/core, @tiptap/*, @lucide/vue etc. are all bundled. Only the optional
  // cloud/feature peers stay external (matches the old Vite `external` list).
  deps: {
    neverBundle: [
      '@templatical/media-library',
      '@templatical/quality',
      '@templatical/renderer',
      'pusher-js',
    ],
  },
  // The editor's .d.ts stays on vue-tsc + @microsoft/api-extractor (see the
  // build script). rolldown-plugin-dts inlines any non-external import, and the
  // editor bundles its entire type surface (vue, @tiptap/*, @vueuse, prosemirror
  // — all devDeps) in JS while those must stay EXTERNAL in the published .d.ts.
  // tsdown couples JS-bundle and dts-external, so it would inline ~950 kB of
  // third-party types. api-extractor's no-paths tsconfig keeps them external (~11 kB).
  dts: false,
  css: {
    // Editor compiles its full Tailwind surface into one style.css (no peer
    // fallback). @tailwindcss/postcss handles the v4 `@import 'tailwindcss/…'
    // prefix(tpl)` syntax. No minify: lightningcss's minify pass strictly
    // rejects the (intentional) Geist `@import url(fonts.bunny…)` appearing
    // mid-bundle after concatenation; unminified also matches the other
    // tsdown library packages (consumers minify downstream).
    transformer: 'postcss',
    postcss: { plugins: [tailwindcss()] },
    fileName: 'style.css',
  },
})
