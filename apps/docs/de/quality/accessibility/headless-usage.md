# Headless-Nutzung

`@templatical/quality` ist ausschließlich JSON-basiert und hat keine DOM-Abhängigkeit – derselbe Lint läuft also in jedem Node.js-Kontext: CI, Build-Pipelines, serverseitige Validierung, Batch-Jobs.

## Vor dem Speichern validieren

Lehnen Sie Template-JSON, das den Linter nicht besteht, an der Stelle ab, an der es in Ihr System gelangt – CMS-Save-Handler, API-Endpunkt, Ingest-Job:

```ts
import { lintAccessibility } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

export function assertValid(content: TemplateContent): void {
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

## CI-Schutz für gespeicherte Templates

Speichert Ihre Anwendung `TemplateContent`-JSON in einer Datenbank, lassen Sie den Linter in CI gegen jede gespeicherte Fixture laufen, damit keine Regressionen ausgeliefert werden:

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

Mit `tsx scripts/lint-templates.ts` ausführen und in den CI-Workflow einhängen. Der Templatical-Playground macht genau das – siehe `apps/playground/scripts/lint-templates.ts` im Repo.

## Eigene Schweregrad-Policy

Ein Team möchte vielleicht in CI nur Errors, in der Entwicklung aber die volle Info-Stufe:

```ts
const SEVERITIES = process.env.CI
  ? ["error"]
  : ["error", "warning", "info"];

const issues = lintAccessibility(content).filter((i) =>
  SEVERITIES.includes(i.severity),
);
```

## Eigene Regeln bauen

Sie können eigene Walker mit denselben Primitiven komponieren, die das Paket mitbringt:

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

`walkBlocks` löst pro Block den nächstgelegenen opaken Vorfahren-Hintergrund auf – Kontrastprüfungen "funktionieren einfach", ohne dass Sie die Section-/Column-Traversierung neu implementieren müssen.

Soll Ihre eigene Regel mit den Built-ins zusammenspielen (Schweregrad-Overrides, lokalisierte Meldungen, der Editor-Sidebar), implementieren Sie das `Rule`-Interface – `block` / `template` geben einen `RuleHit` zurück (`blockId`, optionale `params`, optionaler `fix`), und der Orchestrator kombiniert ihn mit den `meta`-Daten der Regel und dem Meldungs-Template der aktiven Locale.
