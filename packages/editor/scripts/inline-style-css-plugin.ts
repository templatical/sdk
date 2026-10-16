import { readFileSync } from 'node:fs'
import type { Plugin, Rolldown } from 'vite'

type OutputAsset = Rolldown.OutputAsset
type OutputChunk = Rolldown.OutputChunk

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
 *
 * A host app that compiles the editor from source (the playground) runs this
 * plugin in its own build, where the bundle also holds the host's CSS. Pass
 * `ownedRoots` there: only CSS from modules under those directories (plus the
 * third-party CSS they import) reaches the shadow root, and the module also
 * exports the roots so the dev mirror in `src/index.ts` applies the same rule.
 * Without it, the playground's Tailwind preflight rendered every canvas title
 * at 400 where real installs and the exported email show 700.
 */
export function inlineStyleCssPlugin(opts: {
  /** Absolute path to the source CSS used as a dev/test fallback. */
  fallbackSourcePath: string
  /**
   * Absolute directories whose CSS is the editor's. Omit in the editor's own
   * builds, where every emitted CSS asset is the editor's. Set it in a host
   * app build that compiles the editor from source, so the host's CSS stays
   * out of the shadow root.
   */
  ownedRoots?: string[]
}): Plugin {
  const VIRTUAL_ID = 'virtual:editor-css'
  const RESOLVED_ID = '\0virtual:editor-css'
  const PLACEHOLDER = '__TPL_INLINE_EDITOR_CSS__'
  const ownedRoots = opts.ownedRoots?.map(toRootPrefix) ?? null
  const rootsExport = `export const ownedStyleRoots = ${JSON.stringify(ownedRoots)};\n`

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
        return `import css from '${opts.fallbackSourcePath.replace(/\\/g, '\\\\')}?inline';\nexport default css;\n${rootsExport}`
      }
      // Build mode — emit the placeholder. generateBundle replaces it.
      return `export default ${JSON.stringify(PLACEHOLDER)};\n${rootsExport}`
    },

    generateBundle(_, bundle) {
      // Concatenate the emitted CSS assets (Vite library mode with
      // cssCodeSplit: false produces one; CDN build with code-splitting can
      // produce multiple — both are shadow-DOM-relevant). With `ownedRoots`,
      // only the editor's own assets.
      const cssAssets = Object.values(bundle).filter(
        (file): file is OutputAsset =>
          file.type === 'asset' && file.fileName.endsWith('.css'),
      )
      const chunks = Object.values(bundle).filter(
        (file): file is OutputChunk => file.type === 'chunk',
      )
      const cssParts: string[] = []
      let hostAssets = 0
      for (const file of cssAssets) {
        if (ownedRoots) {
          const verdict = attributeCssAsset(file.fileName, chunks, ownedRoots)
          if (verdict.error) {
            this.error?.(verdict.error)
            return
          }
          if (!verdict.owned) {
            hostAssets++
            continue
          }
        }
        const source =
          typeof file.source === 'string'
            ? file.source
            : new TextDecoder().decode(file.source)
        cssParts.push(source)
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
      const cssDoubleQuoted = JSON.stringify(cssContent)
      // Backticks let us avoid escaping every embedded `${...}` and `\`
      // for template-literal output. Replicate the minifier's expected
      // form so the chunk lands a valid string literal either way.
      const cssBacktickQuoted =
        '`' +
        cssContent
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${') +
        '`'

      // The plugin emits the placeholder via `JSON.stringify(PLACEHOLDER)`
      // (double-quoted), but library/app bundlers downstream may re-emit
      // it as a single-quoted string OR a template literal. Rolldown app
      // builds in particular promote long single-line strings to
      // template literals during minification, which the original
      // double-quote-only replacement missed — shipping the literal
      // `__TPL_INLINE_EDITOR_CSS__` token into the runtime and giving
      // shadow-root mounts an adopted stylesheet of garbage.
      //
      // Match all three string-literal forms and substitute with the
      // quote variant the chunk already uses, so we preserve whatever
      // escaping convention the downstream bundler picked.
      const variants: Array<{ from: string; to: string }> = [
        { from: `"${PLACEHOLDER}"`, to: cssDoubleQuoted },
        { from: `'${PLACEHOLDER}'`, to: cssDoubleQuoted },
        { from: '`' + PLACEHOLDER + '`', to: cssBacktickQuoted },
      ]

      let chunksTouched = 0
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        let touched = false
        for (const { from, to } of variants) {
          if (!file.code.includes(from)) continue
          file.code = file.code.split(from).join(to)
          touched = true
        }
        if (touched) chunksTouched++
      }

      this.info?.(
        `inline-style-css: injected ${(cssContent.length / 1024).toFixed(1)} kB raw CSS into ${chunksTouched} chunk(s)` +
          (ownedRoots ? `, left out ${hostAssets} host CSS asset(s)` : ''),
      )

      // Self-check: if the placeholder still appears in any chunk after the
      // variant-aware replacement above, a downstream bundler re-emitted it
      // in a form we don't recognize. Fail the build so the regression
      // surfaces immediately instead of shipping a shadow root whose
      // adopted stylesheet content is the literal placeholder token.
      // Real-world precedent: Rolldown app-mode minification promoted long
      // single-line strings to backtick template literals, slipping past
      // the original double-quote-only replacement and shipping broken
      // styling to consumers using `shadowDom: true`.
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        if (!file.code.includes(PLACEHOLDER)) continue
        const surrounding = file.code.match(
          new RegExp(`.{0,40}${PLACEHOLDER}.{0,40}`),
        )
        this.error?.(
          `inline-style-css: placeholder \`${PLACEHOLDER}\` still present in chunk ${file.fileName} after replacement. ` +
            `A downstream bundler likely re-emitted the placeholder string in a quote form not handled by the plugin. ` +
            `Surrounding context: ${surrounding?.[0] ?? '<unavailable>'}`,
        )
      }
    },
  }
}

/** Same matcher as Vite's own `CSS_LANGS_RE`, plus Vue's style blocks. */
const CSS_MODULE_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)|[?&]type=style(?:&|$)/

type Owner = 'owned' | 'host' | 'neutral'

function toRootPrefix(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/?$/, '/')
}

function ownerOf(moduleId: string, roots: string[]): Owner {
  const path = moduleId.replace(/\\/g, '/')
  if (roots.some((root) => path.startsWith(root))) return 'owned'
  if (path.includes('/node_modules/')) return 'neutral'
  return 'host'
}

function sideOf(owners: Set<Owner>): 'owned' | 'host' | 'mixed' | null {
  if (owners.has('owned') && owners.has('host')) return 'mixed'
  if (owners.has('owned')) return 'owned'
  if (owners.has('host')) return 'host'
  return null
}

/**
 * Decides whether one emitted CSS asset is the editor's. Vite records which
 * chunk imports each asset (`viteMetadata.importedCss`), and the chunk lists
 * the modules it was built from, so the asset's CSS modules say whose it is.
 * Third-party CSS takes the side of the first-party code in its chunk. An
 * asset that holds both sides, or that can't be attributed, fails the build:
 * it can't be split, and either answer would put CSS in the wrong place.
 */
function attributeCssAsset(
  fileName: string,
  chunks: OutputChunk[],
  roots: string[],
): { owned: boolean; error?: undefined } | { owned?: undefined; error: string } {
  const importers = chunks.filter((chunk) =>
    chunk.viteMetadata?.importedCss.has(fileName),
  )
  if (importers.length === 0) {
    return {
      error: `inline-style-css: no chunk imports ${fileName}, so it can't be attributed to the editor or the host app.`,
    }
  }

  const cssOwners = new Set<Owner>()
  const codeOwners = new Set<Owner>()
  for (const chunk of importers) {
    for (const id of chunk.moduleIds) {
      // Virtual modules (`\0plugin-vue:export-helper`) belong to no one.
      if (id.startsWith('\0')) continue
      const owner = ownerOf(id, roots)
      if (CSS_MODULE_RE.test(id)) cssOwners.add(owner)
      else if (owner !== 'neutral') codeOwners.add(owner)
    }
  }

  const side = sideOf(cssOwners) ?? sideOf(codeOwners)
  if (side === 'owned') return { owned: true }
  if (side === 'host') return { owned: false }
  return {
    error:
      side === 'mixed'
        ? `inline-style-css: ${fileName} mixes the editor's CSS with the host app's. Keep the editor in chunks of its own (a dynamic import), or adjust ownedRoots.`
        : `inline-style-css: ${fileName} holds only third-party CSS, and its chunk has no first-party code to attribute it by.`,
  }
}
