---
"@templatical/quality": minor
"@templatical/editor": minor
---

Add `lintStructure` + `lintLinks` and reshape the quality package around a shared linting surface.

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
