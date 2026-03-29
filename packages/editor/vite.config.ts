import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TemplaticalEditor',
      fileName: 'templatical-editor',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue', '@templatical/core', '@templatical/core/cloud', '@templatical/media-library', '@templatical/types', '@templatical/renderer'],
      output: {
        globals: {
          vue: 'Vue',
          '@templatical/core': 'TemplaticalCore',
          '@templatical/core/cloud': 'TemplaticalCoreCloud',
          '@templatical/media-library': 'TemplaticalMediaLibrary',
          '@templatical/types': 'TemplaticalTypes',
          '@templatical/renderer': 'TemplaticalRenderer',
        },
      },
    },
  },
})
