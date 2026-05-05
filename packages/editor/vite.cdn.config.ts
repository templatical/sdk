import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

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
    ],
    publicDir: false,
    // Vite's lib mode does not replace `process.env.NODE_ENV`. Some deps
    // (vuedraggable/sortablejs) reference it unguarded — define it explicitly.
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
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: () => 'editor.js',
            cssFileName: 'editor',
        },
        rolldownOptions: {
            // CDN bundle is self-contained — don't externalize peerDeps.
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
                    if (
                        id.includes('@tiptap/') ||
                        id.includes('prosemirror')
                    ) {
                        return 'tiptap';
                    }
                    if (id.includes('pusher-js')) {
                        return 'pusher';
                    }
                    if (id.includes('/quality/src/') || id.includes('htmlparser2')) {
                        return 'quality';
                    }
                    if (id.includes('/renderer/src/')) {
                        return 'renderer';
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
            treeshake: {
                moduleSideEffects: 'no-external',
                propertyReadSideEffects: false,
            },
        },
    },
    resolve: {
        alias: {
            '@templatical/media-library': resolve(import.meta.dirname, '../media-library/src/index.ts'),
            '@templatical/quality': resolve(import.meta.dirname, '../quality/src/index.ts'),
            '@templatical/renderer': resolve(import.meta.dirname, '../renderer/src/index.ts'),
            '@templatical/core/cloud': resolve(import.meta.dirname, '../core/src/cloud/index.ts'),
            '@templatical/core': resolve(import.meta.dirname, '../core/src/index.ts'),
            '@templatical/types': resolve(import.meta.dirname, '../types/src/index.ts'),
        },
    },
});
