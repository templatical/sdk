---
"@templatical/quality": patch
"@templatical/editor": patch
---

Reshape `LintOptions` around per-tool config namespaces. Each linter's severity overrides and tool-specific knobs now live under its own key, and each linter can be disabled individually.

**`@templatical/quality` — breaking**

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

**`@templatical/editor` — breaking**

- `init({ lint })` and `initCloud({ lint })` consume the new shape verbatim. When every per-tool key is set to `false` the editor behaves as if `lint.disabled === true`: no chunk download for `@templatical/quality`, no Issues sidebar tab, no inline canvas badges.
- `useTemplateLint` re-exports the new `isLintFullyDisabled` helper.
