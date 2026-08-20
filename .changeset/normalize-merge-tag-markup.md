---
"@templatical/editor": patch
---

Fix: bare merge-tag tokens in loaded and imported content now behave as merge tags.

A merge tag reaches stored content in one of two physical shapes, and only one of them worked. Anything a user types or pastes becomes a `<span data-merge-tag>` node on the spot, via `MergeTagNode`'s input and paste rules. Content that never passed through that pipeline keeps its bare `{{first_name}}` — and a bare token renders as literal text: no label, no highlight, no `sample` substitution, and deletable one character at a time instead of as a unit.

That is every template you load rather than type. Most sharply, a template migrated through `@templatical/import-beefree` / `-unlayer` / `-html`, which is typically full of tokens and has none of them as nodes — the exact case the importers exist for. It also covers a consumer's own stored templates, which is how it was first reported (#543, #548): the pill "must show its human-readable label … never the raw `<% ... %>` syntax".

Bare tokens are now converted as content comes in, on every path consumer content arrives through. There is nothing to call and nothing to enable:

| Path | When |
|---|---|
| `init({ content })` / `initCloud({ content })` | before mount |
| `editor.setContent(content)` | before the content reaches the canvas |
| `editor.create({ content })` | before the content becomes editor state |
| `editor.load(id)` | as the `templates` provider's result comes back |
| version history preview / restore | as each version reaches the canvas |

Version history matters more than it looks. A version written *after* this ships is already normalized, but every version already in your store predates it — as does anything a backend versioned from an imported template. Previewing one of those would put bare tokens back on a canvas where every other tag is a chip. Previews still do not mark the template dirty.

Matching is driven by the configured `syntax` rather than by the `tags` array, so a migrated template's tags become atomic before you have declared them all; an undeclared token shows its own raw value as its label. This mirrors typing, where the input rules already match on syntax alone.

### Attribute-positioned tokens are left alone

Only text is converted. This is the property the whole approach is built around, not a refinement of it:

```html
<!-- in  -->
<p>Hi {{first_name}} — <a href="{{unsubscribe_url}}">unsubscribe</a></p>

<!-- out -->
<p>Hi <span data-merge-tag="{{first_name}}">First Name</span> —
   <a href="{{unsubscribe_url}}">unsubscribe</a></p>
```

The removed `restoreMergeTagMarkup` got this wrong because a regex cannot tell text position from attribute position — its lookbehind guard left `href="<span data-merge-tag=…>Unsubscribe URL</span>"`. The replacement parses the fragment and walks text nodes only, so an attribute value is unreachable rather than merely guarded. It is idempotent for the same structural reason: the walk rejects the subtree of any element already carrying `data-merge-tag`, so re-running cannot see an existing tag's inner text — including when a tag's label *is* its value.

Spans are built as real elements via `setAttribute` / `textContent`, never by string concatenation, so a syntax whose delimiters contain `<` / `>` (Smarty-style `<% $email %>`, the #543 case) round-trips instead of emitting markup no scanner can re-read.

### Fields deliberately not converted

Only `TitleBlock.content` and `ParagraphBlock.content` are rich text. Button text and URLs, image `src`/`alt`, `HtmlBlock.content`, custom-block field values and `settings.preheaderText` are rendered as text — a span written into one would be displayed literally on the canvas and emitted into a `url=` attribute. They keep their bare tokens and are unaffected.

`TableCellData.content` is excluded too, despite the renderer treating it as span-bearing: `TableBlock.vue` writes a cell's `innerText` back on blur, so a converted cell would persist its markup as literal text the first time a user focused and left it. The editor/renderer asymmetry there is a separate pre-existing gap.

### `getContent()` is no longer an identity round-trip

If a template you load contains bare tokens in title or paragraph content, what `getContent()` returns contains spans instead. Nothing is written to your store unless you save, and a load that converted does **not** mark the template dirty — conversion happens on the way in, so core is handed content that is already correct and never observes a mutation. But if you diff or checksum stored templates, expect one-time churn on the affected ones.

Rendered output is unaffected. `toMjml()` / `toHtml()` replace a tag node with its token, so a converted template and its bare-token original compile to byte-identical MJML — asserted directly rather than assumed.

One caveat for `resolvePreview` implementations: your callback now receives spans where an imported template previously gave it bare tokens. A resolver that already handles typed tags needs no change, but a naive `replaceAll('{{first_name}}', 'Grace')` would now also hit the token inside `data-merge-tag="{{first_name}}"` and silently produce a tag that renders its label. Match on the tag markup, not the raw token.
