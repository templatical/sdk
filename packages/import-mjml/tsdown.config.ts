import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // declarationMap is on in tsconfig.base, but sources aren't published
  // (files: ["dist"]), so a bundled .d.ts.map would point at nothing — strip it.
  dts: { resolver: 'tsc', compilerOptions: { declarationMap: false } },
})
