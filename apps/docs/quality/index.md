# Quality

`@templatical/quality` is the umbrella package for Templatical's template-quality tooling — deterministic, JSON-only linters that catch authoring mistakes inside the editor and in headless / CI checks. MIT-licensed, ESM, no Vue, no DOM.

## Linters

| Linter | What it catches | Default severities |
|---|---|---|
| **[Accessibility](./accessibility/)** | Missing alt text, low contrast, vague CTAs, heading-skip, undersized touch targets, ALL CAPS body, target=_blank missing rel, missing preheader, … | mostly error/warning |
| **[Structure](./structure/)** | Duplicate block IDs, sections with the wrong column count, nested sections, empty sections, empty columns | mostly error; some warning |

Both linters return the same `LintIssue` shape and share the same options surface (`LintOptions`) — so consumers can run them in any combination, merge results, and filter by `ruleId` prefix (`a11y.*`, `structure.*`) when grouping.

## Architecture

<svg viewBox="0 0 640 280" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;margin:1.5em auto;display:block;">
  <defs>
    <marker id="ah-quality" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Step 1: Input -->
  <rect x="10" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="100" y="38" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">TemplateContent</text>
  <text x="100" y="60" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">JSON block tree</text>
  <text x="100" y="76" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">from the editor or DB</text>
  <!-- Arrow -->
  <line x1="190" y1="50" x2="225" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 2: Engines (two boxes stacked) -->
  <rect x="230" y="2" width="180" height="44" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintAccessibility()</text>
  <text x="320" y="38" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">a11y.* rules</text>
  <rect x="230" y="54" width="180" height="44" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintStructure()</text>
  <text x="320" y="90" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">structure.* rules</text>
  <!-- Arrow -->
  <line x1="410" y1="50" x2="445" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 3: Output -->
  <rect x="450" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="540" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">LintIssue[]</text>
  <text x="540" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">severity · message ·</text>
  <text x="540" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">blockId · optional fix</text>
  <!-- Divider -->
  <line x1="30" y1="130" x2="610" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="320" y="155" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Consumed by</text>
  <!-- Consumer chips -->
  <rect x="40" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="120" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Issues panel</text>
  <text x="120" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">editor sidebar</text>
  <rect x="240" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="320" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Canvas badges</text>
  <text x="320" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">per-block icons</text>
  <rect x="440" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="520" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Headless / CI</text>
  <text x="520" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">stored templates</text>
</svg>

The package has no opinion on UI. The editor's `useTemplateLint` composable lazy-imports `@templatical/quality`, runs every exported linter on debounced content changes, and merges results into a single issues stream that drives the **Issues** sidebar tab and the per-block canvas badges. `applyFix(issue)` runs each patch through the editor's existing block-update path so fixes land as proper undo entries.

## Install

::: code-group
```bash [npm]
npm install @templatical/quality
```
```bash [pnpm]
pnpm add @templatical/quality
```
```bash [yarn]
yarn add @templatical/quality
```
```bash [bun]
bun add @templatical/quality
```
:::

The package is an **optional peer** of `@templatical/editor`. Install it to turn on the Issues sidebar tab and canvas badges. Skip it and the editor stays lean — the dynamic import is gated and tree-shakeable, so the linter chunk never downloads.

::: tip CDN users
If you load Templatical via CDN, there's nothing to install. The editor's CDN bundle ships `@templatical/quality` as a separate code-split chunk that lazy-loads automatically when linting is enabled.
:::

## Wire into the editor

Pass `lint` to `init()` or `initCloud()`:

```ts
import { init } from "@templatical/editor";

const editor = init({
  container: "#editor",
  locale: "en",
  lint: {
    rules: {
      "a11y.img-missing-alt": "warning",      // soften from default 'error'
      "a11y.text-all-caps": "off",            // turn off entirely
      "structure.empty-column": "info",       // demote to info
    },
    thresholds: { minFontSize: 16 },
  },
});
```

The Issues tab and inline canvas badges appear automatically once the optional peer is resolved. When `lint.disabled === true`, the editor never lazy-loads the package — no chunk download, no UI surface.

## Quick links

- [Options](./options) — `disabled`, `locale`, `rules`, `thresholds` (shared by every linter).
- [Severity & fixes](./severity-and-fixes) — severity model + how auto-fix patches land in the editor.
- [Headless usage](./headless-usage) — validating stored templates in CI / server save handlers.
- [Contributing locales](./contributing-locales) — adding rule messages + vague-text dictionaries.
- [Accessibility linter](./accessibility/) — what it catches, rule catalog.
- [Structure linter](./structure/) — what it catches, rule catalog.
