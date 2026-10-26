---
title: Localized templates
description: Keep language versions of one email in one template — per-language text, overrides and hidden blocks, rendering per locale, and checks for missing and stale translations.
---

# Localized templates

Keep language versions of one email in one shared block tree with `settings.locales` and `l10n`; render a version with `resolveLocale` or check it with `--locale`.

## Turn on language versions

In a Vite app with `@templatical/editor` installed, use this HTML entry point. The blank template defaults to English. Under **Languages**, choose **Add language** and German; configuring the list alone writes no localization fields.

<<< @/snippets/localized-editor.html

Upgrade the renderer, validator and collaboration backend before enabling this config; see [Upgrading](#upgrading). The UI language (`init({ locale })`) is independent of template language versions; see [Internationalization](/guide/i18n).

## Data shape

`settings.locale` is the fixed default language. `settings.locales?: string[]` lists the other versions, without duplicates or the default. Every key in `block.l10n` and `settings.l10n` must occur in that list.

| Member | Contract |
| --- | --- |
| `block.l10n[locale].text` | `Record<string, LocalizedText>`; each value is `{ value: string; source: string }` |
| `block.l10n[locale].set` | `Record<string, unknown>` for URLs, images, styling and other overrides; `null` means the property is absent in that language |
| `block.l10n[locale].hidden` | `true` omits the block and its descendants from this language's render |
| `settings.l10n[locale]` | `SettingsLocaleLayer`: optional `text` and `set`, without `hidden`; text covers `preheaderText`, overrides can set `direction`, fonts and colors |

A field path joins property names with `.`. At an array, the next segment is the element's `id`, never its index: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. A field id is `<blockId>/<path>` or `settings/<path>`.

`TRANSLATABLE_FIELDS` lists text patterns for each block type; `translatableFields(block, definitions)` expands element ids and custom `text` and `textarea` fields. `SETTINGS_TRANSLATABLE_FIELDS` lists settings text paths. A `text` path always names an existing text field. A `set` override may add an optional property absent from the default, but its parent must exist. It cannot change structural keys (`id`, `type`, `children`, `l10n`).

`set` also refuses section `columns` and whole built-in list paths: menu `items`, table `rows` and `rows.<id>.cells`, and social `icons`. These structural overrides return `invalid_operation`; edit their element leaves instead. Custom `fieldValues.<key>` whole-field overrides remain allowed.

A path occurs in at most one of `text` and `set`; writing either removes it from the other. Omit empty layers, `text`, `set`, `l10n` and `settings.locales` instead of storing `{}` or `[]`. See [Types](/api/types#localization) for exact declarations.

## Editing in a language

The **Languages** menu shows the default and each version with coverage. **Add language** offers configured languages the template lacks. **Remove {language}** asks for confirmation and removes that version's layers; removal is undoable.

Text and property edits in a language view affect that language only. When a translatable field has a default value, an edit stores `text` with its `source` hash. If the default has no value, such as an absent preheader, the edit stores a `set` override without staleness tracking. An edit equal to the default leaves no override.

**Differs in {language}** marks property overrides. The toolbar’s per-field **Reset** restores only that field from the default and keeps sibling overrides. The block marker’s **Reset** clears all of that block’s `set` overrides; it keeps its `text` translations. **Hide in {language}** leaves a ghost block on the canvas; **Show** restores it. The renderer omits hidden blocks.

Add, move, delete, duplicate, paste and drag change the shared tree for every language. The editor shows **Structure changes apply to every language.** once per session per template. A version in `settings.locales` but absent from `localization.locales` remains selectable, read-only and marked **Not enabled**: both value edits and structure changes are refused.

Deleting a base field or list element prunes every language’s text entries whose path no longer resolves and overrides whose parent no longer resolves. Removing the default preheader therefore removes its text translations. Empty localization members are omitted. Undo restores the base first and then the pruned entries; removing a language and undoing it restores the same content.

The active language is view state, never saved. Sessions start on the default. `editor.getLocale()` reads it; `editor.setLocale(tag)` selects the default or an existing version when localization is enabled. `onLocaleChange(tag)` reports selection changes, including fallback to the default after removal or loading another template. Unknown versions throw `SdkError` with code `unknown_locale`.

## Missing values {#missing-values}

A missing translation falls back to the default-language value. The block shows **Not translated**, coverage reports the field as missing, and `localization.untranslated` reports a warning. Empty defaults and hidden blocks do not count as missing. A deliberate empty translation is a value and does not trigger fallback.

## Out-of-date values {#out-of-date-values}

Each `LocalizedText.source` stores `sourceHash(defaultValue)` when written. `sourceHash` is FNV-1a 32-bit over UTF-8 bytes, formatted as eight lowercase hexadecimal digits. A changed default hash marks the translation **Out of date** and produces `localization.stale`.

**Keep** retains the existing translation entry and updates its source hash, even when the changed default now equals the translation. Coverage counts the kept entry as translated. Hide and Show preserve text entries too. **Use default** removes the field's layer value, restoring fallback. Neither action changes sibling overrides. In the default view, **Translations out of date: {count}** identifies affected blocks. Property overrides in `set` have no source hash.

## Merge tags {#merge-tags}

Keep the same merge tags, including repeated occurrences, in each translated text field. `localization.merge-tags-differ` compares tag multisets against the default; the editor uses the same merge-tag list in every language. The rule is a warning, but CLI validation treats a merge-tag mismatch as blocking and exits `1`, even when `valid: true`. Missing and stale translations alone remain advisory.

## Rendering a language

With `@templatical/types` and `@templatical/renderer` installed, this complete TypeScript example creates a version, writes text and direction, checks coverage and renders German MJML:

<<< @/snippets/localize-template.ts

`renderToMjml(content, { locale })` resolves that language before rendering. `editor.toMjml({ locale })` and `editor.toHtml({ locale })` accept the same optional selection. Omitting it renders the default, independently of the active editor view. Local MJML export needs the optional `@templatical/renderer` peer; HTML requires a `render.toHtml` or `render.compileMjml` provider. See [Rendering & Export](/backend/render).

`resolveLocale(content, locale)` is pure: it applies text, overrides and settings, drops hidden blocks recursively, strips localization fields and sets the projected `settings.locale`. Missing values stay at the default. Unknown versions throw `unknown_locale`. The projected locale and direction determine MJML `lang` and `dir`. Save the original content, which retains all versions, rather than this projection.

Preview localizes the active language, composes the layout, then calls `resolvePreview`. The returned plain template renders directly. Changing language invalidates the cached result and discards responses for the previous language.

**Custom blocks:** any `text` or `set` entry in the requested locale’s layer removes the default-language `renderedHtml` from the projection. `renderedStylesheet` stays. Supply `renderCustomBlock` to render the localized fields; without it the block is omitted instead of showing the default-language pre-render. Blocks without a layer for that locale keep their cached HTML. The editor export path localizes before pre-rendering and produces translated custom HTML. See [Custom block rendering](/api/renderer-typescript#custom-blocks).

## Operations and collaboration

| Operation | Effect |
| --- | --- |
| `addLocale` | Adds a version to `settings.locales` |
| `removeLocale` | Removes the version and every corresponding block/settings layer |
| `updateBlockLocale` | Writes a block's `text`, `set`, `unset` paths and `hidden` for a locale |
| `updateSettingsLocale` | Writes settings `text`, `set` and `unset` for a locale |

Updates apply `unset`, then `text`, then `set`, then `hidden` (blocks only). `expect` guards the current layer: a mismatch is `precondition_failed`. Invalid paths, non-text `text` paths and invalid locale operations are `invalid_operation`. Only locale operations change localization fields; generic `updateBlock` and `updateSettings` refuse them. `addBlock` may carry `l10n`; `setContent` replaces everything. Use `applyOperations` and `invertOperations` from `@templatical/types`.

`BlockLock.locale?: string | null` and `OperationLock.locale?: string | null` use `null` (also the absent default) for the default language and structure. A localized edit to (block X, `de`) conflicts with another session's lock on (X, `de`) or (X, `null`); a `fr` lock can coexist. Every other block operation conflicts with any other session's lock on X. Provider lock methods accept an optional locale. `onRemoteChange.locale` is the first locale operation's language in the batch, otherwise `null`. See [Collaboration](/backend/collaboration) for exact contracts.

## Upgrading

Upgrade the renderer, validator and collaboration backend **before** enabling `localization`. Older renderers ignore the fields and render the default. Older strict validators reject `l10n`; older collaboration backends reject the new operations as `invalid_operation`. A backend that ignores lock `locale` serializes per block.

This is additive and opt-in: existing single-language templates need no migration and retain their load, edit, save and render behavior. Without `localization`, there is no language UI; existing layers survive default-language edits and saves. The editor writes localization fields only after configuration and an author adding a language.

## Fully separate layouts

For independent block trees or layouts in each language, keep separate templates and switch them with `editor.load(id)`. Language versions share one structure.

## Limits

- The default language cannot change once versions exist.
- Direction can differ by language; automatic RTL mirroring is not implemented.
- Repeatable custom-block text is override-only because its items have no ids; override the whole `fieldValues.<key>`.
- A layout's own blocks (`init({ layout })`) are not localizable; content is localized before composition.
- Menu items, table rows and cells with `.` in their ids cannot be localized. SDK-created ids never contain `.`.
- Accepted tags have a 2–3 letter language plus optional 2–8 character alphanumeric subtags. Private-use (`x-…`) and grandfathered (`i-…`) tags are not accepted.
- The Cloud editor does not support language versions yet: `initCloud()` ignores `localization` and logs a warning.
- The SDK doesn't translate: you or your own pipeline write the values.
- In a language view, AI chat edits the default language; its composer says **AI chat edits the default language.** **Fix with AI** and **Write alt text** are hidden in language views.

- Comments and version history are per block and template, not per language.
- The CLI has no custom-block definitions flag, so validation refuses custom `text` paths. Both `validate` and `render` validate without definitions. Use the library workflow below.
- Localized custom blocks with any `text` or `set` entries need `renderCustomBlock`; without it they are omitted, including CLI rendering of custom `set` overrides. Their default-language cached HTML is discarded; stylesheets are retained.

## Check your work

For a saved `template.json` without custom `text` paths, run the CLI with the language selected:

```bash
npx -y @templatical/template-tools validate template.json --locale de --json
npx -y @templatical/template-tools render template.json --locale de --format mjml --out template.de.mjml
```

`validateTemplate` checks every declared language’s resolved blocks and settings against the ordinary schemas and names the locale in projection errors. Deleting required properties or supplying invalid override types fails validation, even when another language is selected for linting. A failure inside lint itself exits `2`, with a diagnostic on stderr and no result document.

`validate --locale de` checks structure and the projected content, including `localization.untranslated`, `localization.stale` and `localization.merge-tags-differ`. Exit `0` means success, `1` means invalid structure, error-severity lint, a merge-tag mismatch or an unknown locale, `2` means misuse/tool failure (including a missing or empty `--locale` value), and `3` means a missing optional dependency. An unknown locale exits `1`, writes `unknown_locale` to stderr without a result document, including with `--json`. A missing or empty `--locale` value exits `2`. `valid: true` alone does not mean exit `0`. See [Template tools](/api/template-tools).

For custom translations, the CLI cannot supply definitions and cannot render localized custom blocks with its own resolver. Use `validateTemplate(content, definitions)`, then `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })`, and supply `renderCustomBlock` for rendering. This complete TypeScript example requires `@templatical/types`, `@templatical/template-tools`, `@templatical/quality`, `@templatical/renderer` and `liquidjs`:

<<< @/snippets/localize-custom-block.ts

Check `validation.valid`, inspect `issues`, and confirm the MJML contains `Willkommen` rather than the cached `Welcome`. See [Custom block rendering](/api/renderer-typescript#custom-blocks) and the [CLI library API](/api/template-tools#library-use).

## In the playground

The [Languages setup](https://play.templatical.com/scenes/languages) opens one template with German text, a different hero image, a hidden block and a stale value. Switch to Deutsch, edit its text, then return to English to check that it is unchanged. Choose **Keep** to clear the stale marker, add French, or select Arabic to see right-to-left content.
