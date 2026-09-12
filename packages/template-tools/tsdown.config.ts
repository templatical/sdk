import { defineConfig } from 'tsdown'

export default defineConfig({
  // Three entries: the library, the Node-only live subpath, and the CLI. The
  // array form preserves dist/index.js + dist/live/index.js + dist/bin.js,
  // matching package.json's exports and bin fields.
  entry: ['src/index.ts', 'src/live/index.ts', 'src/bin.ts'],
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
