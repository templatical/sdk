# Localize a template

Keep language versions in one shared block tree with `settings.locales` and `l10n`. For independent layouts, keep separate templates and switch with `editor.load(id)`.

**Read first:** [cli.md](cli.md) for the pinned invocation and exit codes; [version-awareness.md](version-awareness.md) for the installed SDK version.
**Consult:** [providers.md](providers.md) for editor config and collaboration; [docs.md](docs.md) → `guide/localized-templates`, `backend/translation` and `api/types` for exact declarations.

## Configuration and compatibility

`init({ localization: { locales: ["en", "de", "fr"] } })` turns on language versions. Existing templates need no migration, and configuration alone writes no localization fields. Keep every `@templatical/*` package on one version: an older renderer renders the default language and an older validator rejects `l10n`. A self-built collaboration backend must apply the locale operations and lock `locale` ([providers.md](providers.md)); until it does, it rejects them as `invalid_operation`. The Cloud editor does not support language versions yet: `initCloud()` ignores the key and logs a warning.

`settings.locale` is the default; `setDefaultLocale` promotes an existing version. `settings.locales` contains other versions without duplicates or the default. A stored version absent from `localization.locales` is selectable but read-only, marked **Not enabled**; value edits and structure changes are refused. `getLocale()`, `setLocale(tag)` and `onLocaleChange(tag)` control view state, which starts at the default and is not saved. An unknown version throws `unknown_locale`.

## Language values

1. Add a language with **Languages → Add language**, or the `addLocale` operation. Remove with **Remove {language}** or `removeLocale`; removal drops its block and settings layers and is undoable in the editor.
2. Write translated text with `updateBlockLocale.text` and `sourceHash: sourceHash(defaultValue)`. Use `set` for URLs, image sources, styles and other overrides, or `hidden: true` to omit a block in this language. Use `updateSettingsLocale` for preheader text and settings overrides such as direction. A text path must name an existing translatable field; `set` may add an optional property when its parent exists. `null` in `set` means absence. Omit empty localization members.
3. In a language view, text and property edits affect that version. Existing default text produces `text` with `sourceHash`; an absent default such as a missing preheader produces `set`, without staleness tracking. An equal value leaves no override. The toolbar’s per-field **Reset** restores one field and preserves sibling overrides. The block marker’s **Reset** clears all of that block’s `set` overrides and keeps its `text` translations. Structure edits affect every version; **Structure changes apply to every language.** appears once per session per template. A disabled version refuses these edits.
4. Check missing/stale values and merge tags, then render the selected locale.

Property paths use `.` and element ids, not array indices: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. Field ids are `<blockId>/<path>` or `settings/<path>`. `TRANSLATABLE_FIELDS` and `translatableFields(block, definitions)` identify text; custom blocks cover only `text` and `textarea`. Repeatable fields are override-only (whole `fieldValues.<key>`), because their items have no ids. Menu item, social icon, table row and table cell ids must not contain `.` or `/`; validation and `addBlock`, `updateBlock` and `setContent` refuse them. Use `elementIdIssues(content)` to inspect their template paths. Language tags must match `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`: 2–3 ASCII letters, followed by zero or more hyphen-separated subtags of 2–8 ASCII letters or digits. Forms beginning with `x-…` or `i-…` are rejected because their language segment has one letter; grandfathered forms such as `no-bok` and `zh-min-nan` match and are accepted.

For a standalone Node TypeScript example with `@templatical/types` and `@templatical/renderer` installed, fetch `https://docs.templatical.com/guide/localized-templates.md`. Its complete authoring example creates a default title, runs `addLocale`, `updateBlockLocale` and `updateSettingsLocale` through `applyOperations`, and renders German. Save the original content with its layers, not the result of `resolveLocale`.

`unset` resets field paths; updates apply `unset`, then `text`, then `set`, then block `hidden`. Writing a path in `text` removes its `set` value and vice versa. `expect` uses the nested `LocaleLayerExpect` contract; mismatches are `precondition_failed`. Invalid operations/paths are `invalid_operation`. Generic `updateBlock`/`updateSettings` refuse localization fields; `addBlock` may carry layers and `setContent` replaces the whole document. `invertOperations` creates the guarded inverse.

Default-field and list-element deletions prune text paths that no longer resolve and overrides whose parent no longer resolves, across every language. Empty localization members disappear. Undo restores the base before the pruned entries; language removal and undo restore identical content. Text projection never recreates an absent base field.

`set` refuses section `columns` and whole built-in list paths (`items`, `rows`, `rows.<id>.cells`, `icons` on their corresponding built-in blocks) with `invalid_operation`. Write element leaf paths; custom `fieldValues.<key>` whole-field overrides remain allowed.

`validateTemplate` validates every declared language’s resolved blocks and settings against the ordinary schemas, naming the locale on errors. Invalid override types and deletion of required properties fail validation. If lint itself throws, validate exits 2 with a diagnostic on stderr and no result document.

## Translate a language

1. Check the installed SDK version, then fetch `backend/translation` and `guide/localized-templates` through [docs.md](docs.md). Pass a `TranslationProvider` as `init({ translation })`, alongside `localization`. Translate appears only in an enabled non-default language view; no loaded template or `AiProvider` is required. `initCloud()` ignores `translation` with a warning.
2. Select the version and use **Translate from {language}**. The default is gaps only (missing and stale); current translations and manual edits survive. **Translate everything again…** overwrites all eligible fields after confirmation naming the language. Block markers offer **Translate** and **Re-translate**. Zero-field actions are disabled.
3. Preserve the editor's mask: `<x id="n"/>` in text, `__xn__` in HTML attribute values, one shared id sequence per field. Every id must return exactly once; original tags are restored byte for byte. `tags_changed` keeps the previous value. Existing translations use the source's ids; changed tags exclude the field. HTML passes Rewrite's `sanitizeRichTextHtml` before tags are restored.
4. Read the dismissible result notice: translated fields, old text retained, omitted fields, blocks skipped because they are locked and provider errors. Cancel keeps valid fields already returned. A run is one undo step, an ordinary edit under collaboration, and skips other sessions' locks in the captured target language or structurally. No change records no history; a second run rejects with editor-local `translation_running`.
5. Save and run the pinned CLI below: `validate --locale de`. Require no `localization.untranslated` or `localization.stale` after translating eligible fields, and no `localization.merge-tags-differ`. Inspect issues even on exit 0: missing/stale warnings are advisory. Manually translate excluded fields if needed.

For brand names, configure `localization.doNotTranslate` using [providers.md](providers.md), then fetch `backend/translation` through [docs.md](docs.md). Terms share the tag placeholder check, so preservation is checked on return. Pass the same `doNotTranslate` list to both strings helpers for a headless round trip; `maskTags(text, syntax, format, { doNotTranslate })` accepts it too. A stored translation missing a protected term is excluded; correct it by hand before rerunning Translate.

Translate sends only eligible fields: no HTML blocks, empty defaults, `set` overrides and hidden blocks. Title and paragraph `content` use `html`; every other field uses `text`. Each sequential call has at most 50 fields and 20,000 UTF-16 units of masked text. On `content_too_large`, the editor halves the batch down to one field. Errors are recognized by their string `code` across bundles: `rate_limited`, `limit_reached`, `content_too_large`, `translation_failed`; an abort is `AbortError`.

For a backend, use `createHttpTranslationProvider({ url, headers?, fetch? })` from `@templatical/ai-kit/client`, `readTranslationRequest` and `translateFields` from `/server`, or implement the plain provider for DeepL/TMS. Fetch `backend/translation` for the wire, limits, exact signatures and runnable server example. Run `runTranslationConformance` from `@templatical/ai-kit/testing`; the `createMockTranslationProvider` is deterministic. DeepL uses `tag_handling=html` for HTML fields and `tag_handling=xml` for text; the editor's exact check still decides whether a result can apply.

For JSON exchange use `localeStrings(content, locale, { syntax, only: "gaps" })`, serialize its strings and tokens, translate each `text`, then call `applyLocaleStrings` with the original tokens and extraction-time `sourceHash`. It returns locale operations plus `tags_changed`, `unknown_field` or `not_translatable` rejections. Apply the operations with `applyOperations`. `maskTags(text, syntax, format, { doNotTranslate })` and `unmaskTags(text, tokens)` are also public. Pure helpers do not sanitize external HTML; preserve placeholders while sanitizing before applying. Fetch the guide's CI-run strings snippet; there is no strings export/import CLI command yet.

AI chat, Fix, Rewrite and alt text use the active language. Chat/Fix receive its projection and map returned operations to locale text/overrides; structure changes and added blocks remain shared, and added text becomes default content. Whole-template replacement and changing the default language are refused in language views. Empty batches do nothing. Chat/Fix/Rewrite carry `locale: string | null` (null for the default view), alt text always carries a concrete language, and optional `AiChatMessage.locale` labels history. Rewrite's Translate preset uses its chosen target; `checkRewrite` requires the exact merge/logic tag multiset, including chips and declared tag values with `custom` syntax. Fetch `backend/ai` for the AI gates and review flow.

## Missing, stale and merge-tag checks

| Rule | Action |
| --- | --- |
| `localization.untranslated` | Missing nonempty default text falls back to the default; **Not translated** marks it. Write a translation or accept the advisory warning. Hidden blocks and empty defaults are excluded. |
| `localization.stale` | **Out of date** means the stored `sourceHash` differs from `sourceHash(defaultValue)`. **Keep** updates the hash while retaining the existing text entry, including when the new default equals it; coverage counts it as translated. Hide and Show also preserve text entries; **Use default** removes the field's value to restore fallback. Sibling overrides remain. |
| `localization.merge-tags-differ` | Preserve the default's merge-tag multiset, including repeated occurrences. This warning is blocking in CLI validation. |

For an existing saved `template.json`, run:

```bash
npx -y @templatical/template-tools@0.51.1 validate template.json --locale de --json
npx -y @templatical/template-tools@0.51.1 render template.json --locale de --format mjml --out template.de.mjml
```

Missing/stale warnings alone allow exit 0; merge-tag mismatches cause exit 1 even with `valid: true`. An unknown locale exits 1 with `unknown_locale` on stderr and no result document, including with `--json`. A missing or empty `--locale` value exits 2. `--format html` needs the optional `mjml` dependency (exit 3 if absent). Read every issue, not just `valid`.

Headless `lintTemplate(content, { contentLocale: "de", locale: "en" })` checks German and returns English messages. Dictionaries remain a union across languages; `contentLocale` is not a spelling/dictionary locale. `localization.rules` overrides severity, and `localization: false` disables the category.

## Rendering and collaboration

A layout carries its own `settings.locales`, block `l10n` and `settings.l10n`, including wrapper children beside the slot. Rendering projects it for the requested language with `resolveLocale(layout, locale, { missing: "default" })` before composition, falling back to the layout's default when it lacks that language. The editor never edits the layout. Check a layout file with `template-tools validate --locale de`; fetch `api/renderer-typescript` and `api/types` through [docs.md](docs.md) for the contract.

`renderToMjml(content, { locale: "de" })`, `editor.toMjml({ locale: "de" })` and `editor.toHtml({ locale: "de" })` select a version. Omission renders the default regardless of active view. `resolveLocale(content, "de")` is a pure projection: text and overrides applied, hidden blocks removed recursively, localization fields stripped, `settings.locale` set to `de`. The editor's HTML method still needs `render.toHtml` or `render.compileMjml`; local MJML needs the renderer peer.

Locks carry `locale?: string | null`, absent meaning null (default language and structure). Forward the optional locale through provider `acquireLock`, `renewLock`, `releaseLock` and `onUnlock`. A localized edit on (X, de) conflicts with another session's (X, de) or (X, null) lock, while (X, fr) can coexist. Other block operations conflict with every other session's lock on X. `onRemoteChange.locale` reports the first locale operation's language in the batch, excluding `setDefaultLocale`, otherwise null. A `setDefaultLocale` batch reports null because it changes the template's default. A backend ignoring locale serializes per block; check the lock matrix against the contracts in `backend/collaboration` and the shared operation fixtures documented in `api/operations`.

## Custom blocks

The CLI has no custom-block definitions flag. Both validate and render validate without definitions, so custom `text` paths are refused. For custom translations use `validateTemplate(content, definitions)`, then `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })`, then `renderToMjml` with `renderCustomBlock`. The guide's checking section has a complete library example; fetch it through [docs.md](docs.md) → `guide/localized-templates`, and follow `api/renderer-typescript` for custom rendering.

Any `text` or `set` entry in a custom block's requested locale layer discards its default-language `renderedHtml`, keeping `renderedStylesheet`. A resolver renders the localized fields; without `renderCustomBlock` the block is omitted, including CLI renders of custom `set` overrides. Blocks without a layer for that locale retain cached HTML. The editor's export path localizes before pre-rendering and retains translated HTML. Check the library example's validation result and localization issues, and verify the rendered MJML contains the translated custom text, rather than assuming CLI validation/rendering can check it.

Use `{ "op": "setDefaultLocale", "locale": "de" }` to promote an existing version. Its values become the base; the former default becomes a version in the same list position. Gaps keep their old default values. `defaultLocaleGaps(content, "de", definitions?)` lists those field ids; stale text and applicable `set` overrides do not count. `localeHiddenBlocks(content, "de")` lists blocks to show first: any hidden block refuses promotion. Other sessions’ locks also refuse it. The inverse restores the exact prior content through `setContent`. See [Operations](https://docs.templatical.com/api/operations) for re-stamping, optional-field removal and refusal messages. Run `template-tools validate` after the edit.

## Limits

**Defaults and direction**

- Direction can differ per language. Column order follows the language's direction automatically: right-to-left versions show the first column on the right. Explicit left and right text alignment and left/right padding aren't mirrored. Override them per language. Column structure is shared across languages and can't be overridden per language.

**Fields and layouts**

- Text in a custom block's repeatable items can't be translated per field: override the whole `fieldValues.<key>` instead.
- Language tags must match `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`: 2–3 ASCII letters, followed by zero or more hyphen-separated subtags of 2–8 ASCII letters or digits. Forms beginning with `x-…` or `i-…` are rejected because their language segment has one letter; grandfathered forms such as `no-bok` and `zh-min-nan` match and are accepted.

**Translate**

- HTML blocks are left out of Translate. They can still be translated by hand.
- The strings round trip is JSON through `localeStrings`/`applyLocaleStrings`. There's no strings CLI command and no XLIFF or CSV support.

**AI in a language view**

- Blocks the AI adds enter the shared tree with their text as default content, as a paste does.
- AI can't replace the whole template there. Switch to the default language for that.
- With a custom merge-tag syntax, Rewrite's tag check covers chips and declared tags only.

**Comments, history, CLI and Cloud**

- Comment threads are shared across languages. Each new comment and reply stores its view’s language tag through a BYO [comments provider](https://docs.templatical.com/backend/comments); Cloud does not store it yet. Version history remains per template.
- The CLI has no custom-block definitions flag, so validating custom text translations and rendering localized custom blocks goes through the library (`validateTemplate(content, definitions)`, `renderCustomBlock`).
- The Cloud editor doesn't support language versions or translation yet: `initCloud()` ignores `localization` and `translation` and logs a warning.
