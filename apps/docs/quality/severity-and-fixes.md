# Severity & fixes

Both linters share the same severity model and patch shape, so this page covers `lintAccessibility` and `lintStructure` together.

## Severity model

Every rule emits a `LintIssue` with one of four severities:

| Severity | Meaning | UI |
|---|---|---|
| `error` | Hard failure. Recipient may be excluded, or the template is structurally corrupt. | Red dot on canvas, "Errors" group in the Issues panel. |
| `warning` | Likely problem — fix unless you know better. | Yellow dot, "Warnings" group. |
| `info` | Recommendation; not a defect. | No canvas badge, "Info" group. |
| `off` | Override — disables the rule entirely. | Nothing. |

Severity is configurable per rule via `options.rules` — each rule's documented default is just the baseline.

## Auto-fix

Some rules ship a `fix` patch that the user can apply with one click from the Issues panel. Each patch implements:

```ts
interface LintPatch {
  description: string;
  apply: (ctx: LintPatchContext) => void;
}

interface LintPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
  removeBlock: (blockId: string) => void;
}
```

In the editor, `apply` runs through the existing `editor.updateBlock` / `editor.updateSettings` / `editor.removeBlock` path — which is wrapped by the history interceptor — so each fix lands as its own undo entry. Users can press Cmd/Ctrl+Z to revert a fix without losing surrounding work.

Headless callers can construct their own `LintPatchContext` and apply patches programmatically:

```ts
import { lintAccessibility, lintStructure } from "@templatical/quality";

const issues = [
  ...lintAccessibility(content),
  ...lintStructure(content),
];
const fixable = issues.filter((i) => i.fix);

for (const issue of fixable) {
  issue.fix!.apply({
    updateBlock: (id, patch) => mutateBlock(content, id, patch),
    updateSettings: (patch) => Object.assign(content.settings, patch),
    removeBlock: (id) => removeBlockFromTree(content, id),
  });
}
```

## Which rules ship a fix?

See the **Auto-fix** column in each catalog. Today's auto-fixable rules:

- Accessibility — `a11y.img-alt-is-filename`, `a11y.img-decorative-needs-empty-alt`, `a11y.link-target-blank-no-rel`.
- Structure — `structure.empty-section`.

Auto-fixes are added conservatively — only when the right answer is unambiguous. `structure.empty-column`, for example, has no auto-fix because removing an empty column requires changing the section's `columns` layout, and the right answer (merge into a sibling vs. drop the section vs. change the layout key) depends on intent.
