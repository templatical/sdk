# Localize a template

Keep language versions in one shared block tree with `settings.locales` and `l10n`. For independent layouts, keep separate templates and switch with `editor.load(id)`.

**Read first:** [cli.md](cli.md) for the pinned invocation and exit codes; [version-awareness.md](version-awareness.md) for the installed SDK version.
**Consult:** [providers.md](providers.md) for editor config and collaboration; [docs.md](docs.md) → `guide/localized-templates` and `api/types` for exact declarations.

## Configuration and compatibility

`init({ localization: { locales: ["en", "de", "fr"] } })` turns on language versions. Existing templates need no migration, and configuration alone writes no localization fields. Keep every `@templatical/*` package on one version: an older renderer renders the default language and an older validator rejects `l10n`. A self-built collaboration backend must apply the locale operations and lock `locale` ([providers.md](providers.md)); until it does, it rejects them as `invalid_operation`. The Cloud editor does not support language versions yet: `initCloud()` ignores the key and logs a warning.

`settings.locale` is the fixed default. `settings.locales` contains other versions without duplicates or the default. A stored version absent from `localization.locales` is selectable but read-only, marked **Not enabled**; value edits and structure changes are refused. `getLocale()`, `setLocale(tag)` and `onLocaleChange(tag)` control view state, which starts at the default and is not saved. An unknown version throws `unknown_locale`.

## Language values

1. Add a language with **Languages → Add language**, or the `addLocale` operation. Remove with **Remove {language}** or `removeLocale`; removal drops its block and settings layers and is undoable in the editor.
2. Write translated text with `updateBlockLocale.text` and `source: sourceHash(defaultValue)`. Use `set` for URLs, image sources, styles and other overrides, or `hidden: true` to omit a block in this language. Use `updateSettingsLocale` for preheader text and settings overrides such as direction. A text path must name an existing translatable field; `set` may add an optional property when its parent exists. `null` in `set` means absence. Omit empty localization members.
3. In a language view, text and property edits affect that version. Existing default text produces `text` with a source hash; an absent default such as a missing preheader produces `set`, without staleness tracking. An equal value leaves no override. The toolbar’s per-field **Reset** restores one field and preserves sibling overrides. The block marker’s **Reset** clears all of that block’s `set` overrides and keeps its `text` translations. Structure edits affect every version; **Structure changes apply to every language.** appears once per session per template. A disabled version refuses these edits.
4. Check missing/stale values and merge tags, then render the selected locale.

Property paths use `.` and element ids, not array indices: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. Field ids are `<blockId>/<path>` or `settings/<path>`. `TRANSLATABLE_FIELDS` and `translatableFields(block, definitions)` identify text; custom blocks cover only `text` and `textarea`. Repeatable fields are override-only (whole `fieldValues.<key>`), because their items have no ids. Menu/table element ids containing `.` cannot be localized; SDK ids never contain it. Tags accept a 2–3 letter language and optional 2–8 character alphanumeric subtags; private-use (`x-…`) and grandfathered (`i-…`) tags are rejected.

For a standalone Node TypeScript example with `@templatical/types` and `@templatical/renderer` installed, fetch `https://docs.templatical.com/guide/localized-templates.md`. Its complete authoring example creates a default title, runs `addLocale`, `updateBlockLocale` and `updateSettingsLocale` through `applyOperations`, and renders German. Save the original content with its layers, not the result of `resolveLocale`.

`unset` resets field paths; updates apply `unset`, then `text`, then `set`, then block `hidden`. Writing a path in `text` removes its `set` value and vice versa. `expect` uses the nested `LocaleLayerExpect` contract; mismatches are `precondition_failed`. Invalid operations/paths are `invalid_operation`. Generic `updateBlock`/`updateSettings` refuse localization fields; `addBlock` may carry layers and `setContent` replaces the whole document. `invertOperations` creates the guarded inverse.

Default-field and list-element deletions prune text paths that no longer resolve and overrides whose parent no longer resolves, across every language. Empty localization members disappear. Undo restores the base before the pruned entries; language removal and undo restore identical content. Text projection never recreates an absent base field.

`set` refuses section `columns` and whole built-in list paths (`items`, `rows`, `rows.<id>.cells`, `icons` on their corresponding built-in blocks) with `invalid_operation`. Write element leaf paths; custom `fieldValues.<key>` whole-field overrides remain allowed.

`validateTemplate` validates every declared language’s resolved blocks and settings against the ordinary schemas, naming the locale on errors. Invalid override types and deletion of required properties fail validation. If lint itself throws, validate exits 2 with a diagnostic on stderr and no result document.

## Missing, stale and merge-tag checks

| Rule | Action |
| --- | --- |
| `localization.untranslated` | Missing nonempty default text falls back to the default; **Not translated** marks it. Write a translation or accept the advisory warning. Hidden blocks and empty defaults are excluded. |
| `localization.stale` | **Out of date** means the stored `source` differs from `sourceHash(defaultValue)`. **Keep** updates the hash while retaining the existing text entry, including when the new default equals it; coverage counts it as translated. Hide and Show also preserve text entries; **Use default** removes the field's value to restore fallback. Sibling overrides remain. |
| `localization.merge-tags-differ` | Preserve the default's merge-tag multiset, including repeated occurrences. This warning is blocking in CLI validation. |

For an existing saved `template.json`, run:

```bash
npx -y @templatical/template-tools@0.51.1 validate template.json --locale de --json
npx -y @templatical/template-tools@0.51.1 render template.json --locale de --format mjml --out template.de.mjml
```

Missing/stale warnings alone allow exit 0; merge-tag mismatches cause exit 1 even with `valid: true`. An unknown locale exits 1 with `unknown_locale` on stderr and no result document, including with `--json`. A missing or empty `--locale` value exits 2. `--format html` needs the optional `mjml` dependency (exit 3 if absent). Read every issue, not just `valid`.

Headless `lintTemplate(content, { contentLocale: "de", locale: "en" })` checks German and returns English messages. Dictionaries remain a union across languages; `contentLocale` is not a spelling/dictionary locale. `localization.rules` overrides severity, and `localization: false` disables the category.

## Rendering and collaboration

`renderToMjml(content, { locale: "de" })`, `editor.toMjml({ locale: "de" })` and `editor.toHtml({ locale: "de" })` select a version. Omission renders the default regardless of active view. `resolveLocale(content, "de")` is a pure projection: text and overrides applied, hidden blocks removed recursively, localization fields stripped, `settings.locale` set to `de`. The editor's HTML method still needs `render.toHtml` or `render.compileMjml`; local MJML needs the renderer peer.

Locks carry `locale?: string | null`, absent meaning null (default language and structure). Forward the optional locale through provider `acquireLock`, `renewLock`, `releaseLock` and `onUnlock`. A localized edit on (X, de) conflicts with another session's (X, de) or (X, null) lock, while (X, fr) can coexist. Other block operations conflict with every other session's lock on X. `onRemoteChange.locale` reports the first locale operation's language in the batch, otherwise null. A backend ignoring locale serializes per block; check the lock matrix against the contracts in `backend/collaboration` and the shared operation fixtures documented in `api/operations`.

## Custom blocks

The CLI has no custom-block definitions flag. Both validate and render validate without definitions, so custom `text` paths are refused. For custom translations use `validateTemplate(content, definitions)`, then `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })`, then `renderToMjml` with `renderCustomBlock`. The guide's checking section has a complete library example; fetch it through [docs.md](docs.md) → `guide/localized-templates`, and follow `api/renderer-typescript` for custom rendering.

Any `text` or `set` entry in a custom block's requested locale layer discards its default-language `renderedHtml`, keeping `renderedStylesheet`. A resolver renders the localized fields; without `renderCustomBlock` the block is omitted, including CLI renders of custom `set` overrides. Blocks without a layer for that locale retain cached HTML. The editor's export path localizes before pre-rendering and retains translated HTML. Check the library example's validation result and localization issues, and verify the rendered MJML contains the translated custom text, rather than assuming CLI validation/rendering can check it.
