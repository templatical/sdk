import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // tsconfig.build.json excludes tests and carries the `paths` to
  // @templatical/media-library source, which is the only thing that resolves
  // the type-only import behind `PlanConfig` — this package deliberately has no
  // media-library dependency (see src/cloud.ts). Those types therefore inline
  // into the bundled .d.ts rather than becoming an external import.
  // declarationMap stays off — sources aren't published.
  dts: {
    resolver: 'tsc',
    tsconfig: 'tsconfig.build.json',
    compilerOptions: { declarationMap: false },
  },
})
