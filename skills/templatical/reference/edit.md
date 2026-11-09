# Editing with operations

**Before:** [cli.md](cli.md)
**Consult:** [rules.md](rules.md) before adding a block · [blocks.md](blocks.md)
for field-level shape · [brand.md](brand.md) when restyling
**After:** validation runs inside `edit` itself, so a refused operation writes
nothing — see [validate.md](validate.md) for reading the failure
**Then:** `live reload` if [live.md](live.md) is running

Prefer this over re-emitting the document for any scoped change. An operation
composes with a hand-edit; a whole-document write discards it. A shell around
the email (view-in-browser, imprint, a card) is not an edit of the template —
[rules.md](rules.md) says what to hand back instead.

For a **scoped change** to a template that's already valid — recolor a button,
swap a headline, delete a block, reorder two sections — apply an operation
instead of regenerating and rewriting the whole document:

```
npx -y @templatical/template-tools@0.57.2 edit .templatical/<name>.json --op '{"op":"updateBlock","blockId":"button_1","set":{"backgroundColor":"#1d4ed8"}}' --json
```

`edit` applies the operation, validates the result, and writes the file — all
in one step, and nothing is written if the result isn't structurally valid.
The vocabulary is the one the editor, collaboration backends and Templatical
Cloud share:

| Operation        | Shape                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| `addBlock`       | `{"op":"addBlock","block":{…},"parent":null,"after":"<sibling id>"}`          |
| `moveBlock`      | `{"op":"moveBlock","blockId":"…","parent":null,"after":null}`                 |
| `deleteBlock`    | `{"op":"deleteBlock","blockId":"…"}` (a section goes with its blocks)         |
| `updateBlock`    | `{"op":"updateBlock","blockId":"…","set":{…},"unset":["…"]}`                  |
| `updateSettings` | `{"op":"updateSettings","set":{…},"unset":["…"]}`                             |
| `setContent`     | `{"op":"setContent","content":{…}}` — a full replacement, not a scoped change |

The SDK also supports `addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale` and
`updateSettingsLocale` for language versions. Their paths, guards and locks
are documented in [Operations](https://docs.templatical.com/api/operations).
Follow [localize.md](localize.md) for adding versions, writing values and checking
`validate --locale`; the [Localized templates guide](https://docs.templatical.com/guide/localized-templates)
covers the editor workflow. Keep every `@templatical/*` package that reads the
template on one version before writing localized content. Check an SDK batch
with the shared operation fixtures, then run `template-tools validate` on
the resulting template.

To make an existing German version the default language:

```
npx -y @templatical/template-tools@0.57.2 edit .templatical/<name>.json --op '{"op":"setDefaultLocale","locale":"de"}' --json
```

German's values become the base and the old default becomes a version. A
block hidden in German refuses it with `invalid_operation`: list them with
`localeHiddenBlocks(content, "de")` and show them first. Fields without German
text show the English fallback before the change. After the change the German
base keeps that text and the old default keeps its own current copy: a later
German edit marks English out of date without changing the English email.
Afterwards nothing flags that the German base contains English text, so
translate them into German first, with Translate or `strings export` /
`strings import`, until `defaultLocaleGaps(content, "de")` returns `[]`
([localize.md](localize.md)); an empty default isn't a gap. HTML
blocks aren't sent by Translate or `strings export`:
translate HTML blocks by hand in the German view.
Without code, the CLI checks the same: the refusal names the number of
hidden blocks and the first hidden block (`Block: "<id>".` on stderr; exit 2,
nothing written). To show them all at once,
list every hidden block with
`jq '[.. | objects | select(.l10n?.de?.hidden == true) | .id]' .templatical/<name>.json`
and show each with `{"op":"updateBlockLocale","blockId":"<id>","locale":"de","hidden":false}`.
`validate .templatical/<name>.json --locale de --json` then reports every gap as
`localization.untranslated`, and
`strings export .templatical/<name>.json --locale de --out strings.de.json`
exports them, except HTML blocks, with any out-of-date fields, for
`strings import`. After the change,
`validate --locale en` no longer lists those fields as `localization.untranslated`;
both gaps and text German translated to the English value keep current entries.
`updateSettings` refuses to change `settings.locale` while versions exist.

For custom `text`/`textarea` gaps, pass `--definitions definitions.json` to `edit`. Headless, use `createSetDefaultLocaleOperation(content, "de", definitions)` from `@templatical/types` and apply its result. `customTextFields?: Record<string, string[]>` captures custom block ids and their safe existing `fieldValues.<key>` string paths for deterministic replay; without it, only existing custom text entries identify translatable fields. The visual editor captures registered definitions automatically. Metadata keys `__proto__`, `constructor` and `prototype` are refused with `invalid_operation` even for existing custom block ids; the builder also refuses to capture paths for them, so rename such an id first.

An agent connected to a template through Templatical Cloud's hosted MCP server
edits with this same vocabulary through the server's `edit_template` tool, so
the shapes and rules here hold there too.

Positions name a sibling, never an index: `parent` is `null` for the top level
or `{"sectionId":"…","column":0}` for a section column, or `{"wrapperId":"A"}` for a wrapper’s direct child list, and `after` is the id
of the block to land after, or `null` for first. A section sits at the top level or inside a wrapper. A wrapper sits only at the
top level; a wrapper in a column or another wrapper is refused. **`set` replaces each named key whole, `styles` included**: to
change one style property, read the block's `styles` from the file and send
the whole object with that property changed, or `padding` and the rest are
dropped. `id`, `type` and `children` can't be set; a section's layout changes
with `"set":{"columns":"1"}`, which only drops columns that are already empty,
so move their blocks out first. Batch several operations with `--ops <file>` (a
JSON array of the same objects) instead of one `--op` per call — the batch
applies in order and all or nothing, and a refusal names the operation and why
(`Operation 2 (updateBlock) was refused: block_missing — …`).

**Prefer an operation over a whole-document rewrite whenever the change is
scoped.** It matters most once [live mode](live.md) is running: a
whole-document write discards whatever the user just hand-edited in the
browser, even for a one-word change, while an operation composes on top of
it — which is also what keeps the live-update loop's divergence check from
firing on edits that were never actually in conflict. Reach for a full
rewrite only for a genuine rebuild — a new layout, a different brief,
starting over.

For headless layout operations,
`{"op":"moveBlock","blockId":"X","parent":{"wrapperId":"A"},"after":"S"}`
moves `X` after `S` in wrapper `A`. `after` must name a sibling in that
immediate list. The visual editor still refuses authored wrappers; use the CLI
or `applyOperations` on an existing layout tree.

Run `template-tools validate` on the edited JSON and
`validateLayout(editedLayout)` from `@templatical/types` on the same layout.
`validateLayout` checks slot count and nesting; `template-tools validate` does
not replace that layout check.
