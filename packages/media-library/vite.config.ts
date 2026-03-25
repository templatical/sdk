import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue(), dts({ rollupTypes: true })],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'TemplaticalMediaLibrary',
            fileName: 'templatical-media-library',
            formats: ['es', 'umd'],
        },
        rollupOptions: {
            external: [
                'vue',
                '@templatical/core',
                '@templatical/core/cloud',
                '@templatical/types',
                '@vueuse/core',
                'lucide-vue-next',
                'vue-advanced-cropper',
            ],
            output: {
                globals: {
                    vue: 'Vue',
                    '@templatical/core': 'TemplaticalCore',
                    '@templatical/core/cloud': 'TemplaticalCoreCloud',
                    '@templatical/types': 'TemplaticalTypes',
                    '@vueuse/core': 'VueUseCore',
                    'lucide-vue-next': 'LucideVueNext',
                    'vue-advanced-cropper': 'VueAdvancedCropper',
                },
            },
        },
    },
});
