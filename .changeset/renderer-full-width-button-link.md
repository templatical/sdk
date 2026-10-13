---
"@templatical/renderer": patch
"@templatical/import-mjml": patch
---

A full-width button is now clickable across its whole fill in the compiled email, not only on its label. MJML gives a button's `<a>` a width only for a px `width`, so for `width: "full"` it widened the button's table and left the `<a>` at `display:inline-block`, the size of its label. A full-width button's `mj-button` now carries the class `tpl-button-full`, and every template's `<mj-style inline="inline">` block ends with `.tpl-button-full a { display: block !important; }`: `mjml` inlines it onto the link, and MRML's default build keeps it as a `<style>` rule. That one line is new in every template's MJML. With `mjml`, juice drops the rule when nothing matches, so the compiled HTML of a template without a full-width button is unchanged. Outlook on Windows ignores `display:block`, so there the link stays the size of its label, as it does for every MJML button. `BUTTON_FULL_WIDTH_CSS_CLASS` is exported for `blockRenderers` overrides of the button. The MJML importer treats `tpl-button-full` as the renderer's own class, so importing a rendered template doesn't report it as dropped consumer CSS. Fixes #868.
