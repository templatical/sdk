import { defineConfig } from 'tsdown'

export default defineConfig({
  // Four entries: the wire, the browser/server client, the server kit and the
  // test kit. The array form keeps dist/index.js + dist/{client,server,testing}/
  // index.js, matching package.json's exports. Shared code becomes a chunk.
  entry: [
    'src/index.ts',
    'src/client/index.ts',
    'src/server/index.ts',
    'src/testing/index.ts',
  ],
  format: ['esm'],
  // Isomorphic by contract (A1 BY4): browsers, Node, Workers, Deno, Bun.
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // declarationMap is on in tsconfig.base, but sources aren't published
  // (files: ["dist", …]), so a bundled .d.ts.map would point at nothing.
  dts: { resolver: 'tsc', compilerOptions: { declarationMap: false } },
})
