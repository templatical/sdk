import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // tsconfig.build.json mirrors the old tsup setup: excludes tests and carries
  // the `paths` to @templatical/media-library source, so its type-only imports
  // (TemplaticalConfig/PlanConfig) inline into the bundled .d.ts as before.
  // declarationMap stays off — sources aren't published.
  dts: {
    resolver: 'tsc',
    tsconfig: 'tsconfig.build.json',
    compilerOptions: { declarationMap: false },
  },
})
