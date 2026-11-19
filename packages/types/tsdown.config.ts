import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // tsconfig.build.json excludes tests. declarationMap stays off because
  // sources are not published.
  dts: {
    resolver: 'tsc',
    tsconfig: 'tsconfig.build.json',
    compilerOptions: { declarationMap: false },
  },
})
