import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { inlineStyleCssPlugin } from './scripts/inline-style-css-plugin';

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
        inlineStyleCssPlugin({
            fallbackSourcePath: resolve(import.meta.dirname, 'src/styles/index.css'),
        }),
    ],
    publicDir: false,
    // Vite's lib mode does not replace `process.env.NODE_ENV`. Some deps
    // (vue-draggable-plus/sortablejs) reference it unguarded — define it explicitly.
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
                // THIRD-PARTY DEPENDENCIES ONLY — never group first-party source.
                //
                // Forcing our own modules into a named chunk creates static import
                // edges between otherwise-independent lazy subgraphs, which silently
                // makes a lazy chunk EAGER. That is not theoretical: the former
                // `features` group (6 `defineAsyncComponent` cloud panels) became
                // statically reachable from the entry, so every Cloud session
                // downloaded all 66.5 KB gzip of it whether or not the user opened a
                // single panel — `defineAsyncComponent` was fully defeated for them.
                //
                // The failure also moves: removing only `features` promoted
                // `media-library` to eager (41.2 -> 65.7 KB) and grew the eager
                // payload by 32.7 KB; removing that too promoted `quality` instead.
                // Grouping source is what creates the bridge, so the rule is a ban,
                // not a list to curate.
                //
                // Third-party groups stay because they earn their keep on caching:
                // tiptap alone is 145 KB gzip, and keeping it in a content-addressed
                // chunk of its own means an editor-only release doesn't invalidate it
                // for repeat visitors.
                //
                // Guarded by `tests/cdn-chunk-granularity.test.ts` — it enumerates
                // `defineAsyncComponent` call sites from source and fails if any of
                // them lands in a chunk reachable from the entry by static import.
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
                    if (id.includes('htmlparser2')) {
                        return 'htmlparser';
                    }
                    if (
                        id.includes('vue-draggable-plus') ||
                        id.includes('sortablejs')
                    ) {
                        return 'draggable';
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
