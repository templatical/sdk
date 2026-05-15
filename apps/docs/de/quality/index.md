# Qualität

`@templatical/quality` ist das Dachpaket für die Template-Qualitäts-Werkzeuge von Templatical — deterministische, ausschließlich JSON-basierte Linter, die Autorenfehler im Editor und in Headless- / CI-Prüfungen erkennen. MIT-lizenziert, ESM, kein Vue, kein DOM.

## Linter

| Linter | Was er erkennt | Standard-Schweregrade |
|---|---|---|
| **[Barrierefreiheit](./accessibility/)** | Fehlender Alt-Text, niedriger Kontrast, vage CTAs, übersprungene Überschriftenebenen, zu kleine Touch-Ziele, lange GROSSBUCHSTABEN, target=_blank ohne rel, fehlender Preheader, … | überwiegend error/warning |
| **[Struktur](./structure/)** | Doppelte Block-IDs, Sektionen mit falscher Spaltenanzahl, verschachtelte Sektionen, leere Sektionen, leere Spalten | überwiegend error; einige warning |

Beide Linter liefern dieselbe `LintIssue`-Struktur und teilen sich dieselbe Optionsfläche (`LintOptions`) — Konsumenten können sie also in jeder Kombination ausführen, Ergebnisse zusammenführen und beim Gruppieren nach `ruleId`-Präfix (`a11y.*`, `structure.*`) filtern.

## Architektur

<svg viewBox="0 0 640 280" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;margin:1.5em auto;display:block;">
  <defs>
    <marker id="ah-quality-de" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6" fill="#94a3b8"/>
    </marker>
  </defs>
  <rect x="10" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="100" y="38" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">TemplateContent</text>
  <text x="100" y="60" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">JSON-Blockbaum</text>
  <text x="100" y="76" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">aus Editor oder DB</text>
  <line x1="190" y1="50" x2="225" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality-de)"/>
  <rect x="230" y="2" width="180" height="44" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintAccessibility()</text>
  <text x="320" y="38" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">a11y.* Regeln</text>
  <rect x="230" y="54" width="180" height="44" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="8"/>
  <text x="320" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">lintStructure()</text>
  <text x="320" y="90" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">structure.* Regeln</text>
  <line x1="410" y1="50" x2="445" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality-de)"/>
  <rect x="450" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="540" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">LintIssue[]</text>
  <text x="540" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Schweregrad · Nachricht ·</text>
  <text x="540" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">blockId · optionaler fix</text>
  <line x1="30" y1="130" x2="610" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="320" y="155" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Verwendet von</text>
  <rect x="40" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="120" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Issues-Panel</text>
  <text x="120" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Editor-Sidebar</text>
  <rect x="240" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="320" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Canvas-Badges</text>
  <text x="320" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Symbole pro Block</text>
  <rect x="440" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="520" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Headless / CI</text>
  <text x="520" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">gespeicherte Templates</text>
</svg>

Das Paket trifft keine UI-Annahmen. Das `useTemplateLint`-Composable des Editors lädt `@templatical/quality` per dynamischem Import nach, ruft jeden exportierten Linter bei (entprellten) Inhaltsänderungen auf und führt die Ergebnisse in einen einzigen Issue-Strom zusammen, der den **Issues**-Sidebar-Tab und die Per-Block-Canvas-Badges speist. `applyFix(issue)` führt jeden Patch über den bestehenden Block-Update-Pfad des Editors aus — Fixes landen so als ordentliche Undo-Einträge.

## Installation

::: code-group
```bash [npm]
npm install @templatical/quality
```
```bash [pnpm]
pnpm add @templatical/quality
```
```bash [yarn]
yarn add @templatical/quality
```
```bash [bun]
bun add @templatical/quality
```
:::

Das Paket ist ein **optionaler Peer** von `@templatical/editor`. Installiere es, um den Issues-Tab und die Canvas-Badges zu aktivieren. Lass es weg und der Editor bleibt schlank — der dynamische Import ist gegated und tree-shakeable, der Linter-Chunk wird nie geladen.

::: tip CDN-Nutzer
Wenn du Templatical per CDN lädst, gibt es nichts zu installieren. Das Editor-CDN-Bundle liefert `@templatical/quality` als separat ausgelagerten Code-Split-Chunk aus, der automatisch nachgeladen wird, sobald Linting aktiv ist.
:::

## Editor anbinden

Übergib `lint` an `init()` oder `initCloud()`:

```ts
import { init } from "@templatical/editor";

const editor = init({
  container: "#editor",
  locale: "de",
  lint: {
    rules: {
      "a11y.img-missing-alt": "warning",      // von Standard 'error' herabstufen
      "a11y.text-all-caps": "off",            // komplett deaktivieren
      "structure.empty-column": "info",       // von warning auf info herabstufen
    },
    thresholds: { minFontSize: 16 },
  },
});
```

Der Issues-Tab und die Canvas-Badges erscheinen automatisch, sobald der optionale Peer aufgelöst ist. Bei `lint.disabled === true` lädt der Editor das Paket gar nicht erst nach — kein Chunk-Download, keine UI.

## Schnellzugriff

- [Optionen](./options) — `disabled`, `locale`, `rules`, `thresholds` (von jedem Linter geteilt).
- [Schweregrade & Fixes](./severity-and-fixes) — Schweregrad-Modell + wie Auto-Fix-Patches im Editor landen.
- [Headless-Nutzung](./headless-usage) — Validierung gespeicherter Templates in CI / Server-Save-Handlern.
- [Lokalen beitragen](./contributing-locales) — Regel-Nachrichten + Vague-Text-Dictionaries hinzufügen.
- [Barrierefreiheits-Linter](./accessibility/) — was er erkennt, Regelkatalog.
- [Struktur-Linter](./structure/) — was er erkennt, Regelkatalog.
