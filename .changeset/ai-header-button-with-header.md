---
"@templatical/editor": patch
---

The AI button renders with the rest of the header

With an `ai` provider and a loaded template, the header's AI button was a lazily loaded chunk that the editor fetched only after the header rendered, so the button appeared one network round trip after the other header controls. It is now part of the main bundle, which every editor downloads with or without `ai`. The AI panels and menus still load on demand, so an editor without `ai` downloads none of their code. With the button's restyle in this release, which drops its own CSS, the npm build's initial bundle is 269 bytes gzip smaller than in 0.51.0 (measured from `bundle-stats.json`).
