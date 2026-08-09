---
"@templatical/quality": patch
---

Add `a11y.text-justified` — flags justified body copy in paragraph blocks

Justified text stretches word spacing to reach both margins, opening uneven "rivers" of white space that are hardest to track for dyslexic and low-vision readers; email clients justify without hyphenation, so the gaps get wider still. WCAG 2.1 SC 1.4.8 requires that text not be justified.

Companion to the paragraph toolbar's new **Justify** button in `@templatical/editor` — the editor offers the alignment, the linter advises against it, and consumers who want it can silence the rule with `accessibility: { rules: { "a11y.text-justified": "off" } }`.

Default severity is `warning`, and the rule ships an auto-fix. The fix **removes** the `text-align` declaration rather than forcing `left`, so the paragraph inherits the document default — which is also the correct result for right-to-left content. Sibling declarations in the same `style` attribute (a `line-height` from the editor's line-height control, for example) are preserved.

Only paragraph blocks are checked. Every other block stores alignment as a typed field whose union excludes `justify`, so no other block can express it.
