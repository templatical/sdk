---
"@templatical/editor": patch
---

Replace `vuedraggable` with `vue-draggable-plus`. The previous draggable library shipped a UMD-only bundle whose `define.amd` wrapper got inlined into our published editor chunks, causing `error TP1200 unsupported AMD define() dependency element form` for any Next.js 15+ consumer using Turbopack (the default). The new library ships proper ESM, so the published bundle no longer contains UMD/AMD wrappers and Turbopack builds succeed. No public API change.
