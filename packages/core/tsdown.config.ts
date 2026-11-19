import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // @vue/reactivity is a dependency (auto-external); vue is a devDep used only
  // in tests, so it must be externalized explicitly (matches tsup's external).
  deps: { neverBundle: ['vue'] },
  // declarationMap is on in tsconfig.base, but sources aren't published
  // (files: ["dist"]), so a bundled .d.ts.map would point at nothing — strip it.
  dts: { resolver: 'tsc', compilerOptions: { declarationMap: false } },
})
