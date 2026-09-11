---
"@templatical/editor": minor
---

Add a `socialIconsBaseUrl` option to `init()`. It forwards to the bundled renderer's `socialIconsBaseUrl`, so `toMjml()` / `toHtml()` can emit social-icon URLs from your own origin instead of the default jsDelivr mirror. The renderer already supported this; the editor now exposes it. Omit it and output is unchanged.
