---
"@templatical/types": patch
"@templatical/renderer": patch
---

Decode entity-encoded merge-tag attribute values

Rich text is serialized with the tag value entity-encoded in the attribute, so
stored content reads `data-merge-tag="&lt;% $email %&gt;"` for a tag configured
as `<% $email %>`. Every resolver compared that raw string against the
configured token, missed, and fell back to echoing the escaped token — which
overwrote the correct label the moment the block left edit mode.

Only tag values containing characters a serializer escapes (`<`, `>`, `&`) were
affected, so it showed up on custom `mergeTags.syntax` configs and not on the
built-in presets.

Three fixes, one cause:

- **Label mode** rendered the raw token over the label instead of `E-Mail`.
- **Sample mode** double-escaped it (`&amp;lt;% $email %&amp;gt;`), rendering
  the entity text on screen rather than the configured sample.
- **Export** emitted `&lt;% $email %&gt;` into the MJML, so the send engine
  received an escaped string instead of a token it recognises.

`getTagAttrValue` now decodes character references — the named set a serializer
emits plus decimal and hex numeric ones — which is what the attribute means.
Decoding is single-pass, so `&amp;lt;` yields the literal text `&lt;` and an
unknown reference is left alone.
