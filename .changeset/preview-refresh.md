---
"@templatical/types": minor
"@templatical/editor": minor
---

Add `PreviewResolveTrigger`, the required `PreviewResolveContext.trigger`, and the `refreshPreview()` instance method. A Refresh preview button is available in preview mode and the test-email dialog when `resolvePreview` is configured. A failed re-resolve now shows the unresolved template instead of stale resolved content, and opening the test-email dialog makes one resolver call with its seeded recipient.
