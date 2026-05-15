# Headless-Nutzung

`@templatical/quality` ist ausschließlich JSON-basiert und hat keine DOM-Abhängigkeit — dieselben Linter laufen in jedem Node.js-Kontext: CI, Build-Pipelines, serverseitige Validierung, Batch-Jobs.

Sowohl `lintAccessibility(content, options?)` als auch `lintStructure(content, options?)` liefern dieselbe `LintIssue[]`-Struktur — du kannst sie unabhängig aufrufen oder Ergebnisse zusammenführen.

## Vor dem Speichern validieren

Verweigere Template-JSON, das die Linter nicht besteht, dort wo es in dein System eintritt — CMS-Save-Handler, API-Endpunkt, Ingestion-Job:

```ts
import { lintAccessibility, lintStructure } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

export function assertValid(content: TemplateContent): void {
  const issues = [
    ...lintAccessibility(content),
    ...lintStructure(content),
  ];
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Template scheitert an Qualitätsprüfungen:\n${errors
        .map((e) => `  [${e.ruleId}] ${e.message}`)
        .join("\n")}`,
    );
  }
}
```

`structure.*`-Fehler signalisieren typischerweise Datenkorruption (doppelte IDs, Layout/Children-Mismatch) und sollten ein Save immer blocken. `a11y.*`-Fehler sind Inhaltsqualität — hier kann eine weichere Policy sinnvoll sein.

## CI-Schutz für gespeicherte Templates

Wenn deine Anwendung `TemplateContent`-JSON in einer Datenbank speichert, lass die Linter in CI gegen jede Fixture laufen, damit Regressionen nicht durchrutschen:

```ts
// scripts/lint-templates.ts
import { lintAccessibility, lintStructure } from "@templatical/quality";
import { templates } from "../fixtures/templates";

const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };

let failed = 0;

for (const [name, content] of Object.entries(templates)) {
  const issues = [
    ...lintAccessibility(content),
    ...lintStructure(content),
  ].filter((i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.warning);

  if (issues.length === 0) {
    console.log(`OK ${name}: sauber`);
    continue;
  }
  failed++;
  console.error(`FAIL ${name}: ${issues.length} Problem(e)`);
  for (const issue of issues) {
    const where = issue.blockId ? `Block ${issue.blockId}` : "Template";
    console.error(`  [${issue.severity}] ${issue.ruleId} (${where}): ${issue.message}`);
  }
}

if (failed > 0) process.exit(1);
```

Per `tsx scripts/lint-templates.ts` ausführen und in deinen CI-Workflow einbinden. Das Templatical-Playground macht genau das — siehe `apps/playground/scripts/lint-templates.ts` im Repo.

## Nach Kategorie filtern

Regel-IDs sind namensraum-getrennt (`a11y.*`, `structure.*`), also ist Gruppieren oder Filtern nach Linter ein `startsWith`-Check:

```ts
const issues = [
  ...lintAccessibility(content),
  ...lintStructure(content),
];
const a11y = issues.filter((i) => i.ruleId.startsWith("a11y."));
const structural = issues.filter((i) => i.ruleId.startsWith("structure."));
```

## Eigene Schweregrad-Policy

Ein Team möchte in CI nur Fehler, aber in Entwicklung die volle Info-Ausgabe:

```ts
const SEVERITIES = process.env.CI
  ? ["error"]
  : ["error", "warning", "info"];

const issues = lintAccessibility(content).filter((i) =>
  SEVERITIES.includes(i.severity),
);
```

## Eigene Regeln bauen

Du kannst eigene Walker mit denselben Primitiven komponieren, die das Paket ausliefert:

```ts
import { walkBlocks, getContrastRatio } from "@templatical/quality";

walkBlocks(content, (block, ctx) => {
  if (block.type === "title" && block.color) {
    const ratio = getContrastRatio(block.color, ctx.resolvedBackgroundColor);
    if (ratio < 4.5) {
      console.warn(`Überschrift ${block.id} Kontrast ${ratio.toFixed(2)}:1`);
    }
  }
});
```

`walkBlocks` löst den nächsten opaken Vorfahren-Hintergrund pro Block auf — Kontrast-Checks „funktionieren einfach", ohne dass du die Section/Column-Traversierung neu implementieren musst.

Wenn deine Custom-Regel beim Orchestrator mitmachen soll (Schweregrad-Overrides, lokalisierte Nachrichten, das Editor-Issues-Panel), implementiere das `Rule`-Interface — `block` / `template` liefern einen `RuleHit` (`blockId`, optionale `params`, optionaler `fix`), und der Orchestrator kombiniert ihn mit `meta` und dem Nachrichtentemplate der aktiven Locale. Dasselbe `runRules`-Helper-Modul betreibt sowohl `lintAccessibility` als auch `lintStructure`.
