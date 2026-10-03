---
"@templatical/media-library": patch
"@templatical/editor": patch
---

Fix the media library's Edit dialog replacing the image with an 80% crop when only the alt text or filename changed (#834). The crop box now starts on the whole image, and Save sends a new file only after the crop moves or a max width or height shrinks the image.

Other fixes on the same path:

- A failed replace no longer saves the metadata anyway. Save keeps the dialog open and shows an error when the provider rejects the replace or the update, or when the edited image cannot be encoded. A retry after a replace that succeeded sends only the metadata.
- The cropper is hidden when the provider has no `replace`, and for GIFs, whose animation a crop would flatten to one frame.
- The upload zone's hint lists the categories and size cap from the provider's `mimeTypes` and `maxFileSize`, instead of a fixed "max 10MB".
- Files the upload zone rejects for type or size are named under it, instead of disappearing.
- The Replace dialog no longer promises that every reference updates, which is false for a provider that gives the new file a new URL.
- File sizes on cards, in the preview panel and on the storage ring share one format: `2 KB`, `1.5 MB`, `3 GB`. Sizes past 1 GB no longer read as thousands of MB.
- `useMediaLibrary().updateFile()` resolves to `true` on success and `false` when the update failed or the provider has none.
