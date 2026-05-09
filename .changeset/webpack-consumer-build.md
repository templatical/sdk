---
"@templatical/editor": patch
---

Fix Webpack 5 production build failure on `@templatical/media-library` (issue #63). The dynamic `import()` for the cloud media browser was missing the `try/catch` wrapper that the other three optional peers (`pusher-js`, `@templatical/quality`, `@templatical/renderer`) already had. Without it, Webpack escalates "Module not found" from a warning to an error and breaks the consumer's production build. Wraps the import so OSS consumers (no cloud, no media-library installed) can build cleanly. Adds a regression test that builds the editor as a real Webpack 5 consumer would (`pnpm run test:webpack-consumer`, wired into CI). Vite, esbuild, and Rolldown were unaffected.
