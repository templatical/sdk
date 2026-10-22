---
description: lintStructure catches template JSON that can't safely render — duplicate block IDs, section-column mismatches, nested sections, empty sections or columns, heroes that render as regular sections, and background images Outlook can't layer.
---

# Structure linter

`lintStructure(content, options?)` is the data-integrity checker inside [`@templatical/quality`](../). It walks the `TemplateContent` block tree and flags shapes that indicate corruption — duplicate IDs, sections whose `columns` layout doesn't match their `children` array, nested sections (the renderer rejects them), empty sections / columns, heroes that render as regular sections, and background images Outlook on Windows can't layer.

## Purpose

Most "is this template OK?" tooling cares about content quality (alt text, contrast). Structure rules cover a different problem: **can this JSON safely render at all?** Importers (BeeFree, Unlayer, HTML, MJML, Topol, Stripo, Chamaileon, Easy Email Pro) and custom server-side editors can produce blocks the editor would never produce — orphan column entries, missing block fields, layout/children mismatches. By the time they reach the renderer they're usually too late to recover from cleanly.

The structure linter catches these before save / before send:

- **Duplicate block IDs.** Tree traversal, undo/redo, and selection all assume IDs are unique. A duplicate ID silently corrupts every operation that targets a block by ID.
- **Section column mismatch.** A section with `columns: "2-1"` expects `children.length === 2`. If `children` has one or three inner arrays, the layout is broken — usually a UI bug or a stale import.
- **Nested section.** The renderer rejects sections inside columns. If one ends up there, MJML output silently drops it.
- **Empty section.** A section with no blocks renders as a blank table row — wasted whitespace, sometimes a visible padding gap.
- **Empty column.** A multi-column section with one empty column renders awkwardly in most clients and almost always means the author intended fewer columns.
- **Hero not applied.** A section with `hero` set that renders as a regular section: more than one column, no background image, or `height: "image"` without the image's size. The message says which.
- **Background images Outlook can't layer.** Outlook on Windows paints a wrapper's background color over its section's background image, and can't layer a wrapper image and a section image. These two rules are compatibility warnings rather than corruption checks: every other client renders these combinations correctly.

These rules are deterministic and locale-agnostic — they fire on JSON shapes, not phrases. Only the message text needs translating.

## API

```ts
import { lintStructure } from "@templatical/quality";

const issues = lintStructure(content); // options is an optional second argument
// issues: LintIssue[] — each entry has ruleId starting with "structure."
```

Same signature as `lintAccessibility`. Same `LintOptions` shape. Same `LintIssue` return type. You can run all five linters independently or merge results.

Structure-specific config lives under `LintOptions.structure`. Set `structure: false` to disable the linter entirely.

```ts
lintStructure(content, {
  structure: { rules: { "structure.empty-column": "info" } },
});
```

In the editor, the `useTemplateLint` composable lazy-imports `@templatical/quality` and runs all five linters on every (debounced) content change. Structure issues appear in the **Issues** sidebar tab alongside accessibility issues.

## Quick links

- [Rule catalog](./rule-catalog) — every structure rule with severity, rationale, and an auto-fix note.
- [Options](../options) — shared across all five linters.
- [Severity & fixes](../severity-and-fixes) — how the severity model works and how auto-fix patches are applied.
- [Headless usage](../headless-usage) — validating stored templates in CI.
