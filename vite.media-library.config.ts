import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    publicDir: false,
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'packages/media-library/src/standalone/visual.ts'),
            name: 'TemplaticalMediaLibrary',
            fileName: (format) => `media-library.${format}.js`,
            cssFileName: 'media-library',
        },
        outDir: resolve(__dirname, 'dist/media-library'),
        emptyOutDir: true,
        minify: 'esbuild',
        target: 'es2022',
        sourcemap: true,
        cssMinify: true,
        rollupOptions: {
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
                        if (id.includes('lucide-vue-next')) {
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
            '@templatical/media-library': resolve(__dirname, 'packages/media-library/src/index.ts'),
            '@templatical/core/cloud': resolve(__dirname, 'packages/core/src/cloud/index.ts'),
            '@templatical/core': resolve(__dirname, 'packages/core/src/index.ts'),
            '@templatical/types': resolve(__dirname, 'packages/types/src/index.ts'),
        },
    },
});
