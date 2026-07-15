---
"@templatical/editor": patch
"@templatical/media-library": patch
---

Fix: editor primary buttons no longer render with a transparent background in bundled/CDN builds (#357)

`@templatical/media-library`'s shared `.tpl` form-element reset authored its button reset as a bare `.tpl button { background: none; border: none }` (specificity 0,1,1). Because `@templatical/editor` bundles these styles and shares the `.tpl` scope class, that reset out-specified the editor's single-class button utilities such as `.tpl:bg-[var(--tpl-primary)]` (0,1,0) — rendering the Insert/Update Link dialog's primary action button with a transparent background (invisible on light backgrounds) and stripping button borders. It surfaced in the CDN bundle and in any app that bundles the editor from source (e.g. the deployed playground); the npm `dist` was unaffected because it externalizes media-library. The reset is now `:where(.tpl) button` (specificity 0,0,1), matching the editor's own reset, so per-button utilities always win.
