import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { inlineStyleCssPlugin } from './scripts/inline-style-css-plugin';

export default defineConfig({
  plugins: [
    vue(),
    // Resolves `virtual:editor-css` in tests using the source CSS as a
    // fallback (no build artifacts exist in test mode).
    inlineStyleCssPlugin({
      fallbackSourcePath: resolve(import.meta.dirname, 'src/styles/index.css'),
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.vue'],
      reporter: ['text', 'json'],
      reportsDirectory: './coverage',
    },
  },
});
