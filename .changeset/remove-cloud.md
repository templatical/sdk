---
"@templatical/editor": patch
"@templatical/core": patch
"@templatical/types": patch
"@templatical/media-library": patch
---

Remove the unreleased Templatical Cloud integration. The SDK is configured through `init()` alone: every storage feature is a provider you pass to it (`templates`, `comments`, `versionHistory`, `savedBlocks`, `media`, `testEmail`, `render`, `ai`, `collaboration`). This drops `initCloud()`, `getSupportedCloudLocales()`, the `@templatical/core/cloud` subpath and the Cloud wire types in `@templatical/types`, and `pusher-js` is no longer a peer dependency.
