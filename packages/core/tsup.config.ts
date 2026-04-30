import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cloud/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  sourcemap: true,
  external: ['vue'],
})
