import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    publicDir: false,
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        outDir: resolve(import.meta.dirname, 'dist/cdn'),
        emptyOutDir: true,
        minify: true,
        target: 'es2022',
        sourcemap: true,
        cssMinify: 'esbuild',
        lib: {
            entry: resolve(import.meta.dirname, 'src/standalone/visual.ts'),
            formats: ['es'],
            fileName: () => 'media-library.js',
            cssFileName: 'media-library',
        },
        rolldownOptions: {
            external: [],
            output: {
                chunkFileNames: 'chunks/[name]-[hash].js',
                manualChunks: (id) => {
                    if (id.includes('@lucide/vue')) {
                        return 'icons';
                    }
                    if (
                        id.includes('node_modules/vue/') ||
                        id.includes('node_modules/@vue/')
                    ) {
                        return 'vue';
                    }
                    return undefined;
                },
            },
            treeshake: {
                moduleSideEffects: 'no-external',
                propertyReadSideEffects: false,
            },
        },
    },
    resolve: {
        alias: {
            '@templatical/media-library': resolve(import.meta.dirname, 'src/index.ts'),
            '@templatical/core/cloud': resolve(import.meta.dirname, '../core/src/cloud/index.ts'),
            '@templatical/core': resolve(import.meta.dirname, '../core/src/index.ts'),
            '@templatical/types': resolve(import.meta.dirname, '../types/src/index.ts'),
        },
    },
});
