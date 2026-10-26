---
"@templatical/editor": patch
---

The AI button renders with the rest of the header

With an `ai` provider and a loaded template, the header's AI button was a lazily loaded chunk that the editor fetched only after the header rendered, so the button appeared one network round trip after the other header controls. It is now part of the main bundle, which every editor downloads with or without `ai` (measured: 223 bytes gzip on the npm build's initial bundle). The AI panels and menus still load on demand, so an editor without `ai` downloads none of their code.
