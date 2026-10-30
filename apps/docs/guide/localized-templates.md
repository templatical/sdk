---
title: Localized templates
description: Keep language versions of one email in settings.locales and l10n, fill them with Translate through your TranslationProvider, project them with resolveLocale and check or render them with --locale.
---

# Localized templates

Language versions keep every translation of one email in one template: a shared block tree, plus `l10n` layers with each language's text, property overrides and hidden blocks, for the languages in `settings.locales`. Authors add and edit versions in the editor and fill them with Translate through your `TranslationProvider`; `resolveLocale` and `--locale` project, check and render one version.

Language versions share one structure. For independent block trees per language, keep separate templates and switch them with `editor.load(id)`.

## Setup

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  localization: { locales: ["en", "de", "fr"] },
});
```

`localization.locales` lists the BCP 47 tags authors can add. The template's `settings.locale` is its default language; a blank template starts in English (`"en"`). Configuring the list writes nothing into the template: the **Languages** menu appears in the header, and an author adds a version from it. For a static page without a bundler, mount from the CDN as in the [Quick Start](/getting-started/quick-start#mount-the-editor) and pass the same `localization` key.

Add `translation` for Translate and `localization.doNotTranslate` for brand names; see [Translating](#translating). The editor's UI language (`init({ locale })`) is independent of template languages; see [Internationalization](/guide/i18n). Existing templates need no migration; see [Compatibility](#compatibility). `initCloud()` ignores `localization` and `translation` and logs a warning.

## Adding a language

Open **Languages**, choose **Add language**, then a language; the submenu offers the configured languages the template lacks. Labels name each language in itself, for example `de` as **Deutsch** and `fr` as **Français**, wherever they show `{language}` or `{default}`. Select the new version in the menu to edit it: the language bar under the header reads **Editing {language}**. **Back to {default}** in the bar, or the default row in the menu, returns to the default language. Each version's **More actions for {language}** button offers **Make default language** ([Default language](#default-language)) and **Remove {language}…**, which asks for confirmation and can be undone.

Text and property edits in a language view change only that language. When a translatable field has a default value, an edit stores `text` with its `sourceHash`; when the default has no value, such as an absent preheader, the edit stores a `set` override, which isn't tracked for staleness. An edit equal to the default leaves no override. For an overridden or translated field, the settings panel shows a language pill and a **Reset to {default}** icon that restores only that field from the default and keeps sibling overrides. The status badge’s **Reset changes** clears all of that block’s `set` overrides; it keeps its `text` translations. **Hide in {language}** in the block's settings leaves a ghost block on the canvas; **Show** restores it, and the renderer omits hidden blocks.

Add, move, delete, duplicate, paste and drag change the shared tree for every language. The language bar shows **Structure changes apply to every language.** once per session per template. A version in `settings.locales` but absent from `localization.locales` stays selectable, read-only and marked **Not enabled**: value edits and structure changes are refused. Selecting a block there still takes its lock for that language, so with collaboration a reviewer in the read-only view and an author editing another language can hold the same block at once.

The active language is view state and isn't saved; every session starts on the default. `editor.getLocale()`, `editor.setLocale(tag)` and `init({ onLocaleChange })` read, select and report it; an unknown version throws `SdkError` with code `unknown_locale`. See [Editor API](/api/editor).

Languages imported from [Beefree](/guide/migration-from-beefree#languages), [Unlayer](/guide/migration-from-unlayer#languages) and [Topol](/guide/migration-from-topol#languages) use the same layers. Every importer accepts `defaultLocale?: string` for a source that declares no default, and `template-tools import --default-locale <tag>` passes it from the CLI; an invalid tag there exits `2`. An importer ignores a declared default or `defaultLocale` that isn't a language tag, warns, and falls back to the next valid value or `"en"`. Inspect `report.warnings` for dropped languages, then add the imported languages to `localization.locales` to edit them. Without the editor, write versions with the [locale operations](#operations-and-collaboration) or with `strings import` ([Translating](#translating)).

## Translating {#translating}

Pass a [`TranslationProvider`](/backend/translation) as `init({ translation })` next to `localization`; without it there is no Translate UI. In an enabled language view, **Translate {count} fields** in the language bar sends the missing and out-of-date fields (the gaps), so current translations and manual edits survive; it's hidden when there are no gaps. **Translate everything again…** sends every eligible field after a confirmation that names the field count and says that manual edits are replaced; it's disabled when no field is eligible. A block's status badge offers **Translate** for missing text and **Re-translate** for out-of-date text or differing merge tags.

Translate masks merge tags, logic tags and the terms in `localization.doNotTranslate` (for example `["Sable"]`) as numbered placeholders, and applies a returned field only when it carries exactly the placeholders it was sent; any other field keeps its previous value and is reported. HTML blocks, empty defaults, `set` overrides and hidden blocks aren't sent: translate HTML blocks by hand. The [translation contract](/backend/translation#provider-contract) defines the placeholders, batch limits, errors and the DeepL settings.

While a run lasts, the language bar shows **Translating {done} of {total}…** with **Cancel**, and the editor stays editable. Fields returned before Cancel or an error apply together as one undo step; a run that changes nothing records nothing. With collaboration, a run is an ordinary edit, and blocks another session holds in that language or structurally are skipped. The dismissible result notice reports translated fields, fields kept because their tags changed, fields not returned, blocks skipped because someone is editing them, and the translation service's error message. Dismiss it to see the counts again; changing the view clears it.

AI chat, Fix with AI, Rewrite and Write alt text edit the active language; see [AI in language views](/backend/ai#ai-in-language-views).

To exchange strings as files with a translation service or a translator, `strings export` writes a language's gaps as JSON and `strings import` applies the translated file:

```bash
npx -y @templatical/template-tools strings export template.json --locale de --out strings.de.json
npx -y @templatical/template-tools strings import template.json strings.de.json --json
```

Set each entry's `text` and keep its `id`, `sourceHash` and placeholders unchanged. An out-of-date entry has no `text`: its old translation is in `previous`, which import never reads, so translate it again from `source`. Import applies every string whose `sourceHash` still matches the current default and whose placeholders come back exactly, writes the accepted strings, and exits `1` when any string was rejected. Both commands refuse the default language, and import refuses a file exported before another language became the default. Pass the same `--do-not-translate` and `--definitions` files to both commands; see [Strings](/api/template-tools#strings).

In code, the same round trip is `localeStrings` → JSON → `applyLocaleStrings` from `@templatical/types`. This complete TypeScript example extracts the gaps with `Sable` protected, simulates a translator's JSON edit and applies the returned locale operations; pass the same `doNotTranslate` list to both helpers. `localeStrings` returns an out-of-date entry's stored translation in `text`, and `applyLocaleStrings` stamps every `text` it receives with the extraction-time hash, so applying that entry unchanged marks the field current, as **Keep** does. Drop `text` from out-of-date entries before handing them to a translator, as the example does by moving it to `previous`, or use `strings export`. With `only: "gaps"`, only out-of-date entries carry `text`; with `only: "all"`, `localeCoverage(content, locale).stale` lists them. A default edited while the file is out makes that string out of date. The pure helpers don't sanitize returned HTML: sanitize it, keeping the placeholders, before applying it.

<<< @/snippets/translate-strings.ts

## Checking a language

The header's language button names the active language; in a language view with gaps it adds a warning icon and the number of gaps, with "{missing} missing, {stale} out of date" in its tooltip. Its accessible name reads the language name, then the visible gap count, the language tag and the same breakdown; without gaps it stays, for example, "Deutsch (de)". The language bar shows the same counts or **Complete**. A block with a localization state carries an icon badge in its top-right corner (top-left in a right-to-left view); its tooltip and accessible name give the label below. Select the badge, or **Jump to block** on a localization finding in the Issues panel, to open its popover. On a short selected block in a narrow canvas, the action bar sits beside the badge slot, leaving the badges and their focus rings visible.

| Badge label | Meaning | Actions |
| --- | --- | --- |
| **Hidden in {language}** | The block isn't in this language's email | **Show** |
| **Not translated** | A field has no text in this language; the email shows the default text | **Translate** |
| **Out of date** | The default text changed after the translation | **Re-translate**, **Keep**, **Use {default}** |
| **Merge tags differ** | A current translation's merge tags differ from the default text | **Re-translate**, **Use {default}** |
| **Changed in {language}** | Properties are overridden in this language | **Reset changes** |
| **Out of date in {count} languages** | In the default view: this block's translations are out of date | **Open**, per language |

A block in several states shows the first one in this order; with several fields in one state its label counts them ("{count} not translated"). **Translate** and **Re-translate** need a translation provider. Badges don't show in preview, and a layout's blocks have none ([Layouts](#layouts)). `template-tools validate --locale <tag>` and `lintTemplate(content, { contentLocale })` report missing, out-of-date and merge-tag findings as `localization.untranslated`, `localization.stale` and `localization.merge-tags-differ`, described below; see [Check your work](#check-your-work).

### Missing values {#missing-values}

A missing translation falls back to the default-language value. The block shows **Not translated**, coverage reports the field as missing, and `localization.untranslated` reports a warning. Empty defaults and hidden blocks don't count as missing. HTML block content does count, although Translate and `strings export` don't send it: the language bar counts it as missing without offering **Translate {count} fields** for it, and the warning stays until you translate it by hand in the language view. A deliberate empty translation is a value and doesn't fall back.

### Out-of-date values {#out-of-date-values}

Each translation stores the `sourceHash` of the default value it was written against. When the default changes, the translation is **Out of date** and `localization.stale` reports it. **Re-translate** translates it again. **Keep** keeps the text and stores the current hash, even when the changed default now equals the translation; coverage then counts it as translated. **Use {default}** removes the translation so the default shows. None of them changes sibling overrides, and hiding and showing a block keeps its text. In the default view, **Out of date in {count} languages** marks the affected blocks. Overrides in `set` have no source hash. [Types](/api/types#localization) gives the hash format.

### Merge tags {#merge-tags}

Keep the default's merge tags, including repeated ones, in each translated field: `localization.merge-tags-differ` compares them as a multiset, and the editor offers the same merge-tag list in every language. A current translation whose tags differ shows **Merge tags differ**. Its **Re-translate**, with a provider, sends every eligible text field of that block. If this would replace another current translation in the block, the popover first asks for confirmation with the field count and explains that manual edits are replaced. Confirming applies the translation as one undo step; without another current translation to replace, Re-translate starts at once. During confirmation, Escape returns to **Re-translate**; a second Escape closes the popover. **Use {default}** removes only the mismatched translations. Missing and out-of-date text take priority over this state. The rule is a warning, but CLI validation exits `1` on it, even with `valid: true`; missing and out-of-date translations alone don't change the exit code.

## Rendering a language

`renderToMjml(content, { locale: "de" })`, `editor.toMjml({ locale: "de" })`, `editor.toHtml({ locale: "de" })` and `template-tools render template.json --locale de` render one version. Without `locale` they render the default, whatever view the editor shows; an unknown version fails with `unknown_locale`. The projected language and direction set MJML `lang` and `dir`. Local MJML export needs the optional `@templatical/renderer` peer, and HTML needs a `render.toHtml` or `render.compileMjml` provider; see [Rendering & Export](/backend/render).

With `@templatical/types` and `@templatical/renderer` installed, this complete TypeScript example adds German, writes its text and direction, checks coverage and renders German MJML:

<<< @/snippets/localize-template.ts

`resolveLocale(content, locale)` is the projection behind every render: it applies text, overrides and settings, drops hidden blocks, strips the localization fields and sets `settings.locale` to the projected language. Missing values stay at the default. Save the original content, which keeps every version, not the projection. Preview shows the active language with the layout composed before `resolvePreview` runs, and switching language discards the previous language's result.

A custom block with any `text` or `set` entry in the requested language loses its cached default-language `renderedHtml` in the projection, so it renders through `renderCustomBlock`; without one it's omitted rather than shown in the default language. The editor's export renders it in the requested language. See [Custom block rendering](/api/renderer-typescript#custom-blocks).

## Data shape

`settings.locale` is the default language. `settings.locales?: string[]` lists the other versions, without duplicates or the default. Every key in `block.l10n` and `settings.l10n` must be in that list.

| Member | Contract |
| --- | --- |
| `block.l10n[locale].text` | `Record<string, LocalizedText>`; each value is `{ value: string; sourceHash: string }` |
| `block.l10n[locale].set` | `Record<string, unknown>` for URLs, images, styling and other overrides; `null` means the property is absent in that language |
| `block.l10n[locale].hidden` | `true` omits the block and its descendants from this language |
| `settings.l10n[locale]` | `SettingsLocaleLayer`: optional `text` (`preheaderText`) and `set` (such as `direction`, fonts and colors), without `hidden` |

Language tags must match `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`: 2–3 ASCII letters, followed by zero or more hyphen-separated subtags of 2–8 ASCII letters or digits. Forms beginning with `x-…` or `i-…` are rejected because their language segment has one letter; grandfathered forms such as `no-bok` and `zh-min-nan` match and are accepted.

A field path joins property names with `.`; at an array, the next segment is the element's `id`, never its index: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. A field id is `<blockId>/<path>` or `settings/<path>`. Menu item, social icon, table row and table cell ids must not contain `.` or `/`: `validateTemplate` reports them, and `addBlock`, `updateBlock` and `setContent` refuse an operation that adds one (a new block, item, row or cell) with `invalid_operation`. An id already in the template stays editable, so a template saved with one can still be edited; rename it to localize that element and to pass validation.

`text` holds human-readable fields only: the `TRANSLATABLE_FIELDS` of each block type (content, alt text, button text, countdown labels, menu item text, table cell content), the preheader, and custom `text` and `textarea` fields. Everything else, such as URLs, image sources, sizes and colors, is a `set` override. A path is in at most one of `text` and `set`. `set` can't replace section `columns` or whole built-in lists (`items`, `rows`, `rows.<id>.cells`, `icons`); override their element leaves instead. Empty layers and members are omitted, never stored as `{}` or `[]`. [Types](/api/types#localization) has the declarations and path rules.

## Layouts

An `init({ layout })` shell is composed around the template, outside it, so its text isn't part of the template. A layout can carry its own `settings.locales`, block `l10n` and `settings.l10n`, including the wrapper children beside the slot, independent of the template's languages. Preview, `toMjml()`, `toHtml()`, the test-email preview and `renderToMjml(content, { layout, locale })` project it with `resolveLocale(layout, locale, { missing: "default" })` before composing; a language the layout lacks shows the layout's default.

A language can't hide the layout's slot or a wrapper that contains it, because the layout couldn't compose that language: `updateBlockLocale` refuses `hidden: true` on them with `invalid_operation`, `moveBlock` and `addBlock` refuse placing the slot under a block a language hides, and `validateTemplate` reports such a layer. Hiding any other layout block works as in a template.

The editor never edits the layout. Its blocks have no selection, lint or status badge, Translate doesn't send them, and the language counts don't include them. Translate the layout file instead, for example with the CLI:

```bash
npx -y @templatical/template-tools edit layout.json --op '{"op":"addLocale","locale":"de"}' --json
npx -y @templatical/template-tools strings export layout.json --locale de --out layout.de.json
npx -y @templatical/template-tools strings import layout.json layout.de.json --json
npx -y @templatical/template-tools validate layout.json --locale de --json
```

Set each entry's `text` in `layout.de.json` between export and import, as in [Translating](#translating).

## Default language

`settings.locale` is the default language: the text every version falls back to and is translated from. To promote a version, open **Languages**, select the version's **More actions for {language}** and choose **Make default language**. The confirmation, **Make {language} the default language?**, counts the fields that have no text in that language, when there are any: "{count} fields have no {language} text and keep their {default} text." **Make default** applies the change as one undo step, switches the view to the new default and reports "{language} is now the default language."; undoing it removes that notice. The item is disabled, with the reason under it, while the current default isn't in `localization.locales` ("Add {default} to the enabled languages first"), because the old default would become a version nobody can edit or promote back; and while blocks are hidden in that language ("Show the {count} blocks hidden in {language} first"). It isn't offered in a read-only editor or for a version that isn't enabled.

The change is one operation, `{ "op": "setDefaultLocale", "locale": "de" }`:

- German's text and overrides become the base. English takes German's place in `settings.locales`, with its differing values in an English layer; text German had translated to the same value stays a current English translation.
- A field without German text keeps its English value, so the German email shows English there. `defaultLocaleGaps(content, "de", definitions?)` lists those field ids before the change; afterwards, `validate --locale en` reports them as `localization.untranslated`. English keeps no copy of those fields: after the change, editing one in the German default also changes the English email. Translate the gaps into German first, until `defaultLocaleGaps(content, "de")` returns `[]`. An empty default, such as a decorative image's `alt: ""`, has no text to keep and isn't a gap. Translate and `strings export` don't send HTML blocks: translate HTML blocks by hand in the German view.
- Other languages keep their state against the new base: current text is re-stamped and stays current; out-of-date text keeps its stored hash and stays out of date, unless that hash equals the promoted German value, in which case it becomes current.
- A version with hidden blocks is refused with `invalid_operation`; `localeHiddenBlocks(content, "de")` lists the blocks to show first. An unknown version is refused with `invalid_operation` too, and with collaboration any other session's lock refuses the change with `locked_by_others`.

`updateSettings` can't change `settings.locale` while versions exist, and AI in a language view can't run `setDefaultLocale`. [Operations](/api/operations#default-language) gives the re-stamped hashes, removed optional fields, the inverse and the refusal messages. Check the result: the saved file has `settings.locale` `"de"` with `"en"` in `settings.locales`, `template-tools validate template.json --json` reports `valid: true`, and `validate template.json --locale en --json` lists the remaining gaps as `localization.untranslated`, and only those: a field whose German text equalled the English keeps a current English entry.

## Comments

Comment threads are shared across languages. Every new comment and reply sends `CommentInput.locale`, the language of the view it was written in, the default's tag included; your [comments provider](/backend/comments#locale) stores it and returns `Comment.locale`. A comment without a tag, saved before language versions existed or by a comments backend that doesn't store `locale` (Cloud's doesn't yet), counts as the template's current default language and follows a change of the default; a tagged comment keeps its tag. With localization configured, every comment and reply shows a language badge, and **This language** in the comments panel shows the threads whose root or any reply is in the active language, with all their messages and badges. The filter is view state and isn't saved. Cloud's comments don't store the language yet.

## Subject lines

A template has no subject field: the subject line belongs to the host that sends the email, so Translate and `strings export` don't include it. Translate it with the same `TranslationProvider` as one `text` field: mask its merge tags and protected terms with `maskTags`, send it, and restore the answer with `unmaskTags`, which returns `null` when a placeholder is missing or changed. This complete TypeScript example needs `@templatical/types` and `@templatical/ai-kit`; replace the mock with the provider you pass to `init({ translation })`:

<<< @/snippets/translate-subject.ts

Pass the merge-tag syntax and `doNotTranslate` list your editor uses; the example uses `SYNTAX_PRESETS.liquid`. It prints <code v-pre>{{first_name}}, Ihre Sable-Bestellung ist unterwegs</code>. The field `id` is yours to choose; the provider returns it unchanged. Store each language's subject with the template in your own data.

## Operations and collaboration

| Operation | Effect |
| --- | --- |
| `addLocale` | Adds a version to `settings.locales` |
| `removeLocale` | Removes the version and every corresponding block and settings layer |
| `setDefaultLocale` | Makes a version the default; see [Default language](#default-language) |
| `updateBlockLocale` | Writes a block's `text`, `set`, `unset` paths and `hidden` for a language |
| `updateSettingsLocale` | Writes the settings' `text`, `set` and `unset` for a language |

Apply them with `applyOperations` and undo them with `invertOperations` from `@templatical/types`, run them through `template-tools edit`, or send them as a collaboration batch. Only these operations change localization fields: `updateBlock` and `updateSettings` refuse them, `addBlock` may carry a new block's `l10n`, and `setContent` replaces everything. A failed `expect` guard is `precondition_failed`; an invalid path, language or text field is `invalid_operation`. [Operations](/api/operations#locale-operations) gives the exact shapes, the order updates apply in and the undo guards.

`BlockLock.locale?: string | null` and `OperationLock.locale?: string | null` use `null`, or an absent value, for the default language and structure. A localized edit to (block X, `de`) conflicts with another session's lock on (X, `de`) or (X, `null`); a lock on (X, `fr`) can coexist. `updateBlock`, `moveBlock` and `deleteBlock` on X conflict with any other session's lock on X (a move or delete also with locks inside X), `addBlock` checks no locks, and `setDefaultLocale` conflicts with every lock. `onRemoteChange.locale` is the language of the batch's first locale operation, excluding `setDefaultLocale`, otherwise `null`; a `setDefaultLocale` batch reports `null` because it changes the template's default. See [Collaboration](/backend/collaboration) for the exact contracts.

## Compatibility

Existing single-language templates need no migration: they load, edit, save and render as before. Without `localization` there is no language UI, and existing layers survive default-language edits and saves. The editor writes localization fields only after an author adds a language.

All `@templatical/*` packages release together under one version number. Keep them on the same version: a renderer or validator from before language versions doesn't know `l10n`, so an older renderer renders the default language and an older validator rejects the template.

A collaboration backend you built yourself must apply the locale operations in the [Operations reference](/api/operations) and the lock `locale`; see [Collaboration](/backend/collaboration). Until it does, it rejects them as `invalid_operation`, and a backend that ignores the lock `locale` serializes edits per block. A comments backend you built yourself stores `locale`; see [Comments](#comments).

## Limits

- Column structure is shared across languages and can't be overridden per language. Column order follows each language's direction, so a right-to-left version shows the first column on the right, but explicit left and right text alignment and left/right padding aren't mirrored: override them per language.
- Text in a custom block's repeatable items can't be translated field by field, because the items have no ids. Override the whole `fieldValues.<key>` per language instead.
- Translate leaves out HTML blocks. Translate them by hand in the language view.
- Blocks the AI adds in a language view enter the shared tree with their text as default content, as a paste does. AI can't replace the whole template in a language view; switch to the default language for that.
- Comment threads are shared across languages. Each new comment and reply stores its view’s language tag through your comments provider; Cloud does not store it yet. Version history remains per template, not per language.
- The Cloud editor doesn't support language versions or translation yet: `initCloud()` ignores `localization` and `translation` and logs a warning.
- Strings are exchanged as JSON; XLIFF and CSV aren't supported.

## Check your work

For a saved `template.json`, check and render one language:

```bash
npx -y @templatical/template-tools validate template.json --locale de --json
npx -y @templatical/template-tools render template.json --locale de --format mjml --out template.de.mjml
```

`validate --locale de` validates every declared language's projection against the ordinary schemas, naming the language in projection errors, then lints the German projection, including `localization.untranslated`, `localization.stale` and `localization.merge-tags-differ`. Read the issues even on exit `0`: missing and out-of-date translations are warnings. After `strings import`, read its `rejected` list before validating.

| Exit | `validate` and `render` | `strings import` |
| --- | --- | --- |
| `0` | Success; warnings such as `localization.untranslated` and `localization.stale` can remain | No string was rejected (entries without `text` are skipped) |
| `1` | Invalid structure, an unknown locale, or for `validate` an error-severity lint issue or `localization.merge-tags-differ` (even with `valid: true`) | A string was rejected (the accepted strings are written), the template is invalid, or `targetLocale` isn't a version of it (nothing is written) |
| `2` | Misuse or a tool failure: a missing or empty `--locale` value, an invalid `--definitions` file, or for `validate` an exception inside lint | Misuse: missing arguments, or an unreadable or invalid strings, definitions or terms file |
| `3` | A missing optional dependency: `mjml` for `render --format html` and `validate --html` | Not used |

An unknown locale exits `1` and writes `unknown_locale` to stderr without a result document, including with `--json`. A missing or empty `--locale` value exits `2`. `valid: true` alone doesn't mean exit `0`. See [Template tools](/api/template-tools#exit-codes).

For custom-block translations, pass `--definitions definitions.json`, a JSON array of `CustomBlockDefinition`, to `validate`, `render` and both `strings` commands; rendering uses each type’s Liquid template and CSS. For the library route, use `validateTemplate(content, definitions)`, then `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })`, and supply `renderCustomBlock` for rendering. This complete TypeScript example requires `@templatical/types`, `@templatical/template-tools`, `@templatical/quality`, `@templatical/renderer` and `liquidjs`:

<<< @/snippets/localize-custom-block.ts

Check `validation.valid`, inspect `issues`, and confirm the MJML contains `Willkommen` rather than the cached `Welcome`. See [Custom block rendering](/api/renderer-typescript#custom-blocks) and the [CLI library API](/api/template-tools#library-use). For a translation backend, run `runTranslationConformance` as described in [the translation contract](/backend/translation#check-it).

## In the playground

The [Languages setup](https://play.templatical.com/scenes/languages) opens one template with German text, a different hero image, a block hidden in German, an out-of-date German value, a layout footer per language, and a recorded translation provider with Sable on the do-not-translate list. Switch to Deutsch and use **Translate {count} fields**, or **Re-translate** on the out-of-date block; edit German text, then return to English to check that it is unchanged. Choose **Keep** to clear an out-of-date badge, add French, or select Arabic to see right-to-left content. Its variants show a changed tag (`?translation=tags-changed`), partial results on Cancel (`?translation=cancel`), collaboration locks (`?collaboration=1&user=Ada`) and 300 blocks in 20 languages (`?scale=1`).
