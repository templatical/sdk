---
"@templatical/renderer": patch
---

Quoted merge-tag arguments survive in rendered output. In an attribute, `'` stays raw and `"` is still `&quot;`. In element text, both quotes stay raw. `{{ x|default('y') }}` reaches Twig or Liquid intact in links, image sources, button labels, menu items, table cells and the preheader. A `linkColor` that contains `'` or `"` renders as `inherit`, so links follow the text colour instead of the client default the dropped declaration left them with. Rendered HTML otherwise changes byte-wise, with no visual change.

For direct callers of `escapeHtml` and `escapeAttr`: `escapeHtml` now escapes only `&`, `<` and `>` and is for element text only. `escapeAttr` escapes `&`, `<`, `>` and `"` and is for double-quoted attribute values only. A caller that put `escapeHtml` output into an attribute, or `escapeAttr` output into a single-quoted attribute, must switch.
