import { defineConfig } from 'tsdown'

export default defineConfig({
  // Array entry preserves dist/index.js + dist/live/index.js, matching the
  // package's two subpath exports (same shape as @templatical/core's cloud split).
  entry: ['src/index.ts', 'src/live/index.ts'],
  format: ['esm'],
  // 'neutral' like every sibling package. The ./live subpath is Node-only in
  // practice (node:http / node:fs), but those are node:-prefixed builtins that
  // externalize identically under either platform — and 'node' would switch the
  // output to .mjs/.d.mts, breaking the .js/.d.ts paths in package.json exports.
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // declarationMap is on in tsconfig.base, but sources aren't published
  // (files: ["dist", ...]), so a bundled .d.ts.map would point at nothing — strip it.
  dts: { resolver: 'tsc', compilerOptions: { declarationMap: false } },
})
