# @templatical/editor

## 0.29.0

### Minor Changes

- 09f6136: Provider objects now carry their own configuration and events

  Every BYO provider takes its outward events on the provider object itself, next
  to the storage methods, instead of as root config callbacks:

  ```ts
  templates:      { load, create, save,               onSaved, onCreated, onLoaded }
  comments:       { list, create, update, delete, setResolved, subscribe,
                    onCreated, onUpdated, onDeleted, onResolved, onUnresolved }
  savedBlocks:    { list, create, update, delete,     onCreated, onUpdated, onDeleted }
  versionHistory: { list, get, create, restore,       onCreated, onRestored }
  testEmail:      { send,                             onSent }
  ```

  Each provider's events and configuration are declared on a `<Feature>Options`
  type that `<Feature>Provider` extends, so a bundle of handlers can be typed and
  passed around on its own.

  Handlers fire once the editor has settled — template adopted, `isDirty` cleared,
  `isSaving` false — so a handler may navigate without tripping your own
  unsaved-changes guard, which a side effect inside `save()` cannot. A handler that
  throws is reported through `onError` and never fails the operation.

  **`onSaved` carries the trigger**: `manual` (Save button or Cmd/Ctrl+S),
  `autosave`, `rename`, `restore`, or `api`. Gate navigation on
  `trigger === "manual"` rather than `trigger !== "autosave"` — a rename commit and
  a save-before-restore are both real saves you almost certainly don't want to
  navigate on.

  **Comment handlers carry `{ origin: 'local' | 'remote' }`.** `local` means the
  mutation ran through this editor; `remote` means it arrived via `subscribe` —
  someone else, in another browser. A "new comments" badge should count `remote`
  only.

  Payloads worth noting: `savedBlocks.onDeleted` receives the removed block, not an
  id, and emits nothing when the id was never loaded locally.
  `versionHistory.onRestored` receives the resulting `Template`, not the version it
  was restored from.

  ## Breaking

  | Before                             | After                                                                     |
  | ---------------------------------- | ------------------------------------------------------------------------- |
  | `onComment: (e) => …`              | `comments: { onCreated, onUpdated, onDeleted, onResolved, onUnresolved }` |
  | `autoSave: { debounce: 5000 }`     | `templates: { autoSave: true }` + root `changeDebounce: 5000`             |
  | `unsavedChangesGuard: false`       | `templates: { unsavedChangesGuard: false }`                               |
  | `templateNameField: false`         | `templates: { nameField: false }`                                         |
  | `TemplatesEvents`                  | `TemplatesOptions`                                                        |
  | `CommentEvent`, `CommentEventType` | removed — match on the handler name                                       |
  - **`autoSave` is `boolean` only.** Its cadence is the root `changeDebounce?: number`,
    because one timer paces both the save and the `onChange` notification, and
    `onChange` fires with no `templates` provider at all. Set `changeDebounce` alone
    to pace `onChange` by itself.
  - `CommentChange` — the _inward_ shape a `subscribe` implementation reports — is
    unrelated and unchanged.

  ### A transport that echoes your own writes no longer double-fires

  A store whose `subscribe` reports your own write back (Pusher's default, most SSE
  fan-outs) used to fire `onComment` twice for one comment. A remote change is now
  emitted only when it actually alters the loaded list.

  **If you de-duplicated by comment id to work around this, remove it** — unless
  your transport can echo a write back _before_ your mutation's own response
  resolves. In that ordering the echo is applied first as `origin: 'remote'` and
  your local call still emits `origin: 'local'`, so keep de-duplicating. Everywhere
  else the guard now discards real information: a second event on the same comment,
  such as an edit after its creation, arrives once.

### Patch Changes

- @templatical/media-library@0.29.0
  - @templatical/quality@0.29.0
  - @templatical/renderer@0.29.0

## 0.28.1

### Patch Changes

- cafb5c1: Preview surfaces render the template's background colour

  The test-email dialog, the saved-blocks browser and the save dialog's reorder rows painted the editor's neutral canvas surface regardless of `settings.backgroundColor`, so a coloured email body read as unset in the preview shown immediately before sending.

  Each of those surfaces now draws the body colour the way the canvas does: a stage carrying the background, with a band of it on each side of the content column, mirroring how `mj-body background-color` renders around the centred content when the email is sent. A block with no fill of its own shows the body colour through it, and the test-email dialog widened to leave the band room to appear.

- @templatical/media-library@0.28.1
  - @templatical/quality@0.28.1
  - @templatical/renderer@0.28.1

## 0.28.0

### Minor Changes

- 2cacdbc: Image and video blocks take an explicit height

  Reported on #594: the editor had no height input for images. It wasn't a missing control — `ImageBlock` had nowhere to put a height, so neither the toolbar, the canvas, nor the renderer could carry one.

  `ImageBlock.height` and `VideoBlock.height` are new optional pixel numbers. Absent means the height is derived from the width, which is the existing behaviour and stays the default for every template: no migration, and a new block still keeps its aspect ratio.

  The toolbar control has two modes — Auto and Custom — rather than a bare number field, because `Number("")` is `0` and a stored `0` has to stay distinguishable from "no opinion". Custom seeds 200px; switching back to Auto clears the field. Empty, zero and negative input keep the last valid height instead of committing, the same guard the custom width input carries (#259).

  The renderer emits `height="Npx"` on `mj-image`, and omits the attribute entirely when unset so MJML applies its own `auto`. The px suffix is load-bearing: `height` is a Unit attribute accepting only `px` or `auto`, so a bare number is a validation error and MJML drops it silently. Compiled through MJML, the value lands in both the `<img>` inline style (webmail) and its `height` attribute (Outlook) — locked by `mjml-image-height-roundtrip.test.ts`.

  All three importers now carry a source height across instead of dropping it: `import-html` from the `<img>`'s `height` attribute or its `height` style, `import-unlayer` from `src.height`, `import-beefree` from `image.height` — plus the BeeFree video thumbnail's `style.height`. `auto` and any non-positive value are read as "no height", which is what a responsive source template means by them. Nothing gains a default: an imported template with no stated height still derives it from the width, exactly as before.

  Width and height together **stretch** the image; they never crop. `object-fit` is unsupported in Outlook and most email clients, so the editor canvas stretches identically rather than previewing a crop the inbox won't deliver.

### Patch Changes

- Updated dependencies [2cacdbc]
  - @templatical/renderer@0.28.0
  - @templatical/media-library@0.28.0
  - @templatical/quality@0.28.0

## 0.27.6

### Patch Changes

- de2d670: Dialogs no longer get clipped when the host page traps fixed positioning

  Reported on #575 as tall dialogs being cut off with no way to scroll to the buttons. The dialogs were already capped and internally scrollable — the cap was measuring the wrong box.

  `TplModal`'s backdrop is `fixed; inset: 0`, which covers the viewport only while nothing traps it. Any ancestor with `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change: transform`, `contain: paint`, `container-type`, or a running transform animation becomes the containing block for fixed descendants, and the editor is a component mounted inside someone else's markup. When one of those sits above it, `inset: 0` resolves to that ancestor's box while a `vh` cap on the panel still resolves to the viewport. Measured in a 420px-tall host inside a 720px viewport: a 648px panel (90vh) clipped ~113px at the top and the bottom by the host's `overflow: hidden`, with the panel's own `overflow-y: visible` leaving no scrollbar to reach Send.

  Every panel now caps against the backdrop instead — `max-h-[90%]` / `max-h-[80%]`, the same proportions the `vh` values expressed, so an untrapped editor looks exactly as it did. Percentages need an unbroken chain of definite heights, so the bare wrapper `TplModal` put between the backdrop and the panel now spans the backdrop's height; it stays shrink-to-fit horizontally, which is what keeps shrink-to-fit dialogs (the collapsed test-email form) from inflating to their `max-w-*`. The gutter moved from each panel's `mx-4` onto the backdrop's padding, so it also acts as a floor when the host box is small enough for a percentage gutter to vanish.

  Applies to the test-email dialog, the save-block and saved-blocks-browser dialogs, the merge-tag and logic-tag pickers, the restore-version dialog, and the Cloud save gate. The two `100vw`/`92vw` width caps went the same way for the same reason. `RestoreVersionDialog` was uncapped entirely and now scrolls rather than clipping.

  `@templatical/media-library` had the same mismatch in all four of its modals — the library itself, and the edit / replace / import-URL dialogs — and it matters there for the same reason: `MediaLibraryModal` teleports into the editor's `popoverTarget`, so it lands inside a consumer's markup too. `MediaReplaceModal` and `MediaImportUrlModal` were uncapped entirely and now scroll. Separately, `MediaLibraryModal`'s overlay had no centring at all — a 900x650 panel as a plain block child of `fixed; inset: 0`, so it rendered pinned to the viewport's top-left corner. It is now centred, which is also what makes its percentage cap resolve.

  The rule is locked structurally by `overlay-height-scope.test.ts` (editor) and `overlay-height-scope-audit.test.ts` (media library), and behaviourally by `modal-height-clamp.spec.ts`, which arms a real fixed-position trap and asserts the panel and its Send button stay inside it.

- Updated dependencies [de2d670]
  - @templatical/media-library@0.27.6
  - @templatical/quality@0.27.6
  - @templatical/renderer@0.27.6

## 0.27.5

### Patch Changes

- 1668d1a: The header's Viewport, Dark mode and Preview controls now hold their position for the whole session

  Entering preview mode added the Sample / Label switch to the header's centre group, and that group is an `auto` grid track between two equal `1fr` columns — so it is centred, and any width change redistributes symmetrically about the header's centre. Measured: the switch plus its gap added 229px, and Viewport, Dark mode and **Preview** each jumped 114.5px left while the version-history menu jumped 114.6px right. Leaving preview mode meant hunting for a button half a switch's width from where it had just been (#574).

  Note the reported cause was the opposite of the real one: the switch already rendered _after_ the Preview button, and the button moved _left_. DOM order is irrelevant here — a centred track moves everything when it changes width, whichever side of the change it sits on.

  The fix is the invariant rather than the instance: **the centre track now carries only the three view controls, and nothing in it may be conditional.** Conditional controls moved to the edge-anchored columns, which grow away from their anchored edge and so move nothing already in them:

  - The **Sample / Label switch** now floats at the top of the canvas, in the same zero-height overlay layer as the "Show all hidden blocks" pill (which moved down to make room). Absolutely-positioned children in a zero-height layer have no layout coupling, so neither pill can move the other, and the switch's width no longer reaches the header at all.
  - **Version history** moved to the left column, joining the template name and its write time as "which template, and which version of it".
  - Cloud's **collaborator bar** moved to the left column too. This was the worse case: it sits in the header for the whole session and changes width whenever somebody joins or leaves, so it slid the Preview button out from under the cursor with no user action at all.

  The `center-extras` slot is gone rather than left empty — a slot is the one thing a guard test cannot stop someone filling.

  **The two canvas pills now read as one family.** They share the overlay, so they had to: the "Show all hidden blocks" pill was hand-rolled at 30px with `rounded-full` and a filled amber surface, against the switch's 38px `--tpl-radius-sm` box. It now uses a shared `warningBtnCompactClass`, shaped like the existing danger skin — `--tpl-bg` fill, `--tpl-warning` border, the house's muted-at-rest label, and the amber fill arriving on hover instead of sitting there permanently.

  That also retires a legibility defect. The old pill painted `--tpl-warning` on `--tpl-warning-light`, which is **1.85:1** in light mode. Putting the amber on the label instead — the literal reading of the danger skin — would only have reached 2.11:1, because `--tpl-warning` is a light amber (76.9% L) where `--tpl-danger` is a mid red. The amber therefore carries on the border and the label stays muted: **5.93:1 light, 5.99:1 dark.**

  Both pills sit in one centred column in the overlay rather than at fixed offsets. Fixed offsets were tried and were wrong: pinning the restore pill low enough to clear the switch left it there when it rendered alone, which in editing mode — where the switch never shows — dropped it onto the first block's content.

  Nothing changes for consumers: no public API, config key or CSS class was added, removed or renamed. The relocated controls keep their `data-testid`s.

- @templatical/media-library@0.27.5
  - @templatical/quality@0.27.5
  - @templatical/renderer@0.27.5

## 0.27.4

### Patch Changes

- 1a3dddc: The sidebar rail collapses again after a palette entry is clicked

  Clicking a block in the palette left the rail stuck expanded: moving the pointer back to the canvas did nothing, and only a completed drag&drop released it (reported on #568). Because the expanded rail is 200px and overlays the canvas — `.tpl-body` starts at the collapsed 48px — it covered the block the click had just scrolled into view.

  The rail suppresses its `mouseleave` collapse while a drag is in flight, so the fallback ghost isn't stamped with a mid-transition rect. That guard was set on Sortable's `choose` and cleared only on `end` — but `end` is not the counterpart of `choose`: Sortable gates it on `Sortable.active`, which only a drag that actually started ever sets. A click emits `choose` + `unchoose` and stops there, so the first click latched the guard on for the rest of the session. It is now cleared on `unchoose` as well, which fires on every release, at drop time — after the ghost rect has been captured, so the drag defense is unchanged.

  The rail also no longer collapses out from under a keyboard user: while an entry inside it has `:focus-visible`, `mouseleave` leaves it open and focus leaving is what closes it. Collapsing to the 48px icon strip otherwise hides the label of the entry the user has focused. The test is `:focus-visible` rather than `:focus` on purpose — a mouse click leaves the clicked button focused, so `:focus` would pin the rail open exactly as the latched guard did.

- @templatical/media-library@0.27.4
  - @templatical/quality@0.27.4
  - @templatical/renderer@0.27.4

## 0.27.3

### Patch Changes

- ac21de3: Clicking a block in the sidebar palette now inserts it directly below the selected block, and scrolls it into view

  Previously a palette click always appended to the end of the template. On anything longer than a screen the new block landed below the fold and the canvas never moved, so the click read as though it had failed (#568).

  Insertion now follows the selection, the same rule `duplicateBlock` already used:

  - A top-level selection gets the new block immediately after it.
  - A selection nested in a section column gets it in that same column, right after it.
  - Adding a **section** while a nested block is selected places it beside the parent section at the top level — MJML forbids `mj-section` inside `mj-column`, so the column would have rejected it outright.
  - No selection, an unresolvable selection, or a section locked by a collaborator still appends at the end.

  Separately, the inserted block is now scrolled into view (`block: "nearest"`, so an already-visible block doesn't jump, and instantly under `prefers-reduced-motion`). This covers the append-at-the-end case too, where the position is correct but the canvas still needs to follow. The Issues panel's **Jump to block** button gained the same scroll — it selected the block without moving the canvas, so on a long template it also appeared to do nothing.

  Click-to-insert is unchanged as an affordance; it remains the only keyboard-reachable way to add a block (Enter/Space on a focused palette entry), which is why it was not replaced with a drag-only flow.

- @templatical/media-library@0.27.3
  - @templatical/quality@0.27.3
  - @templatical/renderer@0.27.3

## 0.27.2

### Patch Changes

- 47dd5a5: Fix: bare merge-tag tokens in loaded and imported content now behave as merge tags.

  A merge tag reaches stored content in one of two physical shapes, and only one of them worked. Anything a user types or pastes becomes a `<span data-merge-tag>` node on the spot, via `MergeTagNode`'s input and paste rules. Content that never passed through that pipeline keeps its bare `{{first_name}}` — and a bare token renders as literal text: no label, no highlight, no `sample` substitution, and deletable one character at a time instead of as a unit.

  That is every template you load rather than type. Most sharply, a template migrated through `@templatical/import-beefree` / `-unlayer` / `-html`, which is typically full of tokens and has none of them as nodes — the exact case the importers exist for. It also covers a consumer's own stored templates, which is how it was first reported (#543, #548): the pill "must show its human-readable label … never the raw `<% ... %>` syntax".

  Bare tokens are now converted as content comes in, on every path consumer content arrives through. There is nothing to call and nothing to enable:

  | Path                                           | When                                            |
  | ---------------------------------------------- | ----------------------------------------------- |
  | `init({ content })` / `initCloud({ content })` | before mount                                    |
  | `editor.setContent(content)`                   | before the content reaches the canvas           |
  | `editor.create({ content })`                   | before the content becomes editor state         |
  | `editor.load(id)`                              | as the `templates` provider's result comes back |
  | version history preview / restore              | as each version reaches the canvas              |

  Version history matters more than it looks. A version written _after_ this ships is already normalized, but every version already in your store predates it — as does anything a backend versioned from an imported template. Previewing one of those would put bare tokens back on a canvas where every other tag is a chip. Previews still do not mark the template dirty.

  Matching is driven by the configured `syntax` rather than by the `tags` array, so a migrated template's tags become atomic before you have declared them all; an undeclared token shows its own raw value as its label. This mirrors typing, where the input rules already match on syntax alone.

  ### Attribute-positioned tokens are left alone

  Only text is converted. This is the property the whole approach is built around, not a refinement of it:

  ```html
  <!-- in  -->
  <p>Hi {{first_name}} — <a href="{{unsubscribe_url}}">unsubscribe</a></p>

  <!-- out -->
  <p>
    Hi <span data-merge-tag="{{first_name}}">First Name</span> —
    <a href="{{unsubscribe_url}}">unsubscribe</a>
  </p>
  ```

  The removed `restoreMergeTagMarkup` got this wrong because a regex cannot tell text position from attribute position — its lookbehind guard left `href="<span data-merge-tag=…>Unsubscribe URL</span>"`. The replacement parses the fragment and walks text nodes only, so an attribute value is unreachable rather than merely guarded. It is idempotent for the same structural reason: the walk rejects the subtree of any element already carrying `data-merge-tag`, so re-running cannot see an existing tag's inner text — including when a tag's label _is_ its value.

  Spans are built as real elements via `setAttribute` / `textContent`, never by string concatenation, so a syntax whose delimiters contain `<` / `>` (Smarty-style `<% $email %>`, the #543 case) round-trips instead of emitting markup no scanner can re-read.

  ### Fields deliberately not converted

  Only `TitleBlock.content` and `ParagraphBlock.content` are rich text. Button text and URLs, image `src`/`alt`, `HtmlBlock.content`, custom-block field values and `settings.preheaderText` are rendered as text — a span written into one would be displayed literally on the canvas and emitted into a `url=` attribute. They keep their bare tokens and are unaffected.

  `TableCellData.content` is excluded too, despite the renderer treating it as span-bearing: `TableBlock.vue` writes a cell's `innerText` back on blur, so a converted cell would persist its markup as literal text the first time a user focused and left it. The editor/renderer asymmetry there is a separate pre-existing gap.

  ### `getContent()` is no longer an identity round-trip

  If a template you load contains bare tokens in title or paragraph content, what `getContent()` returns contains spans instead. Nothing is written to your store unless you save, and a load that converted does **not** mark the template dirty — conversion happens on the way in, so core is handed content that is already correct and never observes a mutation. But if you diff or checksum stored templates, expect one-time churn on the affected ones.

  Rendered output is unaffected. `toMjml()` / `toHtml()` replace a tag node with its token, so a converted template and its bare-token original compile to byte-identical MJML — asserted directly rather than assumed.

  One caveat for `resolvePreview` implementations: your callback now receives spans where an imported template previously gave it bare tokens. A resolver that already handles typed tags needs no change, but a naive `replaceAll('{{first_name}}', 'Grace')` would now also hit the token inside `data-merge-tag="{{first_name}}"` and silently produce a tag that renders its label. Match on the tag markup, not the raw token.

- Updated dependencies [99de7a2]
  - @templatical/renderer@0.27.2
  - @templatical/media-library@0.27.2
  - @templatical/quality@0.27.2

## 0.27.1

### Patch Changes

- 18f6b38: Fix: the media library could not mount at all on 0.27.0 — in either mount mode.

  0.27.0 moved `authManager` / `projectId` / `planConfig` to props and had `MediaLibraryModal` re-provide the plan config under `PLAN_CONFIG_KEY` for its descendants, while `useMediaCategories()` was given a named throw for the no-provider case. Both host shells then called `useMediaCategories()` with no argument — and **a component never sees its own `provide`**, because Vue resolves `inject` against the _parent_ chain. So the new throw fired in the very components that supplied the value:

  ```
  [Templatical] useMediaCategories() needs a plan config in scope.
  Render it under <MediaLibraryModal> (pass its `planConfig` prop) …
  ```

  This hit the editor path (`initCloud()`) **and** the standalone SDK, which had worked before 0.27.0 — its `useMediaCategories()` previously injected the bare string `"planConfig"` that `standalone/MediaLibrary.vue` provided. `useMediaCategories(planConfigOverride?)` now takes the value explicitly, which both shells pass; descendants inject exactly as before.

  Two further key-identity faults in the same file are fixed with it, both invisible until the modal could mount:

  - **Translations.** `useI18n()` injected the bare string `"translations"`, which never resolves the `Symbol` `@templatical/editor` provides under the same name — so a host-mounted modal got `undefined` and threw on its first of 28 `t.mediaLibrary.*` reads. Strings now cross the package boundary as a **`locale` prop** on `MediaLibraryModal`, which loads its own translations and provides them under a `Symbol`; `useI18n()` falls back to bundled English rather than asserting non-null.
  - **Dark mode.** Four components injected the bare string `"tplUiTheme"`, so `data-tpl-theme` was always `undefined` and the library rendered light inside a dark editor. `MediaLibraryModal` takes a `uiTheme` prop and provides it for the three sub-modals, which teleport out of its DOM.

  `initCloud()` consumers get all of this by upgrading — `CloudPanels` forwards `locale` and the resolved UI theme automatically.

  ### Breaking — only if you mount `MediaLibraryModal` yourself

  Both new props are optional, so nothing is required. Pass them to get the behaviour the editor gets:

  ```vue
  <MediaLibraryModal
    :visible="open"
    :locale="locale"
    :ui-theme="resolvedTheme"
    :auth-manager="authManager"
    :project-id="authManager.projectId"
    :plan-config="planConfig"
    @select="onSelect"
    @close="open = false"
  />
  ```

  Omit `locale` and it loads English; omit `uiTheme` and no `data-tpl-theme` is stamped. If you called `useMediaCategories()` from a component that _also_ provides `PLAN_CONFIG_KEY`, pass your value: `useMediaCategories(planConfig)`.

  The regression escaped because no test or e2e had ever mounted either shell — the standalone suite mocks Vue's `createApp` wholesale, and the plan-config audit exercised the composable through an app-level `provide`, the one topology where self-injection works. Both shells are now mounted in tests, and the package's injection audit bans _any_ bare-string `inject` rather than an enumerated list of names.

- 18f6b38: Four field indicators that were translated but rendered nothing now say what they mean.

  Each had its string sitting in all seven locales, bound nowhere — a control on screen carrying no text:

  - **The required asterisk** (`FieldWrapper`) was a bare `<span>*</span>`. An asterisk announces as "asterisk" or as nothing, so a screen reader user could not tell a field was required. The glyph is now `aria-hidden` with `customBlocks.fields.required` carried alongside it and on `title`.
  - **The read-only lock** was a bare icon. It reuses `customBlocks.dataSource.readOnlyTooltip` — the string the seven field components already put on the input — rather than a new key, because `readOnly` here is only ever `field.readOnly && block.dataSourceFetched`, so "loaded from your data source" is the actual reason and a generic "Read-only" would say less.
  - **The minimum-items message** (`RepeatableField`) never appeared: `!canAdd` rendered `maxItemsReached`, while `!canRemove` silently dropped the Remove button. `customBlocks.fields.minItemsRequired` now mirrors it, with its `{count}` filled in. Both render together for a fixed-length list (`minItems === maxItems`) — that pair is what says the length is fixed.
  - **The image placeholder tooltip** (`ImageToolbar`) bound `placeholderUrl` and `placeholderUrlPlaceholder` but not `placeholderUrlTooltip`, which `VideoToolbar` had carried on its own placeholder field all along. The field explains itself now: the real image comes from the merge tag at send time, so this is a design-time stand-in that never ships.

  `image.optional` is a new key. The hint beside that same field was a hardcoded `"(optional)"` — the last hardcoded UI string in the editor — so every non-English locale showed English there. It copies each locale's existing `video.optional`, so no translation was invented.

  Nothing changes for anyone whose custom blocks set neither `required`, `readOnly`, nor `minItems`.

- 18f6b38: Remove dead code, dead translations, and comments that only recorded history.

  ### Breaking — `restoreMergeTagMarkup` is removed from `@templatical/types`

  It converted raw `{{ tag }}` tokens in stored HTML back into `<span data-merge-tag>` markup, and nothing in the SDK called it. It was also **unsafe**: its only guard was a literal `data-merge-tag="` lookbehind, so a token in any other attribute had an element injected into the attribute value —

  ```html
  <a href="{{unsubscribe_url}}">
  <!-- became -->
  <a href="<span data-merge-tag="{{unsubscribe_url}}">Unsubscribe URL</span>">
  ```

  — which is worse than the bare token it was meant to fix. Position-awareness needs parsing, not better lookarounds, so the fix is a parse-based replacement rather than a patch to this function. If you were calling it, stop: it corrupts attribute-positioned tokens. Its private `escapeRegExp` helper went with it.

  ### Breaking — `_internal` is removed from `@templatical/import-html`

  A test-support barrel (`export const _internal = { convertButton, … }`) that the tests had stopped using. Removing it revealed `convertSpacer` as reachable only through it — a line-for-line duplicate of the live `buildSpacerFromCell` in `section-builder.ts`, which is what actually converts spacer cells. Both are gone; conversion output is unchanged.

  ### Smaller locale chunks

  **772 unused translation strings** removed across ten locale files. The bulk was an 81-key `mediaLibrary` block in the editor's own OSS locales — a key-for-key duplicate of `@templatical/media-library`'s, read by nothing, which every OSS consumer downloaded for a package they do not install. The rest were strings for UI that was never built: a 23-key `aiRewrite` block (the composable is headless and unaffected), add/remove row and column labels for a table toolbar that uses number inputs, singular `social.platform`/`social.url` beside the live plural `social.platforms[…]`, and video platform names nothing renders.

  Every OSS session fetches exactly one locale chunk, so this is a direct **~1.1 KB gzip (−14%)** off it; cloud locales drop 18–19%.

  Nothing in the public API changes: `init()` accepts only `locale`, with no way to supply or type against these keys.

  A new guard (`i18n-key-usage.test.ts`) now checks locale ↔ source agreement in both directions — no reference to a missing key, no key without a reader — which the existing locale-parity test and `typecheck` both structurally miss, since each compares locales to _each other_ or derives the type from `en.ts`.

- Updated dependencies [18f6b38]
  - @templatical/media-library@0.27.1
  - @templatical/quality@0.27.1
  - @templatical/renderer@0.27.1

## 0.27.0

### Minor Changes

- d256b41: Comments become a bring-your-own provider, and the editor learns who is using it.

  `init()` takes a new `comments?: CommentsProvider` key. Configure it — together with the new top-level `user` key — and the editor grows a review panel: threads with replies, per-block anchors, resolve and reopen, a count badge on every commented block. Omit it and none of that UI is downloaded.

  ```ts
  init({
    container,
    templates: myTemplatesProvider,
    user: { id: "u_7", name: "Ada Lovelace" },
    comments: {
      list: (templateId) =>
        fetch(`/api/templates/${templateId}/comments`).then((r) => r.json()),
      create: (templateId, input) =>
        fetch(`/api/templates/${templateId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }).then((r) => r.json()),
      update: (templateId, commentId, patch) =>
        fetch(`/api/templates/${templateId}/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).then((r) => r.json()),
      delete: async (templateId, commentId) => {
        await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
          method: "DELETE",
        });
      },
      setResolved: (templateId, commentId, resolved) =>
        fetch(`/api/templates/${templateId}/comments/${commentId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved }),
        }).then((r) => r.json()),
    },
  });
  ```

  `list` is the operation and cannot be disabled; `create`, `update`, `delete` and `setResolved` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method. Withhold all four and you get a genuine read-only review: threads and replies render, jump-to-block works, and the composer, resolve, edit and delete affordances are **absent** rather than disabled. The composable rejects a withheld mutation rather than no-opping, because a resolved promise reads as "saved" to whoever awaited it.

  **`setResolved` takes the target state, not a toggle** — idempotent, so two clicks in flight can't leave a thread inverted. The editor reports whatever your store returned rather than what it asked for, so a store that refuses to reopen a thread is believed.

  ### `user` — a new top-level config key

  ```ts
  init({ container, user: { id: "u_7", name: "Ada Lovelace" } });
  ```

  Comments are the first feature to need "who are you" (the panel compares `user.id` against each comment's `author.id` to decide what may be edited or deleted), and collaboration presence will want the same answer — so it is a top-level key rather than part of the comments provider, where a second copy would inevitably drift.

  **With no `user`, comments report themselves unavailable — never anonymous.** No trigger, no panel, no indicators. An unattributable comment is worse than no comment feature, the same reasoning that makes an explicitly empty `TestEmailProvider.allowedRecipients` disable test email rather than fall through to free text. Not a security boundary: attribute writes server-side.

  ### Realtime is optional

  `CommentsProvider.subscribe` is optional and pushes remote changes into the open panel. **Comments without it work identically** — you simply see a colleague's on the next read rather than immediately:

  ```ts
  subscribe: (templateId, onChange) => {
    const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
    source.onmessage = (e) => onChange(JSON.parse(e.data));
    return () => source.close();
  },
  ```

  Your own writes may echo back through it with no de-duplication on your side: a `created` for a comment already in the list is ignored, and an `updated` replaces it in place.

  ### `initCloud()` rejects a consumer-supplied `comments`

  Exactly as it rejects `templates` and `versionHistory`: a comment is keyed to a template id Cloud issued, and its author is signed by the auth token, so Cloud owns the conversation. One passed from JavaScript is ignored with a console warning. `initCloud()` takes no `user` key either — it fills `init({ user })` from the token's `user` claim, the same claim its backend verifies. Switch the feature off with `commenting: false`.

  Cloud's availability now folds three conditions, none implying another: `commenting: false`, the `commenting` plan feature, and **the template being saved** (Cloud anchors a comment server-side). The last is new — the button previously rendered before the first save.

  ### Breaking — the comments API

  | Before                                                                            | After                                                                                                                                                       |
  | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Comment` (`@templatical/types`) — snake_case                                     | `CommentResponse` — still Cloud's wire shape. The contract shape is the new camelCase `Comment`                                                             |
  | `CommentThread`                                                                   | **Removed.** It was an alias for `Comment`                                                                                                                  |
  | `useComments` (`@templatical/core/cloud`)                                         | `useComments` in `@templatical/core`, shared by both tiers, taking a `provider` + `getUser` instead of an `authManager`                                     |
  | `loadComments` / `addComment` / `editComment` / `removeComment` / `toggleResolve` | `load` / `create` / `update` / `remove` / `setResolved` — and each **rejects** on failure instead of returning `null`/`false`                               |
  | `useCommentListener({ comments, channel })` (`@templatical/core/cloud`)           | `useCommentListener({ comments, provider, getTemplateId })` in `@templatical/core` — driven by the provider's `subscribe`, so it knows nothing about Pusher |
  | `CommentBroadcastPayload`                                                         | **Removed.** Cloud's broadcast shape is internal to its adapter now                                                                                         |
  | `comments.*` translation keys (cloud chunk)                                       | `comments.*` in the **OSS** chunk, in all seven OSS locales                                                                                                 |

  `CommentEvent` / `CommentEventType` keep their names and now carry the camelCase `Comment`. New export: `createCloudCommentsProvider` (plus `RealtimeChannel`, the structural channel shape its `subscribe` binds — named structurally so the optional `pusher-js` peer stays optional).

  Two dead translation keys (`comments.addComment`, `comments.resolved`) were dropped rather than carried across, and `comments.jumpToBlock` replaces the one hard-coded English string the panel had.

  ### Shared rather than cloud-only

  `CommentsSidebar` moved out of `cloud/components/`, the Comments trigger moved from `CloudHeaderExtras` into the shared header, and both are lazily loaded behind the capability — so an OSS consumer without a provider pays nothing for them. `capabilities.comments` is now built by the shared feature and gained `isAvailable`, `unresolvedCount` and the four `can*` flags.

- d256b41: **The `initCloud()` collapse — heavily breaking.** `initCloud()` is now a thin adapter-wiring wrapper over `init()`: it authenticates, fetches the plan, builds Cloud's providers, and delegates. One `Editor.vue`, one `useEditor`, one header. Read every bullet below — `minor` is the breaking channel on a 0.x line, and it still under-states this.

  **`TemplaticalCloudEditor` is now `TemplaticalEditor`.** The two entry points return the same type, which is the proof the unification worked. Three cloud-only members went with it:

  - `create(content)` → `create({ name?, content? })`, matching `init()`.
  - `setThemeOverrides(overrides)` — **removed.** `config.theme` is applied at init on both entry points, and the entitlement that gated changing it later is gone.
  - `sendTestEmail(recipient)` — **removed.** The shared test-email dialog is the supported path.

  **`initCloud()` rejects on a failed bootstrap** instead of mounting an editor that shows an error overlay. Auth, the health check and the plan fetch now run _before_ the mount, so a session that cannot authenticate never produces an editor. Handle it like any other rejected promise. A session that dies _later_ — a token refresh that cannot renew — still surfaces as an overlay. The 30s "initialization timed out" rejection is gone with the post-mount readiness handshake.

  **Eleven of the sixteen `PlanFeatures` are deleted.** An entitlement is legitimate only when it meters a resource Cloud itself buys; a gate on editor capability that OSS gives away free is either backwards or inert. Removed: `custom_fonts`, `theme_customization`, `custom_blocks`, `auto_save`, `pluggable_media`, `media_folders`, `import_from_url`, `white_label`, `html_block`, `export_mjml`, `headless_sdk`. Surviving: `ai_generation`, `collaboration`, `commenting`, `saved_modules`, `test_email`, plus all four limits (`max_templates` + `template_count`, `storage_limit_bytes`, `max_file_size_mb`, `media_categories`), including the header's usage readout. Behavioural consequences: custom fonts, custom blocks and `theme` are applied on every plan; media folders and URL import render on every plan; `onRequestMedia` needs only to be configured; and Cloud's renderer no longer drops custom faces from the export payload.

  **Removed APIs**

  - `@templatical/core/cloud` no longer exports `useEditor` / `UseEditorOptions` / `UseEditorReturn`. There is one editor core, exported from `@templatical/core`. The Cloud core's last member over it, `savedBlockIds`, was always a comments dependency and now reaches `CommentsSidebar` through `capabilities.comments.isBlockSaved`.
  - `@templatical/types` no longer exports `EditorState`; the surviving definition is exported from `@templatical/core`.
  - `resolveExportFonts(fonts, allowCustomFonts)` → `resolveExportFonts(fonts)`.
  - `createCloudRenderProvider({ …, canUseCustomFonts })` → the option is gone.
  - `useFonts()` no longer returns `customFontsEnabled` / `setCustomFontsEnabled`, and `resolveRenderFonts` no longer reads them.
  - `useMediaLibraryUI({ …, canUseMediaFolders })` → the option is gone.
  - The duplicated `header.save` / `saving` / `saved` / `unsaved` / `saveFailed` keys are removed from the cloud i18n chunk; the OSS chunk's copies are the only ones. `header.templatesUsed` stays cloud-only.

  **Internal deletions** (not public API, listed because they were large): `cloud/CloudEditor.vue`, `cloud/components/CloudHeader.vue`, `cloud/composables/useCloudInitialization.ts`, `cloud/composables/useCloudLifecycle.ts` and `core/src/cloud/editor.ts`. Their content is `EditorHeader.vue` (one shared header, with three slots for Cloud's controls), `cloud/createCloudRuntime.ts` (bootstrap + adapters) and Cloud's decorated templates provider, which is where the websocket-connect-on-load choreography belongs.

  **New on `initCloud()`:** `onDirtyChange` and `unsavedChangesGuard`, the two keys `init()` already had. The `beforeunload` guard is on by default, so a Cloud session can no longer lose work on tab close; pass `unsavedChangesGuard: false` to own that prompt yourself.

  **Fixed along the way:** the OSS editor's drag ghost showed an English "Drop here" whatever the locale, and `init({ fonts: { defaultFont } })` never seeded a blank template's body font — both were wired only on the deleted Cloud side.

  **Preserved deliberately:** Cloud's lint save-gate. `TemplatesProvider` saves now route through an optional `SaveGate`, so the shared header's Save, `Cmd`+`S`, autosave and the version-restore confirmation all still honour the server's `accessibility.blockOnError` policy — autosave by skipping silently rather than raising a prompt on a debounce timer.

- d256b41: Rendering becomes a bring-your-own provider, and the editor grows `toHtml()`.

  `init()` takes a new `render?: RenderProvider` key. Every method is independently optional, and each is resolved on its own:

  | Call              | Order                                                                 |
  | ----------------- | --------------------------------------------------------------------- |
  | `editor.toMjml()` | `render.toMjml` → the bundled `@templatical/renderer` → reject        |
  | `editor.toHtml()` | `render.toHtml` → `toMjml()`'s result + `render.compileMjml` → reject |

  **`compileMjml` is the cheap tier and the point of the whole shape.** MJML compilation is a commodity — a hosted service, a container, a CLI shell-out — whereas rendering Templatical's block model is not. Wire up that one function and `toHtml()` works while the SDK keeps rendering the MJML itself, so a non-Node backend never has to stand up a Node sidecar. There is deliberately **no local HTML path**: with neither `toHtml` nor `compileMjml`, `toHtml()` rejects with an error naming the method to add.

  Provider methods receive a **render-complete** payload — custom blocks already resolved into `renderedHtml`, plus the editor's effective fonts. Both are things a backend cannot reconstruct from the template JSON, and the custom-block case failed silently before (a renderer given one with neither a resolver nor `renderedHtml` omits it from the output).

  **The Cloud editor now exposes `toMjml()` and `toHtml()`**, which it never did — Cloud consumers had to fish HTML out of the save result.

  ### Breaking — `SaveResult` is removed

  `SaveResult` is deleted from `@templatical/types` (and its re-export from `@templatical/editor`). The Cloud editor's `save()` resolved to `{ templateId, html, mjml, content }`; it now resolves to the stored `Template`.

  ```ts
  // Before
  const { html, mjml } = await editor.save();

  // After
  const template = await editor.save();
  const html = await editor.toHtml();
  const mjml = await editor.toMjml();
  ```

  It only ever existed because Cloud's save stitched `editor.save()` and its export endpoint together. Saving and rendering run at different frequencies — autosave was compiling MJML server-side on every debounce tick — and fail in different ways, so they are separate calls now.

  ### Breaking — `onSave` is removed from both entry points

  `init({ onSave })` and `initCloud({ onSave })` are gone. The provider _is_ the save.

  - **OSS** — `onSave` meant "the user hit Cmd+S, you persist it". With a `templates` provider, Cmd+S now calls `save()`. Without one, Cmd+S flushes the `onChange` debounce immediately, so a consumer persisting from `onChange` still receives the keystroke:

    ```ts
    // Before
    init({ container, onChange: persist, onSave: persist });

    // After
    init({ container, onChange: persist });
    ```

  - **Cloud** — `onSave` meant "a save completed", and carried the `SaveResult`. Use the resolved value of `await editor.save()`; `onCreate` and `onLoad` are unchanged.

  ### Breaking — `@templatical/renderer` marks unrenderable blocks instead of dropping them

  A block type with no built-in renderer **and** no `blockRenderers` override now emits an `mj-raw` placeholder comment plus a `console.warn`, where it previously returned an empty string:

  ```html
  <mj-raw
    ><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw
  >
  ```

  `countdown` is the only built-in block that lands here (Cloud renders it server-side as an animated GIF). Not a throw, because the renderer runs inside send pipelines and killing an entire render over one block is worse than shipping a marked gap; not silence either, because a countdown vanishing from a marketing email reaches recipients as a missing section with nothing anywhere explaining why. The marker survives an `mjml2html` compile under strict validation, and a block hidden on every viewport still renders nothing and warns about nothing.

  Two new exports go with it, so a send pipeline never hardcodes the marker text:

  ```ts
  import {
    UNRENDERABLE_MARKER_PREFIX,
    renderUnrenderableBlock,
  } from "@templatical/renderer";

  if (mjml.includes(UNRENDERABLE_MARKER_PREFIX)) {
    throw new Error(
      "Refusing to send: a block in this template rendered as a gap.",
    );
  }
  ```

  `UNRENDERABLE_MARKER_PREFIX` is the marker's stable leading text — scan for it before shipping. `renderUnrenderableBlock(block)` emits one and logs the warning, so a `blockRenderers` override can degrade the same way for a variant it decides it cannot handle, rather than returning `""` and reintroducing the silent drop.

  ### New — `blockRenderers` on `renderToMjml()`

  A per-block-type override map that generalises `renderCustomBlock`:

  ```ts
  renderToMjml(content, {
    blockRenderers: {
      countdown: (block) => `<mj-image src="${countdownGifUrl(block)}" />`,
      video: (block, ctx) => renderVideoWithPlayButton(block, ctx),
    },
  });
  ```

  An entry replaces the built-in renderer for that type wholesale, including its hidden-on-all-viewports check. It exists so a backend whose output is a _superset_ of the browser's can inject exactly that delta instead of forking the renderer — which is how Cloud now runs the published renderer rather than a copy of it.

  `BlockRenderer` moved to `render-context.ts` next to the new `BlockRendererMap` and is re-exported from its previous path, so consumer imports are unaffected.

  ### Breaking — Cloud internals (`@templatical/core/cloud`)

  Consumers using `initCloud()` are unaffected; these matter only if you import the cloud subpath directly.

  - `useEditor({ templates })` is now required — Cloud persists through `createCloudTemplatesProvider(authManager)` rather than hardcoded `ApiClient` calls.
  - `ApiClient.updateTemplate(id, patch)` takes a `TemplatePatch` instead of bare content; `createTemplate(content, name?)` gained an optional name.
  - `useExport`'s methods take an explicit fonts payload and its options are now just `{ authManager }` — the `canUseCustomFonts` entitlement gate moved into `createCloudRenderProvider`, where plan gating belongs. New `resolveExportFonts()` helper.
  - New exports: `createCloudTemplatesProvider`, `createCloudRenderProvider`.

  `editor.toMjml()` / `toHtml()` also now pass the editor's resolved fonts to the bundled renderer. A template using a custom font family previously exported with no `<mj-font>` declaration and no fallback stack, so mail clients silently substituted.

  `initCloud()` deliberately does **not** take this key. Cloud renders server-side for delivery as well — test email, scheduled sends and API exports — so a consumer-supplied renderer would have changed `toMjml()` / `toHtml()` and nothing else, leaving what you preview and export out of step with what Cloud sends. One passed from JavaScript is ignored with a console warning. For your own MJML on Cloud, call `renderToMjml(editor.getContent())` directly.

- d256b41: Add a bring-your-own **templates provider**: the editor's save/load lifecycle over your own storage.

  Pass three methods as `init({ templates })` and the editor grows the chrome that goes with them — an inline-editable template name in the header, a save button, a three-state save-status indicator, `Cmd`/`Ctrl`+`S`, optional debounced autosave, and a `beforeunload` guard for unsaved work:

  ```ts
  const editor = await init({
    container: "#editor",
    templates: {
      load: (id) => fetch(`/api/templates/${id}`).then((r) => r.json()),
      create: (input) => post("/api/templates", input),
      save: (id, patch) => patchJson(`/api/templates/${id}`, patch),
    },
    autoSave: true,
  });

  await editor.load("tpl_123");
  ```

  Omit `templates` and no chrome appears: no name field, no save button, no status indicator. `onChange` keeps working exactly as before, and `Cmd`/`Ctrl`+`S` flushes its debounce immediately so a consumer persisting from `onChange` still receives the keystroke. (`onSave` is removed in this same release — see the render-provider entry.)

  New in `@templatical/types`: `Template`, `TemplatePatch`, `TemplatesProvider`. `create` and `save` are `false | fn` and **required**, mirroring `SavedBlocksProvider` — disabling one is a decision you state rather than something you get by forgetting a method. `save: false` yields a genuine read-only mode: the save button, the status indicator and the rename affordance all disappear, while loading and local editing keep working.

  New in `@templatical/editor`: `templates`, `autoSave`, `autoSaveDebounce`, `onDirtyChange`, `templateNameField` and `unsavedChangesGuard` config keys, plus `create()`, `load()`, `save()` and `isDirty()` on the instance. The lifecycle methods are always present on the type and reject with an explanatory error when no provider is configured — the documented `toMjml()` convention.

  The header chrome has two switches of its own:

  - **`templateNameField: false`** hides the inline name field — for a store with no name column, or when your own chrome owns the name. It hides the field and nothing else: `create({ name })`, `setName()` and the `name` in each save patch keep working. `initCloud()` accepts the same key.
  - **`Template.createdAt` / `updatedAt`** (optional, ISO 8601) render a relative line under the name — "Updated 5m ago" — with the full date on hover, refreshing while the editor stays open. `updatedAt` wins when both are present, and the wording follows whichever was used, so a template your store never rewrote reads "Created". Neither field, or a value that does not parse, renders nothing. Both are absent from `TemplatePatch`: the editor never writes them, and it renders whatever `load` or `save` returned. The line appears whether or not `save` is available, which is what a read-only template has in place of a status indicator.

  The four relative-time labels now live in one shared top-level `time` namespace, replacing the three identical copies under `savedBlocks`, `comments` and `versionHistory`.

  **Breaking, type-only:**

  - `EditorState` in `@templatical/core` gains three required members — `template: Template | null`, `isSaving: boolean` and `isLoading: boolean`. Code that constructs an `EditorState` object literal, or that mirrors the interface, must add them. Reading state is unaffected.
  - `Template` moved from `@templatical/types`' cloud module into its own `templates` module. It is still exported from the package root and re-exported from the cloud module, so no import breaks.
  - `useConditionPreview`, `useHistoryInterceptor` and `useCollaborationBroadcast` now take the minimal structural slice of an editor they actually use, instead of a whole `UseEditorReturn`. Passing either editor still works; a caller that relied on the parameter type by name should use the exported `ConditionPreviewEditor` / `HistoryInterceptorEditor` instead.

  Also fixed: a save that resolves _after_ an edit landed mid-flight no longer clears the dirty flag. Clearing it claimed the edit was persisted, and — because autosave decides dirtiness at debounce time — made the follow-up save skip it.

  Docs: [Saving & Loading Templates](https://docs.templatical.com/backend/templates).

- d256b41: Version history becomes a bring-your-own provider, and "snapshot" is renamed to "version" throughout.

  `init()` takes a new `versionHistory?: VersionHistoryProvider` key. Configure it and the editor grows a history control in the header — step older and newer through past states, preview one on the canvas, restore it. Omit it and none of that UI is downloaded.

  ```ts
  init({
    container,
    templates: myTemplatesProvider,
    versionHistory: {
      list: (templateId) =>
        fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
      get: (templateId, versionId) =>
        fetch(`/api/templates/${templateId}/versions/${versionId}`)
          .then((r) => r.json())
          .then((v) => v.content),
      create: false,
      restore: (templateId, versionId) =>
        fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, {
          method: "POST",
        }).then((r) => r.json()),
    },
  });
  ```

  `list` and `get` are the operations and cannot be disabled; `create` and `restore` each take `false` instead of a function, so turning one off is a decision you state rather than something you get by forgetting a method.

  **Your `save` records the versions, not the editor.** Whichever `TemplatesProvider.save` you supply decides whether a save also records a version, which keeps throttling, retention and dedupe with the side that pays for the storage. `create` exists for versions a person asks for; the editor never calls it on its own.

  That rule is literal, and restore is no exception. Confirming a restore discards unsaved work, so **Restore asks first when there are unsaved changes** and offers to save them before restoring — through your ordinary `templates.save`, user-initiated. Without a `templates` provider, or with one whose `save` is `false`, the offer isn't made and the confirmation says plainly that the changes will be lost, because there is nowhere to put them.

  `initCloud()` does **not** take `versionHistory`, exactly as it does not take `templates`: a version is keyed to a template id Cloud issued, and Cloud's templates adapter keeps recording into Cloud's own store regardless. One passed from JavaScript is ignored with a console warning.

  **Restore is append-only** — it adds an entry rather than rewriting one. A backend with no atomic endpoint composes it in one line (`get` the old content, then `save` it), which the docs spell out.

  **Scrubbing stays synchronous.** Each `TemplateVersion` may carry an optional `content` — a _cache hint_, evaluated per entry, never an alternative to `get`. When it is present the editor previews that version in the same tick; when it is absent it calls `get` once and caches the result. So a provider that hydrates recent versions and omits older ones is a supported middle ground, and Templatical Cloud (which returns content on every entry) never waits.

  ### Breaking — snapshot → version, everywhere

  The rename is the largest part of this release. Cloud's REST routes change too.

  | Before                                                                   | After                                                                                                                                                     |
  | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `TemplateSnapshot` (`@templatical/types`)                                | `TemplateVersionResponse` — still Cloud's snake_case wire shape. The contract shape is the new camelCase `TemplateVersion`                                |
  | `useSnapshotHistory` (`@templatical/core/cloud`)                         | **Removed.** The reactive state is now `useVersionHistory` in `@templatical/core`, shared by both tiers, and takes a provider instead of an `authManager` |
  | `editor.createSnapshot()` (cloud core)                                   | **Removed.** A save records a version; `versionHistory.create` records one on demand                                                                      |
  | `ApiClient.getSnapshots` / `createSnapshot` / `restoreSnapshot`          | `getVersions` / `getVersion` / `createVersion` / `restoreVersion`                                                                                         |
  | `API_ROUTES["snapshots.*"]`, `templates/{id}/snapshots`                  | `API_ROUTES["versions.*"]`, `templates/{id}/versions`                                                                                                     |
  | `snapshotHistory.*` / `snapshotPreview.*` translation keys (cloud chunk) | `versionHistory.*` / `versionPreview.*` in the **OSS** chunk, in all seven OSS locales                                                                    |

  "Snapshot" was an implementation word, and it collided with the editor's undo/redo history — a different thing entirely (in-session, unsaved, per-keystroke).

  ### Breaking — Cloud internals (`@templatical/core/cloud`)

  Consumers using `initCloud()` are unaffected; these matter only if you import the cloud subpath directly.

  - `useEditor({ authManager })` is gone — the option was unused once persistence moved behind `TemplatesProvider`. Pass `templates` alone.
  - `createCloudTemplatesProvider`'s `save` now also records an automatic version, throttled to at most one per minute, and records nothing for a rename-only patch. This replaces the editor-side `createSnapshot()` on a timer, which put Cloud's retention policy in the editor. A version write that fails still resolves the save, but now logs a warning instead of being swallowed.
  - New export: `createCloudVersionHistoryProvider`.

  ### Cloud behaviour changes
  - **Autosave saves the template.** It previously created a snapshot and left the template itself unsaved, which meant "autosave" named two different things across the two entry points. It now routes through the same save the header button uses.
  - **Autosave does not fire while the lint save-gate would block.** No modal — one firing on a debounce timer would interrupt typing — but no save either, so `accessibility.blockOnError` stays a policy on every write path rather than a manual-save-only speed bump. The header keeps saying "unsaved", which is true, and the blocking issues stay listed in the Issues panel. Cmd+S and the header button remain gated, modal and all.
  - **The history list re-reads on every open** rather than only when empty, and no longer re-reads after every save. History also grows server-side, so a list fetched once went stale silently; and a refresh per save was a round-trip for a dropdown nobody had open.
  - The history control and preview banner are now shared components lazily loaded behind the capability, so an OSS consumer without a provider pays nothing for them.

  `VersionHistoryProvider.list` resolves to `{ versions, nextCursor? }` rather than a bare `TemplateVersion[]`, and `VersionHistoryListParams` carries `{ limit?, cursor? }`. The editor loads one page and calls `list` bare; a store that returns its whole history at once omits `nextCursor`. The envelope is there so that adding pagination later is not a breaking change — reserving only the params object would have covered the request and left the response needing a new shape.

- d256b41: Fix: Cloud's media library was non-functional inside the editor.

  `MediaLibraryModal` reached for its host's state by injection under bare **string** keys — `inject("authManager")`, `inject("projectId")`, `inject("planConfig")`, all non-null-asserted — while `@templatical/editor` provides `Symbol("authManager")` and had no key at all for the other two. Vue matches injection keys by identity, so a string never resolves a Symbol: opening the media library through `initCloud()` received `undefined` for all three and nothing worked. Only the editor path was affected; the standalone media SDK (`init()` from `@templatical/media-library`) provided them correctly and is unchanged in behaviour.

  The three values now travel as **props**, so `@templatical/editor`'s typecheck fails if a binding is dropped rather than the browser silently breaking again.

  ### Breaking — only if you mount `MediaLibraryModal` yourself

  If you render `MediaLibraryModal` in your own Vue app, pass the three as props instead of providing them:

  ```vue
  <MediaLibraryModal
    :visible="open"
    :auth-manager="authManager"
    :project-id="authManager.projectId"
    :plan-config="planConfig"
    @select="onSelect"
    @close="open = false"
  />
  ```

  `planConfig` is a `UsePlanConfigReturn` (from `usePlanConfig(authManager)` in `@templatical/core/cloud`) — the same shape the modal read before. The modal re-provides it internally for the descendants that call `useMediaCategories`, so nothing below it changes.

  `useMediaCategories()` now throws a named error when no plan config is in scope, instead of failing several frames later on `undefined.config`.

### Patch Changes

- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
  - @templatical/media-library@0.27.0
  - @templatical/renderer@0.27.0
  - @templatical/quality@0.27.0

## 0.26.3

### Patch Changes

- 777a2ce: Work around a Chromium bug (verified in Chromium 140–151, including stable Chrome) where pressing End or Home shortly after triple-clicking inside a text block armed a native scroll: the next typed character smooth-scrolled the canvas to its very bottom (End) or top (Home), dragging the caret out of view. Rich-text blocks now handle plain End/Home through `Selection.modify` — identical visual-line caret movement, without arming the bug. Shift+End/Home selection extension keeps its native behavior.
- @templatical/media-library@0.26.3
  - @templatical/quality@0.26.3
  - @templatical/renderer@0.26.3

## 0.26.2

### Patch Changes

- b872914: Stop writing redundant attributes into serialized merge tags

  `MergeTagNode` and `LogicMergeTagNode` declared their attributes without the
  `rendered: false` flag, so TipTap serialized each one under its own name in
  addition to the canonical `data-*` pair emitted by `renderHTML()`:

  ```html
  <span
    label="E-Mail"
    value="{{email}}"
    data-merge-tag="{{email}}"
    data-label="E-Mail"
    >E-Mail</span
  >
  <span
    value="{% if vip %}"
    keyword="IF"
    data-logic-merge-tag="{% if vip %}"
    data-keyword="IF"
    >IF</span
  >
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

- Updated dependencies [4b976a8]
  - @templatical/renderer@0.26.2
  - @templatical/media-library@0.26.2
  - @templatical/quality@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [a95274c]
  - @templatical/renderer@0.26.1
  - @templatical/media-library@0.26.1
  - @templatical/quality@0.26.1

## 0.26.0

### Minor Changes

- 753262e: Add an alignment option to the button block (#536).

  `ButtonBlock` gains `align: "left" | "center" | "right"`, surfaced in the button toolbar as the same sliding control image, video, social, title, menu and table already use. The renderer passes it through to `mj-button`'s native `align` attribute, and the editor canvas — which previously hardcoded centering — now mirrors it, so the preview, saved-block previews and the test-email dialog all agree with what gets sent.

  **Breaking (types):** `align` is required, matching `ImageBlock` / `VideoBlock` / `SocialIconsBlock`. Code that constructs a `ButtonBlock` literal without going through `createButtonBlock()` must add the field. Nothing else changes: the factory defaults to `"center"`, and both the renderer and the editor fall back to `"center"` for templates stored before the field existed, so existing content renders byte-for-byte as it did.

  Note `align` has no visible effect when `width` is `"full"` — the button spans the column either way. The control stays visible in that state rather than appearing and disappearing with the width mode, matching the image toolbar.

  The three importers now carry button alignment across instead of dropping it: BeeFree and Unlayer read the button's own `text-align`, and the HTML importer reads the wrapping cell's `text-align` or its legacy `align` attribute (an anchor is sized to its content, so its own `text-align` says nothing about placement).

### Patch Changes

- Updated dependencies [753262e]
  - @templatical/renderer@0.26.0
  - @templatical/media-library@0.26.0
  - @templatical/quality@0.26.0

## 0.25.2

### Patch Changes

- @templatical/media-library@0.25.2
- @templatical/renderer@0.25.2
- @templatical/quality@0.25.2

## 0.25.1

### Patch Changes

- 2309a9d: Add **justify** to the paragraph toolbar's alignment group
- Updated dependencies [dda6373]
  - @templatical/quality@0.25.1
  - @templatical/renderer@0.25.1
  - @templatical/media-library@0.25.1

## 0.25.0

### Minor Changes

- 7c24a7c: Add **`resolvePreview`** — a hook that resolves the template for preview surfaces using your own backend, so previews can show real data instead of tokens.

  ```ts
  await init({
    container: "#editor",
    resolvePreview: async ({ content, recipient }) => {
      const res = await fetch("/api/resolve-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, recipient }),
      });
      if (!res.ok) throw new Error("Could not resolve");
      return res.json();
    },
  });
  ```

  **This is what `MergeTag.sample` cannot do.** Samples substitute value tags client-side; they can't evaluate **logic tags** — `{% if %}` … `{% endif %}` blocks stay visible as keyword badges, because substituting a value isn't taking a branch. The editor only ever _recognises_ tags — `syntax` is a pair of regexes, and logic tags pass through to the MJML for whatever sends the email to evaluate. Taking a branch needs your data and your template language, so only your backend can.

  **Preview surfaces only, never while editing.** Runs on entering preview mode and — in the test-email dialog — on every recipient change, debounced 500ms. The editing canvas always shows the tag you inserted.

  **Degrades, never breaks.** If the resolver rejects, or returns something that isn't a `TemplateContent`, the preview falls back to the unresolved template and says so inline. A shape check means a mis-shaped API response degrades rather than throwing inside the render. Failures are deliberately **not** routed to `onError`: a degraded preview is user-visible and non-fatal.

  **Races are handled.** A superseded response is discarded even when it settles last, so switching recipient twice can't land the first answer. A _first_ resolve shows a skeleton; a re-resolve keeps the previous result on screen rather than flashing over content that's already correct.

  **Supersedes sample values entirely.** Configuring a resolver turns `MergeTag.sample` off: the Sample/Label switch never renders and the preview hint names your backend as the data source. This applies from the first frame rather than once a result lands — gating it on resolved content made the switch appear for the debounce plus resolver latency and then vanish. It also keeps the failure note truthful, since that note says the _unresolved_ template is showing.

  **Supersedes the display-condition filter too**, for the same reason. A block hidden by hand via its filter icon would otherwise stay hidden over resolved content — vetoing the condition your backend just evaluated against real data, while the "Show all hidden blocks" button sat there claiming blocks were hidden that the preview was showing. The filter and that button now step aside whenever a resolver owns the preview. The hides are **suppressed, not discarded**: they return on leaving the preview, so a view toggle never loses work, including when the resolve fails and the unresolved template is what renders. Editing is untouched, and previewing _without_ a resolver keeps simulate-then-preview exactly as before.

  **Display-only, structurally.** Resolved content reaches preview surfaces and nothing else: never editor state, never `getContent()`, never a send, never an export. The `content` handed to your resolver is a `safeClone` copy, so mutating it cannot affect the editor.

  Documented on a new **Preview Rendering** guide page covering all three preview layers — labels, `MergeTag.sample` and `resolvePreview` — how they compose, and use cases including letting the user pick an example audience from your own UI inside the callback.

  New exports from `@templatical/types`: `ResolvePreview`, `PreviewResolveContext`, `isRenderableTemplateContent`.

### Patch Changes

- @templatical/media-library@0.25.0
- @templatical/quality@0.25.0
- @templatical/renderer@0.25.0

## 0.24.1

### Patch Changes

- 72338ba: Fix dialogs ignoring the `theme` config option ([#487](https://github.com/templatical/sdk/issues/487)). The saved-blocks browser, the save-block dialog and the test-email dialog rendered in the SDK's default colours inside an otherwise themed editor.

  `theme` is applied as inline styles on the editor root, and the shared modal backdrop carries the `tpl` class that re-declares the full `--tpl-*` token set. A custom property declared on a descendant beats one inherited from an ancestor, so the backdrop reset every token to its stock default for the whole dialog it wrapped. The backdrop now re-applies the theme overrides, which covers every dialog rendered through it — including any added later.

  Dark mode was unaffected, and the `--tpl-user-*` CSS-variable theming surface was unaffected. Only the `theme` config option was lost, and only inside modals.

  A new guard enforces the underlying rule — any element carrying the bare `tpl` class must re-apply the theme overrides — so a future surface can't reintroduce this silently.
  - @templatical/renderer@0.24.1
  - @templatical/quality@0.24.1
  - @templatical/media-library@0.24.1

## 0.24.0

### Minor Changes

- c9b9eea: Add **`MergeTag.sample`** — an example value that previews render in place of the tag, so a preview reads like a delivered email instead of a list of field names.

  ```ts
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
      { label: 'Plan', value: '{{plan_name}}', sample: 'Pro' },
    ],
  }
  ```

  Setting `sample` is the whole opt-in — there is no flag to enable alongside it. **Nothing appears until you configure one:** the Sample/Label switch renders only when at least one tag declares a `sample`, and previews default to Sample view only in that case. Set none and the editor behaves exactly as before, so this is a no-op for every existing configuration.

  **Preview surfaces only, never while editing.** Substitution happens in preview mode and in the test-email dialog's preview. On the editing canvas a tag always shows its label, so an author keeps seeing the field they inserted rather than a value they never typed.

  **A Sample / Label switch** appears beside the viewport toggle whenever a preview is showing, so you can flip between the realistic view and the field-name view. The choice lasts for the session.

  **The highlight follows the individual tag, not the view.** In Sample view a tag with a `sample` renders as ordinary text with no highlight, while a tag without one keeps its label _and_ its highlight. So a partly-configured template reads naturally where you've supplied data and stays visibly dynamic where you haven't — and the remaining highlights double as a list of tags still missing a sample.

  **Display-only, and structurally so.** A sample is never written to the template, never included in `getContent()`, never sent by the test-email feature, and never present in MJML or HTML output — those always carry the real token. In rich text the substitution replaces the whole `<span data-merge-tag>`, so the substituted markup has no token left in it to export; the stored content is untouched.

  Covered everywhere tags render: rich text, plain-string fields (button, image, video, menu), `html` block content, and top-level custom-block field values. Table cells are **not** covered — they are `contenteditable`, and injecting sample text into an editing control is a different problem. Logic tags (`{% if %}`) are unaffected: substitution replaces a value, it cannot evaluate a branch, so they stay keyword badges in both views.

  The built-in merge tag picker now shows a tag's sample, so an author can see what it will render before inserting.

  New exports from `@templatical/types`: `getMergeTagSample`, `hasMergeTagSamples`, `substituteHtmlMergeTagSamples`, `substituteTextMergeTagSamples`.

### Patch Changes

- @templatical/media-library@0.24.0
- @templatical/quality@0.24.0
- @templatical/renderer@0.24.0

## 0.23.0

### Minor Changes

- 7d51750: Add **bring-your-own test emails** — let users mail themselves the template they're editing, sent through your own infrastructure.

  Previously Cloud-only. Now `init()` accepts a `testEmail` provider and one method is the whole integration:

  ```ts
  await init({
    container: "#editor",
    testEmail: {
      send: async ({ recipient, content }) => {
        const res = await fetch("/api/test-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient, content }),
        });
        if (!res.ok) throw new Error("Could not send the test email");
      },
    },
  });
  ```

  The editor owns the trigger, the dialog, recipient validation and the sending / success / error states; you own delivery. Omit `testEmail` and the feature is entirely absent — no button, and none of its UI code is downloaded.

  **Restricting recipients.** `allowedRecipients` drives the dialog: omitted gives a free-text field, one entry a read-only field, several a picker, and an empty array means nobody may be sent to (so no button renders at all). It restricts the _picker_ only — the array lives in the user's browser, so **validate the recipient on your server**.

  **Optional MJML.** Set `includeMjml` and the payload carries the rendered MJML, saving you a `renderToMjml()` call. It needs the optional `@templatical/renderer` peer; without it the send still happens with JSON only and one warning is logged, so always guard for `payload.mjml` being absent.

  **A live preview.** The dialog renders the template chrome-free at email width with a desktop / mobile switch, so a user can confirm what they're sending without leaving it. It honours display conditions — a block a condition excludes is omitted, so the preview never shows content the recipient won't get — and responsive blocks follow the switch rather than always rendering desktop. Merge tags render unresolved, and the dialog says so: it answers "is this the right template?", not "is this exactly what lands in the inbox?".

  `SavedBlockPreviewCanvas` is renamed **`BlockPreviewCanvas`** now that saved blocks and test email both use it, and gained a `viewport` prop plus condition filtering. Both default to the previous behaviour, so saved-block previews are unchanged. Internal component, not part of the public API.

  **Preview widths now come from one place.** A new `getEmailFrameWidth(settings, viewport)` helper backs the canvas, the preview canvas and the save dialog's scaled rows. Previously the previews hardcoded 600px while the canvas used the template's own `settings.width`, so a template with a custom body width previewed at the wrong size — and the save dialog's `transform: scale()` divided by that same hardcoded number, so the two had to agree by coincidence rather than by construction.

  **Upgrading to Cloud is a deletion.** `initCloud()` takes the same `testEmail` key with the same type: omit it and Templatical Cloud sends (using its own deliverability infrastructure and a server-signed recipient list), or leave it exactly as it is to keep your own sender — useful when mail must leave your own infrastructure for compliance reasons. Your users see no difference; the button, dialog and flow are the same components in both editors.

  New exports: `TestEmailProvider` and `TestEmailPayload` from `@templatical/types` and `@templatical/editor`, plus `createCloudTestEmailProvider` from `@templatical/core/cloud`.

  **Cloud internals changed.** `useTestEmail` is now configuration only — `isEnabled`, `allowedEmails` and a new `getSignature` — and its `sendTestEmail` / `isSending` / `error` members are gone, replaced by `createCloudTestEmailProvider` driving the shared editor seam. This keeps exactly one send path behind one UI. No runtime impact for `initCloud()` consumers, whose configuration is unchanged; only direct callers of the composable are affected, and Templatical Cloud has not shipped.

  Also fixed while migrating: an empty allowed-recipient list previously rendered a dialog with an empty picker and a permanently disabled Send button, instead of hiding the feature.

### Patch Changes

- @templatical/media-library@0.23.0
- @templatical/quality@0.23.0
- @templatical/renderer@0.23.0

## 0.22.0

### Minor Changes

- 09d4fa2: Add French (fr) and Dutch (nl) OSS locales.

  Both files follow the existing pattern: typed `typeof en` so a missing key is a
  compile error, auto-registered through the `import.meta.glob` locale registry, and
  covered by the "OSS locale parity" test (keys and placeholder tokens).
  `isLocaleSupported("fr")` / `isLocaleSupported("nl")` now return `true`, and region
  variants such as `fr-BE` / `nl-BE` resolve to the base locale as usual. Cloud
  translations are intentionally not included; `loadCloudTranslations` keeps falling
  back to English for these locales.

  The i18n test suite previously used `"fr"` as its canonical unsupported locale;
  those assertions now use `"it"`.

### Patch Changes

- @templatical/renderer@0.22.0
- @templatical/quality@0.22.0
- @templatical/media-library@0.22.0

## 0.21.2

### Patch Changes

- 635eb7e: `initCloud()` now accepts a saved-blocks provider, and two unused types are removed.

  **`savedBlocks` accepts `boolean | SavedBlocksProvider` on `initCloud()`.** Previously Cloud took a boolean and OSS took a provider — the same key with a different type on each entry point, so moving an OSS integration to Cloud meant rewriting that line. Now:

  - omitted or `true` — backed by Templatical Cloud, gated on the `saved_modules` plan feature (unchanged);
  - `false` — off entirely (unchanged);
  - a `SavedBlocksProvider` — backed by your own store instead of Cloud's, and **not** plan-gated, because the plan feature licenses Cloud's storage rather than the editor's UI.

  Pure type widening, so existing Cloud consumers passing a boolean are unaffected. The practical effect is that upgrading from OSS to Cloud is now a deletion — drop the key to adopt Cloud's store, or leave it exactly as it is to keep your own.

  **Removed the unused `TemplaticalConfig` and `TemplaticalInstance` types from `@templatical/types`.** They duplicated the cloud editor's config and instance types and had drifted from them — `modules` was never renamed to `savedBlocks`, and later options were never added — so they described a config the SDK does not accept. The authoritative types are `TemplaticalCloudEditorConfig` and `TemplaticalCloudEditor`, both already exported from `@templatical/editor`, which is where `initCloud()` reads its config.

  No runtime impact, and in practice nothing to migrate: the types were never re-exported from `@templatical/editor`, were absent from the documentation, and described Cloud configuration. If you did import either name directly from `@templatical/types`, switch to the two above — TypeScript will point at the line.
  - @templatical/media-library@0.21.2
  - @templatical/quality@0.21.2
  - @templatical/renderer@0.21.2

## 0.21.1

### Patch Changes

- 8c62722: Stop the CDN bundle eagerly shipping lazy-loaded components.

  Two independent causes of the same bug: code behind `defineAsyncComponent` was ending up in the entry's static-import closure, so it downloaded on every editor load regardless of whether it was ever used.

  **1. The `features` manual chunk.** `vite.cdn.config.ts` grouped six `defineAsyncComponent` cloud panels — AI chat, comments, design reference, template scoring, test email and snapshot history — into a single chunk that was statically reachable from the entry. Every Cloud session downloaded all **66.5 KB gzip** of it whether or not the user opened a single panel. `manualChunks` now groups third-party dependencies only; first-party source splits at its own dynamic-import boundaries.

  **2. A duplicate countdown registration.** `countdown` requires Templatical Cloud (its animated GIF renders server-side), so `useEditorCore` registers it as a lazy `defineAsyncComponent`. `Canvas.vue` also listed it in its static `blockComponentMap` — the only one of the four fallback maps that did. Because `resolveBlockComponent` checks the registry first, that entry was unreachable at runtime, but its static `import` still pulled the module into the eager graph. The registry is now the single source, matching `SectionBlock`, `SavedBlockPreviewCanvas` and `PreviewSectionBlock`.

  Measured on the CDN build:

  - Eager payload (what every session fetches before opening anything): **337.1 → 329.5 KB gzip**.
  - Opening one cloud panel: **0 KB (already paid up front) → 1.7–5.0 KB**, charged only to users who open it. All six in one session: **18.3 KB** across 7 chunks.
  - Eager chunk count rises 14 → 27 while bytes fall, and waterfall depth only moves 5 → 6 — so the extra chunks are fetched in parallel rather than costing round-trips.

  Removing only the `features` group would have made things worse: `media-library` becomes the next eager bridge and the eager payload grows 32.7 KB. Grouping first-party source is what creates the bridge, so the rule is a ban rather than a curated list. Guarded by a new `cdn-chunk-granularity` test — `bundle-topology` deliberately skips `dist/cdn/`, which is why this went unnoticed.

  No API change and no behaviour change: countdown blocks and all six panels render exactly as before. CDN consumers get a smaller initial download and genuinely on-demand panels; npm consumers are unaffected (that build has no `manualChunks`).
  - @templatical/renderer@0.21.1
  - @templatical/quality@0.21.1
  - @templatical/media-library@0.21.1

## 0.21.0

### Minor Changes

- fc545c2: Open-source **Saved Blocks** — reusable groups of blocks users save and re-insert — backed by a consumer-supplied storage provider. Previously Cloud-only ("Saved Modules").

  The editor owns the UI; you own persistence. Templatical Cloud now consumes the same interface as one adapter rather than a separate implementation.

  Saving starts from a block's bookmark action and opens a **pick session**: plain clicks add or remove blocks on the canvas, a bar shows the count with Save/Cancel (Escape cancels, Enter confirms), and Save opens a dialog that asks for a name and previews the picked blocks. The preview lists them in pick order and each row can be dragged (or moved with the arrow keys from its grip handle) to reorder before saving; blocks are stored in whatever order the list ends in. Picking never touches the editor's block selection. Browsing gives search, an optional free-text **category** filter, live preview, insert-at-position, rename and delete. A category is set in the save dialog (suggesting the ones already in use) and editable inline afterwards; it is flat and optional — there are no folders. Both filters run in the editor over whatever `list()` returned, so a provider that simply returns its entries gets search and categories for free.

  **Permissions are the implementer's to set.** Each mutation on the provider is `false | fn`: pass `false` and the editor hides that affordance rather than letting the user try and fail. For exceptions on individual entries, return `canUpdate` / `canDelete` on them — absent means allowed. Setting all three to `false` gives a read-only library users still browse, preview and insert from, since insertion never touches your store. `list` cannot be disabled.

  **Nothing is fetched until the user opens the browser or the save dialog** — `list()` is never called on editor load. The rail entry is present from the first paint whenever a provider is configured, so a slow or empty `list()` can neither delay the editor nor shift the sidebar; the browser shows skeleton rows on a first open, and reopens render the previous entries while refreshing underneath.

  ```js
  import {
    init,
    createLocalStorageSavedBlocksProvider,
  } from "@templatical/editor";

  // Zero-backend option, for demos and prototypes:
  await init({
    container: "#editor",
    savedBlocks: createLocalStorageSavedBlocksProvider(),
  });

  // Or implement `SavedBlocksProvider` against your own API:
  await init({ container: "#editor", savedBlocks: myProvider });
  ```

  **Off by default.** With no `savedBlocks` provider the feature is entirely absent and none of its UI code is downloaded — the pick bar and both dialogs are lazily loaded chunks fetched only when actually used.

  Ordering belongs to the provider: the browser renders `list()`'s order verbatim and never re-sorts, so you control it server-side. `createdAt` / `updatedAt` are display only — each entry shows a relative timestamp (hover for the absolute date) and both fields are optional.

  New exports:

  - `@templatical/types` — `SavedBlock`, `SavedBlocksListParams`, `SavedBlocksProvider`
  - `@templatical/core` — `useSavedBlocks`, `createLocalStorageSavedBlocksProvider`
  - `@templatical/core/cloud` — `createCloudSavedBlocksProvider`
  - `@templatical/editor` — `savedBlocks` config option, plus re-exports of the provider factory and types

  ### Breaking changes
  - **`useSavedModules` is removed** from `@templatical/core/cloud`. Use `useSavedBlocks` from `@templatical/core` with a provider — `createCloudSavedBlocksProvider(authManager)` for Cloud. The return shape changed: `modules`/`loadModules`/`createModule`/`updateModule`/`deleteModule` → `savedBlocks`/`load`/`create`/`update`/`remove`.
  - **`SavedModule` is removed** from `@templatical/types`. Use `SavedBlock`, whose `createdAt`/`updatedAt` are now optional (a browser-local or in-memory store may not track them).
  - **`initCloud()`'s `modules` option is renamed to `savedBlocks`.** `modules: false` becomes `savedBlocks: false`.
  - **Editor translation keys renamed.** `blockActions.saveAsModule` → `blockActions.saveAsBlock`, `sidebarNav.browseModules` → `sidebarNav.browseSavedBlocks`, and the cloud chunk's `modules.*` namespace moved into the OSS chunk as `savedBlocks.*`. Only affects consumers overriding translations directly.

  The Cloud REST contract is unchanged: `ApiClient.listModules`/`createModule`/`updateModule`/`deleteModule` and the `saved-modules` routes keep their names and paths.

  ### Fixes
  - Cloud no longer renders a dead "save as block" button on plans without the saved-blocks entitlement. Availability is now a reactive signal on the capability, so the control appears only when the feature actually works.

### Patch Changes

- @templatical/media-library@0.21.0
- @templatical/quality@0.21.0
- @templatical/renderer@0.21.0

## 0.20.0

### Minor Changes

- 90f088e: Add per-field color presets to custom-block color fields.

  A `color` field in a `CustomBlockDefinition` now accepts the same `presets` / `allowCustom` pair as the editor-wide `colors` config, applied to that one field — so a field can be scoped to a color role (an accent/ink pair, say) while every other picker keeps the global palette. Entries are validated as `#rgb` / `#rrggbb` hex, exactly like editor-level presets.

  A field's `presets` **replace** the editor-wide palette for that field rather than intersecting it, so a locked field can carry colors the global grid doesn't list; what a field can never do is unlock a locked editor. Setting neither inherits the editor's palette and its `allowCustom`; `allowCustom: false` locks one field while the rest of the editor stays free-form; `allowCustom: true` cannot unlock a field when `colors.allowCustom` is `false`. An empty `presets: []` — or one whose entries are all invalid — narrows nothing, so the field inherits the editor's palette.

  Field configs that can't be honoured are reported once per block definition, naming both the block type and the field key: invalid preset entries, an ignored empty list, an ignored `allowCustom: true`, and a locked field whose `default` its own palette can't reselect. Non-breaking — color fields that set neither option render exactly as before.

### Patch Changes

- @templatical/media-library@0.20.0
- @templatical/quality@0.20.0
- @templatical/renderer@0.20.0

## 0.19.0

### Minor Changes

- ef6deec: Add a `colors` editor option for a preset color-picker palette.

  `colors.presets` renders a clickable grid inside every color picker popover (block toolbars, template settings, rich text, custom-block color fields); clicking a preset applies it and the preset matching the current value is marked selected. Presets must be `#rgb` / `#rrggbb` hex — invalid entries are skipped with a console warning. The grid is an ARIA radio group: arrow keys rove focus between chips (roving tabindex) and Enter/Space activate.

  `colors.allowCustom: false` (with presets) hides the wheel and hex input so authors can only pick from the palette — a white-label / brand-kit constraint. In this locked mode the palette leads with a "no colour" chip that restores the unset (inherit) state, and the editor warns when any `blockDefaults` / `templateDefaults` colour falls outside the palette. It is ignored with a warning when no presets are configured. Non-breaking — pickers render exactly as before when `colors` is unset.

- b8fbca0: Add a `fonts.builtIns` option to restrict which of the seven built-in fonts the font picker offers.

  `builtIns: true` (or omitting it) keeps all seven built-ins — the current behaviour. `builtIns: false` drops them all so the picker lists only `customFonts`. A `builtIns: string[]` allowlist keeps just the named families, matched case-insensitively; a name that isn't a built-in is logged with a warning and skipped, the same way `paletteBlocks` treats an unknown entry.

  Filtering only affects the picker: excluding a built-in never removes a custom font, a custom font stays usable as `defaultFont` when every built-in is excluded, and content already using an excluded family still resolves to its proper fallback stack. When the family new templates seed (`fonts.defaultFont`, or Arial by default) isn't in the offered list, the editor warns once at init so the mismatch is caught. Non-breaking — the default is unchanged.

### Patch Changes

- @templatical/media-library@0.19.0
- @templatical/quality@0.19.0
- @templatical/renderer@0.19.0

## 0.18.0

### Minor Changes

- aceefa2: Add a `resolveImageUrl` config option — a display-only resolver for image `src` values (#415).

  The canvas calls it to obtain a preview URL for a src the user entered (`resolveImageUrl?: (src: string) => string | null | Promise<string | null>`); the content model and `toMjml()` output always keep the canonical value. Returning `null` (or the input value) means "use the src as-is". This lets hosts whose templates reference images by non-displayable values — e.g. plain file names resolved to ephemeral `blob:` URLs from local storage — show real previews without rewriting content via `setContent()` or reverse-substituting URLs before export.

  The resolver is called once per committed src value (typing in the src input is debounced, so partial values never reach it) and results are cached per src for the editor instance's lifetime, including failures — a src whose lookup failed stays unresolved until the editor is re-initialized (a re-resolve hook may follow in a later release). Merge-tag srcs are never passed to the resolver; their `placeholderUrl` preview is resolved instead.

  Covers every image the canvas paints from content: image block srcs, design-time placeholder previews, and explicit video `thumbnailUrl`s. Thumbnails auto-derived from a YouTube/Vimeo URL are already real URLs and are never passed to the resolver.

### Patch Changes

- @templatical/renderer@0.18.0
- @templatical/quality@0.18.0
- @templatical/media-library@0.18.0

## 0.17.1

### Patch Changes

- Updated dependencies [956664e]
  - @templatical/renderer@0.17.1
  - @templatical/quality@0.17.1
  - @templatical/media-library@0.17.1

## 0.17.0

### Minor Changes

- bfce2ea: Add an opt-in `htmlBlockPreview` config option that renders HTML blocks as a live preview in the editor canvas.

  When enabled (`htmlBlockPreview: true` or `{ enabled: true }` — off by default), each HTML block's content is rendered verbatim inside a sandboxed `<iframe>` (`sandbox="allow-same-origin"`, no `allow-scripts`) instead of the static placeholder card. Scripts and inline event handlers never execute and the fragment's styles can't leak into the editor. This is preview-only — the MJML/HTML export path renders HTML blocks regardless.

  Also corrects the HTML block's editing-panel hint, which previously claimed scripts and unsafe elements were stripped on export; the OSS renderer does not sanitize HTML block content, so the hint now states that content is exported as-is.

### Patch Changes

- @templatical/renderer@0.17.0
- @templatical/quality@0.17.0
- @templatical/media-library@0.17.0

## 0.16.5

### Patch Changes

- 1150894: Fix two shadow-DOM rendering bugs surfaced when the editor is embedded under a transformed ancestor

  - **Popovers mispositioned under a transformed ancestor.** The color picker, the rich-text floating toolbars (Title + Paragraph), and the merge-tag autocomplete positioned their teleported popovers with `position: fixed` using viewport coordinates. When any ancestor of the editor has a `transform` / `filter` / `will-change` (a host's scroll-parallax wrapper, route transition, or reveal animation — even while its computed `transform` reads `none`, since a running/animated transform still promotes the element), that ancestor becomes the containing block for the `fixed` popover and offset it far from its trigger. They now anchor `position: absolute` inside the (positioned) `.tpl-popover-root`, converting the viewport target to root-local coordinates via the new `usePopoverPosition` helper — immune to the ancestor transform.

  - **`ToggleSwitch` knob off-center / overflowing its track.** Tailwind Preflight is intentionally omitted, and the hand-rolled form reset never zeroed native `<button>` padding — so a button with no padding utility kept the UA default (`1px 6px` in Chromium). In shadow-DOM mode (no host reset to mask it) that shrank the fixed-size toggle track and pushed the knob off-center. The `:where(.tpl) button` reset now zeroes `padding`/`margin` (specificity stays 0, so per-button `tpl:p-*` utilities still win).

  - **Block palette rail stayed expanded after a drag-drop.** Dropping a block leaves the cursor out in the canvas, so no `mouseleave` fired to collapse the hover-expanded sidebar rail (and the mid-drag `mouseleave` was intentionally suppressed) — it stayed open until the next hover-in/out. It now collapses on drag-end.

  Also documents the containing-block caveat (a `transform`/`filter`/`will-change` on an ancestor of the mount point offsets the editor's `fixed`-positioned overlays and drag ghost) on the `init()` `container` option and in the installation docs.
  - @templatical/renderer@0.16.5
  - @templatical/quality@0.16.5
  - @templatical/media-library@0.16.5

## 0.16.4

### Patch Changes

- 1801876: Add a per-section "Stack on mobile" control and make the mobile preview stack columns

  - **Fix (#395):** the editor's canvas mobile preview now stacks multi-column sections (each column full-width) on the mobile viewport, matching the exported email. Previously columns stayed side-by-side in the preview while the sent email stacked them.
  - **Feature (#396):** new optional `SectionBlock.stackOnMobile`. A "Stack on mobile" toggle in the section settings (shown for multi-column sections, on by default) lets you opt out of stacking — the columns then render inside an `<mj-group>` and stay side-by-side on mobile, reflected in both the canvas preview and the MJML output. Existing templates are unaffected: an absent value keeps MJML's default stacking behavior.

- Updated dependencies [1801876]
  - @templatical/renderer@0.16.4
  - @templatical/media-library@0.16.4
  - @templatical/quality@0.16.4

## 0.16.3

### Patch Changes

- 01e5550: The `swatch-only` color pickers (paragraph text color and highlight, plus the menu color control) now carry a manual hex field with an inline × clear inside the picker popover — the same control as the sidebar color pickers. You can type or paste an exact hex (applied on Enter/blur) and clear back to the inherited color with the ×. This restores the unset affordance that the move to the shared color picker had dropped, and adds precise hex entry that swatch-only mode previously lacked.

  The color picker also normalizes colors to hex for display and for seeding the wheel, so editing an already-applied color shows `#rrggbb` (not the browser's `rgb(...)` read-back) and the wheel opens on the correct color.
  - @templatical/renderer@0.16.3
  - @templatical/quality@0.16.3
  - @templatical/media-library@0.16.3

## 0.16.2

### Patch Changes

- 971fea6: Rich-text toolbar (text color + highlight) now uses the SDK's shared color picker — the same hex-wheel `ColorPicker` used everywhere else in the editor — instead of the native OS color input. The controls are unset-aware (an inherited-color selection shows the "not set" swatch, with the wheel seeded on the color the text actually renders in) and sized to match the toolbar. Adds `size` (`"sm" | "md"`) and `ariaLabel` props to the internal `ColorPicker`.
- Updated dependencies [3cefbc0]
  - @templatical/renderer@0.16.2
  - @templatical/quality@0.16.2
  - @templatical/media-library@0.16.2

## 0.16.1

### Minor Changes

- cca4a4c: Add per-link color for rich-text links

  A rich-text link (in Paragraph and Title blocks) can now carry its own color — set it in the link dialog, or select the link and use the text-color control. The color is applied to the `<a>` itself, so the link's text and its underline stay the same color (the underline follows `currentColor`) in the editor canvas and the exported MJML/HTML alike. A per-link color takes absolute priority: it overrides the document link color, and setting one also strips any inline text color already on the link's text, so the whole link (glyphs and underline) follows the chosen color rather than showing a recolored underline over differently-colored text. Conversely, applying a text color across a selection that includes a link updates the link's own color to match — so a link stays internally consistent (its text, underline, and the color shown in the link dialog and toolbar always agree) in both directions.

  Previously a link's color could only be applied as an inner text-color span, which colored the text but left the underline painted by the ancestor `<a>` in the document link color — a visible mismatch that also shipped in the exported email. Putting the color on the link resolves it, and completes the per-link styling deferred from the document-level link color work. (#373)

### Patch Changes

- cca4a4c: Fix the paragraph text-color control so it reflects the color actually in use

  The rich-text toolbar's text-color swatch used a native `<input type="color">`, which can't represent "unset" — so for text with no inline color it always painted a hard-coded `#000000`. That both looked like an explicit choice and didn't even match the real inherited color (the document `textColor`, default `#1a1a1a`). The swatch now shows the effective color the selection renders in (an explicit inline mark if present, otherwise the inherited document `textColor`), and a reset control appears only when an explicit inline color is set, clearing it back to inherited. (#373)
  - @templatical/renderer@0.16.1
  - @templatical/quality@0.16.1
  - @templatical/media-library@0.16.1

## 0.16.0

### Minor Changes

- 2805049: Add Spanish translations for the editor and media library.
- e5156a5: Add document-level link color and underline controls

  `TemplateSettings` gains an optional `linkColor` and a required `linkUnderline` (default `true`). The renderer emits them as a single global `a { color; text-decoration }` rule. `linkColor` cascades to every link — rich-text and menu alike; unset keeps `color: inherit` (links follow the surrounding text color). `linkUnderline` underlines body (rich-text) links; buttons and menu items carry their own inline `text-decoration` and are unaffected. An inline per-link/per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still overrides the color.

  Both are exposed in the editor's Appearance settings — a link-color picker and an underline toggle next to the text color — and reflected live on the canvas, fixing the previous preview/export mismatch (the canvas hardcoded a blue underlined link that never shipped).

  Newly created content (via `createDefaultTemplateContent()` / `init()` defaults) now underlines body links by default — the common, more accessible email default. Set `linkUnderline: false` for no underline.

  **Breaking (types):** `TemplateSettings.linkUnderline` is now required — add it when hand-constructing settings, or use `createDefaultTemplateContent()` / `init({ templateDefaults })`, which supply it. `linkColor` is optional; omit it to keep links inheriting the text color.

  Runtime stays backward-compatible for stored content: content lacking `linkUnderline` still renders without an underline (the renderer treats an absent value as off), so already-saved templates are unchanged. (#352)

- d35d36e: Add a document-level default text color with a full per-block cascade

  `TemplateSettings` gains a required `textColor` (default `#1a1a1a`, customizable via `templateDefaults`). Every text block — Title, Paragraph, Menu, Table — inherits it unless it sets its own color, so a document text color now flows through the whole template. To enable that, the per-block `color` on Title, Menu and Table is now optional: unset means "inherit the document color", and new blocks default to unset. An explicit per-block color (or an inline text-color mark) still overrides, and links inherit via `color: inherit`.

  It's exposed as a color picker in the editor's Appearance settings (next to Background color) and reflected live on the canvas; each text block's own color picker gains an unset/inherit state.

  **Breaking (types):** `TemplateSettings.textColor` is now required — add it when hand-constructing settings (including content passed to `init()`), or use `createDefaultTemplateContent()` / `init({ templateDefaults: { textColor } })`, which supply it. `TitleBlock`, `MenuBlock`, and `TableBlock` now have an optional `color` (`string | undefined`) — handle the unset case if you read it (unset means the block inherits the document color).

  Runtime stays backward-compatible: content lacking `textColor` still renders (falling back to the previous default), and existing templates with explicit block colors are byte-for-byte unchanged. Only newly created content shifts — paragraph body text resolves to `#1a1a1a` instead of MJML's default `#000000`, a negligible and more consistent shade. (#355)

- b8fe370: Add Catalan translations for the editor and media library.

### Patch Changes

- Updated dependencies [2805049]
- Updated dependencies [3a42ea8]
- Updated dependencies [e5156a5]
- Updated dependencies [d35d36e]
- Updated dependencies [b8fe370]
  - @templatical/media-library@0.16.0
  - @templatical/renderer@0.16.0
  - @templatical/quality@0.16.0

## 0.15.1

### Patch Changes

- 88c44ae: Fix: editor primary buttons no longer render with a transparent background in bundled/CDN builds (#357)

  `@templatical/media-library`'s shared `.tpl` form-element reset authored its button reset as a bare `.tpl button { background: none; border: none }` (specificity 0,1,1). Because `@templatical/editor` bundles these styles and shares the `.tpl` scope class, that reset out-specified the editor's single-class button utilities such as `.tpl:bg-[var(--tpl-primary)]` (0,1,0) — rendering the Insert/Update Link dialog's primary action button with a transparent background (invisible on light backgrounds) and stripping button borders. It surfaced in the CDN bundle and in any app that bundles the editor from source (e.g. the deployed playground); the npm `dist` was unaffected because it externalizes media-library. The reset is now `:where(.tpl) button` (specificity 0,0,1), matching the editor's own reset, so per-button utilities always win.

- 48cc7c0: Fix: clicking a link inside a rich-text block no longer opens it

  Clicking a link inside a Paragraph or Title block used to navigate to its `href` (typically opening a new tab) instead of letting you work with the block. Two paths were affected:

  - On the canvas (not editing), the link rendered as a plain `<a>` with no click guard — unlike Button/Menu/Image/Video/SocialIcons blocks, whose anchors carry a `@click.prevent`.
  - While editing, StarterKit bundles its own Link extension (registered with `openOnClick: true`), which was registered alongside — and overriding — the editor's `LinkExt` (`openOnClick: false`). Disabling StarterKit's bundled Link (`link: false`) — plus its bundled Underline in the paragraph editor, which already adds its own — removes those duplicate extensions and the "duplicate extension names" console warnings TipTap logged for them.

  A click on a rich-text link now selects the block on the canvas (double-click still opens the inline editor) and does nothing while editing; preview mode leaves links clickable. (#351)

- Updated dependencies [88c44ae]
- Updated dependencies [88c44ae]
  - @templatical/media-library@0.15.1
  - @templatical/renderer@0.15.1
  - @templatical/quality@0.15.1

## 0.15.0

### Minor Changes

- 7afeacb: Add type-ahead merge tag autocomplete to input and textarea fields

  Typing the syntax opener (e.g. `{{`) in any merge-tag-enabled input or textarea — button/image/video/menu links, image alt text, template settings, and custom-block text fields — now surfaces the same autocomplete popup as the rich-text editor. The popup, filtering, keyboard navigation (Arrow / Enter / Tab / Escape), and caret positioning are shared with the TipTap path, so behavior is identical across both surfaces. Controlled by the existing `mergeTags.autocomplete` flag (default on; auto-disabled when `tags` is empty or a custom syntax is used).

  `@templatical/types` gains `getSyntaxClosingChar()` alongside `getSyntaxTriggerChar()`.

### Patch Changes

- a48118b: Fix: show merge tag labels in Button, Menu, Video and Image block canvas display

  Merge-tag-enabled fields rendered directly on the canvas now show a tag's human-readable `label` (e.g. "Shipping Method") instead of the raw `{{shipping_method}}` token, matching the rich-text editor: button labels, menu item labels, and the Video URL / Image src placeholders shown when those fields are merge tags. Resolved tags carry a subtle dotted underline (in the current text color) so a dynamic value stays distinguishable from user-typed text on any background. Display-only — the raw token is unchanged in the stored value and MJML output. (#348)
  - @templatical/media-library@0.15.0
  - @templatical/quality@0.15.0
  - @templatical/renderer@0.15.0

## 0.14.0

### Minor Changes

- 12100c8: Add standalone logic tags — a control-flow feature separate from merge tags. Configure `logicTags.tags` (standalone tokens like `{% else %}`) and `logicTags.pairs` (open/close constructs like `{% if %}` … `{% endif %}`), or supply `logicTags.onRequest` to plug in your own picker (mirrors `mergeTags.onRequest`; precedence: onRequest → built-in picker). A dedicated "Insert logic" affordance appears in rich-text blocks **and** in merge-tag-enabled plain fields (button text, URLs, alt text). Standalone tags insert at the cursor; pairs wrap the current selection (or drop with the caret between them). The built-in picker is a single searchable list grouped by `group` — each group holds both its standalone tags and its open/close pairs, with keyword badges (one per tag, two per pair). Typed and pasted logic tags are still highlighted automatically, independent of this config. New exported types: `LogicTagsConfig`, `LogicTag`, `LogicPair`.
- 718d781: Add an optional outer frame to section blocks (`section.wrapper`) — a full-width band with its own background, padding, and corner radius that frames the section, rendered as an `mj-wrapper` around the section's `mj-section`. This makes the common "white card on a colored band" layout possible without nesting sections (which MJML forbids). Enable it from the section toolbar's Wrapper panel, or set `createSectionBlock({ wrapper: { backgroundColor, padding, borderRadius } })`; omit it and existing templates are unchanged. (#312)

### Patch Changes

- a476576: Fix the editor allowing a section to be dropped into another section's column (dragged from the sidebar palette) and then silently losing it on export. MJML cannot nest `mj-section` inside `mj-column`, so `renderToMjml()` / `editor.toMjml()` dropped the nested section and all of its content. Dragging a section into a column is now rejected up front, and the core `addBlock` / `moveBlock` APIs refuse to nest a section into a column, so the invalid state can no longer be created. (#292)
- 710c9be: Add an optional `borderRadius` (px) to section blocks. Set it from the section toolbar or via `createSectionBlock({ borderRadius })`; the renderer emits it as `border-radius` on the `mj-section`, so a section with a background color reads as a rounded card on a contrasting background. Omitted or `0` keeps square corners, so existing templates are unchanged. First step toward the framed "card on colored background" pattern. (#312)
- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/renderer@0.14.0
  - @templatical/media-library@0.14.0
  - @templatical/quality@0.14.0

## 0.13.0

### Minor Changes

- 7ad4adc: Add drag-and-drop image upload (#229). Drag an image file from your computer onto an image block (empty or filled to replace), the sidebar image field, or a custom block's image field to set it — the editor forwards the dropped `File` to your `onRequestMedia` handler via the new optional `MediaRequestContext.files`, exactly like the Browse Media path (upload it and return the URL). In Cloud editors the dropped file is uploaded to your media library automatically. A file dropped anywhere else on the editor is ignored instead of navigating the browser away.

### Patch Changes

- Updated dependencies [7ad4adc]
  - @templatical/media-library@0.13.0
  - @templatical/renderer@0.13.0
  - @templatical/quality@0.13.0

## 0.12.1

### Patch Changes

- 643d05e: Fix block/section background color incorrectly showing `#ffffff` when no color is set. An unset color now reads as "Not set" (a slashed swatch) instead of a fake white, and picking a color equal to the default — e.g. white on a transparent background — now persists and renders correctly instead of being silently dropped. A clear (×) button resets a color back to unset. (#282)
  - @templatical/renderer@0.12.1
  - @templatical/quality@0.12.1
  - @templatical/media-library@0.12.1

## 0.12.0

### Minor Changes

- 7b76e46: Add a `width` option to button blocks: buttons can be set to a fixed pixel width or stretched to full width (`'full'`), independently of their label, instead of always shrinking to fit their content. Omitting `width` keeps the previous content-sized behavior, so existing templates are unaffected (#260).
- c865348: Allow entering a custom image width. The image width control now has a "Custom" option alongside the existing presets (Full width / 300 / 400 / 500) that reveals a pixel input, so images can be sized to any width instead of only the nearest preset (#259).
- a209073: Add website option to social icons

### Patch Changes

- 16d2c46: Fix the button settings panel laying out the Background and Text Color pickers side by side in a two-column grid too narrow to hold each picker's swatch + hex input, clipping the hex field. The two color fields now stack vertically (full width), matching the rest of the panel.
- 67f44fb: Centralize social-icon glyph data (SVG path + brand color) into a single `SOCIAL_ICON_GLYPHS` map in `@templatical/types`, shared by the editor's inline-SVG renderer and the renderer's PNG rasterizer (which previously each kept their own copy). Adding a platform to the `SocialPlatform` union is now a compile error until its glyph exists, so the editor and renderer can no longer drift out of sync. Social platform dropdown labels now resolve through i18n (`social.platforms`) instead of a hardcoded English name.
- 9a1912f: Prevent palette block from disappearing during drag and drop
- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
  - @templatical/renderer@0.12.0
  - @templatical/media-library@0.12.0
  - @templatical/quality@0.12.0

## 0.11.1

### Patch Changes

- 130f8f7: Add a `smallScreenNotice` option (default `true`): on viewports narrower than ~768px the editor now shows a "use a larger screen" notice instead of a cramped, unusable drag-and-drop layout. The palette, canvas, and properties panel can't lay out on a phone and touch dragging is impractical, so this is the honest fallback. Opt out with `smallScreenNotice: false` to render the editor at any width if you handle small screens yourself. Applies to both the OSS and cloud editors (#235).
  - @templatical/renderer@0.11.1
  - @templatical/quality@0.11.1
  - @templatical/media-library@0.11.1

## 0.11.0

### Minor Changes

- c038853: Add a `paletteBlocks` config option to reorder and filter the block palette (#232)

  `init({ paletteBlocks: [...] })` now accepts an allowlist that controls which block types appear in the sidebar palette and in what order. Only the listed types are shown, in the given order — unlisted built-ins (e.g. `video`, `table`) are hidden. Reference built-ins by their bare type (`"image"`) and custom blocks by their `custom:`-prefixed type (`"custom:qrcode"`), so the two can be interleaved freely. Unknown entries (a typo, an unregistered custom block) are logged with a warning and skipped. Filtering the palette never affects rendering — existing content that uses a hidden block type still renders correctly. Omit `paletteBlocks` for the full default palette.

### Patch Changes

- d24805f: Fix the global email background being hidden in the editor when a section has its own background. The background now renders in the gutters around the centered content, matching how it appears when the email is sent (#230).
- 70586b3: Fix the editor clipping its own content on short viewports. The block-types palette is now a scroll region, and the editor's `min-height` floor was lowered so it fills short containers instead of overflowing them — restoring access to the bottom of the palette, the footer, and the config panel's lower controls (#231).
  - @templatical/renderer@0.11.0
  - @templatical/quality@0.11.0
  - @templatical/media-library@0.11.0

## 0.10.4

### Patch Changes

- 8fb5df9: Fix the inline "Browse media" button not inserting an image when the image is nested inside a section (#219)

  `SectionBlock` rendered each nested child block with only a `@fetch-data` listener, whereas `Canvas` (top-level blocks) also forwards `@update`. `ImageBlock` signals a media pick by emitting `update` and holds no editor reference of its own, so an image _inside a section_ emitted into the void and the picked media never landed. The content-sidebar path was unaffected because it updates the selected block by id, independent of nesting. `SectionBlock` now forwards the child's `@update` to `editor.updateBlock`, matching `Canvas`.
  - @templatical/renderer@0.10.4
  - @templatical/quality@0.10.4
  - @templatical/media-library@0.10.4

## 0.10.3

### Patch Changes

- e5908e8: Make the editor and standalone media library independent of the host page's `html { font-size }` (#209).

  The UI's length scale (spacing, font sizes, border radii) is now anchored to a new `--tpl-user-base-size` token that defaults to a fixed `16px`, instead of `rem`. A `rem` always resolves against the document root — even inside the editor's shadow root — so a consumer design system that set e.g. `html { font-size: 8px }` previously shrank the entire editor. It no longer does.

  Consumers on a normal 16px root see identical sizing. To scale the whole UI, set `--tpl-user-base-size` on the editor container (or any ancestor): a px value to enlarge/compact (`18px`, `14px`), or a `rem` value such as `2rem` to deliberately track a custom root font-size. Email content on the canvas is unaffected — it uses the pixel sizes stored on each block.

- Updated dependencies [e5908e8]
  - @templatical/media-library@0.10.3
  - @templatical/renderer@0.10.3
  - @templatical/quality@0.10.3

## 0.10.2

### Patch Changes

- 5676cb3: Fix `Converting circular structure to JSON` when exporting after a drag inside a section (#203)

  Dragging a block within a section column could leave a Sortable expando back-ref (`HTMLDivElement.SortableXXX → instance → el → div`) reachable from the editor's live content. The public `getContent()` serialized with a naked `JSON.stringify`, so it threw on that cycle and broke export until the section was removed.

  - `@templatical/types`: add the cycle-safe `safeClone()` helper (`WeakSet`-replacer JSON round-trip that drops self-referencing back-refs instead of throwing).
  - `@templatical/editor`: `init().getContent()` and `initCloud().getContent()` now clone via `safeClone()`; the pre-ready fallback also defaults to an empty template instead of throwing when no content was supplied.
  - `@templatical/core`: `history.cloneContent()` now reuses `safeClone()` (same behavior, deduplicated).
  - @templatical/media-library@0.10.2
  - @templatical/quality@0.10.2
  - @templatical/renderer@0.10.2

## 0.10.1

### Patch Changes

- c7eb7ae: Fix a batch of correctness and data-loss bugs found during an audit

  Each fix ships with a regression test that fails without the change.
  - **`@templatical/editor` — rich-text URL sanitizer XSS bypass.** `isSafeUrl`
    only `.trim()`-ed the value before scheme matching, so payloads with embedded
    tab/newline/CR or leading control characters (e.g. `java\tscript:…`,
    `\x01javascript:…`) matched no scheme and were treated as safe, yet re-formed a
    live `javascript:` URL once rendered. The value is now normalized the way the
    WHATWG URL parser does (strip ASCII tab/LF/CR anywhere, strip leading
    C0-control/space) before the scheme check.
  - **`@templatical/core` (cloud) — `moveBlock` data loss.** The cloud editor
    spliced a block out of its parent before resolving the destination, so an
    invalid/stale `targetSectionId`, a non-section target, or an out-of-range
    `columnIndex` (all reachable via remote MCP/collaboration `move_block`
    payloads) dropped the block irrecoverably. It now resolves and validates the
    target before mutating the source, mirroring the OSS editor.
  - **`@templatical/core` (cloud) — collaboration broadcast positioning.** The
    `addBlock` broadcast wrapper dropped the 4th `index` argument, so duplicating a
    block or inserting a saved module at a position appended it to the end and
    desynced collaborators. The wrapper now forwards `index` and includes it in the
    broadcast payload.
  - **`@templatical/editor` — table cell edits clobbered in shadow DOM.** The
    `v-cell-content` guard compared `el.ownerDocument.activeElement`, which returns
    the shadow host (never the inner `<td>`) in the default shadow-DOM mount, so a
    concurrent external `update_block` overwrote in-progress keystrokes. It now
    resolves the focused element via `el.getRootNode().activeElement`.
  - **`@templatical/renderer` — display conditions dropped on nested blocks.**
    Blocks inside a section column never received their `{% if %}`/`{% endif %}`
    display-condition guards, so conditional content in a multi-column layout
    rendered unconditionally for every recipient. Display-condition wrapping is now
    applied to nested blocks too.
  - **`@templatical/editor` — snapshot restore failure left wrong content.** When a
    snapshot restore failed, the editor was left showing the previewed snapshot as
    the live document with the banner gone and the backup discarded. The content is
    now rolled back to the pre-preview state on failure, and the restore is no
    longer an unhandled promise rejection.
  - **`@templatical/media-library` — crop resize aspect-ratio distortion.**
    `resizeCanvas` injected a spurious factor when `maxWidth` was set but only
    `maxHeight` clamped, squishing the image horizontally and disagreeing with the
    on-screen preview. It now scales width by `maxHeight / targetHeight`.
  - **`@templatical/import-html` — wrapper-div content reordering.** Loose content
    appearing before a table inside a wrapping `<div>`/`<center>`/`<main>` was
    emitted after the table-derived sections, reordering the document. Pending loose
    content is now flushed before each nested table.
  - **`@templatical/import-html` — paragraph alignment dropped.** A container's
    `text-align` was lost when the inner `<p>` carried a non-style attribute
    (`class`/`id`/`dir`/…). Alignment is now applied with an attribute-tolerant
    matcher that merges into any existing `style`.
  - **`@templatical/import-beefree` — single-column row background dropped.** A
    single-column row's background color was discarded because only multi-column
    rows were wrapped in a section. Single-column rows with a non-transparent
    background are now wrapped in a one-column section carrying the background.

- 5a98533: Close meaningful test-coverage gaps and fix a BeeFree import bug
  - `@templatical/import-beefree`: stop emitting a redundant `font-weight: 400` span (now matches `@templatical/import-unlayer`).
  - `@templatical/editor`: export the merge-tag suggestion `render` factory so the popup lifecycle is unit-testable (behavior unchanged).
  - Added regression tests across editor, import, and media-library packages, and started measuring Vue SFCs in coverage.

- Updated dependencies [c7eb7ae]
- Updated dependencies [2ed1b80]
  - @templatical/renderer@0.10.1
  - @templatical/media-library@0.10.1
  - @templatical/quality@0.10.1

## 0.10.0

### Minor Changes

- ac9eab8: Add `CustomBlockDefinition.stylesheet` — definition-level CSS that emits once into `<mj-head><mj-style>` in the rendered MJML and is mirrored in the editor canvas.

  Custom blocks render as raw HTML inside an `mj-text` cell, which means MJML's automatic responsive behavior (column stacking, fluid images) only applies to the _outer_ layout — not to the internals of a custom block. Previously a developer had no clean place to put per-definition media queries, hover states, or block-specific font declarations; ad-hoc `<style>` blocks inside the `template` ended up in the email body rather than `<mj-head>`, with no dedupe across instances.

  The new `stylesheet?: string` field on `CustomBlockDefinition` solves this:
  - The renderer collects every definition's `stylesheet` from the content tree, dedupes by `customType` _and_ by trimmed content, and emits each unique stylesheet once as an additional `<mj-style>` block alongside the built-in visibility media queries.
  - The editor canvas mirrors the same CSS via a reactive `<style>` element rendered inside the editor root — in shadow-DOM mode it scopes to the shadow root; in light-DOM mode it shares the global stylesheet surface already established by `dist/style.css`.
  - The renderer adds an optional `getCustomBlockStylesheet?: (customType: string) => string | undefined | null` resolver to `RenderOptions`. The editor wires this from its block registry automatically; headless callers provide their own resolver from whatever definitions map they manage.
  - `TemplaticalEditor` (the OSS init return) gains `getCustomBlockStylesheet(customType)` for parity with `renderCustomBlock`.

  Class names in `stylesheet` are **not** scoped by the SDK — namespace them per definition (e.g. `.tplc-<type>-<element>`) to avoid collisions. Email-client caveats apply (Outlook desktop ignores `@media` queries, matching every other media-query-based feature in the SDK such as block visibility).

  Fully backward compatible: existing definitions and renderer callers that omit the new field/option produce the same MJML and editor behavior as before.

  Addresses #155 (raised as the follow-up to #146).

- 5d961a3: Remove the unimplemented `BaseBlock.customCss` per-block CSS surface.

  `BaseBlock.customCss?: string` was a typed field with a "Custom CSS" textarea in the block settings panel, but no renderer ever read it — the field was dead data (same shape as the `styles.responsive` removal in #154). The editor textarea, the type field, and the three locale strings (`customCss` / `css` / `cssPlaceholder`) plus the docs section are removed.

  Per-block free-form CSS is the wrong shape for an email editor: it targets end-users (who typically aren't email-CSS fluent), it doesn't dedupe across instances, and there is no reliable rendering surface for it that survives email-client variance. Custom-block-scoped CSS belongs at the definition level (developer-authored, deduped, emitted to `<mj-head><mj-style>…</mj-style></mj-head>`) — tracked separately in #155.

  **Migration:** saved templates carrying a `customCss` string keep parsing — the extra key is ignored at runtime. No data migration is required; nothing read the field before this change, so no rendered output changes.

- 4309923: Collapse the responsive model to Desktop + Mobile, dropping the `tablet` tier.

  `ViewportSize` is now `"desktop" | "mobile"` and `BlockVisibility` drops its `tablet` field. The editor's viewport toggle no longer offers a Tablet preview, and the renderer emits a single 480px breakpoint (`tpl-hide-mobile` ≤480px, `tpl-hide-desktop` ≥481px) instead of three bands. A "tablet" breakpoint isn't a meaningful concept for email (bodies are ~600px wide; a tablet viewport renders at full desktop width), and the useful responsive split is binary — mobile vs. not-mobile, matching MJML's model.

  **Migration:** saved templates carrying `visibility.tablet` keep parsing — the extra key is ignored at runtime. A block previously hidden only on tablet (`tablet: false` with `desktop`/`mobile` true) will now show on 481–768px devices, because there's no longer a `tpl-hide-tablet` class. No data migration is required; re-saving a block normalizes its visibility object to the new shape.

- af913bb: Remove `margin` from `BlockStyles`.

  `margin` was a canvas-only style: it surfaced in the block settings panel and applied to the editor wrapper, but the renderer never read it, so it was dropped from the exported email — a WYSIWYG mismatch. Email spacing is expressed via `padding` (the renderer honors it on every block), so `margin` added a second, unreliable spacing control with no email output.
  - `BlockStyles.margin` is removed from the type and from `createDefaultStyles()`.
  - The Margin inputs are removed from the block settings panel, and the editor canvas no longer applies a wrapper margin.
  - The BeeFree, Unlayer, and HTML importers no longer emit a `margin` field on converted blocks.

  Use `padding` for block spacing. Persisted templates that still carry a `margin` key load fine — the extra field is ignored.

- 72e1e58: Remove the unimplemented `BlockStyles.responsive` / `ResponsiveStyles` surface and make preview mode honor block visibility.

  `styles.responsive` (tablet/mobile padding overrides) was typed and documented but read by neither the renderer nor the editor preview, so the values were dead data (#146). The `ResponsiveStyles` type, the `responsive` field on `BlockStyles`, and their docs are removed. Per-breakpoint padding is intentionally not implemented: email clients vary in media-query support (Outlook desktop ignores them entirely) and MJML already stacks columns and scales fluidly on mobile. Use `visibility` for per-viewport show/hide.

  The editor preview now actually hides blocks that are set hidden on the current viewport (previously they were only dimmed with a badge), so the preview matches the exported MJML.

### Patch Changes

- f51fc5b: Add a single `lintTemplate(content, options?)` entry point that runs every linter — accessibility, structure, and links — and returns the merged issue list. Prefer it over calling `lintAccessibility` / `lintStructure` / `lintLinks` individually: new linter categories are picked up automatically by every consumer that funnels through it.

  The editor's live linter (`useTemplateLint`) now calls `lintTemplate` internally; behavior is unchanged. The individual linter exports remain available.

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [4309923]
- Updated dependencies [f51fc5b]
  - @templatical/renderer@0.10.0
  - @templatical/quality@0.10.0
  - @templatical/media-library@0.10.0

## 0.9.1

### Patch Changes

- 3c908d7: Fix theming of the built-in merge tag picker modal. The panel carries the `tpl` token class, which re-declares every design token with light-mode defaults, so without re-establishing the theme locally the picker ignored dark mode and the consumer `theme` config overrides. The panel now sets `data-tpl-theme` and applies the resolved theme styles — matching the pattern used by the other OSS panels (rich-text toolbar, link dialog) — so its surfaces, text, borders, and primary-accent highlight follow the editor theme correctly.
  - @templatical/renderer@0.9.1
  - @templatical/quality@0.9.1
  - @templatical/media-library@0.9.1

## 0.9.0

### Minor Changes

- 4dfe37e: Add a built-in merge tag picker modal. When `mergeTags.tags` is configured without `mergeTags.onRequest`, clicking "Insert merge tag" now opens a searchable, keyboard-navigable picker that lists every tag. The picker supports optional grouping (via a new `group` field on `MergeTag`) and per-tag helper text (via a new `description` field). `onRequest` continues to take precedence when set.

### Patch Changes

- @templatical/media-library@0.9.0
- @templatical/quality@0.9.0
- @templatical/renderer@0.9.0

## 0.8.5

### Patch Changes

- 674571b: Harden HTML/regex hot paths against polynomial-ReDoS and incomplete-sanitization classes flagged by GitHub code scanning. All changes preserve existing public APIs.
  - `@templatical/types`: rewrite `resolveHtmlMergeTagLabels` / `resolveHtmlLogicMergeTagLabels` from a `<span[^>]*…[^>]*>` regex to a single-pass linear scanner. Adversarial inputs that used to take O(n²) now complete in O(n).
  - `@templatical/renderer`: same linear-scanner rewrite for `convertMergeTagsToValues`. Paragraph stripper changed `[^>]*` → `[^<>]*` so it fails fast on `<p<p<p…`-style inputs.
  - `@templatical/quality`: linear-time HTML-comment stripper in `hasNestedAnchors`. An unterminated `<!--` now drops the rest of the input rather than leaving the literal `<!--` behind (closes the incomplete-sanitization gap). The `link.javascript-protocol` rule now also flags `data:` and `vbscript:` URLs — both can encode executable script and were previously only flagged as the lower-severity `link.unsupported-protocol`. Rule ID unchanged; message gained a `{protocol}` placeholder. Severity overrides set against `link.javascript-protocol` continue to apply.
  - `@templatical/import-unlayer` / `@templatical/import-beefree`: replace `<p[^>]*>([\s\S]*?)</p>` paragraph-wrap regex with a linear scanner. Button-label sanitizer now drops unterminated `<script` fragments instead of leaving them in the imported JSON. `parsePxValue` collapses two whitespace quantifiers around an optional `px` so trailing whitespace can't trigger backtracking.
  - CI: every job in `.github/workflows/ci.yml` now runs under a least-privilege `permissions: contents: read` token. Closes the missing-workflow-permissions alerts.
  - Playground Cloudflare Worker: `generateId` switched from `bytes[i] % 62` (biased — indices 0..7 were ~25% more likely than 8..61) to rejection sampling for a uniform distribution over the alphabet.

  Regression coverage added: 13 new tests assert linear-time behavior on 10k–50k-char adversarial inputs (bounded at 500ms), plus correctness tests for the new dangerous-protocol coverage, nested-span rewriting, and button-label sanitization edge cases.

- Updated dependencies [674571b]
  - @templatical/renderer@0.8.5
  - @templatical/quality@0.8.5
  - @templatical/media-library@0.8.5

## 0.8.4

### Patch Changes

- bfa416d: Fix input fields overflowing their container in the template settings panel and other sidebars (issue #115).

  Root cause: Tailwind preflight is disabled (intentional — see CLAUDE.md), so `box-sizing: border-box` was never applied to form elements. The hand-rolled `.tpl` reset block reset `font-family` and button chrome but not `box-sizing`. With `tpl:w-full` (`width: 100%`) plus a horizontal padding utility like `tpl:px-3.5` (28px total), inputs resolved to `content-box` and extended their padding beyond the parent — most visible in the 320px right sidebar.

  Fix: add `box-sizing: border-box` to the form-element reset in `packages/editor/src/styles/index.css`. Affects every `<input>`, `<select>`, `<textarea>`, and `<button>` under `.tpl`. Also resolves the social-toolbar slider/number-input misalignment reported in the same issue.

  Regression locked by `packages/editor/tests/formResetStyles.test.ts`.
  - @templatical/renderer@0.8.4
  - @templatical/quality@0.8.4
  - @templatical/media-library@0.8.4

## 0.8.3

### Patch Changes

- 5c56c19: Fix center alignment in Video and Image blocks (issue #111). When a fixed pixel width was set and alignment was set to "center", the editor preview rendered the block flush-left instead of centered.

  Root cause: the alignment styles mixed the CSS `margin` shorthand with the `marginLeft` longhand in the same Vue style object. Vue patched `margin: "0 auto"` first (expanding to all four longhands including `margin-left: auto`), then patched `marginLeft: undefined` which cleared `margin-left` back to `0`. Result: `margin-right: auto` only, which is left-alignment with extra space on the right.

  Fix: use only longhand `marginLeft` / `marginRight` properties — no shorthand. MJML export was unaffected (the renderer emits `align="center"` on `<mj-image>` directly); only the editor preview was broken.
  - @templatical/renderer@0.8.3
  - @templatical/quality@0.8.3
  - @templatical/media-library@0.8.3

## 0.8.2

### Patch Changes

- Updated dependencies [d835948]
  - @templatical/quality@0.8.2
  - @templatical/renderer@0.8.2
  - @templatical/media-library@0.8.2

## 0.8.1

### Patch Changes

- 75bfd29: Reshape `LintOptions` around per-tool config namespaces. Each linter's severity overrides and tool-specific knobs now live under its own key, and each linter can be disabled individually.

  **`@templatical/quality`**
  - `LintOptions.rules` and `LintOptions.thresholds` moved into their owning linter namespace: `accessibility.rules`, `accessibility.thresholds`, `structure.rules`, `links.rules`. `LintOptions.links` keeps `nonProductionHosts` but now also accepts `links.rules`.
  - Each tool key (`accessibility`, `structure`, `links`) accepts `false` to disable that linter entirely without enumerating its rules — e.g. `lintLinks(content, { links: false })` returns `[]`.
  - New `isLintFullyDisabled(options)` helper returns `true` when no linter would run — either `disabled: true` or all three tool keys set to `false`. The editor uses this gate to skip lazy-loading the package, hide the Issues sidebar tab, and suppress canvas badges. Headless consumers can use it to short-circuit before any linter call.
  - New exported option types: `AccessibilityLintOptions`, `StructureLintOptions`, `LinksLintOptions`, `RuleOverrides`. The old `LintLinksOptions` type is removed (replaced by `LinksLintOptions`).
  - Severity override keys still use the full prefixed rule ID (`a11y.*`, `structure.*`, `link.*`) — the same ID emitted on `LintIssue.ruleId`, so values copied from an issue paste straight into config.

  ```diff
  - lintAccessibility(content, {
  -   rules: { "a11y.img-missing-alt": "warning" },
  -   thresholds: { minFontSize: 16 },
  - });
  + lintAccessibility(content, {
  +   accessibility: {
  +     rules: { "a11y.img-missing-alt": "warning" },
  +     thresholds: { minFontSize: 16 },
  +   },
  + });

  - lintLinks(content, {
  -   rules: { "link.localhost-or-staging": "error" },
  -   links: { nonProductionHosts: ["*.preview.*"] },
  - });
  + lintLinks(content, {
  +   links: {
  +     rules: { "link.localhost-or-staging": "error" },
  +     nonProductionHosts: ["*.preview.*"],
  +   },
  + });
  ```

  **`@templatical/editor`**
  - `init({ lint })` and `initCloud({ lint })` consume the new shape verbatim. When every per-tool key is set to `false` the editor behaves as if `lint.disabled === true`: no chunk download for `@templatical/quality`, no Issues sidebar tab, no inline canvas badges.
  - `useTemplateLint` re-exports the new `isLintFullyDisabled` helper.

- Updated dependencies [75bfd29]
  - @templatical/quality@0.8.1
  - @templatical/renderer@0.8.1
  - @templatical/media-library@0.8.1

## 0.8.0

### Minor Changes

- 6705a64: Add `lintStructure` + `lintLinks` and reshape the quality package around a shared linting surface.

  **`@templatical/quality`**
  - New `lintStructure(content, options?)` linter — 5 rules: `structure.duplicate-block-id`, `structure.section-column-mismatch`, `structure.nested-section`, `structure.empty-section` (auto-fix removes the section), `structure.empty-column`.
  - New `lintLinks(content, options?)` linter — 5 rules covering URL hygiene across every URL-bearing field in the template (anchors in rich text + `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`):
    - `link.javascript-protocol` (error) — flags `javascript:` hrefs that the render-time sanitizer would silently strip.
    - `link.unsupported-protocol` (warning) — flags explicit schemes outside `http`, `https`, `mailto`, `tel`, `sms`.
    - `link.malformed-mailto` (warning) — sanity-checks `mailto:` recipient + domain shape.
    - `link.malformed-tel` (warning) — rejects letters in `tel:` URIs.
    - `link.localhost-or-staging` (warning) — flags URL hosts matching `options.links.nonProductionHosts` (default catches `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`).
  - New `walkUrls(content) → UrlOccurrence[]` helper for headless callers building URL-scoped rules.
  - `LintOptions` gains `links?: { nonProductionHosts?: string[] }` for `link.localhost-or-staging` configuration. `DEFAULT_NON_PRODUCTION_HOSTS` is exported as the baseline.
  - Rule IDs are now namespaced. Every accessibility rule is prefixed with `a11y.` (e.g. `img-missing-alt` → `a11y.img-missing-alt`); structure rules use `structure.`; link rules use `link.`. Severity overrides and message-map keys must use the prefixed form.
  - Type names renamed for cross-linter reuse: `A11yIssue` → `LintIssue`, `A11yOptions` → `LintOptions`, `A11yPatch` → `LintPatch`, `A11yPatchContext` → `LintPatchContext` (now also exposes `removeBlock`), `A11yThresholds` → `LintThresholds`, `DEFAULT_THRESHOLDS` → `DEFAULT_A11Y_THRESHOLDS`. The `RULES` export is now `ACCESSIBILITY_RULES`; new `STRUCTURE_RULES` and `LINK_RULES` exports sit alongside it.
  - New exports: `lintStructure`, `STRUCTURE_RULES`, `formatStructureMessage`, `getStructureMessages`, `SUPPORTED_STRUCTURE_MESSAGE_LOCALES`, `StructureMessageMap`, `StructureRuleMessageId`, `lintLinks`, `LINK_RULES`, `walkUrls`, `UrlOccurrence`, `UrlSource`, `formatLinkMessage`, `getLinkMessages`, `SUPPORTED_LINK_MESSAGE_LOCALES`, `LinkMessageMap`, `LinkRuleMessageId`, `LintLinksOptions`, `ResolvedLinksOptions`, `DEFAULT_NON_PRODUCTION_HOSTS`.

  **`@templatical/editor`**
  - `init({ accessibility })` is renamed to `init({ lint })` — the same option object now drives every linter exported by `@templatical/quality` (accessibility + structure + links).
  - Sidebar tab renamed from "Accessibility" to "Issues" and now shows all three linter families. The composable is `useTemplateLint` (was `useAccessibilityLint`); the inject key is `TEMPLATE_LINT_KEY`; the components are `IssuesPanel.vue` and `BlockIssueBadge.vue`.
  - Section toolbar now rebalances `children` when the columns layout changes (1↔2↔3 / 1-2 / 2-1) — grows pad with empty columns, shrinks merge trailing columns into the last kept column so blocks are never silently dropped. Eliminates the `structure.section-column-mismatch` error that previously fired on every layout change.
  - Editor button reset (`.tpl button { background: none }`) now wrapped in `:where()` so its specificity drops to (0,0,1) and per-button utility classes (e.g. `tpl:bg-[var(--tpl-primary)]`) win. Fixes the Fix-button-renders-transparent bug introduced by the canvas reset; affects every primary-bg button in the editor.

### Patch Changes

- Updated dependencies [6705a64]
  - @templatical/quality@0.8.0
  - @templatical/renderer@0.8.0
  - @templatical/media-library@0.8.0

## 0.7.3

### Patch Changes

- 507c5be: Batch of bug fixes hardening editor correctness and security:
  - **Link dialog rejects dangerous URL schemes.** `javascript:`, `data:`, `vbscript:`, `file:` (plus case-bypasses like `JaVaScRiPt:` and whitespace-padded variants) are now dropped at link-insert time. Safe schemes (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) and `#` anchors still pass through.
  - **`v-html` content sanitized before render.** `ParagraphBlock` and `TitleBlock` now scrub `<script>`/`<style>`/`<iframe>`/`on*` event handlers and unsafe `href` / `src` schemes from `block.content` before binding it to `v-html`. Closes the XSS path where a malicious or compromised template JSON could execute code on canvas load. TipTap-authored content (the common case) is unaffected.
  - **Block duplication regenerates nested IDs.** Cloning a `table`, `social`, or `menu` block previously reused identical `rows[].id` / `cells[].id` / `icons[].id` / `items[].id` from the source, violating the unique-id invariant.
  - **Removing a section clears descendant selection.** Previously, deleting an ancestor with a child selected left `selectedBlockId` dangling on the now-orphan id. The full subtree is walked on remove and selection is cleared if any descendant id matches.
  - **`addBlock` / `moveBlock` validate `columnIndex` against the section layout.** Passing `columnIndex: 5` on a `"2"`-layout section no longer creates phantom columns persisted into JSON; out-of-range indices are rejected and `moveBlock` leaves the source intact.
  - **Media-picker callers guard against post-unmount writes.** `ImageBlock`, `ImageToolbar`, `VideoToolbar`, and the custom-block `ImageField` now check an alive flag after `await onRequestMedia()`. Closing the editor mid-pick no longer triggers zombie `emit("update")` / pulse-ref writes on a torn-down component.
  - **Keyboard shortcuts scoped to the active editor when two are mounted.** Each `useEditorCore` instance previously installed its own `document` keydown listener, so a single `Cmd+Z` fired both editors' undo handlers. The new `activeEditorTracker` routes shortcuts to the editor the user most recently interacted with (single-editor pages keep the original always-active behavior).
  - **`MergeTagSuggestion` cancels its pending `requestAnimationFrame` on exit.** The reposition-after-paint frame previously ran after the popup tore down, pinning the Vue app and DOM nodes for one frame.
  - **`useMergeTagField.insertMergeTag` no longer emits after the host component unmounts.** A scope-dispose flag now gates the post-`await requestMergeTag()` writes (emit + `isEditing` + `nextTick`).
  - **`useFonts.loadCustomFonts` no longer flips `isLoaded` after dispose.** The post-`Promise.allSettled` write is gated by the same scope-dispose flag.
  - @templatical/media-library@0.7.3
  - @templatical/renderer@0.7.3
  - @templatical/quality@0.7.3

## 0.7.2

### Patch Changes

- 5d1b0c5: Block clone now inserts directly after the source block (in the same section column when applicable) instead of appending to the end of the canvas. Action bar now follows the editor's UI theme — appears dark in editor dark mode instead of being forced light by the canvas-wrapper override. Canvas dark-mode preview refactored: filter moved from `.tpl-canvas-wrapper` onto a sibling bg layer + per-block `.tpl-block-content` wrapper, so block chrome (action bar, indicators) is never inside the filter region — no more counter-filter flicker when toggling dark preview. Fixes drag-inside-section in Chrome: all three `<VueDraggable>` instances (sidebar, canvas, section) now use `force-fallback` to bypass Chrome's silent failure to initiate native drag from a nested HTML5 Sortable AND to ensure consistent cross-list drag-over coordination (Sortable only binds native `dragover` in HTML5 mode, so mixing modes breaks cross-list drops). Fixes a `cyclic object value` error that broke clone/move after a within-section drag — `history.cloneContent` is now cycle-safe (drops back-refs instead of throwing) and `SectionBlock.setColumnBlocks` deep-clones each emitted block to strip any Sortable expando the drag handler might attach. Adds `findBlockLocation(blockId)` to `useEditor` (and the cloud variant) and an optional `findBlockLocation` option on `useBlockActions` to power the new "insert clone after source" behavior.
  - @templatical/media-library@0.7.2
  - @templatical/renderer@0.7.2
  - @templatical/quality@0.7.2

## 0.7.1

### Patch Changes

- 254a204: Render social icons as hosted PNGs instead of inline SVG data URIs so they display in Outlook desktop (the Word rendering engine has no SVG support and rejects base64 in `<img src>`). PNGs are shipped with the npm package and served via the version-pinned unpkg URL by default; override via the new `RenderOptions.socialIconsBaseUrl` to self-host. Replace the Style segmented control in the social icons sidebar with a native dropdown so the 5-option list no longer overflows the sidebar.
- Updated dependencies [254a204]
  - @templatical/renderer@0.7.1
  - @templatical/quality@0.7.1
  - @templatical/media-library@0.7.1

## 0.7.0

### Minor Changes

- 2832f5d: Mount the editor inside a Shadow DOM by default. `init({ container })` now resolve `shadowDom: true` when the option is omitted — host page stylesheets no longer cascade into editor elements (`p`, `h1`, `a`, `input`, etc.) via tag selectors, closing [issue #70](https://github.com/templatical/sdk/issues/70).

  **Behavior changes consumers may notice:**
  - External `document.querySelector("#editor .tpl-…")` queries no longer reach editor internals because the editor's DOM lives inside `container.shadowRoot`. Walk the shadow root explicitly (`container.shadowRoot.querySelector(...)`) or opt out with `shadowDom: false`.
  - Host stylesheets that intentionally styled editor elements via element selectors stop applying. The supported theming protocol is now the `--tpl-user-*` CSS custom property namespace — set `--tpl-user-primary`, `--tpl-user-radius-md`, etc. on the editor container (or any ancestor) and the override inherits across the shadow boundary. The existing `theme` config option still takes precedence and works unchanged.
  - Browser minimums in default mode bump to Firefox 101+ and Safari 16.4+ (required by the `adoptedStyleSheets` API). Chrome / Edge 80+ is unchanged. Pass `shadowDom: false` to keep the previous light-DOM mount with broader browser support.

  The `shadowDom: false` escape hatch remains supported.

### Patch Changes

- @templatical/renderer@0.7.0
- @templatical/quality@0.7.0
- @templatical/media-library@0.7.0

## 0.6.7

### Patch Changes

- 2afaea1: Simplify locale resolution in `@templatical/editor` and `@templatical/media-library` and align behavior between the two. Both packages now share the same canonicalization step (trim, treat `_` as `-`, lowercase) so locales like `pt_BR` are accepted alongside `pt-BR`. The editor's exact-then-base fallback logic is deduplicated behind a single helper used by `resolveLocale`, `isLocaleSupported`, and `isCloudLocaleSupported`. `@templatical/editor` now re-exports `getSupportedLocales`, `getSupportedCloudLocales`, `isLocaleSupported`, `isCloudLocaleSupported`, and `getBaseLocale` from its public entry point so consumers can drive their own locale pickers without reaching into the i18n subpath. No behavior change for any existing locale input; this is purely cleanup and a small API surface addition.
- Updated dependencies [2afaea1]
  - @templatical/media-library@0.6.7
  - @templatical/renderer@0.6.7
  - @templatical/quality@0.6.7

## 0.6.6

### Patch Changes

- 4bdf972: Fix Title block rendering as `<p>` inside the editor canvas. The exported MJML/HTML already used the correct `<h${level}>` tag, but the canvas wrapped TipTap's stored content in a plain `<div>` and left the outer `<p>` from the editor's paragraph node in place, so the editor preview diverged from the final email and consumer CSS rules targeting `p` could unintentionally style titles in the canvas. The non-editing branch of `TitleBlock` now renders `h1`–`h4` matching `block.level` and strips the single outer `<p>` wrapper using the same rule the renderer applies. No data migration is needed — existing templates already carry `level` and render correctly on reload. Consumers that previously overrode title styling via `.tpl-text-content p` selectors in the canvas should switch to heading selectors (`h1`–`h4`) to match the exported output.
  - @templatical/renderer@0.6.6
  - @templatical/quality@0.6.6
  - @templatical/media-library@0.6.6

## 0.6.5

### Patch Changes

- 9274721: Replace `vuedraggable` with `vue-draggable-plus`. The previous draggable library shipped a UMD-only bundle whose `define.amd` wrapper got inlined into our published editor chunks, causing `error TP1200 unsupported AMD define() dependency element form` for any Next.js 15+ consumer using Turbopack (the default). The new library ships proper ESM, so the published bundle no longer contains UMD/AMD wrappers and Turbopack builds succeed. No public API change.
  - @templatical/renderer@0.6.5
  - @templatical/quality@0.6.5
  - @templatical/media-library@0.6.5

## 0.6.4

### Patch Changes

- 3845ea9: Fix Webpack 5 production build failure on `@templatical/media-library` (issue #63). The dynamic `import()` for the cloud media browser was missing the `try/catch` wrapper that the other three optional peers (`pusher-js`, `@templatical/quality`, `@templatical/renderer`) already had. Without it, Webpack escalates "Module not found" from a warning to an error and breaks the consumer's production build. Wraps the import so OSS consumers (no cloud, no media-library installed) can build cleanly. Adds a regression test that builds the editor as a real Webpack 5 consumer would (`pnpm run test:webpack-consumer`, wired into CI). Vite, esbuild, and Rolldown were unaffected.
  - @templatical/renderer@0.6.4
  - @templatical/quality@0.6.4
  - @templatical/media-library@0.6.4

## 0.6.3

### Patch Changes

- ef598bd: Fix missing video block configuration panel. Selecting a video block in the canvas previously showed only the common spacing/background/display settings — there was no way to set the video URL, custom thumbnail, alt text, width, alignment, or open-in-new-tab from the sidebar. Adds a `VideoToolbar` matching the parity of `ImageToolbar`, including merge-tag-aware URL/thumbnail inputs and a media browser button when an `onRequestMedia` handler is configured.
  - @templatical/renderer@0.6.3
  - @templatical/quality@0.6.3
  - @templatical/media-library@0.6.3

## 0.6.2

### Patch Changes

- de4b0a3: Polish and general bug fixes
- Updated dependencies [de4b0a3]
  - @templatical/renderer@0.6.2
  - @templatical/media-library@0.6.2
  - @templatical/quality@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [b79c7cd]
  - @templatical/quality@0.6.1
  - @templatical/renderer@0.6.1
  - @templatical/media-library@0.6.1

## 0.6.0

### Minor Changes

- 55002de: Introduce `@templatical/quality` — an MIT-licensed accessibility linter for Templatical email templates — and wire it into the editor.

  **New package: `@templatical/quality`**
  - `lintAccessibility(content, options?)` — synchronous, pure, no DOM. Walks the JSON `TemplateContent` tree and runs every enabled rule, returning `A11yIssue[]` with `severity`, `message`, `blockId`, and an optional `fix` patch.
  - 19 deterministic rules across images, headings, links, text, buttons, and structure (missing alt, filename-style alt, low contrast, vague CTAs, heading-skip, multiple H1, target=\_blank without rel=noopener, all-caps, undersized touch targets, missing preheader, …). Three rules ship one-click auto-fixes.
  - Public utilities: `walkBlocks`, `getContrastRatio` (WCAG sRGB), `parseHex`, `isOpaqueHex`, `extractAnchors`, `extractText`, `getDictionary`, `formatMessage`, `getMessages`. Plus `Rule`, `RuleHit`, `RuleMeta`, `A11yIssue`, `A11yOptions`, etc.
  - Per-rule severity overrides (`'error' | 'warning' | 'info' | 'off'`) and configurable thresholds (`altMaxLength`, `minFontSize`, `allCapsMinLength`, `minTouchTargetPx`).
  - Locale-aware: rule messages and vague-text dictionaries auto-discover via `import.meta.glob` (drop a `messages/<lang>.ts` or `dictionaries/<lang>.ts` and it's bundled). The dictionary is a cross-locale union — a German-locale email with an English "Click here" button still flags. Ships `en` + `de` today.

  **Type changes (`@templatical/types`)**
  - `TemplateSettings.locale` (optional, defaults to `'en'`) — drives rendered `<mjml lang="…">`.
  - `ImageBlock.decorative` (optional boolean) — when true, the renderer forces `alt=""` and adds `role="presentation"`.
  - `PlanConfig.accessibility.blockOnError` (cloud) — server-side policy hook.

  **Renderer changes (`@templatical/renderer`)**
  - Emits `<mjml lang="…">` from `settings.locale`.
  - Honors `ImageBlock.decorative` (empty alt + role="presentation").

  **Editor integration (`@templatical/editor`)**
  - New `accessibility` option on `init()` / `initCloud()` — full `A11yOptions` shape. Optional peer; the dynamic import is gated and tree-shakeable, so the linter chunk never downloads when not used.
  - New `useAccessibilityLint` composable — debounced 500ms re-lint on content changes, applies auto-fixes through the editor's existing `updateBlock` / `updateSettings` (history-tracked, undoable per fix).
  - New right-sidebar "Accessibility" tab (lazy-loaded). Errors / Warnings / Info groups with localized messages, "Jump to block" and "Fix" buttons, count badge.
  - New inline canvas badge inside `BlockWrapper` — `CircleAlert` for errors, `TriangleAlert` for warnings.
  - New "Decorative image" toggle on `ImageToolbar` bound to `block.decorative`.
  - Editor mode forces the linter `locale` to match `init({ locale })` — `accessibility.locale` is overwritten on the way through. Headless callers keep full control.
  - Cloud save-gate: when `planConfig.accessibility.blockOnError === true` and the linter reports any errors, the save flow surfaces a confirmation modal. Both the toolbar Save button and the `Cmd/Ctrl+S` keyboard shortcut route through the gate.
  - New i18n keys (`accessibility.*` in `en` / `de` OSS chunks; `saveGate.*` in cloud chunks).
  - CDN bundle ships `@templatical/quality` and `@templatical/renderer` as separate code-split chunks, so CDN consumers don't install the optional peer manually.

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/quality@0.1.0
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.5.1

### Patch Changes

- 6a17329: Fix several merge-tag UX bugs:
  - **Insert button no longer renders without an `onRequest` callback.** When only static `mergeTags.tags` were configured, the "Insert merge tag" button still showed in the rich-text toolbar, `MergeTagInput`, and `MergeTagTextarea`, but clicking it silently no-oped (`requestMergeTag` returns null without `onRequestMergeTag`). Static-tags users discover tags via the autocomplete typing trigger; the button now only appears when `onRequest` is wired up. Renamed the underlying flag from `isEnabled` → `canRequestMergeTag` for clarity.
  - **Autocomplete popup positioning no longer breaks on consumer pages with transformed ancestors.** The popup used to mount inside `[data-tpl-theme]` (the editor wrapper) and rely on `position: fixed` resolving against the viewport. Any `transform` on a consumer-page ancestor (route transitions, reveal animations) makes that ancestor the containing block for fixed descendants — the popup landed off-screen instead of pinning to the caret. Popup now mounts to `document.body` and snapshots `--tpl-*` design tokens + typography from the editor's theme root inline so styling carries over without inheriting `.tpl` base rules.
  - **Popup rounded corners restored.** `MergeTagSuggestionList` was referencing the undefined `--tpl-radius-md` token; switched to `--tpl-radius`.

  Cleanup: leftover "placeholder" copy in editor and playground i18n strings (and corresponding docs in `apps/docs`) is updated to "merge tag" where it referred to the merge-tag concept rather than HTML input placeholder text.
  - @templatical/renderer@0.5.1
  - @templatical/media-library@0.5.1

## 0.5.0

### Patch Changes

- @templatical/renderer@1.0.0
- @templatical/media-library@1.0.0

## 0.4.0

### Minor Changes

- f5a94ab: Add new `@templatical/import-unlayer` package that converts Unlayer design JSON (the output of `editor.saveDesign(...)`) into Templatical's `TemplateContent` shape. Mirrors `@templatical/import-beefree`: maps `text`, `heading`, `image`, `button`, `divider`, `html`, `menu`, `social`, `video`; reports `timer` as html-fallback and `form` as skipped; flattens 4+ column rows; surfaces a per-content conversion report. MIT-licensed.

  The Unlayer migration guide (`/guide/migration-from-unlayer` and `/de/guide/migration-from-unlayer`) is rewritten around the importer. The playground replaces the BeeFree-only chooser button with a single "Import existing template" modal that exposes BeeFree and Unlayer as tabs. README, license FAQ, security policy, and contributing guide reflect the new package; cloud headless API reference adds the matching `templates/import/from-unlayer` route row.

### Patch Changes

- Updated dependencies [f5a94ab]
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.3.2

### Patch Changes

- b29848a: Fix a batch of bugs uncovered by a targeted audit:
  - **`@templatical/editor` `useFocusTrap`**: the focus-restore `requestAnimationFrame` is now cancelled when the trap deactivates before the frame fires, so it no longer touches stale DOM. A second activation (e.g. container ref swapped while still active) now tears down the previous keydown listener before binding a new one, preventing duplicate listeners.
  - **`@templatical/editor` `useMergeTagField.insertMergeTag`**: a rejection from `requestMergeTag()` no longer leaves `insertingMergeTag` stuck at `true` and locking out `stopEditing()`. The flag is now reset in a `finally`.
  - **`@templatical/editor` bundle-stats Vite plugin**: a failure inside the stats-generation `closeBundle` hook (missing dist file, unexpected layout) no longer crashes the editor build. The plugin warns and skips instead.
  - **`@templatical/editor` `useRichTextLinkDialog`**: `mailto:`, `tel:`, `ftp:`, and `#anchor` URLs are no longer mangled by an unconditional `https://` prefix. Only bare hostnames/paths get the scheme prepended.
  - **`@templatical/editor` `useKeyboardReorder`**: pressing Escape after a lifted block was moved across containers (e.g. concurrent drag) now correctly restores it. The cancel logic compares the full original location, not just the index.
  - **`@templatical/editor` `formatRelativeTime`**: an invalid date string now returns `null` instead of `"NaN days ago"`.
  - **`@templatical/editor` `SlidingPillSelect`**: the sliding pill is now hidden when `modelValue` matches no option, instead of silently parking on the first one and producing an `aria-checked` mismatch.
  - **`@templatical/editor` `useCloudMediaLibrary.handleRequestMedia`**: a second call while the built-in media library is open no longer leaves the first call's promise hanging forever. The pending promise is now resolved with `null` before opening a new picker.
  - **`@templatical/renderer` table & menu colors**: `borderColor`, `headerBackgroundColor`, `separatorColor`, and menu `item.color` are now run through a CSS-value escaper that strips `;`, `{`, `}`, and newlines. Tampered or AI-generated color values can no longer break out of the inline `style="color: …"` attribute to inject extra properties (e.g. `background: url(…)` for open-tracking).
  - **`@templatical/renderer` title block**: title content stored as TipTap's `<p>...</p>` no longer produces invalid `<h2><p>...</p></h2>` markup. A single outer `<p>` wrapper is stripped before the `<h${level}>` tag is emitted.
  - **`@templatical/renderer` columns**: the three-column layout widths now sum to exactly 100% (the last column rounds to 33.34% instead of 33.33%, eliminating a 0.01% gap that some clients distributed unpredictably).
  - **`@templatical/renderer` image/video/button/menu links**: `target="_blank"` links now also emit `rel="noopener"`, closing a `window.opener` leak when emails are opened in webmail clients.
  - **`@templatical/renderer` custom block background**: `CustomBlock.styles.backgroundColor` now reaches the compiled HTML — the renderer was emitting `<mj-text>` without `container-background-color`, so MJML silently dropped the bg (same class as #26).
  - **`@templatical/renderer` image with empty `src`**: the renderer no longer emits `<mj-image src="">` (which compiles to a broken-image `<img src="">`). Empty-src images are now skipped, mirroring the `video` block's existing behavior.
  - **`@templatical/renderer` title heading levels**: out-of-range `level` values no longer interpolate `font-size="undefinedpx"` and break MJML compilation. Both `font-size` and the heading tag are clamped to a defined entry.
  - **`@templatical/renderer` nested sections**: a `SectionBlock` placed inside a column (via tampered JSON or programmatic API) is now filtered out instead of emitting `<mj-section>` inside `<mj-column>`, which mjml@5 rejects with a hard error.
  - **`@templatical/renderer` button**: `backgroundColor` and `textColor` are now `escapeAttr`'d like every other user-supplied attribute. A `"` in either value can no longer break the surrounding MJML attribute.
  - **`@templatical/renderer` button with empty `url`**: an empty button URL no longer compiles to a clickable `<a href="">` (which navigates to the current page on click). The `href` attribute is omitted entirely when the URL is empty.
  - **`@templatical/renderer` spacer**: spacers now occupy exactly `height` pixels in the exported HTML, matching the editor canvas. `block.styles.padding` no longer inflates a 30px spacer to 50px.
  - **`@templatical/renderer` empty paragraph**: a paragraph with no content (or only `<p></p>` / whitespace) now renders to an empty string instead of a styled `<td>` cell that silently consumes vertical and horizontal whitespace.
  - **`@templatical/renderer` paragraph default font-size**: paragraphs without an explicit font-size now render at 14px to match the editor canvas (Tailwind `text-sm`), not mjml@5's intrinsic 13px default. Per-section TipTap inline `style="font-size: …"` overrides still apply.

- Updated dependencies [b29848a]
  - @templatical/renderer@0.3.2
  - @templatical/media-library@0.3.2

## 0.3.1

### Patch Changes

- 6f343f8: Emit `dist/bundle-stats.json` during the editor build with gzipped totals for the initial static bundle and the lazy chunks. Powers the bundle-size pill on templatical.com — the marketing site fetches the file from unpkg at its own build time so the published number reflects what real consumers see (Vite/webpack/Rollup preserve dynamic-import boundaries) instead of a bundler-server-side overcount.

  File contract:

  ```json
  {
    "version": "x.y.z",
    "initialGzipBytes": 211686,
    "initialRawBytes": 717015,
    "initialFileCount": 30,
    "lazyGzipBytes": 250763,
    "lazyRawBytes": 876728,
    "lazyFileCount": 43,
    "generatedAt": "2026-05-02T12:48:23.883Z"
  }
  ```

  Implemented as a small Vite `closeBundle` plugin in `packages/editor/vite.config.ts` — walks the static-import graph from `templatical-editor.js`, gzips each chunk individually, and treats every other `.js` in `dist/` as lazy. `dist/cdn/` (the separate script-tag distribution) is excluded.
  - @templatical/renderer@0.3.1
  - @templatical/media-library@0.3.1

## 0.3.0

### Minor Changes

- d65bb0f: Merge tag autocomplete in rich text editors. Typing the syntax opener (e.g. `{{` for Liquid/Handlebars, `*|` for Mailchimp, `%%=` for AMPscript) inside a paragraph or title block surfaces a popup of matching merge tags. Selecting an item (mouse click, `Enter`, or `Tab`) inserts the tag as a styled node — same form as the toolbar picker.

  **`@templatical/types`**
  - New `getSyntaxTriggerChar(syntax)` helper that maps a `SyntaxPreset` to its trigger string (`"{{"`, `"*|"`, `"%%="`) or `null` for custom regex syntaxes.
  - `MergeTagsConfig` gains optional `autocomplete?: boolean` (default `true`). Set to `false` to disable the popup while keeping the toolbar picker available.

  **`@templatical/editor`**
  - New `MergeTagSuggestion` TipTap extension built on `@tiptap/suggestion`. Filters tags case-insensitively against `label` and `value`, capped at 10 results.
  - New `MergeTagSuggestionList.vue` popup component — keyboard navigable (`↑`/`↓`/`Enter`/`Tab`/`Esc`), ARIA combobox-compliant (`role="combobox"` + `aria-haspopup`/`aria-expanded`/`aria-controls`/`aria-activedescendant` on the contenteditable; `role="listbox"` + `role="option"` + stable per-option ids on the popup).
  - Wired into `ParagraphEditor.vue` and `TitleEditor.vue`. Autocomplete activates only when `tags` is non-empty AND `syntax` matches a built-in preset.
  - Popup mounts at the theme root (outside the Canvas's `filter`-induced containing block) so dark-mode positioning stays correct. Viewport-flip logic places the popup above the caret when there's not enough room below; constrained to `max-h: 50vh` with internal scrolling.
  - New i18n key `mergeTag.suggestionEmpty` (en + de).

  **Behavior**
  - Trigger fires regardless of preceding character (no whitespace requirement) — `.{{` opens the popup just like ` {{`.
  - Custom-regex syntaxes silently disable autocomplete since the trigger string can't be inferred.

  **Cloud editor**
  - Inherited transitively — `CloudEditor.vue` uses the same `ParagraphBlock`/`TitleBlock` components, so autocomplete works there as well with no extra wiring.

### Patch Changes

- Updated dependencies [d65bb0f]
  - @templatical/renderer@1.0.0
  - @templatical/media-library@1.0.0

## 0.2.1

### Patch Changes

- e526711: Fix a batch of bugs uncovered by a targeted audit:
  - **`@templatical/core` `useAutoSave`**: a save scheduled inside the debounce window no longer fires after `enabled` flips to `false` or `pause()` is called. The setTimeout callback now re-checks both gates.
  - **`@templatical/media-library` `init()`**: two rapid `init()` calls no longer orphan the first-mounted Vue app. The "unmount existing" guard moved after the awaits so the second call observes the first instance.
  - **`@templatical/core` `useEditor.moveBlock`**: passing an invalid `targetSectionId` no longer deletes the block. The target section is resolved before the source is mutated, so an invalid target is now a clean no-op.
  - **`@templatical/core` `useEditor` lock checks**: `addBlock` and `moveBlock` now respect `isBlockLocked` for the target section / moved block, matching the existing checks on `updateBlock` and `removeBlock`.
  - **`@templatical/editor` keyboard shortcuts**: `Cmd/Ctrl+S` now triggers save when Caps Lock is on. The handler matches `e.key.toLowerCase() === "s"` to mirror the `z` (undo/redo) handler.
  - **`@templatical/editor` `init()` and `initCloud()`**: same race fix as the media-library one — concurrent calls no longer orphan the first-mounted editor app.
  - **`@templatical/types` `resolveSyntax`**: passing an unknown preset name now falls back to `liquid` instead of returning `undefined` and crashing downstream callers.
  - **`@templatical/editor` `useFonts`**: a custom font that fails to load is now registered for cleanup, so its `<link>` tag is removed on editor unmount instead of leaking in `<head>`.
  - **`@templatical/core` `useHistoryInterceptor`**: history snapshots are no longer recorded for no-op mutations (e.g. updating a peer-locked block), preventing the undo button from becoming a silent no-op.
  - **`@templatical/editor` `useRichTextEditor`**: unmounting the host component while TipTap extensions are still loading no longer leaks a TipTap editor instance. A `destroyed` guard short-circuits and disposes any editor created across the await boundary.
  - **`@templatical/media-library` `useMediaLibrary.loadItems` / `loadMore`**: a stale `browseMedia` response from a previous folder no longer overwrites the current view. Each request carries a monotonic token and only the latest response commits to state.
  - **`@templatical/types` `isMergeTagValue`**: handlebars logic tags such as `{{#if x}}` and `{{/if}}` are no longer misclassified as value merge tags by the liberal handlebars value regex.

- Updated dependencies [e526711]
  - @templatical/media-library@0.2.1
  - @templatical/renderer@0.2.1

## 0.2.0

### Minor Changes

- 058dfff: This release bundles three changes: an OSS/Cloud locale split, a fix for missing custom blocks in MJML/JSON exports, and a fix for incorrect background-color attributes on inner MJML elements.

  ## OSS/Cloud locale split

  Split `@templatical/editor` translations into OSS and cloud chunks so external locale contributions only need to cover the open-source surface.

  **Editor i18n changes**
  - Added `packages/editor/src/i18n/locales/cloud/{en,de}.ts` containing strings used only by `initCloud()` features: AI chat / rewrite / menu, comments, collaboration, scoring, snapshots, plan limits (`header.*`), test email, saved modules, design reference, cloud loading/error overlays. These groups were removed from the OSS `locales/{en,de}.ts`.
  - New exports from `@templatical/editor`: `loadCloudTranslations(locale)`, `getSupportedCloudLocales()`, `isCloudLocaleSupported(locale)`, type `CloudTranslations`.
  - New injection key `CLOUD_TRANSLATIONS_KEY` and composables `useCloudI18n()` (returns `CloudTranslations | null` for shared components that conditionally render cloud UI) / `useCloudI18nStrict()` (throws if not provided, for cloud-only components).
  - `initCloud()` now loads OSS + cloud translation chunks in parallel and provides both. `init()` (OSS) loads only the OSS chunk — the cloud strings are tree-shaken from the OSS bundle.
  - Supported-locale lists are auto-derived via `import.meta.glob`. OSS and cloud locales are tracked separately, so an OSS-only contributor adding `locales/fr.ts` without `locales/cloud/fr.ts` ships a French OSS UI while the cloud chunk gracefully falls back to English at runtime.

  **Locale parity enforcement**
  - Type-driven: every non-`en` locale file is now annotated `: typeof en` so missing/extra/mistyped keys fail `pnpm run typecheck`.
  - Runtime: `tests/i18n.test.ts` discovers locale files via `import.meta.glob` and asserts nested-key parity plus per-key `{placeholder}` parity. OSS parity is hard-required; cloud parity is skip-if-absent (only enforced for cloud locales that exist on disk). Same pattern applied to `@templatical/media-library`.

  **Migration notes for embedders**
  - No public API removals. `Translations`, `useI18n()`, `loadTranslations()`, `getSupportedLocales()`, `isLocaleSupported()`, `TRANSLATIONS_KEY` keep their previous names and behavior — they just refer to the OSS surface now.
  - If you imported cloud-only string paths through `Translations` (e.g. `t.aiChat.title`), switch to `useCloudI18n()` / `useCloudI18nStrict()`. Within `initCloud()` the cloud strings are still available; they are no longer present on the OSS `Translations` type.
  - Existing locale overrides passed to `init()` / `initCloud()` continue to work. Cloud overrides are not yet a supported public input — only locale strings are.

  ## Custom blocks now appear in MJML/JSON exports

  Custom blocks were missing from MJML/JSON exports because their rendered HTML was never persisted from the editor's UI ref into the export pipeline. The fix moves custom-block resolution into the renderer itself as an explicit contract.

  **Renderer**
  - `renderToMjml(content, options?)` is now **async** (`Promise<string>`). Custom blocks may need async resolution.
  - New `RenderOptions.renderCustomBlock?: (block: CustomBlock) => Promise<string>` option. The renderer walks the tree, awaits all custom-block resolutions in parallel, then runs the existing sync render pass.
  - If no callback is provided, the renderer falls back to `block.renderedHtml` (if present) and otherwise omits the custom block from output.

  **Editor**
  - `editor.toMjml()` is now `Promise<string>` (was sync), always present (was optional). Wires the editor's internal block registry into the renderer's `renderCustomBlock` callback automatically.
  - If `@templatical/renderer` is not installed, `toMjml()` throws a clear error — the renderer remains an optional peer dependency.
  - New method `editor.renderCustomBlock(block): Promise<string>` for headless callers that want to drive the renderer directly while reusing the editor's registry.
  - The Cloud editor does **not** expose `toMjml()` — the cloud backend handles MJML conversion server-side with additional processing (signed image URLs, asset rewriting). Use the OSS `init()` if you want client-side export.

  **Migration**
  - Add `await` everywhere you call `editor.toMjml()` or `renderToMjml(content)`.
  - Drop any optional-chain (`editor.toMjml?.()`) — the method is always defined now.
  - Headless / Node.js consumers calling `renderToMjml` directly with custom blocks should pass a `renderCustomBlock` resolver (e.g. a Liquid engine running against `block.fieldValues`) — see the renderer README for the full pattern.

  ## MJML inner-element background colors now render correctly

  Inner MJML elements (`mj-text`, `mj-image`, `mj-table`, `mj-navbar`, `mj-video`) only support `container-background-color` per the MJML spec; passing `background-color` was silently dropped by MJML compilers, leaving the rendered email's `<td>` wrapper without a background. The renderer now emits the correct attribute. `mj-section` and `mj-button` continue to use the native `background-color` attribute they natively support.

  The rule is centralized in a new `bgAttr(color, "container" | "native")` helper so future renderers can't regress, and round-trip MJML→HTML compile tests (`tests/mjml-bg-roundtrip.test.ts`) catch the silent-drop class of bug.

### Patch Changes

- Updated dependencies [058dfff]
  - @templatical/renderer@0.2.0
  - @templatical/media-library@0.2.0

## 0.1.2

### Patch Changes

- 31a59c0: Fix editor interactivity broken in 0.1.1.

  In 0.1.1 we bundled Vue inline but left `@templatical/core` and `@templatical/types` as external dependencies. Because `@templatical/core` imports reactivity primitives from `@vue/reactivity` (the standalone package), and the editor bundle shipped Vue's full runtime (which contains its own copy of the reactivity system), consumers ended up with **two separate reactivity instances at runtime** — each with its own dep-tracking `WeakMap`. Refs created by `@templatical/core`'s `useEditor` were never tracked by the editor's render functions, so clicks, drags, and every state mutation silently no-op'd: the editor rendered initial chrome but ignored all user input.

  This release bundles `@templatical/core`, `@templatical/types`, and all transitive Vue libraries (`@vueuse/core`, `vuedraggable`, `@tiptap/*`, `@lucide/vue`) **inline** into the editor's npm entry, with `vue` and `@vue/reactivity` deduped to a single instance via Vite's `resolve.dedupe`. The editor is now a truly self-contained drop-in:
  - Consumer install drops from 149 → 71 packages (no `vue`, no `@vue/*`, no `@tiptap/*`, no `@templatical/core`/`types` in `node_modules`).
  - Zero peer warnings on `npm install @templatical/editor` for any framework (React, Svelte, Angular, vanilla, Vue).
  - Interactivity works in every consumer setup verified — including a React app with `<div id="editor" />` rendered as a JSX child inside the React tree.

  The only externals that remain are the optional cloud/feature peers a consumer explicitly opts into: `@templatical/media-library`, `@templatical/renderer`, `pusher-js`.

  **Note for SDK contributors:** when adding a new runtime dependency to the editor that uses Vue's reactivity (or imports from `@vue/reactivity` directly), it MUST be bundled inline (i.e. listed in `devDependencies`, not `dependencies`, and not in `rolldownOptions.external`). Adding such a dep as a runtime/peer dep reintroduces the duplicate-reactivity bug.
  - @templatical/renderer@0.1.2
  - @templatical/media-library@0.1.2

## 0.1.1

### Patch Changes

- bdb338b: Fix consumer install/bundle of `@templatical/editor`.
  - **`@templatical/editor`/style.css export** — CSS now emits as `dist/style.css` so the `./style.css` subpath export resolves. Previously emitted as `dist/templatical-editor.css`, causing 404s for `import '@templatical/editor/style.css'` and breaking sandbox bundlers (bundlephobia, bundlejs).
  - **`@templatical/editor` peer deps** — `vue` and `tailwindcss` removed from `peerDependencies`. Vue is now bundled into the npm entry; Tailwind is build-time only (CSS already compiled). `npm install @templatical/editor` is now a complete install for any consumer (React, Svelte, Angular, vanilla, Vue) with no peer warnings. **Note for Vue app consumers:** Vue is now isolated inside the editor (Stripe-Elements pattern). Your Vue tree is unaffected, but Vue is shipped twice (~80KB gz duplicated).
  - **`@templatical/core`/cloud pusher-js** — clearer error when cloud features are used without the `pusher-js` optional peer installed.

- Updated dependencies [bdb338b]
  - @templatical/core@0.1.1
  - @templatical/media-library@0.1.1
  - @templatical/types@0.1.1
  - @templatical/renderer@0.1.1

## 0.1.0

### Minor Changes

- 180d247: Initial production release

### Patch Changes

- @templatical/types@0.1.0
- @templatical/core@0.1.0
- @templatical/renderer@0.1.0
- @templatical/media-library@0.1.0

## 0.0.6

### Patch Changes

- 41c11bb: Dependency update
  - @templatical/types@0.0.6
  - @templatical/core@0.0.6
  - @templatical/renderer@0.0.6
  - @templatical/media-library@0.0.6

## 0.0.5

### Patch Changes

- a32206e: Polish and component extraction
  - @templatical/types@0.0.5
  - @templatical/core@0.0.5
  - @templatical/renderer@0.0.5
  - @templatical/media-library@0.0.5

## 0.0.4

### Patch Changes

- 6f234f4: Fix CDN version of Editor + Style and animation fixes
- Updated dependencies [6f234f4]
  - @templatical/media-library@0.0.4
  - @templatical/types@0.0.4
  - @templatical/core@0.0.4
  - @templatical/renderer@0.0.4

## 0.0.3

### Patch Changes

- ce3297e: Test coverage and Media Library CDN build
- Updated dependencies [ce3297e]
  - @templatical/media-library@0.0.3
  - @templatical/types@0.0.3
  - @templatical/core@0.0.3
  - @templatical/renderer@0.0.3

## 0.0.2

### Patch Changes

- c1de323: Include CDN build (ES module with code-split chunks) in the editor package at dist/cdn/. Drop IIFE build in favor of ES-only output for smaller initial load. Add pusher-js as a dependency in core for typecheck support.
- c1de323: Countdown block for cloud editor
- Updated dependencies [c1de323]
- Updated dependencies [c1de323]
  - @templatical/core@0.0.2
  - @templatical/media-library@0.0.2
  - @templatical/renderer@0.0.2
  - @templatical/types@0.0.2
