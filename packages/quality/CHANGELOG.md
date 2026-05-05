# @templatical/quality

## 0.6.1

### Patch Changes

- b79c7cd: Fix four bugs in `@templatical/quality`:
  - **`text-all-caps` now flags non-Latin scripts.** The previous Latin-only character class silently passed all-caps Cyrillic, Greek, Vietnamese, and other non-Latin scripts. The rule now uses the Unicode `\p{L}` class with locale-aware case comparison, so `СКИДКА ПЯТЬДЕСЯТ ПРОЦЕНТОВ…` and `ΜΕΓΑΛΗ ΠΡΟΣΦΟΡΑ…` are reported just like English shouty caps.
  - **`img-linked-no-context` is now locale-aware.** Action-verb hints were hardcoded English, which produced false positives on every German / French / Portuguese alt text. The hints have moved into the dictionary registry as a new `linkedImageActionHints` field, with the same cross-locale union semantics as `vagueLinkText` and `vagueButtonLabels`. Locale contributors should add their language's action verbs (single tokens, e.g. `"kaufen"`, `"compre"`) when adding a new dictionary file.
  - **`link-target-blank-no-rel` auto-fix.** The fix performed a raw substring `String.replace` against the attribute string, so an earlier attribute whose value happened to contain `rel="…"` (e.g. `data-x='rel="external"'`) could be corrupted instead of the real `rel`. The fix now splices by the attribute's parsed start offset.
  - **`extractAnchors` (public utility).** When a nested `<a>` opened (invalid but parsed permissively), the outer anchor's accumulated prefix text was wiped. Each open anchor now owns its own buffer; nested anchors no longer truncate ancestors.

  The `Dictionary` type exported from `@templatical/quality` gains a required `linkedImageActionHints: string[]` field. Downstream contributors maintaining a custom `dictionaries/<locale>.ts` will see a `typeof en` typecheck error until they add the field — see the updated [Contributing locales](https://docs.templatical.com/quality/accessibility/contributing-locales) guide.
  - @templatical/types@0.6.1

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
  - @templatical/types@1.0.0
