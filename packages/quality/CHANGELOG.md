# @templatical/quality

## 0.14.0

### Patch Changes

- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/types@0.14.0

## 0.13.0

### Patch Changes

- @templatical/types@0.13.0

## 0.12.1

### Patch Changes

- @templatical/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
- Updated dependencies [a209073]
  - @templatical/types@0.12.0

## 0.11.1

### Patch Changes

- @templatical/types@0.11.1

## 0.11.0

### Patch Changes

- @templatical/types@0.11.0

## 0.10.4

### Patch Changes

- @templatical/types@0.10.4

## 0.10.3

### Patch Changes

- @templatical/types@0.10.3

## 0.10.2

### Patch Changes

- Updated dependencies [5676cb3]
  - @templatical/types@0.10.2

## 0.10.1

### Patch Changes

- Updated dependencies [2ed1b80]
  - @templatical/types@0.10.1

## 0.10.0

### Minor Changes

- f51fc5b: Add a single `lintTemplate(content, options?)` entry point that runs every linter — accessibility, structure, and links — and returns the merged issue list. Prefer it over calling `lintAccessibility` / `lintStructure` / `lintLinks` individually: new linter categories are picked up automatically by every consumer that funnels through it.

  The editor's live linter (`useTemplateLint`) now calls `lintTemplate` internally; behavior is unchanged. The individual linter exports remain available.

### Patch Changes

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [5d961a3]
- Updated dependencies [4309923]
- Updated dependencies [af913bb]
- Updated dependencies [72e1e58]
  - @templatical/types@0.10.0

## 0.9.1

### Patch Changes

- @templatical/types@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [4dfe37e]
  - @templatical/types@0.9.0

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
  - @templatical/types@0.8.5

## 0.8.4

### Patch Changes

- @templatical/types@0.8.4

## 0.8.3

### Patch Changes

- @templatical/types@0.8.3

## 0.8.2

### Patch Changes

- d835948: Add `a11y.link-nested-anchor` rule and embrace HTML5-spec anchor parsing.

  **New rule**
  - `a11y.link-nested-anchor` (default severity `error`) flags templates that contain an `<a>` opened inside another open `<a>`. Nested anchors are invalid HTML and email clients render them inconsistently — some flatten, some strip the inner anchor, some break the click target.
  - Detection inspects the raw HTML on `Paragraph` and `Title` blocks via a new exported helper `hasNestedAnchors(html)`, which tokenizes anchor open/close tags and ignores anchor-like text inside HTML comments.
  - Opt out per-template via `lintAccessibility(content, { accessibility: { rules: { "a11y.link-nested-anchor": "off" } } })`, or downgrade with `"warning"` / `"info"`.

  **Behavior change in `extractAnchors`**

  `htmlparser2` 12 (bumped from 9) emits an implicit `</a>` when a second `<a>` opens, matching the HTML5 spec. `extractAnchors` now returns nested anchors as flat siblings rather than merging the outer anchor's surrounding text. For input `'<a href="/outer">prefix <a href="/inner">inner</a> suffix</a>'`:

  ```diff
  - outer.text === "prefix inner suffix"
  + outer.text === "prefix"
  + inner.text === "inner"   // unchanged
  ```

  Text that appears after the inner anchor's close and before the outer's stray `</a>` is outside any open anchor in the spec parse and is not attributed to either. Consumers calling `extractAnchors` directly should check whether their callers relied on the old merged-text behavior; the structural concern (nested-anchor markup) is now captured by `a11y.link-nested-anchor`.

  **New exports**
  - `hasNestedAnchors(html: string): boolean`
  - @templatical/types@0.8.2

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
  - @templatical/types@0.8.1

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

- @templatical/types@0.8.0

## 0.7.3

### Patch Changes

- @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- @templatical/types@0.7.2

## 0.7.1

### Patch Changes

- @templatical/types@0.7.1

## 0.7.0

### Patch Changes

- @templatical/types@0.7.0

## 0.6.7

### Patch Changes

- @templatical/types@0.6.7

## 0.6.6

### Patch Changes

- @templatical/types@0.6.6

## 0.6.5

### Patch Changes

- @templatical/types@0.6.5

## 0.6.4

### Patch Changes

- @templatical/types@0.6.4

## 0.6.3

### Patch Changes

- @templatical/types@0.6.3

## 0.6.2

### Patch Changes

- @templatical/types@0.6.2

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
