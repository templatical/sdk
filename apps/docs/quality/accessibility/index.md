# Accessibility linter

`lintAccessibility(content, options?)` is the accessibility checker inside [`@templatical/quality`](../). It operates on the JSON `TemplateContent` block tree, runs in the browser or in Node.js, and ships with no Vue or DOM dependencies — so the same package validates templates inside the editor and as a CI gate on stored fixtures.

## Why

Email accessibility is genuinely under-tooled. Most builders either bury accessibility behind a paywall, run shallow content-tone checks, or skip it entirely. We catch the authoring mistakes that recur every day:

- Missing or filename-style alt text
- Low-contrast text and buttons
- Vague link / CTA copy ("click here", "read more")
- Heading-level skips that break the document outline
- Tiny body text, oversized all-caps blocks, undersized touch targets
- `target="_blank"` links missing `rel="noopener"`
- Decorative images with leftover alt text

Catch problems while you're authoring, not after recipients see broken alt text, unreadable contrast, or vague CTAs. Every rule fires on a clear, named condition, so the output is predictable and stays predictable as templates evolve. The same checks align with the EU Accessibility Act (enforceable June 2025).

## API

```ts
import { lintAccessibility } from "@templatical/quality";

const issues = lintAccessibility(content, options?);
// issues: LintIssue[] — each entry has ruleId starting with "a11y."
```

The function takes a `TemplateContent` and an optional [`LintOptions`](../options) object. It returns a flat array of `LintIssue` objects with `ruleId`, `severity`, `message`, `blockId`, and optionally a `fix` patch.

In the editor, the `useTemplateLint` composable lazy-imports `@templatical/quality`, debounces re-lint on content changes, and wires `applyFix(issue)` through the editor's block-update path so fixes land as proper undo entries. Accessibility issues appear in the **Issues** sidebar tab alongside structure issues.

## Quick links

- [Rule catalog](./rule-catalog) — every accessibility rule with severity, rationale, and examples.
- [Options](../options) — shared across both linters.
- [Severity & fixes](../severity-and-fixes) — how the severity model works and how auto-fix patches are applied.
- [Headless usage](../headless-usage) — validating stored templates in CI.
- [Contributing locales](../contributing-locales) — adding rule messages + vague-text dictionaries.
