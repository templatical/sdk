import { defineConfig } from 'tsdown'

export default defineConfig({
  // The wire, the browser/server client, the server kit, the test kit and one
  // entry per model adapter, so importing one adapter never loads another.
  // Keys are the output paths, matching package.json's exports. Shared code
  // becomes a chunk.
  entry: {
    index: 'src/index.ts',
    'client/index': 'src/client/index.ts',
    'server/index': 'src/server/index.ts',
    'testing/index': 'src/testing/index.ts',
    'adapters/anthropic': 'src/adapters/anthropic.ts',
    'adapters/openai': 'src/adapters/openai.ts',
    'adapters/vercel': 'src/adapters/vercel.ts',
  },
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
