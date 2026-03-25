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
            entry: resolve(__dirname, 'packages/vue/src/index.ts'),
            name: 'TemplaticalEmailEditor',
            fileName: (format) => `email-editor.${format}.js`,
            cssFileName: 'email-editor',
        },
        outDir: resolve(__dirname, 'dist/email-editor'),
        emptyOutDir: true,
        minify: 'esbuild',
        target: 'es2022',
        sourcemap: true,
        cssMinify: true,
        rollupOptions: {
            output: [
                {
                    format: 'iife',
                    name: 'TemplaticalEmailEditor',
                    exports: 'named',
                    entryFileNames: 'email-editor.js',
                    assetFileNames: 'email-editor.[ext]',
                    inlineDynamicImports: true,
                },
                {
                    format: 'es',
                    entryFileNames: 'email-editor.es.js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    assetFileNames: 'email-editor.[ext]',
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
                        if (
                            id.includes('@tiptap/') ||
                            id.includes('prosemirror')
                        ) {
                            return 'tiptap';
                        }
                        if (id.includes('pusher-js')) {
                            return 'pusher';
                        }
                        if (
                            id.includes('vuedraggable') ||
                            id.includes('sortablejs')
                        ) {
                            return 'draggable';
                        }
                        if (
                            id.includes('/media-library/src/components/') ||
                            id.includes('/media-library/src/composable') ||
                            id.includes('/media-library/src/api-client') ||
                            id.includes('/media-library/src/composables/')
                        ) {
                            return 'media-library';
                        }
                        if (
                            id.includes('/cloud/components/AiChatSidebar') ||
                            id.includes('/cloud/components/CommentsSidebar') ||
                            id.includes('/cloud/components/DesignReferenceSidebar') ||
                            id.includes('/cloud/components/TemplateScoringPanel') ||
                            id.includes('/cloud/components/TestEmailModal') ||
                            id.includes('/cloud/components/SnapshotHistory')
                        ) {
                            return 'features';
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
