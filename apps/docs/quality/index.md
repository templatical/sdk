---
description: MIT-licensed linter for Templatical templates — accessibility, structure, links, deliverability, and compatibility rules via lintTemplate() in the editor or CI.
---

# Quality

`@templatical/quality` is the umbrella package for Templatical's template-quality tooling — deterministic linters that catch authoring mistakes inside the editor and in headless / CI checks. MIT-licensed, ESM, no Vue, no DOM.

## Linters

| Linter | What it catches | Default severities |
|---|---|---|
| **[Accessibility](./accessibility/)** | Missing alt text, low contrast, vague CTAs, heading-skip, undersized touch targets, ALL CAPS body, target=_blank missing rel, missing preheader, … | mostly error/warning |
| **[Structure](./structure/)** | Duplicate block IDs, sections with the wrong column count, nested sections, empty sections, empty columns, heroes that render as regular sections, background images Outlook on Windows can't layer | mostly error; some warning |
| **[Links](./links/)** | Dangerous URL schemes (`javascript:`), unsupported protocols, malformed `mailto:` / `tel:`, relative URLs, staging / localhost URLs leaking into a template | mostly warning; `link.javascript-protocol` is error |
| **[Deliverability](./deliverability/)** | Mismatched URL-shaped link text, shortener links, IP-address links, and image-led emails with little text | warning or info |
| **[Compatibility](./compatibility/)** | Client-breaking pass-through HTML and CSS, plus compiled Gmail size | warning or info |

All five linters return the same `LintIssue` shape and share the same options surface (`LintOptions`) — so consumers can run them in any combination, merge results, and filter by `ruleId` prefix (`a11y.*`, `structure.*`, `link.*`, `deliverability.*`, `compat.*`) when grouping. Each linter's per-rule severities and tool-specific knobs live under its own namespace (`accessibility`, `structure`, `links`, `deliverability`, `compatibility`); set any of them to `false` to disable that linter entirely.

**Run everything in one call.** `lintTemplate(content, options?)` is the single aggregate entry point — it runs all five linters and returns the merged `LintIssue[]` (accessibility, then structure, then links, then deliverability, then compatibility). Reach for it by default; the per-linter functions stay exported for when you want to run just a subset. To skip a category, set its key to `false`: `lintTemplate(content, { structure: false })`. See [Headless usage](./headless-usage).

## Architecture

<svg viewBox="0 0 640 370" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;margin:1.5em auto;display:block;">
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
  <!-- Step 2: Engines (five boxes stacked) -->
  <rect x="230" y="2" width="180" height="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="16" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintAccessibility()</text>
  <text x="320" y="28" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">a11y.* rules</text>
  <rect x="230" y="38" width="180" height="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="52" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintStructure()</text>
  <text x="320" y="64" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">structure.* rules</text>
  <rect x="230" y="74" width="180" height="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="88" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintLinks()</text>
  <text x="320" y="100" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">link.* rules</text>
  <rect x="230" y="110" width="180" height="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="124" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintDeliverability()</text>
  <text x="320" y="136" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">deliverability.* rules</text>
  <!-- Arrow -->
  <rect x="230" y="146" width="180" height="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="160" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintCompatibility()</text>
  <text x="320" y="172" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">compat.* rules</text>
  <line x1="410" y1="50" x2="445" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 3: Output -->
  <rect x="450" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="540" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">LintIssue[]</text>
  <text x="540" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">severity · message · suggestion ·</text>
  <text x="540" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">reference · blockId · optional fix</text>
  <!-- Divider -->
  <line x1="30" y1="205" x2="610" y2="205" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="320" y="230" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Consumed by</text>
  <!-- Consumer chips -->
  <rect x="40" y="255" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="120" y="281" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Issues panel</text>
  <text x="120" y="299" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">editor sidebar</text>
  <rect x="240" y="255" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="320" y="281" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Canvas badges</text>
  <text x="320" y="299" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">per-block icons</text>
  <rect x="440" y="255" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="520" y="281" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Headless / CI</text>
  <text x="520" y="299" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">stored templates</text>
</svg>

The package has no opinion on UI. The editor's `useTemplateLint` composable lazy-imports `@templatical/quality`, runs all linters via the single `lintTemplate` call on debounced content changes, and feeds the merged issues stream into the **Issues** sidebar tab and the per-block canvas badges. `applyFix(issue)` runs each patch through the editor's existing block-update path so fixes land as proper undo entries.

## Install

`@templatical/quality` is an optional dependency of the editor and installs by default. Leaving it out is supported: the editor works without it and hides the Issues tab. For headless use or to add it back, install it explicitly:

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



::: tip CDN users
If you load Templatical via CDN, there's nothing to install. The editor's CDN bundle ships `@templatical/quality` as a separate code-split chunk that lazy-loads automatically when linting is enabled.
:::

## Wire into the editor {#wire-into-the-editor}

Pass `lint` to `init()` or `initCloud()`:

```ts
import { init } from "@templatical/editor";

const editor = init({
  container: "#editor",
  locale: "en",
  lint: {
    accessibility: {
      rules: {
        "a11y.img-missing-alt": "warning",   // soften from default 'error'
        "a11y.text-all-caps": "off",         // turn off entirely
      },
      thresholds: { minFontSize: 16 },
    },
    structure: {
      rules: { "structure.empty-column": "info" }, // demote to info
    },
    links: {
      rules: { "link.localhost-or-staging": "error" }, // promote before send
      nonProductionHosts: ["*.staging.*", "*.preview.*"],
    },
    deliverability: { thresholds: { minTextLength: 250 } },
    compatibility: { thresholds: { maxHtmlBytes: 92_160 } },
  },
});
```

[Open in playground](https://play.templatical.com/scenes/issues)

The Issues tab and inline canvas badges appear automatically once the quality package is available. When `lint.disabled === true` — or when every per-tool key (`accessibility`, `structure`, `links`, `deliverability`, `compatibility`) is `false` — the editor never lazy-loads the package: no chunk download, no UI surface.

Set any single linter to `false` to drop just that tool's rules:

```ts
init({ container: "#editor", lint: { links: false } });
```

## Quick links

- [Options](./options) — `disabled`, `locale`, per-tool `accessibility` / `structure` / `links` / `deliverability` / `compatibility` namespaces.
- [Severity & fixes](./severity-and-fixes) — severity model + how auto-fix patches land in the editor.
- [Headless usage](./headless-usage) — `lintTemplate` + validating stored templates in CI / server save handlers.
- [Contributing locales](./contributing-locales) — adding rule messages + vague-text dictionaries.
- [Accessibility linter](./accessibility/) — what it catches, rule catalog.
- [Structure linter](./structure/) — what it catches, rule catalog.
- [Links linter](./links/) — what it catches, rule catalog.
- [Deliverability linter](./deliverability/) — content cues, rule catalog.
- [Compatibility linter](./compatibility/) — pass-through client support and compiled size.
