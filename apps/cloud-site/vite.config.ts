import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { prerenderRoutes } from './src/prerender';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
        },
    },
    assetsInclude: ['**/*.md'],
    ssgOptions: {
        script: 'async',
        formatting: 'minify',
        crittersOptions: false,
        includedRoutes: () => prerenderRoutes,
    },
    build: {
        outDir: 'dist',
    },
});
