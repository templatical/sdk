---
"@templatical/editor": patch
---

Cut the editor's initial JS load by keeping TipTap and the properties panel off the eager graph

Field autocomplete imported the shared merge-tag popup from the TipTap `MergeTagSuggestion` extension, so `@tiptap/core` (and, on the CDN, the whole `tiptap` vendor chunk) downloaded with every session. The popup helpers now live in a TipTap-free module; the extension still loads when a title or paragraph enters edit.

`RightSidebar` now lazy-loads Toolbar and Template Settings behind the `v-if`s that already gated them, so ColorPicker, MergeTagInput and the per-type toolbars fetch on first block select / first Settings visit.

npm initial JS: 314 kB gzip → 169 kB. CDN eager: 335 kB gzip → 152 kB.
