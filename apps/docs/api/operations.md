---
title: Operations
description: The operation vocabulary the editor, the CLI, collaboration backends and Templatical Cloud share.
---

# Operations

An operation is one change to a template: add, move, delete or update a block, update the settings, or replace the whole content. The same six operations travel everywhere a template changes outside a single editor:

- **[Collaboration](/backend/collaboration)** — an editor with `init({ collaboration })` sends every edit to your backend as a batch of operations, and applies other people's batches.
- **The CLI** — `template-tools edit` applies them to a template file.
- **Templatical Cloud** — stores every batch with its revision, and AI agents connected to its MCP server edit with the same vocabulary through `edit_template`.

`applyOperations` from `@templatical/types` (MIT) applies them. Templatical Cloud's server runs an engine with the same rules, and a shared set of test cases keeps the two identical.

## The six operations

```json
{"op": "addBlock",       "block": {"id": "b2", "type": "paragraph", "content": "<p>Hi</p>", "styles": {"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}}}, "parent": null, "after": "b1"}
{"op": "moveBlock",      "blockId": "b2", "parent": {"sectionId": "s1", "column": 0}, "after": null}
{"op": "deleteBlock",    "blockId": "b2"}
{"op": "updateBlock",    "blockId": "b1", "set": {"content": "<p>Hello</p>"}, "unset": ["visibility"]}
{"op": "updateSettings", "set": {"width": 640}, "unset": ["preheaderText"]}
{"op": "setContent",     "content": {"blocks": [], "settings": {"width": 600, "backgroundColor": "#ffffff", "textColor": "#1a1a1a", "linkUnderline": true, "fontFamily": "Arial", "locale": "en"}}}
```

Engine acceptance of an operation does not replace schema validation: run `template-tools validate` on the resulting template.

A batch is a list of operations. It applies in order, each operation seeing the ones before it, and all or nothing: when one is refused, none of the batch applies.

### Positions

Positions name a sibling, never an index, so an operation means the same thing after someone else's change lands first.

- `parent` is `null` for the top level, or `{"sectionId": "…", "column": 0}` for a column of a section. `column` is a 0-based index into the section's `children`.
- `after` is the id of the block to land after, or `null` to land first. For `moveBlock`, the siblings are those of the target container with the moved block taken out.
- `parent` and `after` are required on `addBlock` and `moveBlock`, even when they are `null`.

### Sections and columns

- A section sits only at the top level. Adding or moving a section into a column is refused, and so is a new section with a section among its children.
- `deleteBlock` on a section deletes its blocks with it.
- `updateBlock` replaces each key in `set` whole, a `styles` object included, and removes the keys in `unset`. `id`, `type` and `children` can't be set or unset, and neither can a section's `columns` be unset.
- `set: {"columns": …}` on a section resizes its `children` to the layout's column count: `"1"` has one column, `"3"` has three, and every other layout (`"2"`, `"2-1"`, `"1-2"`) has two. Growing appends empty columns. Shrinking drops trailing columns only when they are empty, so move their blocks out first.
- A new block needs a non-empty string `id` and a string `type`, and every id in it, a new section's children included, must be new to the template.

### Preconditions

Any operation but `addBlock` and `setContent` can carry `expect`, which must hold before it applies. A mismatch refuses the operation with `precondition_failed`. Undo uses this, so an undo that someone else's edit has overtaken is refused instead of overwriting it.

- `updateBlock` and `updateSettings`: `expect` maps keys to their expected current values. `null` matches a `null` value or an absent key.
- `moveBlock`: `expect.parent` and `expect.after` are the block's current position. A key left out counts as `null`.
- `deleteBlock`: `expect.block` is the whole current block, children included, compared exactly.
- Values compare as JSON: object key order is ignored, arrays compare in order, and numbers by value, so `1` equals `1.0`. `set`, `unset` and `expect` given as `null` count as absent.

### Locks

A backend passes the locks it holds and the acting session: `applyOperations(content, ops, { locks, session })`, with `locks` as `[{ blockId, sessionId }]`.

- `updateBlock`, `moveBlock` and `deleteBlock` on a block another session holds are refused with `lock_held`. Moving or deleting a section also checks every block inside it.
- `setContent` is refused with `locked_by_others` while any other session holds a lock.
- With `session` set to `null` (a server-side change), every lock belongs to someone else.

<!-- locale-operations:start -->
## Locale operations

`addLocale`, `removeLocale`, `setDefaultLocale`, `updateBlockLocale` and `updateSettingsLocale` manage language versions in the SDK's shared tree. Upgrade the renderer, validator and collaboration backend before storing localized content.

The following batch starts with paragraph `b1` containing `<p>Original</p>`, default locale `en`, direction `ltr` and no language versions. It adds German, writes a German value, hides the block in German, overrides the direction, then removes German and its layers. `sourceHash` is `sourceHash("<p>Original</p>")`.

```json
{"op":"addLocale","locale":"de"}
{"op":"updateBlockLocale","blockId":"b1","locale":"de","text":{"content":{"value":"<p>Hallo</p>","sourceHash":"f898b751"}},"hidden":true}
{"op":"updateSettingsLocale","locale":"de","set":{"direction":"rtl"}}
{"op":"removeLocale","locale":"de","expect":{"blocks":{"b1":{"text":{"content":{"value":"<p>Hallo</p>","sourceHash":"f898b751"}},"hidden":true}},"settings":{"set":{"direction":"rtl"}}}}
```

| Operation | Contract |
|---|---|
| `addLocale` | `locale: string`; `position?: number` inserts into `settings.locales`, defaulting to the end. Position must be an integer from 0 through the current length. The default (`settings.locale ?? "en"`) and existing versions are refused case-insensitively. |
| `removeLocale` | `locale: string`; `expect?: { blocks: Record<string, BlockLocaleLayer>; settings?: SettingsLocaleLayer }` compares every layer exactly. `blocks` holds layers by block id; an absent id means no layer. The separate `settings` member holds the settings layer; absent means none. `expect: { blocks: {} }` requires no block or settings layers, including for a block named `"settings"`. Removes the locale and all its block and settings layers, including blocks inside columns. |
| `setDefaultLocale` | `locale: string`; an exact tag already in `settings.locales`. Promotes its text and property overrides to the base; the former default takes its list position and gets a layer for changed values. Missing fields keep their base values. Conflicts with every other session’s lock (`locked_by_others`). |
| `updateBlockLocale` | `blockId: string`; `locale: string`; `text?: Record<string, LocalizedText>`; `set?: Record<string, unknown>`; `unset?: string[]`; `hidden?: boolean`; `expect?: LocaleLayerExpect`. At least one change member must be present. |
| `updateSettingsLocale` | `locale: string`; `text?: Record<string, LocalizedText>`; `set?: Record<string, unknown>`; `unset?: string[]`; `expect?: Omit<LocaleLayerExpect, "hidden">`. At least one change member must be present. No hidden state or locks. |

`locale` must satisfy `isLocaleTag`: `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`. Tags outside that pattern, including `x-acme` and `i-klingon`, are refused. Every operation except adding a language requires its exact tag in `settings.locales`; invalid tags and unknown versions produce `invalid_operation`.

Base updates prune orphan locale entries; their inverse restores the base before restoring the pruned layer paths. Locale `set` overrides refuse section `columns`, menu `items`, table `rows` and `rows.<id>.cells`, and social `icons` with `invalid_operation`. Element leaf paths and custom `fieldValues.<key>` whole-field overrides remain allowed.

`LocalizedText` is `{ value: string; sourceHash: string }`. Text paths must match `TRANSLATABLE_FIELDS` for the block type, or `SETTINGS_TRANSLATABLE_FIELDS` (`preheaderText`) for settings, and resolve in the base. Paths use element ids, such as `items.i1.text`; menu item, social icon, table row and table cell ids must not contain `.` or `/`. A `set` path must resolve or have an existing object parent. Prototype segments (`__proto__`, `constructor`, `prototype`) and empty segments are refused. Block overrides cannot start with `id`, `type`, `children` or `l10n`; settings overrides cannot start with `locale`, `locales` or `l10n`.

The engine applies `unset` first (from both maps), then `text`, then `set`, then `hidden`. Writing a path in one map deletes it from the other. `hidden: false` removes the hidden flag. `hidden: true` on a layout's `slot` block, or on a block that contains it, is refused with `invalid_operation`, the block's `blockId` and `A layout's slot block, and any block that contains it, can't be hidden.`, because the layout couldn't compose that language. For the same reason, `moveBlock` and `addBlock` refuse placing the slot, or a block holding it, under a section a language hides, and `addBlock` refuses a new block whose own layers hide the slot it holds: `invalid_operation`, the placed block's `blockId` and `A layout's slot block can't be placed inside a block that a language hides.` Empty maps, layers and localization containers are omitted; removing the last version omits `settings.locales`.

`set: { path: null }` stores a clearing override: the property is absent in that language's `resolveLocale` projection. `unset: [path]` removes the override, so the default-language value applies again. Layers never store `undefined`; undefined `text` or `set` entries and text entries without string `value` and `sourceHash` are refused with `invalid_operation`. Every `unset` path must be non-empty and pass `isSafePath`, even if the base path no longer exists; safe orphan paths remain removable.

### Default language

`{ "op": "setDefaultLocale", "locale": "de" }` makes an existing German version the default. For blocks at every depth, including layout wrappers, and for settings, its `text` values and `set` overrides become the base (`null` removes a property). The old default's differing text becomes `text` stamped with `sourceHash` of the new base; other differing values become `set`. Equal values leave no entry, except text the promoted version translated to the same value: the old default keeps it as a current `text` entry, so it doesn't read as missing there. Gaps retain the old base without an old-default entry. `settings.locale` changes and the old default takes the promoted version's index in `settings.locales`.

Other languages' current text is re-stamped against the new base. Stale text keeps its stored hash; it becomes current if that hash matches the promoted value. If the new base has no value for a text path, the old default's value and other languages' text become `set` entries without staleness tracking. Property overrides whose parent disappears are consolidated at the nearest writable ancestor using that language's prior projected subtree, preserving its inherited properties and overrides. A custom block loses `renderedHtml` only when its `fieldValues` change.

`localeHiddenBlocks(content, locale): string[]` lists, depth first, the ids of blocks whose own `l10n[locale].hidden` is `true`; it also looks inside hidden blocks, so a hidden child of a hidden section is listed separately and needs its own `hidden: false`. It returns `[]` for the default or an unknown locale. `defaultLocaleGaps(content, locale, definitions?): string[]` lists translatable field ids with a nonempty default that keep the old base because the version has neither text nor an applicable property override. Stale text is promoted and is not a gap; neither is an empty default, as in `localeCoverage`. Both helpers are pure; pass custom-block definitions to count their text fields.

An unknown version or the current default is `invalid_operation`: `"<locale>" is not a language version of this template.` Hidden blocks refuse with `invalid_operation`, the first hidden `blockId`, and `<count> blocks are hidden in "<locale>". Show them before making it the default.` Any other session's lock refuses it with `locked_by_others`, as for `setContent`; `onRemoteChange.locale` is `null` for this operation. The checks run in that order: the tag, the version, hidden blocks, then locks, so hidden blocks win over a lock. AI batches in a language view refuse it.

`invertOperations` uses `setContent` to restore the exact prior content, including hashes, the promoted layer and cached HTML. Undo therefore has the same whole-template lock rule. A snapshot can't expect what it overwrites, so under collaboration the editor also records the content each such undo or redo step applies to, and skips the step (`undoSkipped`, `precondition_failed`) once this editor has received another session's batch after it, locked or not. A batch the backend committed but hasn't delivered yet is caught by the backend: it refuses a batch with a `setContent` whose `baseRevision` isn't the current revision ([Collaboration](/backend/collaboration#submit)). The undo of a `setContent` works the same way. Without other sessions' batches, undo and redo restore the content exactly. Submit the explicit operation through collaboration; a snapshot diff emits `setContent` for a default change.

### Clearing overrides

This separate batch starts with German already in `settings.locales`, block `b1` with `styles.backgroundColor: "#ffffff"`, and settings with `linkColor: "#1d4ed8"`. The first two operations make those properties absent in German. The last two remove the clearing overrides and restore the default values. The base values stay unchanged.

```json
{"op":"updateBlockLocale","blockId":"b1","locale":"de","set":{"styles.backgroundColor":null}}
{"op":"updateSettingsLocale","locale":"de","set":{"linkColor":null}}
{"op":"updateBlockLocale","blockId":"b1","locale":"de","unset":["styles.backgroundColor"]}
{"op":"updateSettingsLocale","locale":"de","unset":["linkColor"]}
```

`LocaleLayerExpect` is `{ text?: Record<string, LocalizedText | null>; set?: Record<string, unknown>; hidden?: boolean }`. Text and override guards compare the current layer's value, with absent values read as `null`. A hidden guard compares `layer.hidden === true`. A mismatch produces `precondition_failed`. Block locale updates check shape, the named block (`block_missing`), paths, locks, guards, then the change, which includes the slot rule.

A lock can carry `locale?: string | null`. An absent or `null` locale holds the default and structure. A block locale update conflicts with another session's lock on the same block and locale, or on its structure (`lock_held`, with `blockId`). Different locales coexist. Structural block updates, moves and deletes conflict with every locale lock on the affected blocks. Adding and removing locales and settings locale updates ignore locks.

Only the locale operations edit existing localization containers: `updateBlock` refuses `l10n` in `set` or `unset`; `updateSettings` refuses `locales` and `l10n`, and refuses setting or unsetting `locale` while versions exist (`invalid_operation`). `addBlock` may carry `l10n`, and `setContent` replaces everything.

`invertOperations` guards locale undo. Undoing `addLocale` requires empty layers. Undoing `removeLocale` restores the old list position, then the block and settings layers with empty-path guards. Locale update inverses restore both maps and hidden state, expecting the values left by the forward operation.

### Check it

Run `pnpm --filter @templatical/types exec vitest run tests/operations.test.ts tests/invert-operations.test.ts tests/set-default-locale.test.ts tests/locale-hidden-blocks.test.ts` for the shared fixtures and guarded undo cases. Run `template-tools validate` on the resulting template; engine acceptance alone does not validate the schema.
<!-- locale-operations:end -->

## Errors

A refused batch throws an `OperationError` with `code` and `opIndex`, the 0-based index of the refused operation.

| Code | When | Templatical Cloud answers |
|---|---|---|
| `block_exists` | A new block's id, or an id inside it, is already in the template | 409 |
| `block_missing` | The block, or the parent section, isn't there | 409 |
| `anchor_missing` | The `after` block isn't in the target container | 409 |
| `precondition_failed` | `expect` doesn't hold | 409 |
| `lock_held` | Another session holds the block | 409 |
| `locked_by_others` | Another session holds a lock, for `setContent` or a change of the default language | 409 |
| `invalid_operation` | The operation is malformed or can never apply | 422 |

### Which error wins

When one operation breaks several rules, the first failing check decides:

1. Its shape (`invalid_operation`): a malformed operation, a missing required key, a new section with a parent, `id`/`type`/`children` in `set` or `unset`, a section's `columns` in `unset`.
2. The blocks it names (`block_missing`, `block_exists`).
3. Locks (`lock_held`, `locked_by_others`).
4. Preconditions (`precondition_failed`).
5. Placement (`invalid_operation`): a section into a column, a block after itself.
6. The target container: `block_missing` for a missing parent section; `invalid_operation` for a parent that isn't a section or a column out of range.
7. The anchor (`anchor_missing`).
8. The change itself (`invalid_operation`): a layout that would drop columns that still hold blocks.

Element ids containing `.` or `/` are refused only where an operation adds one, and the check sits at a different step per operation: `addBlock` checks them with its shape (step 1), and checks no locks at all; `updateBlock` checks them as the change itself (step 8), after locks and preconditions; `setContent` checks them after its shape and before locks. The shared fixtures pin each case.

## Applying operations

```ts
import {
  applyOperations,
  OperationError,
  type Operation,
} from '@templatical/types';

const ops: Operation[] = [
  { op: 'updateBlock', blockId: 'b1', set: { content: '<p>Hello</p>' } },
];

try {
  const next = applyOperations(template.content, ops, {
    locks: [{ blockId: 'b4', sessionId: 'f7c1…' }],
    session: requestSessionId,
  });
  // store `next`
} catch (error) {
  if (error instanceof OperationError) {
    // error.code, error.opIndex
  }
  throw error;
}
```

`applyOperations` returns a new document and never changes the one you pass. `applyOperationsInPlace` changes it directly, for a copy you can throw away. `getColumnCount(layout)` is the layout rule above.

## In the CLI

```bash
npx -y @templatical/template-tools edit emails/welcome.json \
  --op '{"op":"updateBlock","blockId":"button_1","set":{"backgroundColor":"#1d4ed8"}}'
```

`--ops <file>` takes a JSON array for a batch. See [Template Tools](/api/template-tools).
