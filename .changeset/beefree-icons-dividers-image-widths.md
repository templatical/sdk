---
"@templatical/import-beefree": minor
---

`convertBeeFreeTemplate()` imports images at the width BeeFree shows them, keeps spacing dividers invisible, and converts the Icons module, addons and empty modules.

- **Image width (#1069).** An `autowidth` image is sized like a `fixedwidth` one, from `computedStyle.width` (its file's width capped at the column), and is `"full"` only when that reaches the image's room. A 111px `autowidth` logo in an 800px template imported at full width; it now imports at `111`. A `computedStyle.width` written as a number (`187.5`, in older exports) is read too, and `computedStyle.class` `fullwidth` imports as `"full"`.
- **Dividers that draw no line (#1070).** A divider whose `border-top` is 0 wide, `none`, `hidden` or transparent (`transparent`, or an alpha of 0 such as `rgba(0, 0, 0, 0)`) becomes a `spacer` whose height is its top and bottom padding plus a transparent border's width, reported `converted` with a `note` naming the height. One that adds up to 0px produces no block and is reported `skipped`. These imported as visible lines: `0px solid transparent` as a 1px black line, `10px solid transparent` as a 10px black bar.
- **Icons module (#1071).** `mailup-bee-newsletter-modules-icons` with one icon and no text becomes an `image` at `computedStyle.iconHeight`. Any other Icons module becomes an HTML table with the icons, their text and links, reported `html-fallback` with the `note` `Icons module rebuilt as an HTML table.` Both replace an empty `<!-- Unsupported BeeFree module -->` comment.
- **Addons (#1071).** `mailup-bee-newsletter-modules-addon` converts as the module whose payload it carries (`image`, `html`, `heading`, `paragraph`, `text`, `list`, `button`, `divider`, `menu` or `iconsList`). An image addon links to `image.href` only; GIPHY's `image.url` is the GIF's page and isn't imported.
- **Empty modules.** `mailup-bee-newsletter-modules-empty`, and an Icons module with no icons, produce no block and are reported `skipped` with `templaticalBlockType: null`.

Rules and tables: the [BeeFree migration guide](https://docs.templatical.com/guide/migration-from-beefree). Check an imported template with `template-tools validate imported.json`.
