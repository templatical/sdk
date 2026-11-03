---
"@templatical/renderer": patch
---

Compiling `renderToMjml()` output with mjml no longer throws `TypeError: Cannot read properties of undefined (reading 'indexOf')` when a paragraph or title holds a character reference in a `style` attribute.

MJML inlines the renderer's rich-text stylesheet with juice, which splits the style attribute of each `<p>`, `<ul>`, `<ol>` and `<li>` on `;` before decoding references, so the `;` ending `&apos;`, `&quot;`, `&#39;` or `&nbsp;` broke the compile. Imported content carries these: BeeFree's text HTML (`font-family: Monda, &apos;Courier New&apos;`) and import-mjml's output for a single-quoted font. The paragraph and title renderers now write those references as the characters they stand for inside `style` attributes, a quote as the one the attribute isn't delimited with (CSS reads either). `&amp;`, `&lt;` and `&gt;` stay encoded. Check with `template-tools render --html` on an imported template.
