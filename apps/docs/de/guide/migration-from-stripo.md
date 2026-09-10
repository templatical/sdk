---
title: Migration von Stripo
description: Stripo-E-Mail-Templates mit @templatical/import-stripo in das Templatical-Format konvertieren.
---

# Migration von Stripo

Diese Anleitung richtet sich an Teams, die E-Mail-Templates in [Stripo](https://stripo.email) erstellt haben — im gehosteten Editor oder über ein Produkt, das das Stripo-Plugin einbettet — und auf Templaticals visuellen Editor wechseln möchten. **`@templatical/import-stripo`** konvertiert Stripo-HTML in Templaticals `TemplateContent`-Format. Installieren Sie es, führen Sie es aus, und nutzen Sie die folgenden Abschnitte, um alles nachzuarbeiten, was es nicht automatisch abbilden kann.

Stripo speichert zwei verschiedene HTML-Oberflächen. Der Konverter erkennt selbst, welche Sie übergeben. Es gibt kein Mode-Flag.

| Oberfläche | Herkunft | Unterscheidungsmerkmal |
|---|---|---|
| Plugin- / Editor-Speicher | `getTemplateData()` → `{ html, css }` | `esd-stripe`, `esd-structure`, `esd-block-*` auf Elementen |
| Kompilierter Export | Datei → HTML, oder `compileEmail({ callback })` | `es-wrapper`, `es-content-body`, `es-header-body` — kein `esd-*` auf Elementen |

Eine übrig gebliebene Regel `.esd-block-html` in einem Stylesheet ist kein Unterscheidungsmerkmal. Rein CSS-seitige Reste werden als generisches HTML konvertiert.

## Installation

```bash
npm install @templatical/import-stripo
```

### Ohne Build-Schritt (CDN)

```html
<script type="module">
  import { convertStripoTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-stripo/+esm';
  // ...dann wie unter Verwendung konvertieren
</script>
```

## Verwendung

```ts
import { convertStripoTemplate } from '@templatical/import-stripo';

// Plugin-Host — was Sie aus getTemplateData() gespeichert haben:
const { html, css } = await window.StripoApi.getTemplateData();
const { content, report } = convertStripoTemplate(html, { css });

// Marketer-Export Datei → HTML:
const exported = await fetch('/path/to/export.html').then((r) => r.text());
const compiled = convertStripoTemplate(exported);

const editor = await init({
  container: '#editor',
  content: compiled.content,
});
```

`convertStripoTemplate` ist synchron und gibt ein `ImportResult` zurück mit:

- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Quellelements (`converted`, `approximated`, `html-fallback` oder `skipped`)

Übergeben Sie `options.css`, wenn Sie Plugin-Speicher konvertieren. Bei kompilierten Exporten wird es ignoriert (die Stile sind dort bereits inline).

Nicht erkanntes HTML (keine Stripo-Klassenattribute) läuft durch `@templatical/import-html`; der Bericht enthält eine Warnung, die diesen Fallback benennt.

## Den Bericht lesen

Jeder Eintrag in `report.entries` beschreibt ein Quellelement:

| Status | Bedeutung |
|---|---|
| `converted` | Auf einen Templatical-Block abgebildet, ohne Verlust. |
| `approximated` | Auf einen Templatical-Block abgebildet, mit einer Begrenzung oder einem Flatten — `note` nennt die Änderung. |
| `html-fallback` | Kein Block-Äquivalent; das Original-Markup liegt in einem `HtmlBlock`. |
| `skipped` | Für die Parität mit den anderen `@templatical/import-*`-Paketen reserviert; dieser Konverter erzeugt das derzeit nicht. |

```ts
console.log(report.summary);
// { total: 18, converted: 16, approximated: 1, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximated:`, entry.note);
  }
}
```

## Weg 1 — Visuell neu aufbauen, mit dem Stripo-Export als Referenz

Bei wenigen Templates ist der Neuaufbau per Hand neben einer kompilierten Vorschau oft schneller als ein Paket zu installieren:

1. Exportieren Sie Datei → HTML aus Stripo und öffnen Sie es im Browser — das ist Ihr visuelles Ziel.
2. Öffnen Sie den Templatical-Editor (oder [den Playground](https://play.templatical.com)) daneben.
3. Ziehen Sie die entsprechenden Templatical-Blöcke herein (siehe die Mapping-Tabellen unten).
4. Kopieren Sie den Text direkt. Hosting Sie Bilder über Ihre Medienbibliothek neu.

Die meisten Stripo-Templates sind in 10–20 Minuten umgezogen, sobald Sie eines oder zwei gemacht haben. Bei größeren Mengen führen Sie zuerst `@templatical/import-stripo` aus und nutzen diesen Weg nur, um nachzuarbeiten, was als `approximated` oder als `html-fallback`-Block gelandet ist.

## Mapping des Plugin-HTML {#plugin-mapping}

Plugin-Speicher ist ein Tabellenbaum mit `esd-*`-Klassen. Jedes `esd-structure` wird ein `SectionBlock`; seine `esd-container-frame`-Kinder sind die Spalten.

| Stripo-Marker | Templatical-Block | Hinweise |
|---|---|---|
| `esd-structure` mit 1–3 `esd-container-frame`s | `SectionBlock` (`columns` `"1"` / `"2"` / `"3"`) | Frames sind die Spalten. |
| `esd-structure` mit 4+ Frames | `SectionBlock` `columns: "1"` | Flattened; `approximated`. |
| `esd-block-text` | `title` / `paragraph` | Generisches HTML-Mapping des inneren Markups. |
| `esd-block-image` | `image` | Generisches HTML-Mapping des inneren `<img>`. |
| `esd-block-button` | `button` | `href`, Text, `target="_blank"` → `openInNewTab`. Inline `background` / `color` / `border-radius`, sofern vorhanden. |
| `esd-block-menu` (2+ Item-Zellen) | `menu` | Ein `MenuItemData` je Item-Zelle. |
| `esd-block-menu` (1 Item-Zelle) | `paragraph` (oder das innere Mapping) | Ein gestapelter Schritt, keine Navigation — Password-Reset-Zeilen bleiben Fließtext. |
| `esd-block-social` | `social` | Plattform aus `title` / `src` / `alt`; unbekannte Namen werden `website`. |
| `esd-block-spacer` | `spacer` | Höhe aus `style` oder dem `height`-Attribut. |
| `esd-block-html` | `html` | Inneres Markup bleibt erhalten. |

## Mapping des kompilierten HTML {#compiled-mapping}

Der kompilierte Export entfernt `esd-*` von den Elementen und behält `es-*`-Reste. Streifen (`es-header` / `es-content` / `es-footer`) werden Abschnitte. Spalten sind benachbarte, gefloatete Tabellen (`es-left` / `es-right`), keine Zellenzählung.

| Stripo-Marker | Templatical-Block | Hinweise |
|---|---|---|
| `es-header` / `es-content` / `es-footer` | `SectionBlock` | Ein Abschnitt je Streifen auf oberster Ebene. Die Füllung kommt vom inneren `es-*-body` `background-color` (Style gewinnt gegen `bgcolor`). |
| 1–3 `es-left` / `es-right`-Geschwister | `columns` `"1"` / `"2"` / `"3"` | Gefloatete Tabellen, nicht die `<td>`-Anzahl. |
| 4+ gefloatete Geschwister | `columns: "3"` | Weitere Spalten landen im dritten Slot; `approximated`. |
| `a.es-button` | `button` | Inline `background` / `color` / `border-radius`, einschließlich vom umschließenden `es-button-border`. |
| `table.es-menu` (2+ Item-Zellen) | `menu` | |
| `table.es-menu` (1 Item-Zelle) | inneres Mapping, nicht `menu` | Dieselbe Schrittzeilen-Regel wie beim Plugin-Pfad. |
| `table.es-social` | `social` | Dasselbe Plattform-Mapping wie beim Plugin-Pfad. |
| `es-spacer` | `spacer` | |

Alles andere in einem Streifen läuft durch `@templatical/import-html` (Überschriften, Absätze, Bilder, Trenner).

## Wo das Mapping verlustbehaftet ist

- **Spaltengeometrie** — Templatical unterstützt fünf Spaltenlayouts (`1`, `2`, `3`, `2-1`, `1-2`). Plugin-HTML mit 4+ Frames flatten zu einer Spalte. Kompiliertes HTML mit 4+ gefloateten Tabellen behält drei Slots und faltet den Rest in den letzten.
- **Social-Icon-`alt`** — Plattformen werden abgeleitet; der ursprüngliche `alt`-Text wird auf `SocialIcon` nicht gespeichert.
- **Block-IDs** — jeder importierte Block bekommt eine neu erzeugte ID.
- **AMP / Timer / Module** — kein Templatical-Äquivalent; inneres Markup landet als `html` oder wird mit Warnung übersprungen.
- **Inline-CSS vs. Plugin-CSS** — kompilierte Exporte sind bereits inline. Plugin-CSS muss als `options.css` übergeben werden, sonst fehlen Stile, die nur in diesem Stylesheet lagen.

## Was nicht automatisch abgebildet wird

- **Ein Roundtrip zurück nach Stripo** — die Ausgabe ist Templatical-JSON, kein Stripo-Editor-HTML.
- **Generisches HTML, das nie ein Stripo-Dokument war** — verwenden Sie [`@templatical/import-html`](/de/guide/migration-from-html) direkt. Hier übergeben konvertiert es trotzdem, mit einer Warnung.

## Was tun, wenn diese Anleitung etwas nicht abdeckt

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres Stripo-HTML und dem, was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-stripo` zu verbessern.
