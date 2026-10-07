---
"@templatical/editor": minor
---

The editor's type declarations no longer import any package. They imported `@templatical/types`, `@templatical/core`, `@templatical/quality` and `vue`, none of which the editor declares, so with only the editor installed TypeScript reported `Cannot find module` under `skipLibCheck: false` and typed those parts as `any` otherwise, letting a call like `init({ content: 42 })` compile. The types they reference are now part of the editor's own declarations.

**Removed exports:** `EditorCapabilities`, `useFonts` and `UseFontsReturn`. They described the editor's internals and only worked inside its own Vue instance. `FontOption` is still exported.
