---
"@templatical/editor": patch
---

Fix Title block rendering as `<p>` inside the editor canvas. The exported MJML/HTML already used the correct `<h${level}>` tag, but the canvas wrapped TipTap's stored content in a plain `<div>` and left the outer `<p>` from the editor's paragraph node in place, so the editor preview diverged from the final email and consumer CSS rules targeting `p` could unintentionally style titles in the canvas. The non-editing branch of `TitleBlock` now renders `h1`–`h4` matching `block.level` and strips the single outer `<p>` wrapper using the same rule the renderer applies. No data migration is needed — existing templates already carry `level` and render correctly on reload. Consumers that previously overrode title styling via `.tpl-text-content p` selectors in the canvas should switch to heading selectors (`h1`–`h4`) to match the exported output.
