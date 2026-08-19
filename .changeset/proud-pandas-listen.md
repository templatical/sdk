---
"@templatical/editor": patch
---

Stop writing redundant attributes into serialized merge tags

`MergeTagNode` and `LogicMergeTagNode` declared their attributes without the
`rendered: false` flag, so TipTap serialized each one under its own name in
addition to the canonical `data-*` pair emitted by `renderHTML()`:

```html
<span label="E-Mail" value="{{email}}" data-merge-tag="{{email}}" data-label="E-Mail">E-Mail</span>
<span value="{% if vip %}" keyword="IF" data-logic-merge-tag="{% if vip %}" data-keyword="IF">IF</span>
```

The duplicates were write-only — `parseHTML` reads only the `data-*` attributes,
nothing in the editor, renderer or quality packages ever read `label` / `value`
/ `keyword`, and none of them are valid on a `<span>`. They were paid for on
every tag in every template, through stored content, autosave PATCHes,
snapshots and version history.

Serialization now emits the `data-*` pair alone. Content already containing the
old attributes keeps parsing unchanged (it always resolved from `data-*`) and
sheds them on the next save; MJML export is unaffected, since the renderer
replaces the whole span.
