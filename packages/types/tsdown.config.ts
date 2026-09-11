import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // tsconfig.build.json excludes tests. PlanConfig's media/storage types are
  // local Cloud wire types, so they inline in the bundled .d.ts rather than
  // becoming an external import. declarationMap stays off — sources aren't
  // published.
  dts: {
    resolver: 'tsc',
    tsconfig: 'tsconfig.build.json',
    compilerOptions: { declarationMap: false },
  },
})
