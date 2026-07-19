# Struktur-Linter

`lintStructure(content, options?)` ist der Datenintegritäts-Checker in [`@templatical/quality`](../). Er durchläuft den `TemplateContent`-Blockbaum und meldet Formen, die auf Korruption hindeuten — doppelte IDs, Sektionen, deren `columns`-Layout nicht zum `children`-Array passt, verschachtelte Sektionen (vom Renderer abgelehnt) und leere Sektionen / Spalten.

## Warum

Die meisten „Ist dieses Template OK?"-Werkzeuge kümmern sich um Inhaltsqualität (Alt-Text, Kontrast). Struktur-Regeln decken ein anderes Problem ab: **Kann dieses JSON überhaupt sauber rendern?** Importer (BeeFree, Unlayer, HTML) und serverseitige Custom-Editoren können Blöcke produzieren, die der Editor selbst nie erzeugen würde — verwaiste Spalten-Einträge, fehlende Block-Felder, Layout-/Children-Mismatches. Erreichen sie den Renderer, ist es meist zu spät, um sauber zu reagieren.

Der Struktur-Linter fängt diese Probleme vor Save / vor Versand:

- **Doppelte Block-IDs.** Baumtraversierung, Undo/Redo und Selection setzen alle voraus, dass IDs eindeutig sind. Eine doppelte ID beschädigt jede ID-basierte Operation lautlos.
- **Section-Column-Mismatch.** Eine Sektion mit `columns: "2-1"` erwartet `children.length === 2`. Hat `children` ein oder drei inner arrays, ist das Layout kaputt — meist ein UI-Bug oder ein veralteter Import.
- **Verschachtelte Sektion.** Der Renderer lehnt Sektionen innerhalb von Spalten ab. Landet eine dort, fällt sie lautlos aus dem MJML-Output.
- **Leere Sektion.** Eine Sektion ohne Blöcke rendert als leere Tabellenzeile — verschwendeter Whitespace, manchmal eine sichtbare Padding-Lücke.
- **Leere Spalte.** Eine Mehrspalten-Sektion mit einer leeren Spalte rendert in den meisten Clients unglücklich und bedeutet fast immer, dass der Autor weniger Spalten meinte.

Diese Regeln sind deterministisch und sprachunabhängig — sie feuern auf JSON-Formen, nicht auf Phrasen. Nur der Nachrichtentext muss übersetzt werden.

## API

```ts
import { lintStructure } from "@templatical/quality";

const issues = lintStructure(content, options?);
// issues: LintIssue[] — jeder Eintrag hat eine ruleId, die mit "structure." beginnt
```

Gleiche Signatur wie `lintAccessibility`. Gleiche `LintOptions`-Struktur. Gleicher `LintIssue`-Rückgabewert. Sie können beide Linter unabhängig aufrufen oder Ergebnisse zusammenführen.

Struktur-spezifische Konfiguration liegt unter `LintOptions.structure`. Setzen Sie `structure: false`, um den Linter komplett zu deaktivieren.

```ts
lintStructure(content, {
  structure: { rules: { "structure.empty-column": "info" } },
});
```

Im Editor lädt das `useTemplateLint`-Composable `@templatical/quality` per dynamischem Import und führt beide Linter bei jeder (entprellten) Inhaltsänderung aus. Struktur-Issues erscheinen im **Issues**-Sidebar-Tab neben Barrierefreiheits-Issues.

## Schnellzugriff

- [Regelkatalog](./rule-catalog) — jede Struktur-Regel mit Schweregrad, Begründung und Auto-Fix-Hinweis.
- [Optionen](../options) — geteilt über beide Linter.
- [Schweregrade & Fixes](../severity-and-fixes) — wie das Schweregrad-Modell funktioniert und wie Auto-Fix-Patches angewendet werden.
- [Headless-Nutzung](../headless-usage) — Validierung gespeicherter Templates in CI.
