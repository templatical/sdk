# Headless usage

`@templatical/quality` is JSON-only and has no DOM dependency, so the same lint runs in any Node.js context: CI, build pipelines, server-side pre-send checks, batch validation jobs.

## Pre-send check

Validate every transactional template before queueing it for delivery:

```ts
import { lintAccessibility } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

export function assertSendable(content: TemplateContent): void {
  const errors = lintAccessibility(content).filter(
    (i) => i.severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(
      `Template fails accessibility checks:\n${errors
        .map((e) => `  [${e.ruleId}] ${e.message}`)
        .join("\n")}`,
    );
  }
}
```

## CI guard for stored templates

If your application stores `TemplateContent` JSON in a database, run the linter in CI against every stored fixture so regressions can't ship:

```ts
// scripts/lint-templates.ts
import { lintAccessibility } from "@templatical/quality";
import { templates } from "../fixtures/templates";

const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };

let failed = 0;

for (const [name, content] of Object.entries(templates)) {
  const issues = lintAccessibility(content).filter(
    (i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.warning,
  );
  if (issues.length === 0) {
    console.log(`✔ ${name}: clean`);
    continue;
  }
  failed++;
  console.error(`✖ ${name}: ${issues.length} issue(s)`);
  for (const issue of issues) {
    const where = issue.blockId ? `block ${issue.blockId}` : "template";
    console.error(`  [${issue.severity}] ${issue.ruleId} (${where}): ${issue.message}`);
  }
}

if (failed > 0) process.exit(1);
```

Run via `tsx scripts/lint-templates.ts` and wire it into your CI workflow. The Templatical playground does exactly this — see `apps/playground/scripts/lint-templates.ts` in the repo.

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
