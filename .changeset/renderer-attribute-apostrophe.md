---
"@templatical/renderer": patch
---

Quoted merge-tag arguments survive in rendered output. In an attribute, `'` stays raw and `"` is still `&quot;`. In element text, both quotes stay raw. `{{ x|default('y') }}` reaches Twig or Liquid intact in links, image sources, button labels, menu items, table cells and the preheader. A `linkColor` that contains `'` or `"` renders as `inherit`, so links follow the text colour instead of the client default the dropped declaration left them with. Rendered HTML otherwise changes byte-wise, with no visual change.

For direct callers of the exported `escapeHtml` and `escapeAttr`:

- `escapeHtml` now escapes only `&`, `<` and `>`, so it is for element text only. It no longer makes a value safe inside any attribute.
- An attribute value must use `escapeAttr` and stay in double quotes. `escapeAttr` escapes `&`, `<`, `>` and `"`, and leaves `'` raw, so it no longer makes a value safe inside single quotes.
- A caller that wrote `escapeHtml` output into an attribute, or `escapeAttr` output into a single-quoted attribute, must switch to `escapeAttr` in a double-quoted attribute.
