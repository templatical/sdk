import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import type { Plugin as RolldownPlugin } from 'rolldown'

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
 * Two variants are exported: `inlineStyleCssPlugin` (Vite — used by the
 * playground dev server, Vitest, and the CDN build) and
 * `inlineStyleCssRolldownPlugin` (tsdown/Rolldown — used by the npm library
 * build). They share the `resolveId` + `generateBundle` core; only the Vite
 * variant carries the serve-mode `load()` fallback and `configResolved` hook.
 *
 * Why a build-time plugin instead of moving every SFC `<style>` block into
 * `styles/index.css`: keeps Vue's component-local CSS authoring ergonomic,
 * preserves `:deep()` and scoped-attribute semantics, and avoids touching
 * 30+ `.vue` files. The plugin localizes the workaround to one file alongside
 * `bundleStatsPlugin`.
 */

const VIRTUAL_ID = 'virtual:editor-css'
const RESOLVED_ID = '\0virtual:editor-css'
const PLACEHOLDER = '__TPL_INLINE_EDITOR_CSS__'

function resolveVirtualId(id: string): string | undefined {
  if (id === VIRTUAL_ID) return RESOLVED_ID
}

/** Build-mode `load`: emit the placeholder; `generateBundle` replaces it. */
function loadBuildPlaceholder(id: string): string | null {
  if (id !== RESOLVED_ID) return null
  return `export default ${JSON.stringify(PLACEHOLDER)};`
}

/**
 * Shared `generateBundle` body. Finds every emitted CSS asset, concatenates
 * them, and replaces the placeholder string literal (in whichever quote form
 * the downstream minifier emitted) across every JS chunk. `ctx` carries the
 * rollup/rolldown plugin context for `warn`/`error`/`info`.
 */
function injectInlineCss(
  bundle: Record<string, unknown>,
  fallbackSourcePath: string,
  ctx: { warn?: (m: string) => void; error?: (m: string) => void; info?: (m: string) => void },
): void {
  // Find every emitted CSS asset and concatenate (library mode with
  // cssCodeSplit: false produces one; CDN build with code-splitting can
  // produce multiple — both are shadow-DOM-relevant).
  const cssParts: string[] = []
  for (const file of Object.values(bundle) as Array<Record<string, unknown>>) {
    if (
      file.type === 'asset' &&
      typeof file.fileName === 'string' &&
      file.fileName.endsWith('.css')
    ) {
      const source =
        typeof file.source === 'string'
          ? file.source
          : new TextDecoder().decode(file.source as Uint8Array)
      cssParts.push(source)
    }
  }

  if (cssParts.length === 0) {
    // No CSS emitted — fall back to source so the placeholder doesn't ship as
    // the runtime value of the export.
    try {
      cssParts.push(readFileSync(fallbackSourcePath, 'utf8'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.warn?.(
        `inline-style-css: no CSS asset emitted and fallback read failed (${message}); placeholder will remain in output`,
      )
      return
    }
  }

  const cssContent = cssParts.join('\n\n')
  const cssDoubleQuoted = JSON.stringify(cssContent)
  // Backticks let us avoid escaping every embedded `${...}` and `\` for
  // template-literal output. Replicate the minifier's expected form so the
  // chunk lands a valid string literal either way.
  const cssBacktickQuoted =
    '`' +
    cssContent
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${') +
    '`'

  // The plugin emits the placeholder via `JSON.stringify(PLACEHOLDER)`
  // (double-quoted), but library/app bundlers downstream may re-emit it as a
  // single-quoted string OR a template literal. Rolldown app builds in
  // particular promote long single-line strings to template literals during
  // minification, which the original double-quote-only replacement missed —
  // shipping the literal `__TPL_INLINE_EDITOR_CSS__` token into the runtime
  // and giving shadow-root mounts an adopted stylesheet of garbage.
  //
  // Match all three string-literal forms and substitute with the quote variant
  // the chunk already uses, so we preserve whatever escaping convention the
  // downstream bundler picked.
  const variants: Array<{ from: string; to: string }> = [
    { from: `"${PLACEHOLDER}"`, to: cssDoubleQuoted },
    { from: `'${PLACEHOLDER}'`, to: cssDoubleQuoted },
    { from: '`' + PLACEHOLDER + '`', to: cssBacktickQuoted },
  ]

  let chunksTouched = 0
  for (const file of Object.values(bundle) as Array<Record<string, unknown>>) {
    if (file.type !== 'chunk') continue
    let touched = false
    for (const { from, to } of variants) {
      if (!(file.code as string).includes(from)) continue
      file.code = (file.code as string).split(from).join(to)
      touched = true
    }
    if (touched) chunksTouched++
  }

  ctx.info?.(
    `inline-style-css: injected ${(cssContent.length / 1024).toFixed(1)} kB raw CSS into ${chunksTouched} chunk(s)`,
  )

  // Self-check: if the placeholder still appears in any chunk after the
  // variant-aware replacement above, a downstream bundler re-emitted it in a
  // form we don't recognize. Fail the build so the regression surfaces
  // immediately instead of shipping a shadow root whose adopted stylesheet
  // content is the literal placeholder token.
  for (const file of Object.values(bundle) as Array<Record<string, unknown>>) {
    if (file.type !== 'chunk') continue
    if (!(file.code as string).includes(PLACEHOLDER)) continue
    const surrounding = (file.code as string).match(
      new RegExp(`.{0,40}${PLACEHOLDER}.{0,40}`),
    )
    ctx.error?.(
      `inline-style-css: placeholder \`${PLACEHOLDER}\` still present in chunk ${file.fileName} after replacement. ` +
        `A downstream bundler likely re-emitted the placeholder string in a quote form not handled by the plugin. ` +
        `Surrounding context: ${surrounding?.[0] ?? '<unavailable>'}`,
    )
  }
}

export function inlineStyleCssPlugin(opts: {
  /** Absolute path to the source CSS used as a dev/test fallback. */
  fallbackSourcePath: string
}): Plugin {
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
      return resolveVirtualId(id)
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
      return loadBuildPlaceholder(id)
    },

    generateBundle(_, bundle) {
      injectInlineCss(bundle, opts.fallbackSourcePath, this)
    },
  }
}

/**
 * tsdown/Rolldown variant. The npm library build is always in build mode (no
 * `vite serve`), so there is no `configResolved` hook and no serve-mode
 * fallback — `load()` always emits the placeholder, and `generateBundle()`
 * swaps in the real CSS. Identical core to the Vite variant above.
 */
export function inlineStyleCssRolldownPlugin(opts: {
  fallbackSourcePath: string
}): RolldownPlugin {
  return {
    name: 'tpl-inline-style-css',
    enforce: 'post',
    resolveId(id: string) {
      return resolveVirtualId(id)
    },
    load(id: string) {
      return loadBuildPlaceholder(id)
    },
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      injectInlineCss(bundle, opts.fallbackSourcePath, this as never)
    },
  } as RolldownPlugin
}
