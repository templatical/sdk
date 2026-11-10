---
"@templatical/types": minor
"@templatical/editor": minor
---

Add `PreviewSurface` (`"preview" | "test-email"`) and the required `PreviewResolveContext.surface`, so a resolver knows whether the editor's preview mode or the test-email dialog is calling. Read `surface`, not the presence of `recipient`, to tell them apart: the dialog leaves `recipient` out while its recipient field is empty. A resolver the editor calls needs no change; code that builds a `PreviewResolveContext` itself, such as a test that calls its own resolver, adds `surface: "preview"` or `surface: "test-email"`.
