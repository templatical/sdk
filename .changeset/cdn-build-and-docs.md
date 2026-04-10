---
"@templatical/editor": patch
"@templatical/core": patch
---

Include CDN build (ES module with code-split chunks) in the editor package at dist/cdn/. Drop IIFE build in favor of ES-only output for smaller initial load. Add pusher-js as a dependency in core for typecheck support.
