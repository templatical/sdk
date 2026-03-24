import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const packagesDir = resolve(__dirname, '../../packages');

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            // Resolve workspace packages to source for dev — avoids needing pre-built dist
            '@templatical/vue/src': resolve(packagesDir, 'vue/src'),
            '@templatical/vue': resolve(packagesDir, 'vue/src/index.ts'),
            '@templatical/core/cloud': resolve(
                packagesDir,
                'core/src/cloud/index.ts',
            ),
            '@templatical/core': resolve(packagesDir, 'core/src/index.ts'),
            '@templatical/types': resolve(packagesDir, 'types/src/index.ts'),
            '@templatical/renderer': resolve(
                packagesDir,
                'renderer/src/index.ts',
            ),
            '@templatical/import-beefree': resolve(
                packagesDir,
                'import-beefree/src/index.ts',
            ),
        },
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            external: ['mjml'],
        },
    },
});
