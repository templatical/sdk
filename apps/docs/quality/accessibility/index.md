# Accessibility linter

The accessibility linter is the first feature in [`@templatical/quality`](../). It's an MIT-licensed accessibility checker for Templatical email templates that operates on the JSON `TemplateContent` block tree, runs in the browser or in Node.js, and ships with no Vue or DOM dependencies — so the same package validates templates inside the editor and as a CI gate on stored fixtures.

## Why

Email accessibility is genuinely under-tooled. Most builders either bury accessibility behind a paywall, run shallow content-tone checks, or skip it entirely. We catch the authoring mistakes that recur every day:

- Missing or filename-style alt text
- Low-contrast text and buttons
- Vague link / CTA copy ("click here", "read more")
- Heading-level skips that break the document outline
- Tiny body text, oversized all-caps blocks, undersized touch targets
- `target="_blank"` links missing `rel="noopener"`
- Decorative images that aren't marked as such

Catch problems while you're authoring, not after recipients see broken alt text, unreadable contrast, or vague CTAs. Every rule fires on a clear, named condition, so the output is predictable and stays predictable as templates evolve. The same checks align with the EU Accessibility Act (enforceable June 2025).

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
  <!-- Step 2: Engine (highlighted) -->
  <rect x="230" y="10" width="180" height="80" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="10"/>
  <text x="320" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">lintAccessibility()</text>
  <text x="320" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">block-level rules</text>
  <text x="320" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">+ template-level rules</text>
  <!-- Arrow -->
  <line x1="410" y1="50" x2="445" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 3: Output -->
  <rect x="450" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="540" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">A11yIssue[]</text>
  <text x="540" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">severity · message ·</text>
  <text x="540" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">blockId · optional fix</text>
  <!-- Divider -->
  <line x1="30" y1="130" x2="610" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="320" y="155" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Used by</text>
  <!-- Consumer chips -->
  <rect x="40" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="120" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Sidebar panel</text>
  <text x="120" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">in the editor</text>
  <rect x="240" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="320" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Canvas badges</text>
  <text x="320" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">per-block icons</text>
  <rect x="440" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="520" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Headless / CI</text>
  <text x="520" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">stored templates</text>
</svg>

The package has no opinion on UI. The editor's `useAccessibilityLint` composable lazy-imports `@templatical/quality`, debounces re-lint on content changes, and wires `applyFix(issue)` through the editor's existing block-update path so fixes land as proper undo entries.

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

The package is an **optional peer** of `@templatical/editor`. Install it to turn on the sidebar tab and canvas badges. Skip it and the editor stays lean — the dynamic import is gated and tree-shakeable, so the linter chunk never downloads.

::: tip CDN users
If you load Templatical via CDN, there's nothing to install. The editor's CDN bundle ships `@templatical/quality` as a separate code-split chunk that lazy-loads automatically when the linter is enabled.
:::

## Quick links

- [Getting started](./getting-started) — first lint call (headless), wiring into the editor.
- [Rule catalog](./rule-catalog) — every rule with severity, rationale, and examples.
- [Options](./options) — `disabled`, `locale`, `rules`, `thresholds`.
- [Severity & fixes](./severity-and-fixes) — how the severity model works and how auto-fix patches are applied.
- [Headless usage](./headless-usage) — validating stored templates in CI.
- [Contributing locales](./contributing-locales) — adding vague-text dictionaries for new languages.
