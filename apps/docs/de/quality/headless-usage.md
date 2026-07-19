# Headless-Nutzung

`@templatical/quality` ist ausschließlich JSON-basiert und hat keine DOM-Abhängigkeit — dieselben Linter laufen in jedem Node.js-Kontext: CI, Build-Pipelines, serverseitige Validierung, Batch-Jobs.

`lintTemplate(content, options?)` führt jeden Linter aus — Barrierefreiheit, Struktur und Links — und liefert die zusammengeführten `LintIssue[]`. Es ist der empfohlene Einstiegspunkt: ein Aufruf, und jede künftige Linter-Kategorie ist automatisch enthalten.

```ts
import { lintTemplate } from "@templatical/quality";

const issues = lintTemplate(content); // a11y-, dann structure-, dann link-Issues
```

Die einzelnen Linter-Funktionen — `lintAccessibility(content, options?)`, `lintStructure(content, options?)`, `lintLinks(content, options?)` — liefern dieselbe Struktur und bleiben exportiert, falls Sie nur eine Teilmenge ausführen wollen. Sie können eine Teilmenge auch über `lintTemplate` ausführen, indem Sie Kategorien deaktivieren: `lintTemplate(content, { structure: false, links: false })` führt nur die Barrierefreiheit aus.

## Vor dem Speichern validieren

Verweigern Sie Template-JSON, das die Linter nicht besteht, dort wo es in Ihr System eintritt — CMS-Save-Handler, API-Endpunkt, Ingestion-Job:

```ts
import { lintTemplate } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

export function assertValid(content: TemplateContent): void {
  const errors = lintTemplate(content).filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Template scheitert an Qualitätsprüfungen:\n${errors
        .map((e) => `  [${e.ruleId}] ${e.message}`)
        .join("\n")}`,
    );
  }
}
```

`structure.*`-Fehler signalisieren typischerweise Datenkorruption (doppelte IDs, Layout/Children-Mismatch) und sollten ein Save immer blocken. `link.javascript-protocol` ist ebenfalls ein Fehler — ein gefährliches Schema, das der Render-Sanitizer im Editor stillschweigend entfernen würde. `a11y.*`-Fehler sind Inhaltsqualität — hier kann eine weichere Policy sinnvoll sein.

## CI-Schutz für gespeicherte Templates

Wenn Ihre Anwendung `TemplateContent`-JSON in einer Datenbank speichert, lassen Sie die Linter in CI gegen jede Fixture laufen, damit Regressionen nicht durchrutschen:

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

Per `tsx scripts/lint-templates.ts` ausführen und in Ihren CI-Workflow einbinden. Das Templatical-Playground macht genau das — siehe `apps/playground/scripts/lint-templates.ts` im Repo.

## Nach Kategorie filtern

Regel-IDs sind namensraum-getrennt (`a11y.*`, `structure.*`, `link.*`), also ist Gruppieren oder Filtern nach Linter ein `startsWith`-Check:

```ts
const issues = lintTemplate(content);
const a11y = issues.filter((i) => i.ruleId.startsWith("a11y."));
const structural = issues.filter((i) => i.ruleId.startsWith("structure."));
const links = issues.filter((i) => i.ruleId.startsWith("link."));
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

Sie können eigene Walker mit denselben Primitiven komponieren, die das Paket ausliefert:

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

`walkBlocks` löst den nächsten opaken Vorfahren-Hintergrund pro Block auf — Kontrast-Checks „funktionieren einfach", ohne dass Sie die Section/Column-Traversierung neu implementieren müssen.

Für URL-bezogene Regeln nutzen Sie stattdessen `walkUrls` — es liefert pro URL-Feld im Template (Anker, Button, Image-Link, Video, Menüpunkt, Social-Icon) eine `UrlOccurrence`, ohne den Baum pro Regel neu zu durchlaufen:

```ts
import { walkUrls } from "@templatical/quality";

for (const { url, blockId, source } of walkUrls(content)) {
  if (source === "anchor" && url.startsWith("https://tracking.")) {
    console.warn(`Block ${blockId} läuft über eine Tracking-Domain`);
  }
}
```

Wenn Ihre Custom-Regel beim Orchestrator mitmachen soll (Schweregrad-Overrides, lokalisierte Nachrichten, das Editor-Issues-Panel), implementieren Sie das `Rule`-Interface — `block` / `template` liefern einen `RuleHit` (`blockId`, optionale `params`, optionaler `fix`), und der Orchestrator kombiniert ihn mit `meta` und dem Nachrichtentemplate der aktiven Locale. Dasselbe `runRules`-Helper-Modul betreibt `lintAccessibility`, `lintStructure` und `lintLinks`, und `lintTemplate` verteilt einfach an alle drei.
