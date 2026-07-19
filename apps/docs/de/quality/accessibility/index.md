# Barrierefreiheits-Linter

`lintAccessibility(content, options?)` ist der Barrierefreiheits-Checker in [`@templatical/quality`](../). Er arbeitet auf dem JSON-`TemplateContent`-Blockbaum, läuft im Browser oder in Node.js und kommt ohne Vue- oder DOM-Abhängigkeiten aus — dasselbe Paket validiert Templates im Editor und als CI-Gate für gespeicherte Fixtures.

## Warum

E-Mail-Barrierefreiheit ist tatsächlich unterversorgt. Die meisten Builder verstecken sie hinter Paywalls, prüfen nur oberflächlich auf Tonalität oder ignorieren sie ganz. Wir erwischen die Autorenfehler, die sich täglich wiederholen:

- Fehlender oder dateinamenartiger Alt-Text
- Niedriger Kontrast bei Text und Buttons
- Vage Link- / CTA-Texte („hier klicken", „mehr erfahren")
- Übersprungene Überschriften-Ebenen, die das Dokumentgliederungs-Outline brechen
- Zu kleiner Fließtext, übergroße Großbuchstaben-Blöcke, zu kleine Touch-Ziele
- `target="_blank"`-Links ohne `rel="noopener"`
- Dekorative Bilder mit übrig gebliebenem Alt-Text

Probleme beim Schreiben fangen, nicht erst nachdem Empfänger kaputten Alt-Text, unlesbaren Kontrast oder vage CTAs sehen. Jede Regel feuert auf eine klare, benannte Bedingung — die Ausgabe ist vorhersehbar und bleibt es, während Templates wachsen. Dieselben Checks decken sich mit dem European Accessibility Act (durchsetzbar ab Juni 2025).

## API

```ts
import { lintAccessibility } from "@templatical/quality";

const issues = lintAccessibility(content, options?);
// issues: LintIssue[] — jeder Eintrag hat eine ruleId, die mit "a11y." beginnt
```

Die Funktion nimmt ein `TemplateContent` und ein optionales [`LintOptions`](../options)-Objekt. Sie liefert ein flaches Array von `LintIssue`-Objekten mit `ruleId`, `severity`, `message`, `blockId` und optional einem `fix`-Patch.

Barrierefreiheits-spezifische Konfiguration liegt unter `LintOptions.accessibility`. Setzen Sie `accessibility: false`, um den Linter komplett zu deaktivieren.

```ts
lintAccessibility(content, {
  accessibility: {
    rules: { "a11y.img-missing-alt": "warning" },
    thresholds: { minFontSize: 16 },
  },
});
```

Im Editor lädt das `useTemplateLint`-Composable `@templatical/quality` per dynamischem Import, entprellt das Re-Linting bei Inhaltsänderungen und routet `applyFix(issue)` über den Block-Update-Pfad des Editors — Fixes landen so als ordentliche Undo-Einträge. Barrierefreiheits-Issues erscheinen im **Issues**-Sidebar-Tab neben Struktur-Issues.

## Schnellzugriff

- [Regelkatalog](./rule-catalog) — jede Barrierefreiheits-Regel mit Schweregrad, Begründung und Beispiel.
- [Optionen](../options) — geteilt über beide Linter.
- [Schweregrade & Fixes](../severity-and-fixes) — wie das Schweregrad-Modell funktioniert und wie Auto-Fix-Patches angewendet werden.
- [Headless-Nutzung](../headless-usage) — Validierung gespeicherter Templates in CI.
- [Lokalen beitragen](../contributing-locales) — Regelnachrichten + Vague-Text-Dictionaries hinzufügen.
