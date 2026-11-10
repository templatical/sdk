---
"@templatical/types": minor
"@templatical/editor": minor
---

Add `PreviewResolveTrigger` (`"open" | "refresh" | "recipient" | "locale"`), the required `PreviewResolveContext.trigger`, and the `refreshPreview()` instance method. A Refresh preview button is available in preview mode and the test-email dialog when `resolvePreview` is configured. A resolver the editor calls needs no change; code that builds a `PreviewResolveContext` itself, such as a test that calls its own resolver, adds `trigger: "open"`. A failed re-resolve now shows the unresolved template instead of stale resolved content, opening the test-email dialog makes one resolver call with its seeded recipient, and a test-email recipient change always waits 500 ms, including before the first answer lands.
