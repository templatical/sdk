import { defineConfig } from 'tsdown'
import { importGlobPlugin } from 'rolldown/experimental'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // Rolldown's port of Vite's `import.meta.glob`. The linter auto-discovers its
  // locale message maps + vague-text dictionaries via `import.meta.glob('./*.ts')`
  // (matching the editor's i18n pattern) — this plugin resolves those at build time.
  plugins: [importGlobPlugin({ root: import.meta.dirname })],
  dts: { resolver: 'tsc', compilerOptions: { declarationMap: false } },
})
