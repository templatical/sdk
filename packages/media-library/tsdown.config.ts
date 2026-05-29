import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'
import { dynamicImportVarsPlugin, importGlobPlugin } from 'rolldown/experimental'
import tailwindcss from '@tailwindcss/postcss'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // Compile .vue SFCs. The npm entry re-exports init/unmount from standalone/visual,
  // which imports src/styles/index.css (the Tailwind v4 entry), so the npm build must
  // compile Tailwind — same as the old Vite build's @tailwindcss/vite plugin did.
  // The lazy locale loader uses a template-literal `import(`./locales/${target}.ts`)`.
  // dynamicImportVarsPlugin rewrites it to `import.meta.glob('./locales/*.ts')`, which
  // importGlobPlugin then resolves into per-locale chunks (de/en/pt-BR), as Vite did.
  plugins: [
    Vue({ isProduction: true }),
    dynamicImportVarsPlugin(),
    importGlobPlugin({ root: import.meta.dirname }),
  ],
  // core/types/vueuse/lucide/cropper are dependencies (auto-external); vue is a
  // devDep used in tests, so externalize it explicitly (matches the old Vite config).
  deps: { neverBundle: ['vue'] },
  dts: { vue: true, resolver: 'tsc', compilerOptions: { declarationMap: false } },
  css: {
    // @tailwindcss/postcss resolves the `@import 'tailwindcss/…' prefix(tpl)` v4
    // syntax that lightningcss can't parse. Emit dist/style.css to match the
    // package.json `./style.css` export (old Vite build mis-named it after the lib).
    transformer: 'postcss',
    postcss: { plugins: [tailwindcss()] },
    fileName: 'style.css',
  },
})
