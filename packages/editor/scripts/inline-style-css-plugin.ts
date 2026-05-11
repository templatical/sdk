import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Inlines the editor's *fully-bundled* library CSS as a JS string export so
 * shadow-DOM mounts can adopt it via `adoptedStyleSheets`.
 *
 * Source modules import a virtual ID:
 *
 *     import editorStyles from 'virtual:editor-css'
 *
 * The plugin's `load()` initially emits a placeholder string. After
 * Vite/Rolldown produces the combined CSS asset (Tailwind utilities + every
 * `.vue` SFC `<style>` block + `styles/index.css` rules + scoped data-v
 * attribute selectors), `generateBundle()` swaps the placeholder with the
 * actual CSS in every JS chunk that references it.
 *
 * In dev (`vite serve`) and tests (vitest), the build pipeline never emits a
 * single combined CSS asset, so `load()` returns the raw source CSS from
 * `fallbackSourcePath` directly. The shadow-mount smoke test only asserts
 * `adoptedStyleSheets` is non-empty, which is satisfied by either path.
 *
 * Why a build-time plugin instead of moving every SFC `<style>` block into
 * `styles/index.css`: keeps Vue's component-local CSS authoring ergonomic,
 * preserves `:deep()` and scoped-attribute semantics, and avoids touching
 * 30+ `.vue` files. The plugin localizes the workaround to one ~70-line
 * file alongside `bundleStatsPlugin`.
 */
export function inlineStyleCssPlugin(opts: {
  /** Absolute path to the source CSS used as a dev/test fallback. */
  fallbackSourcePath: string
}): Plugin {
  const VIRTUAL_ID = 'virtual:editor-css'
  const RESOLVED_ID = '\0virtual:editor-css'
  const PLACEHOLDER = '__TPL_INLINE_EDITOR_CSS__'

  let isServeMode = false

  return {
    name: 'tpl-inline-style-css',
    enforce: 'post',

    configResolved(config) {
      // `serve` covers `vite dev` and Vitest's transform-on-demand mode.
      // `build` is the only mode where generateBundle runs.
      isServeMode = config.command === 'serve'
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },

    load(id) {
      if (id !== RESOLVED_ID) return null
      if (isServeMode) {
        // Dev (vite serve, vitest, playground dev) — delegate to `?inline` on
        // the source CSS. Vite + Tailwind plugin process the file and return
        // the compiled CSS as a string. Raw-source fallback wouldn't work
        // here: `@import 'tailwindcss/utilities.css'` rules are stripped from
        // `replaceSync()` adopted stylesheets per the CSSOM spec, leaving the
        // shadow root with theme vars only and no Tailwind utility rules —
        // which is exactly the broken-chrome regression observed when shipping
        // raw source as the fallback.
        //
        // Known dev-mode limitation: this still does NOT capture SFC `<style
        // scoped>` blocks from `.vue` files (Vite dev injects each into
        // document.head separately via HMR — those don't cross the shadow
        // boundary). For full-fidelity shadow DOM testing, run a production
        // build and exercise the packed output. Acceptable trade-off for dev.
        return `import css from '${opts.fallbackSourcePath.replace(/\\/g, '\\\\')}?inline';\nexport default css;\n`
      }
      // Build mode — emit the placeholder. generateBundle replaces it.
      return `export default ${JSON.stringify(PLACEHOLDER)};`
    },

    generateBundle(_, bundle) {
      // Find every emitted CSS asset and concatenate (Vite library mode with
      // cssCodeSplit: false produces one; CDN build with code-splitting can
      // produce multiple — both are shadow-DOM-relevant).
      const cssParts: string[] = []
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          const source =
            typeof file.source === 'string'
              ? file.source
              : new TextDecoder().decode(file.source)
          cssParts.push(source)
        }
      }

      if (cssParts.length === 0) {
        // No CSS emitted — fall back to source so the placeholder doesn't
        // ship as the runtime value of the export.
        try {
          cssParts.push(readFileSync(opts.fallbackSourcePath, 'utf8'))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.warn?.(
            `inline-style-css: no CSS asset emitted and fallback read failed (${message}); placeholder will remain in output`,
          )
          return
        }
      }

      const cssContent = cssParts.join('\n\n')
      // The placeholder ships as a JSON-encoded string literal in the chunk.
      const placeholderQuoted = JSON.stringify(PLACEHOLDER)
      const cssQuoted = JSON.stringify(cssContent)

      let replaced = 0
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        if (!file.code.includes(placeholderQuoted)) continue
        file.code = file.code.split(placeholderQuoted).join(cssQuoted)
        replaced++
      }

      this.info?.(
        `inline-style-css: injected ${(cssContent.length / 1024).toFixed(1)} kB raw CSS into ${replaced} chunk(s)`,
      )
    },
  }
}
