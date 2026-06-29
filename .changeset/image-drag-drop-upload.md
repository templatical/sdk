---
"@templatical/editor": minor
"@templatical/media-library": minor
---

Add drag-and-drop image upload (#229). Drag an image file from your computer onto an image block (empty or filled to replace), the sidebar image field, or a custom block's image field to set it — the editor forwards the dropped `File` to your `onRequestMedia` handler via the new optional `MediaRequestContext.files`, exactly like the Browse Media path (upload it and return the URL). In Cloud editors the dropped file is uploaded to your media library automatically. A file dropped anywhere else on the editor is ignored instead of navigating the browser away.
