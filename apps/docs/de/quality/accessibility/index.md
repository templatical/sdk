# Barrierefreiheits-Linter

Der Barrierefreiheits-Linter ist die erste Funktion in [`@templatical/quality`](../). Es ist ein MIT-lizenzierter Barrierefreiheits-Prüfer für Templatical-E-Mail-Templates, der auf dem JSON-`TemplateContent`-Blockbaum arbeitet, im Browser oder in Node.js läuft und ohne Vue- oder DOM-Abhängigkeiten ausgeliefert wird – dasselbe Paket validiert Templates also sowohl im Editor als auch als CI-Gate auf gespeicherten Fixtures.

## Warum

Barrierefreiheit bei E-Mails ist tatsächlich unterversorgt. Die meisten Builder verstecken Barrierefreiheit hinter einer Bezahlschranke, führen oberflächliche Tonalitätsprüfungen durch oder lassen sie ganz weg. Wir fangen die Autorenfehler ab, die täglich wiederkehren:

- Fehlender oder dateiname-artiger Alt-Text
- Text und Buttons mit zu geringem Kontrast
- Vage Link- / CTA-Texte ("hier klicken", "mehr lesen")
- Übersprungene Überschriftenebenen, die das Dokumentgerüst zerstören
- Winziger Fließtext, überdimensionierte Großbuchstaben-Blöcke, zu kleine Touch-Ziele
- `target="_blank"`-Links ohne `rel="noopener"`
- Dekorative Bilder, die nicht als solche gekennzeichnet sind

Probleme erkennen, während Sie schreiben – nicht erst, nachdem Empfänger kaputten Alt-Text, unleserlichen Kontrast oder vage CTAs sehen. Jede Regel reagiert auf eine klare, benannte Bedingung; die Ausgabe ist vorhersehbar und bleibt es, während sich Templates weiterentwickeln. Dieselben Prüfungen decken sich mit dem European Accessibility Act (durchsetzbar ab Juni 2025).

## Architektur

<svg viewBox="0 0 640 280" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;margin:1.5em auto;display:block;">
  <defs>
    <marker id="ah-quality" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Step 1: Input -->
  <rect x="10" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="100" y="38" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">TemplateContent</text>
  <text x="100" y="60" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">JSON-Blockbaum</text>
  <text x="100" y="76" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">aus Editor oder DB</text>
  <!-- Arrow -->
  <line x1="190" y1="50" x2="225" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 2: Engine (highlighted) -->
  <rect x="230" y="10" width="180" height="80" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="10"/>
  <text x="320" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">lintAccessibility()</text>
  <text x="320" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">Block-Regeln</text>
  <text x="320" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#92400e" text-anchor="middle">+ Template-Regeln</text>
  <!-- Arrow -->
  <line x1="410" y1="50" x2="445" y2="50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-quality)"/>
  <!-- Step 3: Output -->
  <rect x="450" y="10" width="180" height="80" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="540" y="36" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1e293b" text-anchor="middle">A11yIssue[]</text>
  <text x="540" y="58" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Schweregrad · Meldung ·</text>
  <text x="540" y="74" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">blockId · optionaler Fix</text>
  <!-- Divider -->
  <line x1="30" y1="130" x2="610" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="320" y="155" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Verwendet von</text>
  <!-- Consumer chips -->
  <rect x="40" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="120" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Sidebar-Panel</text>
  <text x="120" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">im Editor</text>
  <rect x="240" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="320" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Canvas-Badges</text>
  <text x="320" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Symbol pro Block</text>
  <rect x="440" y="180" width="160" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="8"/>
  <text x="520" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">Headless / CI</text>
  <text x="520" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">gespeicherte Templates</text>
</svg>

Das Paket macht keine Vorgaben zur UI. Das `useAccessibilityLint`-Composable des Editors lädt `@templatical/quality` per Lazy-Import, entprellt das erneute Linten bei Inhaltsänderungen und schleust `applyFix(issue)` durch den vorhandenen Block-Update-Pfad des Editors – Korrekturen landen also als saubere Undo-Einträge.

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

Das Paket ist ein **optionaler Peer** von `@templatical/editor`. Installieren Sie es, um den Sidebar-Tab und die Canvas-Badges zu aktivieren. Lassen Sie es weg, bleibt der Editor schlank – der dynamische Import ist gegated und tree-shakeable, sodass der Linter-Chunk nie heruntergeladen wird.

::: tip CDN-Nutzer
Wenn Sie Templatical per CDN laden, gibt es nichts zu installieren. Das CDN-Bundle des Editors liefert `@templatical/quality` als separaten code-split-Chunk aus, der automatisch per Lazy-Load geladen wird, sobald der Linter aktiv ist.
:::

## Schnellzugriff

- [Erste Schritte](./getting-started) – erster Lint-Aufruf (Headless), Anbindung an den Editor.
- [Regelkatalog](./rule-catalog) – jede Regel mit Schweregrad, Begründung und Beispielen.
- [Optionen](./options) – `disabled`, `locale`, `rules`, `thresholds`.
- [Schweregrad & Korrekturen](./severity-and-fixes) – wie das Schweregradmodell funktioniert und wie Auto-Fix-Patches angewendet werden.
- [Headless-Nutzung](./headless-usage) – gespeicherte Templates in CI validieren.
- [Lokale beitragen](./contributing-locales) – Vague-Text-Wörterbücher für neue Sprachen ergänzen.
