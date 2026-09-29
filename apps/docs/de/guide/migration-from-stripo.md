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

::: code-group

```bash [npm]
npm install @templatical/import-stripo
```

```bash [pnpm]
pnpm add @templatical/import-stripo
```

```bash [yarn]
yarn add @templatical/import-stripo
```

```bash [bun]
bun add @templatical/import-stripo
```

:::

### Ohne Build-Schritt (CDN)

```html
<script type="module">
  import { convertStripoTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-stripo/+esm';
  // ...dann wie unter Verwendung konvertieren
</script>
```

## Verwendung {#usage}

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

[Im Playground öffnen](https://play.templatical.com/scenes/import-stripo)

`convertStripoTemplate` ist synchron und gibt ein `ImportResult` zurück mit:

- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Quellelements (`converted`, `approximated`, `html-fallback` oder `skipped`)

Übergeben Sie `options.css` zusammen mit dem Plugin-Speicher (`getTemplateData().css`). Diese Regeln gelten für jede Zelle, die der HTML-Importer konvertiert. Ein kompilierter Datei → HTML-Export trägt dieselben Regeln bereits inline.

Nicht erkanntes HTML (keine Stripo-Klassenattribute) läuft durch `@templatical/import-html`; der Bericht enthält eine Warnung, die diesen Fallback benennt.

## Den Bericht lesen

Jeder Eintrag in `report.entries` beschreibt ein Quellelement:

| Status | Bedeutung |
|---|---|
| `converted` | Auf einen Templatical-Block abgebildet, ohne Verlust. |
| `approximated` | Auf einen Templatical-Block abgebildet, mit einer Begrenzung oder einem Flatten — `note` nennt die Änderung. |
| `html-fallback` | Kein Block-Äquivalent; das Original-Markup liegt in einem `HtmlBlock`. |
| `skipped` | Für die Parität mit den anderen `@templatical/import-*`-Paketen reserviert; dieser Konverter erzeugt das derzeit nicht. |

Der Bericht listet die Blöcke, die in `content` bleiben, einschließlich jedes Abschnitts, den Stripo erzeugt. Ein `<tr>`-Abschnitt, den der HTML-Importer beim Durchlaufen einer Zelle anlegt, entfällt. Warnungen aus diesem Durchlauf bleiben.

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
| `esd-structure` mit 1–3 `esd-container-frame`s | `SectionBlock` (`columns` `"1"` / `"2"` / `"3"`) | Frames sind die Spalten. Das Padding kommt von `es-p*` an der Structure (Standard 0); ein Inline-`padding` überschreibt die Seiten, die es nennt. |
| `esd-structure` mit 4+ Frames | `SectionBlock` `columns: "1"` | Auf eine Spalte reduziert; `approximated`. |
| `esd-block-text` | `title` / `paragraph` | Generisches HTML-Mapping des inneren Markups. |
| `esd-block-image` | `image` | Generisches HTML-Mapping des inneren `<img>`. |
| `esd-block-button` | `button` | `href`, Text, `target="_blank"` → `openInNewTab`. Inline `background` / `color` / `border-radius`, sofern vorhanden. |
| `esd-block-menu` (2+ Item-Zellen) | `menu` | Ein `MenuItemData` je Item-Zelle. |
| `esd-block-menu` (1 Item-Zelle) | `paragraph` (oder das innere Mapping) | Ein gestapelter Schritt, keine Navigation — Password-Reset-Zeilen bleiben Fließtext. |
| `esd-block-social` | `social` | Plattform aus `title` / `src` / `alt`; unbekannte Namen werden `website`. |
| `esd-block-spacer` | `spacer` oder `divider` | Ein sichtbarer `border-bottom` oder `border-top` am Spacer oder in der inneren Zelle wird ein Trenner (Stil, Farbe, Stärke und die Breitenregel unten). Sonst ein Spacer: Höhe aus `style`, dem `height`-Attribut oder dem vertikalen Padding. |
| `esd-block-html` | `html` | Inneres Markup bleibt erhalten. |

## Mapping des kompilierten HTML {#compiled-mapping}

Der kompilierte Export entfernt `esd-*` von den Elementen und behält `es-*`-Reste. Jede direkte Zeile eines Streifens wird ein eigener Abschnitt, in Dokumentreihenfolge. Spalten sind die gefloateten Tabellen `es-left` / `es-right` in dieser Zeile.

| Stripo-Marker | Templatical-Block | Hinweise |
|---|---|---|
| `es-header` / `es-content` / `es-footer` | ein oder mehrere `SectionBlock`s | Ein Abschnitt je direkter Zeile des `es-*-body` im Streifen. Ein Streifen ohne `es-*-body` verwendet seine eigenen Zeilen. Eine leere Zeile entfällt. |
| Inhalt neben den Spalten in derselben Zelle | einspaltiger `SectionBlock` | Führender Inhalt bleibt vor dem Spaltenabschnitt, nachfolgender Inhalt danach. Inhalt, der zwischen den Spalten stand, wird hinter den Spaltenabschnitt gesetzt (`approximated`). Eine Zelle mit Padding, die in mehr als einen Abschnitt zerfällt, ist `approximated`: das obere Padding bleibt am ersten Abschnitt, das untere am letzten, die Seiten an jedem. |
| 1–3 `es-left` / `es-right` in einer Zeile | `columns` `"1"` / `"2"` / `"3"` | Gefloatete Tabellen in dieser Zeile, auch Tabellen in einem Wrapper. Spalten innerhalb eines weiteren `es-left` / `es-right` bleiben darin. |
| 4+ gefloatete Tabellen in einer Zeile | `columns: "3"` | Weitere Spalten landen im dritten Slot; `approximated`. |
| `a.es-button` | `button` | Inline `background` / `color` / `border-radius`, einschließlich vom umschließenden `es-button-border`. Widgets bleiben in Dokumentreihenfolge beim Text um sie herum. |
| `table.es-menu` (2+ Item-Zellen) | `menu` | |
| `table.es-menu` (1 Item-Zelle) | inneres Mapping | Eine Schrittzeile, dieselbe Regel wie beim Plugin-Pfad. |
| `table.es-social` | `social` | Dasselbe Plattform-Mapping wie beim Plugin-Pfad. |
| `es-spacer` mit sichtbarem Rahmen | `divider` | Stil, Farbe und Stärke aus `border-bottom` oder `border-top`. Die Breite folgt der Regel unten. |
| `es-spacer` ohne Rahmen | `spacer` | Höhe aus `style`, dem `height`-Attribut oder dem vertikalen Padding. |

`settings.backgroundColor` ist die erste gesetzte Farbe von `es-wrapper` oder `es-wrapper-color` (`#ffffff`, wenn keine gesetzt ist). Eine `es-*-body`-Füllung ist der Hintergrund des Abschnitts. Ein transparenter Body lässt die Streifenfüllung auf dem Abschnitt. Eine Streifenfüllung, die sich von Seite und Body unterscheidet, wird `section.wrapper.backgroundColor`; dieser Abschnitt ist `approximated`. Ein `background-image` wird gemeldet und verworfen; die Farbe bleibt.

Das Padding der Strukturzelle ist das Padding des Abschnitts. Der Standard ist 0. Im Plugin-HTML setzt `es-p20` jede Seite und `es-p10t` / `es-p10r` / `es-p10b` / `es-p10l` überschreibt eine Seite; ein Inline-Padding überschreibt die Seiten, die es nennt. Diese Klassen werden am Structure-Element gelesen.

Die Breite eines Trenners gilt für die Spalte, in der er steht. Fehlende Breite, `auto` oder `100%` füllt diese Spalte. Ein anderer Prozentwert bleibt ein Prozentwert, auf zwei Dezimalstellen gerundet und auf 0–100 begrenzt. Eine px-Breite bleibt px, bis sie den Raum der Spalte füllt (der Anteil der Spalte an der Body-Breite, abzüglich des Abschnitts-Paddings an der Kante, die diese Spalte trägt, und des eigenen Seiten-Paddings des Trenners). `double`, `groove`, `ridge`, `inset` und `outset` werden als `solid` importiert. Eine schmalere Linie mit Ausrichtung links oder rechts wird zentriert; dieser Eintrag ist `approximated`. Eine schmalere Linie ohne Ausrichtung gilt als links.

Alles andere in einer Zeile läuft durch `@templatical/import-html` (Überschriften, Absätze, Bilder, `<hr>`-Trenner).

## Wo das Mapping verlustbehaftet ist

- **Spaltengeometrie** — Templatical unterstützt fünf Spaltenlayouts (`1`, `2`, `3`, `2-1`, `1-2`). Plugin-HTML mit 4+ Frames wird auf eine Spalte reduziert. Kompiliertes HTML mit 4+ gefloateten Tabellen in einer Zeile behält drei Slots und faltet den Rest in den letzten. Inhalt zwischen diesen Spalten wird ein eigener einspaltiger Abschnitt dahinter, und eine Zelle mit Padding, die über die entstehenden Abschnitte aufgeteilt wird, ist `approximated`.
- **Social-Icon-`alt`** — Plattformen werden abgeleitet; der ursprüngliche `alt`-Text wird auf `SocialIcon` nicht gespeichert.
- **Block-IDs** — jeder importierte Block bekommt eine neu erzeugte ID.
- **AMP / Timer / Module** — kein Templatical-Äquivalent; inneres Markup landet als `html` oder wird mit Warnung übersprungen.
- **Plugin-CSS** — übergeben Sie `options.css` mit dem Plugin-Speicher. Regeln, die nur in diesem Stylesheet stehen, werden auf die konvertierten Blöcke angewendet. Kompilierte Exporte tragen sie bereits inline.

## Was nicht automatisch abgebildet wird

- **Ein Roundtrip zurück nach Stripo** — die Ausgabe ist Templatical-JSON, kein Stripo-Editor-HTML.
- **Generisches HTML, das nie ein Stripo-Dokument war** — verwenden Sie [`@templatical/import-html`](/de/guide/migration-from-html) direkt. Hier übergeben konvertiert es trotzdem, mit einer Warnung.

## Weitere Hilfe

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres Stripo-HTML und dem, was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-stripo` zu verbessern.
