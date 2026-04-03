import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    publicDir: false,
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'packages/media-library/src/standalone/visual.ts'),
            name: 'TemplaticalMediaLibrary',
            fileName: (format) => `media-library.${format}.js`,
            cssFileName: 'media-library',
        },
        outDir: resolve(import.meta.dirname, 'dist/media-library'),
        emptyOutDir: true,
        minify: true,
        target: 'es2022',
        sourcemap: true,
        cssMinify: 'esbuild',
        rolldownOptions: {
            output: [
                {
                    format: 'iife',
                    name: 'TemplaticalMediaLibrary',
                    exports: 'named',
                    entryFileNames: 'media-library.js',
                    assetFileNames: 'media-library.[ext]',
                    inlineDynamicImports: true,
                },
                {
                    format: 'es',
                    entryFileNames: 'media-library.es.js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    assetFileNames: 'media-library.[ext]',
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
            ],
            treeshake: {
                moduleSideEffects: 'no-external',
                propertyReadSideEffects: false,
            },
        },
    },
    resolve: {
        alias: {
            '@templatical/media-library': resolve(import.meta.dirname, 'packages/media-library/src/index.ts'),
            '@templatical/core/cloud': resolve(import.meta.dirname, 'packages/core/src/cloud/index.ts'),
            '@templatical/core': resolve(import.meta.dirname, 'packages/core/src/index.ts'),
            '@templatical/types': resolve(import.meta.dirname, 'packages/types/src/index.ts'),
        },
    },
});
