# Severity & fixes

## Severity model

Every rule emits an `A11yIssue` with one of four severities:

| Severity | Meaning | UI |
|---|---|---|
| `error` | Hard accessibility failure. Recipient may be excluded from the message. | Red dot on canvas, "Errors" group in the sidebar, can block save in cloud plans. |
| `warning` | Likely problem — fix unless you know better. | Yellow dot, "Warnings" group. |
| `info` | Recommendation; not a defect. | No canvas badge, "Info" group. |
| `off` | Override — disables the rule entirely. | Nothing. |

Severity is configurable per rule via `options.rules` — the catalog's "Severity" column is just the default.

## Auto-fix

Some rules ship a `fix` patch that the user can apply with one click in the sidebar. Each patch implements:

```ts
interface A11yPatch {
  description: string;
  apply: (ctx: A11yPatchContext) => void;
}

interface A11yPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
}
```

In the editor, `apply` runs through the existing `editor.updateBlock` / `updateSettings` path — which is wrapped by the history interceptor — so each fix lands as its own undo entry. Users can press Cmd/Ctrl+Z to revert a fix without losing surrounding work.

Headless callers can construct their own `A11yPatchContext` and apply patches programmatically:

```ts
import { lintAccessibility } from "@templatical/quality";

const issues = lintAccessibility(content);
const fixable = issues.filter((i) => i.fix);

for (const issue of fixable) {
  issue.fix!.apply({
    updateBlock: (id, patch) => mutateBlock(content, id, patch),
    updateSettings: (patch) => Object.assign(content.settings, patch),
  });
}
```

## Which rules ship a fix?

See the **Auto-fix** column in the [rule catalog](./rule-catalog). Today: `img-alt-is-filename`, `img-decorative-needs-empty-alt`, and `link-target-blank-no-rel`. Auto-fixes are added conservatively — only when the right answer is unambiguous.

## Cloud save-gate

In cloud editors, when the server's `planConfig.accessibility.blockOnError === true` and the linter reports any error-severity issues, the save flow surfaces a confirmation modal listing the blockers. Users can either cancel and fix, or click "Save anyway" — the gate doesn't enforce a hard block, it surfaces a deliberate choice. Both the toolbar Save button and the keyboard `Cmd/Ctrl+S` shortcut route through the gate.
