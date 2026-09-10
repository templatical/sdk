---
"@templatical/types": minor
"@templatical/core": minor
"@templatical/media-library": minor
"@templatical/editor": minor
---

Bring-your-own media library. Cloud is the adapter; `onRequestMedia` remains a UI override.

The editor's image picker (Browse, drop, crop, folders, search) is now backed by a `MediaProvider` you implement — a CMS gallery, a DAM, or the bundled `createLocalStorageMediaProvider()`. Templatical Cloud is one adapter behind the same contract (`createCloudMediaProvider` from `@templatical/core/cloud`). `initCloud({ media })` omitted uses Cloud's store, `false` turns it off, an events-only object keeps Cloud plus your handlers, and a full provider is yours and not plan-gated.

`onRequestMedia` stays as the UI override for a host widget (Bynder, Cloudinary, a modal of your own). It wins over `media` when both are set.

Cloud HTTP is camelCase throughout: media, comments, version history, plan JWT (`aiGeneration`, `savedModules`, `testEmail`, `expiresAt`, `projectId`, `appKey`, …), collab/MCP operations (`addBlock`, `blockId`, `client-blockLocked`), websocket auth params, and AI request/response keys (`conversationId`, `currentContent`, `mergeTags`, `createdAt`).

Origin: [#700](https://github.com/templatical/sdk/issues/700).
