---
title: Migration von HTML
description: HTML-E-Mail-Templates mit @templatical/import-html in das Templatical-Format konvertieren.
---

# Migration von HTML

Das Paket `@templatical/import-html` konvertiert HTML-E-Mail-Templates in das `TemplateContent`-Format von Templatical. Es ist auf das tabellenbasierte HTML zugeschnitten, das echte Marketing-E-Mails tatsächlich verschicken — Ausgaben von MJML, Mailchimp/SendGrid/Campaign-Monitor-Exports, handgeschriebene Kampagnen.

::: warning
Dieses Paket ist in aktiver Entwicklung. Modernes HTML (Flex/Grid) wird als HTML-Fallback-Block erhalten, statt neu zerlegt zu werden — prüfen Sie konvertierte Templates vor dem Produktiveinsatz.
:::

## Installation

```bash
npm install @templatical/import-html
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertHtmlTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-html/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung

```ts
import { convertHtmlTemplate } from '@templatical/import-html';

// Den rohen HTML-Quelltext einer E-Mail laden
const res = await fetch('/path/to/email.html');
const html = await res.text();

// In das Templatical-Format konvertieren
const { content, report } = convertHtmlTemplate(html);

// Im Editor verwenden
const editor = await init({
  container: '#editor',
  content,
});

// Konvertierungsbericht auf Auffälligkeiten prüfen
console.log(report);
```

Die Funktion gibt ein `ImportResult` zurück mit:
- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Elements (`converted`, `approximated`, `html-fallback` oder `skipped`)

## Element-Mapping

HTML-Elemente werden auf ihre Templatical-Entsprechungen abgebildet:

| HTML-Element | Templatical-Block | Status |
|---|---|---|
| `<h1>` – `<h4>` | `title` | Konvertiert (Level erhalten) |
| `<h5>` – `<h6>` | `title` | Konvertiert (auf Level 4 begrenzt) |
| `<p>` / Text-`<div>` / `<span>` | `paragraph` | Konvertiert |
| `<img>` | `image` | Konvertiert |
| `<a>` als Button gestaltet (Hintergrund, Padding, Border-Radius oder `display: inline-block`) | `button` | Konvertiert |
| `<a>` (einfacher Inline-Link) | `paragraph` | Approximiert (in Paragraph eingewickelt) |
| `<hr>` | `divider` | Konvertiert |
| Leeres `<td>` mit explizit gesetzter Höhe | `spacer` | Konvertiert |
| `<td>`, dessen gesamter Inhalt ein gestyltes `<a>` ist | `button` | Konvertiert (Cell-as-Button-Muster) |
| `<table>` (Layout, mehrere Zeilen/Spalten) | `section` (eine pro `<tr>`) | Konvertiert |
| `<table>` (Datentabelle — nur Text in Zellen) | `html` | HTML-Fallback |
| Unbekannte / Custom-Elemente | `html` | HTML-Fallback |

Alles, was sich nicht zuordnen lässt, wird wortgetreu in einem HTML-Block erhalten — sichtbarer Inhalt geht nicht verloren.

Eine Zelle, die Text und einen Link mischt, behält beides: Der Text wird ein `paragraph`, der Link ein eigener `paragraph` mit dem Status `approximated`. Nur eine Zelle, deren gesamter Inhalt der Anchor ist, gilt als Button.

Ein `<div>`, `<center>` oder `<main>`, das eine Tabelle umschließt, erzeugt keinen eigenen Block: Der Importer steigt hinein, unabhängig von der Verschachtelungstiefe, und ordnet die gefundenen Tabellen zu. Ein Wrapper, der nur Text enthält, behält seine `paragraph`-Zuordnung.

## Inline-Formatierung

`<br>`, `<em>`, `<strong>`, `<i>`, `<b>`, `<u>`, `<small>`, `<sub>` und `<sup>` bleiben in dem Text, zu dem sie gehören. Eine Folge davon wird zusammen mit dem umgebenden reinen Text zu einem einzigen `paragraph`, dessen Farbe, Größe und Ausrichtung aus der umgebenden Zelle stammen — `Hello<br>World` in einem `<td>` wird also ein Paragraph mit beiden Wörtern und dem Umbruch.

`<a>` gehört nicht zu einer solchen Folge. Es wird zu einem `button` oder zu einem eigenen, als `approximated` gemeldeten `paragraph`, sodass ein Link seinen eigenen Block behält, statt im umgebenden Text aufzugehen.

## Spalten-Layout

Jeder `<tr>` einer Layout-Tabelle wird zu einem `SectionBlock`. Die direkten `<td>`/`<th>`-Kinder der Zeile ergeben das Layout:

| Zellen pro Zeile | Templatical-Layout |
|---|---|
| 1 | `'1'` |
| 2 | `'2'` |
| 3 | `'3'` |
| 4+ | auf `'1'` zusammengefasst, mit Warnung und einem `approximated`-Eintrag im Bericht |

### Wrapper-Zeilen

Tabellenbasierte E-Mails umschließen ihr eigentliches Layout mit einzelligen Tabellen. Eine Zeile mit einer einzigen Zelle, deren Inhalt ausschließlich aus Tabellen besteht, wird durchlaufen, statt eine Section zu werden — die Spaltenzahl wird so an der Zeile gelesen, die sie deklariert. Das gilt nur, wenn diese Zelle neben ihren Tabellen keinen Inhalt trägt und die Zeile keine Hintergrundfarbe und kein Padding hat. Eine Zeile, die eine dieser Bedingungen nicht erfüllt, wird eine eigene Section, denn die Section trägt Hintergrund und Padding der Zeile.

Spalten, die als `<div class="mj-column-per-*">` innerhalb einer Zelle geschrieben sind — so kompiliert MJML sie —, werden nicht erkannt. Die Zeile hat eine einzige Zelle und wird daher als eine Spalte importiert, die die Blöcke dieses `div` enthält.

### Verschachtelung

Templatical-Sections können nicht verschachtelt werden. Tabellen, die in einem `<td>` verschachtelt sind, werden flachgelegt — ihre Blöcke wandern in die übergeordnete Zelle. Eine verschachtelte Zeile mit mehr als einer Zelle verliert dabei ihre Spalten; `report.entries` hält das als `approximated` mit einer Notiz fest.

## CSS-Behandlung

`<style>`-Blöcke werden vor der Konvertierung auf passende Elemente aufgelöst:

- **Inline-Styles haben Vorrang** vor Regeln aus `<style>`-Blöcken.
- **`@media`-Queries werden übersprungen** — sie würden beim Flachlegen immer greifen. Der Editor rendert in einem festen Viewport.
- **`@font-face`, `@keyframes`, `@supports`** werden übersprungen.
- **Pseudo-Klassen (`:hover`, `::before`)** werden übersprungen.
- **Externe Stylesheets (`<link rel="stylesheet">`)** werden nicht geladen.
- **`!important`-Marker** werden entfernt.

Beste Treue erreichen Sie, indem Sie Styles vor dem Import inlinen. Produktions-Pipelines erledigen das in der Regel ohnehin.

## Template-Einstellungen

Globale Template-Einstellungen werden aus dem Dokument gelesen:

- **Breite** — `width`-Attribut bzw. `style="width:…"` der äußersten `<table>`. Standard: `600`.
- **Hintergrundfarbe** — `background-color` des `<body>`. Standard: `#ffffff`.
- **Schriftart** — `font-family` des `<body>`. Standard: `Arial`.
- **Preheader** — erstes `<div style="display:none">` oben im Body (Konvention).

## Bekannte Einschränkungen

- **Modernes HTML (Flex/Grid/`<div>`-Layouts)** — niedrige Treue, meist HTML-Fallback. Der Importer ist für tabellenbasiertes E-Mail-HTML optimiert.
- **Custom Fonts** — `@font-face` wird nicht importiert. Schriften manuell über die [`fonts`-Konfiguration](/de/guide/fonts) einbinden.
- **Anzeigebedingungen / Merge-Tags** — proprietäre Merge-Tag-Syntax (<code v-pre>{{var}}</code>, `*|VAR|*`, `<%= var %>`) bleibt als reiner Text erhalten. Mit Templaticals [Merge-Tags](/de/guide/merge-tags) bzw. [Anzeigebedingungen](/de/guide/display-conditions) neu aufbauen.
- **Externe Ressourcen** — `<link>`, externe Stylesheets, Web Fonts und Remote-Bilder werden nicht geladen. Bild-`src`-URLs bleiben unverändert.
- **Outlook-MSO-Conditionals** — bleiben innerhalb des umgebenden Blocks als HTML erhalten (in Nicht-Outlook-Clients ohnehin inert).
- **Formularelemente (`<form>`/`<input>`/`<button>`)** — bleiben als HTML-Fallback. Die meisten Mail-Clients blockieren Formular-Submits ohnehin; bauen Sie den CTA als Button mit Link auf eine gehostete Seite.
- **Von MJML kompilierte Spalten** — die Spalten einer Section kommen als benachbarte `<div class="mj-column-per-*">` innerhalb eines einzigen `<td>` an, und der Importer liest das Layout an der Zellenzahl ab. Eine solche Zeile wird daher als eine Spalte importiert, die die Blöcke aller Spalten in ihrer Reihenfolge enthält.
- **AMP for Email** — wird in Templatical derzeit nicht unterstützt.

## Konvertierte Templates prüfen

Prüfen Sie das Ergebnis nach der Konvertierung im Editor auf:

1. **Element-Klassifikation** — `report.entries` auf Einträge mit `status: 'approximated'` oder `status: 'html-fallback'` durchsehen.
2. **Bild-URLs** — relative Pfade und CID-Referenzen funktionieren in der Vorschau nicht; durch absolute URLs ersetzen.
3. **Spaltenverhältnisse** — das automatische Mapping wählt das nächstgelegene Standard-Layout; im Section-Settings-Panel verfeinern.
4. **Abstände und Padding** — `padding`-Shorthand wird treu geparst, leere Zell-Margins können Nachschärfung brauchen.
5. **HTML-Fallback-Blöcke** — Inhalt im HTML-Block lässt sich inline editieren oder durch erstklassige Blöcke ersetzen.

## Den Bericht lesen

```ts
const { content, report } = convertHtmlTemplate(html);

console.log(report.summary);
// { total: 12, converted: 10, approximated: 1, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'html-fallback') {
    console.warn(
      `Element <${entry.sourceTag}> als HTML erhalten:`,
      entry.note,
    );
  }
}

for (const warning of report.warnings) {
  console.warn(warning);
}
```

### Sections im Bericht

`report.entries` weist neben den Blattblöcken auch die Sections aus, sodass sich die Einträge gegen `content.blocks` abgleichen lassen:

- Ein Eintrag pro Section, mit `sourceTag: 'tr'` und `templaticalBlockType: 'section'`. Der Status ist `converted`, wenn jede Zelle ihre eigene Spalte behalten hat, und `approximated` mit einer Notiz, wenn Zellen zusammengefasst wurden.
- Ein Eintrag mit `sourceTag: 'body'` und einer Notiz, wenn freistehender Inhalt der obersten Ebene in einer synthetischen einspaltigen Section gruppiert wird.
- Ein Eintrag mit `templaticalBlockType: null` und einer Notiz für eine verschachtelte Zeile, deren Spalten entfallen sind.
