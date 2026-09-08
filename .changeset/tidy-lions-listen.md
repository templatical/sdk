---
"@templatical/types": minor
"@templatical/editor": minor
---

Let a consumer choose which template settings the Settings panel exposes

The right sidebar's Settings tab offered all eight members of
`TemplateSettings` unconditionally. An embedder whose application owns one of
them — the content locale chosen before the editor opens, a preheader edited
in a field next to the subject line — had no way to take it out, and was left
hiding fields with CSS against internal markup.

New `templateSettings.fields` on both `init()` and `initCloud()`:

```ts
init({
  container,
  templateSettings: {
    fields: ["width", "backgroundColor", "fontFamily"],
  },
});
```

The list only narrows: omit the key, or pass `true`, and every setting stays
editable. A card renders while at least one of its settings survives, so
excluding `locale` removes the Language card and excluding `preheaderText`
removes the Preheader card; `fields: false` (or `[]`) removes the Settings tab
itself. The list never reorders — settings sit in fixed cards, so unlike
`paletteBlocks` there is no order to express. An entry that isn't a
`TemplateSettings` member is a compile error for TypeScript callers, and is
warned and skipped at runtime, so a typo narrows the panel rather than
restoring every setting.

Presentation only. Hiding a setting never changes its value: whatever the
loaded content carries keeps rendering and keeps round-tripping through
`getContent()` and the export. Set the ones you hide from the content you hand
the editor — `init({ content })`, or your own `templates.load`.
`templateDefaults` cannot do it, since it applies only when no content is
provided.

Settings cards now space their contents with a flex gap rather than a bottom
margin on every child but the last, because which field is last depends on the
allowlist. Every field control and card also carries a `data-testid`.

Closes #674.
