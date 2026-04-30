import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue({
      template: {
        compilerOptions: {
          // vanilla-colorful registers <hex-color-picker> as a native web component
          isCustomElement: (tag) => tag === 'hex-color-picker',
        },
      },
    }),
    dts({ rollupTypes: true }),
  ],
  build: {
    cssMinify: 'esbuild',
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'TemplaticalEditor',
      fileName: 'templatical-editor',
      cssFileName: 'style',
      formats: ['es'],
    },
    cssCodeSplit: false,
    rolldownOptions: {
      external: ['@templatical/core', '@templatical/core/cloud', '@templatical/media-library', '@templatical/types', '@templatical/renderer'],
    },
  },
})
