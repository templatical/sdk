import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    publicDir: false,
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        lib: {
            entry: resolve(
                __dirname,
                'packages/core/src/cloud/index.ts',
            ),
            name: 'TemplaticalHeadlessEmailEditor',
            fileName: (format) => `headless-email-editor.${format}.js`,
        },
        outDir: resolve(__dirname, 'dist/headless-email-editor'),
        emptyOutDir: true,
        minify: 'esbuild',
        target: 'es2022',
        sourcemap: true,
        rollupOptions: {
            output: [
                {
                    format: 'es',
                    entryFileNames: 'headless-email-editor.es.js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                },
                {
                    format: 'cjs',
                    entryFileNames: 'headless-email-editor.cjs.js',
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
            '@templatical/core': resolve(__dirname, 'packages/core/src/index.ts'),
            '@templatical/types': resolve(__dirname, 'packages/types/src/index.ts'),
            vue: '@vue/reactivity',
        },
    },
});
