import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    build: {
        cssMinify: 'esbuild',
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            name: 'TemplaticalMediaLibrary',
            fileName: 'templatical-media-library',
            formats: ['es'],
        },
        rolldownOptions: {
            external: [
                'vue',
                '@templatical/core',
                '@templatical/core/cloud',
                '@templatical/types',
                '@vueuse/core',
                '@lucide/vue',
                'vue-advanced-cropper',
            ],
        },
    },
});
