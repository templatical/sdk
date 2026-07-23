---
"@templatical/editor": minor
---

Add a `resolveImageUrl` config option — a display-only resolver for image `src` values (#415).

The canvas calls it to obtain a preview URL for a src the user entered (`resolveImageUrl?: (src: string) => string | null | Promise<string | null>`); the content model and `toMjml()` output always keep the canonical value. Returning `null` (or the input value) means "use the src as-is". This lets hosts whose templates reference images by non-displayable values — e.g. plain file names resolved to ephemeral `blob:` URLs from local storage — show real previews without rewriting content via `setContent()` or reverse-substituting URLs before export.

The resolver is called once per committed src value (typing in the src input is debounced, so partial values never reach it) and results are cached per src for the editor instance's lifetime, including failures — a src whose lookup failed stays unresolved until the editor is re-initialized (a re-resolve hook may follow in a later release). Merge-tag srcs are never passed to the resolver; their `placeholderUrl` preview is resolved instead.

Covers every image the canvas paints from content: image block srcs, design-time placeholder previews, and explicit video `thumbnailUrl`s. Thumbnails auto-derived from a YouTube/Vimeo URL are already real URLs and are never passed to the resolver.
