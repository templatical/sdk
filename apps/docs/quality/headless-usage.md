# Headless usage

`@templatical/quality` is JSON-only and has no DOM dependency, so the same linters run in any Node.js context: CI, build pipelines, server-side validation, batch jobs.

`lintTemplate(content, options?)` runs every linter — accessibility, structure, and links — and returns the merged `LintIssue[]`. It's the recommended entry point: one call, and any future linter category is included automatically.

```ts
import { lintTemplate } from "@templatical/quality";

const issues = lintTemplate(content); // a11y, then structure, then link issues
```

The per-linter functions — `lintAccessibility(content, options?)`, `lintStructure(content, options?)`, `lintLinks(content, options?)` — return the same shape and stay exported for when you want to run only a subset. You can also run a subset through `lintTemplate` by disabling categories: `lintTemplate(content, { structure: false, links: false })` runs accessibility only.

## Validate before storing

Reject template JSON that fails the linter at the point it enters your system — CMS save handler, API endpoint, ingestion job:

```ts
import { lintTemplate } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

export function assertValid(content: TemplateContent): void {
  const errors = lintTemplate(content).filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Template fails quality checks:\n${errors
        .map((e) => `  [${e.ruleId}] ${e.message}`)
        .join("\n")}`,
    );
  }
}
```

`structure.*` errors typically indicate data corruption (duplicate IDs, layout/children mismatch) and should always block a save. `link.javascript-protocol` is also an error — a dangerous scheme that the editor's render-time sanitizer would strip silently. `a11y.*` errors are content quality and may warrant a softer policy.

## CI guard for stored templates

If your application stores `TemplateContent` JSON in a database, run the linters in CI against every stored fixture so regressions can't ship:

```ts
// scripts/lint-templates.ts
import { lintTemplate } from "@templatical/quality";
import { templates } from "../fixtures/templates";

const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };

let failed = 0;

for (const [name, content] of Object.entries(templates)) {
  const issues = lintTemplate(content).filter(
    (i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.warning,
  );

  if (issues.length === 0) {
    console.log(`OK ${name}: clean`);
    continue;
  }
  failed++;
  console.error(`FAIL ${name}: ${issues.length} issue(s)`);
  for (const issue of issues) {
    const where = issue.blockId ? `block ${issue.blockId}` : "template";
    console.error(`  [${issue.severity}] ${issue.ruleId} (${where}): ${issue.message}`);
  }
}

if (failed > 0) process.exit(1);
```

Run via `tsx scripts/lint-templates.ts` and wire it into your CI workflow. The Templatical playground does exactly this — see `apps/playground/scripts/lint-templates.ts` in the repo.

## Filtering by category

Rule IDs are namespaced (`a11y.*`, `structure.*`, `link.*`), so grouping or filtering by linter is a `startsWith` check:

```ts
const issues = lintTemplate(content);
const a11y = issues.filter((i) => i.ruleId.startsWith("a11y."));
const structural = issues.filter((i) => i.ruleId.startsWith("structure."));
const links = issues.filter((i) => i.ruleId.startsWith("link."));
```

## Custom severity policy

A team may want errors-only in CI but the full info-level output in development:

```ts
const SEVERITIES = process.env.CI
  ? ["error"]
  : ["error", "warning", "info"];

const issues = lintAccessibility(content).filter((i) =>
  SEVERITIES.includes(i.severity),
);
```

## Building your own rules

You can compose your own walkers using the same primitives the package ships:

```ts
import { walkBlocks, getContrastRatio } from "@templatical/quality";

walkBlocks(content, (block, ctx) => {
  if (block.type === "title" && block.color) {
    const ratio = getContrastRatio(block.color, ctx.resolvedBackgroundColor);
    if (ratio < 4.5) {
      console.warn(`Heading ${block.id} contrast ${ratio.toFixed(2)}:1`);
    }
  }
});
```

`walkBlocks` resolves the nearest opaque ancestor background per block, so contrast checks "just work" without re-implementing the section/column traversal.

For URL-scoped rules, use `walkUrls` instead — it yields one `UrlOccurrence` per URL field across the template (anchors, button, image-link, video, menu-item, social-icon) without re-walking the tree per rule:

```ts
import { walkUrls } from "@templatical/quality";

for (const { url, blockId, source } of walkUrls(content)) {
  if (source === "anchor" && url.startsWith("https://tracking.")) {
    console.warn(`Block ${blockId} routes through tracking domain`);
  }
}
```

If you'd like your custom rule to participate in the orchestrator alongside the built-ins (severity overrides, localized messages, the editor Issues panel), implement the `Rule` interface — `block` / `template` return a `RuleHit` (`blockId`, optional `params`, optional `fix`) and the orchestrator combines it with the rule's `meta` and the active locale's message template. The same `runRules` helper powers `lintAccessibility`, `lintStructure`, and `lintLinks`, and `lintTemplate` simply fans out to all three.
