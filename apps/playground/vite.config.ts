import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const packagesDir = resolve(import.meta.dirname, '../../packages');

export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    // vanilla-colorful registers <hex-color-picker> as a native web component
                    isCustomElement: (tag) => tag === 'hex-color-picker',
                },
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        // Deduplicate vue and @vue/reactivity so they share one reactive system.
        // Core package imports from @vue/reactivity; editor components import from vue.
        dedupe: ['vue', '@vue/reactivity'],
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
            // Resolve workspace packages to source for dev — avoids needing pre-built dist
            '@templatical/editor/src': resolve(packagesDir, 'editor/src'),
            '@templatical/editor': resolve(packagesDir, 'editor/src/index.ts'),
            '@templatical/core/cloud': resolve(
                packagesDir,
                'core/src/cloud/index.ts',
            ),
            '@templatical/core': resolve(packagesDir, 'core/src/index.ts'),
            '@templatical/types': resolve(packagesDir, 'types/src/index.ts'),
            '@templatical/renderer': resolve(
                packagesDir,
                'renderer/src/index.ts',
            ),
            '@templatical/import-beefree': resolve(
                packagesDir,
                'import-beefree/src/index.ts',
            ),
            '@templatical/import-unlayer': resolve(
                packagesDir,
                'import-unlayer/src/index.ts',
            ),
            '@templatical/import-html': resolve(
                packagesDir,
                'import-html/src/index.ts',
            ),
            '@templatical/media-library': resolve(
                packagesDir,
                'media-library/src/index.ts',
            ),
        },
    },
    build: {
        outDir: 'dist',
        rolldownOptions: {
            output: {
                manualChunks(id: string) {
                    // Vue runtime — cached across navigations
                    if (id.includes('/vue/') || id.includes('@vue/reactivity')) {
                        return 'vue-runtime';
                    }
                    // VueUse — shared between App and Cloud pages
                    if (id.includes('@vueuse/')) {
                        return 'vueuse';
                    }
                    // Pusher — only needed when Cloud collaboration is active
                    if (id.includes('pusher-js')) {
                        return 'pusher';
                    }
                },
            },
        },
    },
});
