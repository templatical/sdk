---
"@templatical/renderer": patch
---

Point the default `socialIconsBaseUrl` at jsDelivr instead of unpkg (`https://cdn.jsdelivr.net/npm/@templatical/renderer@<version>/assets/social`). jsDelivr's multi-CDN backbone with automatic failover is a better fit for the social-icon PNGs embedded in archived emails, which recipients may open years after delivery. The URL stays version-pinned, so already-sent emails keep their existing unpkg URLs (still resolvable) and only new renders use jsDelivr. Consumers overriding `socialIconsBaseUrl` are unaffected.
