import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { tsconfig: 'tsconfig.build.json' },
  clean: true,
  target: 'es2022',
  sourcemap: true,
})
