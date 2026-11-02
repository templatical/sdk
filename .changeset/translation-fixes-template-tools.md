---
"@templatical/template-tools": patch
---

`strings import` refuses an HTML string whose `style` attribute value, on any element, isn't also a `style` value of the field's default, byte for byte, as `unsafe_html`; a style could otherwise fetch a remote file or overlay the email. Moving or dropping a default style, or having none, still passes. When a `text` string is refused because of a `<` directly before a letter, such as `a<b`, the human output adds the hint to write `a < b` with a space; the `--json` rejection keeps the shape `{ id, reason }`. The `--json` result gains `skipped: [{ id, reason }]`, listing every entry without `text`: `reason` is `"stale"` when its field is out of date and `"missing"` otherwise, and the human output prints one `Skipped` line each.

`edit` names the block the engine names when it refuses an operation: the message on stderr ends with `Block: "<id>".`, which for `setDefaultLocale` refused because blocks are hidden is the first hidden block. The exit code stays `2` and stdout stays empty, also with `--json`.
