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
  resolve: {
    // Dedupe Vue runtime + reactivity. Both `vue` (full runtime) and
    // `@vue/reactivity` (used by `@templatical/core`) must resolve to a single
    // physical instance in the bundle — otherwise the editor ships two
    // reactivity systems with separate dep-tracking WeakMaps, and refs created
    // in core never trigger re-renders in editor components (interactivity
    // silently dies). Vue re-exports the entire @vue/reactivity surface, so
    // when both are bundled together the bundler emits one shared module.
    dedupe: ['vue', '@vue/reactivity'],
  },
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
      // Bundle Vue, @templatical/core, @templatical/types and all transitive Vue
      // libs inline so the editor ships as a self-contained drop-in. The only
      // externals are optional cloud/feature peers the consumer opts into.
      external: ['@templatical/media-library', '@templatical/renderer', 'pusher-js'],
    },
  },
})
