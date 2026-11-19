---
"@templatical/editor": minor
"@templatical/core": minor
"@templatical/types": minor
"@templatical/media-library": minor
---

Breaking changes:

- `initCloud()` is removed. Use `init()` with your own providers: `templates`, `comments`, `versionHistory`, `savedBlocks`, `media`, `testEmail`, `render`, `ai`, and `collaboration`.
- The `@templatical/core/cloud` subpath is removed with no replacement.
- Cloud wire types (`PlanConfig`, `MediaConfig`, `StorageInfo`, and auth/token types) are removed from `@templatical/types`.
- `pusher-js` is no longer a peer dependency.
