---
"@templatical/editor": patch
---

Fix missing video block configuration panel. Selecting a video block in the canvas previously showed only the common spacing/background/display settings — there was no way to set the video URL, custom thumbnail, alt text, width, alignment, or open-in-new-tab from the sidebar. Adds a `VideoToolbar` matching the parity of `ImageToolbar`, including merge-tag-aware URL/thumbnail inputs and a media browser button when an `onRequestMedia` handler is configured.
