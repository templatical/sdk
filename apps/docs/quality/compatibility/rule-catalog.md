---
description: Client compatibility rule catalog for pass-through HTML, CSS and compiled Gmail size, with caniemail sources and exclusions.
---

# Compatibility rule catalog

This catalog explains every `compat.*` rule, its trigger, exclusions, severity and evidence. Data-backed rules use the bundled caniemail snapshot dated 2026-09-16. A client verdict is its last-listed test, with the noted usage narrowed where specified.


## `compat.css-display-flex` {#compat-css-display-flex}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** `display: flex` or `inline-flex` in pass-through CSS.

**What does not:** Other display values and SDK column layout.

**Narrowing:** Note 2 makes `inline-flex` unsupported where that variant is excluded.

**Source:** [caniemail css-display-flex](https://www.caniemail.com/features/css-display-flex/).

## `compat.css-display-grid` {#compat-css-display-grid}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** `display: grid` or `inline-grid` in pass-through CSS.

**What does not:** Other display values and SDK column layout.

**Narrowing:** No note narrowing.

**Source:** [caniemail css-display-grid](https://www.caniemail.com/features/css-display-grid/).

## `compat.css-position` {#compat-css-position}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** `position: absolute`, `fixed` or `sticky` in pass-through CSS.

**What does not:** `position: relative`.

**Narrowing:** Notes 1–4 name supported values; any detected value outside a cell’s list is unsupported.

**Source:** [caniemail css-position](https://www.caniemail.com/features/css-position/).

## `compat.css-variables` {#compat-css-variables}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `var(--…)` reference in a CSS value.

**What does not:** Declarations without a variable reference.

**Narrowing:** No note narrowing.

**Source:** [caniemail css-variables](https://www.caniemail.com/features/css-variables/).

## `compat.css-at-import` {#compat-css-at-import}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** An `@import` rule in a style element or stylesheet.

**What does not:** Text inside CSS comments.

**Narrowing:** No note narrowing.

**Source:** [caniemail css-at-import](https://www.caniemail.com/features/css-at-import/).

## `compat.html-link` {#compat-html-link}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `<link>` whose `rel` contains `stylesheet`.

**What does not:** Other `rel` values.

**Narrowing:** No note narrowing.

**Source:** [caniemail html-link](https://www.caniemail.com/features/html-link/).

## `compat.html-style` {#compat-html-style}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `<style>` element in pass-through HTML, which lands in the email body.

**What does not:** Styles generated in MJML’s head.

**Narrowing:** Note 1 excludes `<style>` in `<body>` even when the client supports it in the head.

**Source:** [caniemail html-style](https://www.caniemail.com/features/html-style/).

## `compat.html-svg` {#compat-html-svg}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** An inline `<svg>` element.

**What does not:** A linked SVG image URL; this rule reads elements, not linked image formats.

**Narrowing:** No note narrowing.

**Source:** [caniemail html-svg](https://www.caniemail.com/features/html-svg/).

## `compat.html-form` {#compat-html-form}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `<form>`, `<input>`, `<select>` or `<textarea>` element.

**What does not:** A link to a web form.

**Narrowing:** Gmail web supports forms; Outlook Windows does not. The rule follows the client cells rather than a blanket claim.

**Source:** [caniemail html-form](https://www.caniemail.com/features/html-form/).

## `compat.html-object` {#compat-html-object}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** An `<object>` element.

**What does not:** A linked image.

**Narrowing:** No note narrowing.

**Source:** [caniemail html-object](https://www.caniemail.com/features/html-object/).

## `compat.html-video` {#compat-html-video}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** An embedded `<video>` element.

**What does not:** The SDK Video block, which emits a linked thumbnail.

**Narrowing:** No note narrowing.

**Source:** [caniemail html-video](https://www.caniemail.com/features/html-video/).

## `compat.html-audio` {#compat-html-audio}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** An embedded `<audio>` element.

**What does not:** A link to an audio file.

**Narrowing:** No note narrowing.

**Source:** [caniemail html-audio](https://www.caniemail.com/features/html-audio/).

## `compat.css-width` {#compat-css-width}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** Inline `width` on `div`, `p`, `span` or `body`, or on `img` without a width attribute.

**What does not:** A table cell width or an image with a width attribute.

**Narrowing:** Note 1 excludes these elements in affected clients.

**Source:** [caniemail css-width](https://www.caniemail.com/features/css-width/).

## `compat.css-max-width` {#compat-css-max-width}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** Inline `max-width` on an element other than `table`.

**What does not:** `max-width` on a table.

**Narrowing:** Note 1 permits only tables in affected clients.

**Source:** [caniemail css-max-width](https://www.caniemail.com/features/css-max-width/).

## `compat.css-float` {#compat-css-float}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `float` declaration in an inline style or stylesheet.

**What does not:** Layout produced from SDK sections and columns.

**Narrowing:** No note narrowing.

**Source:** [caniemail css-float](https://www.caniemail.com/features/css-float/).

## `compat.css-background-image` {#compat-css-background-image}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A CSS background URL without `background-color`, a color in the `background` shorthand, or `bgcolor`.

**What does not:** A background with one of those fallback colors.

**Narrowing:** No note narrowing.

**Source:** [caniemail css-background-image](https://www.caniemail.com/features/css-background-image/).

## `compat.image-base64` {#compat-image-base64}

**Default severity:** `warning` when any client is unsupported; `info` when only partial.

**What fires:** A `data:image/` URL in a pass-through image, background attribute, CSS URL or supported block URL field.

**What does not:** Hosted image URLs and non-image data URLs. The excerpt contains only the media type.

**Narrowing:** Note 1 excludes GIF; note 3 supports only PNG.

**Source:** [caniemail image-base64](https://www.caniemail.com/features/image-base64/).

## `compat.html-script` {#compat-html-script}

**Default severity:** `warning`.

**What fires:** A `<script>` element. Email clients do not run its JavaScript.

**Evidence:** Hand-written warning; caniemail has no test for this element.

## `compat.html-iframe` {#compat-html-iframe}

**Default severity:** `warning`.

**What fires:** An `<iframe>` element whose embedded content is blocked in most email clients.

**Evidence:** Hand-written warning; caniemail has no test for this element.

## `compat.gmail-clipping` {#compat-gmail-clipping}

**Default severity:** `warning`.

**What fires:** Compiled HTML larger than `thresholds.maxHtmlBytes` (default `92_160` UTF-8 bytes); equality passes.

**Where it runs:** Never in `lintTemplate` or the editor's live Issues list. Three surfaces measure it: `lintCompiledHtml(html)` on HTML you compile; `templatical validate --html`, which needs the optional `mjml` peer (exit 3 without it); and the editor's **Email size** check, shown only when the [render provider](/backend/render) implements `toHtml` or `compileMjml`, and not in Cloud mode.

**Evidence:** Only `lintCompiledHtml` checks this; template JSON and pass-through scans do not estimate compiled size. Google does not document the approximately 102 KB limit; it comes from community tests, which also show clipping below it after a sending service adds markup.

[email-bugs#41: Gmail clips emails at 102 kB](https://github.com/hteumeuleu/email-bugs/issues/41).
