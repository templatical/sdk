import { defineConfig } from 'vite'

export default defineConfig({
  // Materialized into a temp dir at e2e prep time. The prep step also runs
  // `vite build` here; `main.ts` awaits `init()` at the top level, which needs
  // ES2022, the same floor the editor targets.
  build: { target: 'es2022' },
})
