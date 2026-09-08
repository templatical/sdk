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
| Eine Überschrift in einem `<div>`, `<center>` oder `<main>` | `title` | Konvertiert (Wrapper entfernt) |
| `<p>` / Text-`<div>` / `<span>` | `paragraph` | Konvertiert |
| `<td>` mit ausschließlich Text in einer Layout-Tabelle | `paragraph` | Konvertiert |
| Reiner Text auf Body-Ebene oder direkt in einem Wrapper | `paragraph` | Konvertiert |
| `<img>` | `image` | Konvertiert |
| `<a>` als Button gestaltet (Hintergrund, Padding, Border-Radius oder `display: inline-block`) | `button` | Konvertiert |
| `<a>` (Text-Link) | geht im umgebenden `paragraph` auf | Konvertiert |
| `<a>`, das ein Bild umschließt | `paragraph` | Approximiert (Link-Ziel entfällt) |
| `<hr>` | `divider` | Konvertiert |
| Leeres `<td>` mit explizit gesetzter Höhe | `spacer` | Konvertiert |
| `<td>`, dessen gesamter Inhalt ein gestyltes `<a>` ist | `button` | Konvertiert (Cell-as-Button-Muster) |
| `<table>` (Layout, mehrere Zeilen/Spalten) | `section` (eine pro `<tr>`) | Konvertiert |
| `<table>` (Datentabelle — nur Text in Zellen) | `html` | HTML-Fallback |
| Unbekannte / Custom-Elemente | `html` | HTML-Fallback |

Alles, was sich nicht zuordnen lässt, wird wortgetreu in einem HTML-Block erhalten — sichtbarer Inhalt geht nicht verloren.

Eine Zelle, die Text und einen Link mischt, wird ein einzelner `paragraph`, der beides enthält — das `<a>` samt `href` inline. Eine Zelle gilt als Button, wenn der Anchor ihr gesamter Inhalt ist.

Ein `<div>`, `<center>` oder `<main>`, das eine Tabelle umschließt, erzeugt keinen eigenen Block: Der Importer steigt hinein, unabhängig von der Verschachtelungstiefe, und ordnet die gefundenen Tabellen zu. Ein Wrapper, der nur Text enthält, behält seine `paragraph`-Zuordnung; ein Wrapper, dessen gesamter Inhalt eine Überschrift ist, wird entfernt, sodass die Überschrift selbst zugeordnet wird.

## Inline-Formatierung

`<br>`, `<em>`, `<strong>`, `<i>`, `<b>`, `<u>`, `<small>`, `<sub>` und `<sup>` bleiben in dem Text, zu dem sie gehören. Eine Folge davon wird zusammen mit dem umgebenden reinen Text zu einem einzigen `paragraph`, dessen Farbe, Größe und Ausrichtung aus der umgebenden Zelle stammen — `Hello<br>World` in einem `<td>` wird also ein Paragraph mit beiden Wörtern und dem Umbruch.

Ein Text-`<a>` geht in dieser Folge auf und behält sein `href`, sodass ein Satz mit einem Link als ein Paragraph ankommt und der Link nicht aus seinem Text herausgelöst wird. Ein `<a>`, dessen Inhalt kein Text ist — ein verlinktes Bild —, wird ein eigener `paragraph`.

::: tip
Reiner Text zählt hier als Inhalt. Ein Zellendurchlauf, der nur Element-Kinder besuchte, verlor die Wörter zwischen zwei Inline-Tags und ebenso einen freistehenden Satz neben einer Tabelle auf Body- oder Wrapper-Ebene. Beides bleibt jetzt erhalten.
:::

## Spalten-Layout

Jeder `<tr>` einer Layout-Tabelle wird zu einem `SectionBlock`. Die direkten `<td>`/`<th>`-Kinder der Zeile ergeben das Layout:

| Zellen pro Zeile | Templatical-Layout |
|---|---|
| 1 | `'1'` |
| 2 | `'2'` bzw. `'2-1'` / `'1-2'`, je nach deklarierter Breite |
| 3 | `'3'` |
| 4+ | auf `'1'` zusammengefasst, mit Warnung und einem `approximated`-Eintrag im Bericht |

### Spaltenverhältnisse

Eine zweizellige Zeile wählt zwischen `'2'`, `'2-1'` und `'1-2'` anhand der Breiten, die ihre Zellen deklarieren — ein `width`-Attribut, ein `style="width:…"` oder der Anteil im Klassennamen `mj-column-per-*`. Das nächstgelegene dieser Layouts gewinnt: `350` / `190` wird zu `'2-1'`, `33,33 %` / `66,66 %` zu `'1-2'`.

Ein Verhältnis, das kein Layout ausdrückt, wird als gleichmäßige Teilung dieser Zellenzahl importiert und als `approximated` gemeldet, mit einer Notiz, die die gemessenen Breiten nennt:

```txt
Column widths 24.1% / 51.9% / 24.1% have no Templatical equivalent.
The section was imported as 3 equal columns.
```

### Wrapper-Zeilen

Tabellenbasierte E-Mails umschließen ihr eigentliches Layout mit einzelligen Tabellen. Eine Zeile mit einer einzigen Zelle, deren Inhalt ausschließlich aus Tabellen besteht, wird durchlaufen, statt eine Section zu werden — die Spaltenzahl wird so an der Zeile gelesen, die sie deklariert. Das gilt nur, wenn diese Zelle neben ihren Tabellen keinen Inhalt trägt und die Zeile keine Hintergrundfarbe und kein Padding hat. Eine Zeile, die eine dieser Bedingungen nicht erfüllt, wird eine eigene Section, denn die Section trägt Hintergrund und Padding der Zeile.

### Gutter-Zeilen

Eine Zeile, die ihren Inhalt mit leeren Zellen umgibt — `&nbsp;` links und rechts von einem zentrierten Container —, wird als die eine Spalte gelesen, die sie layoutet, und nicht als eine Spalte pro Zelle. Das Signal ist der Inhalt: Eine Zelle ohne Inhalt nimmt an keinem Layout teil.

### Benachbarte Spalten-Container

Ein einzelnes `<td>`, das pro Spalte einen Container mit `display: inline-block` enthält, wird als Spaltensatz gelesen. Die Spaltenzahl stammt aus der Anzahl der Container, das Verhältnis aus deren deklarierten Breiten. So drücken Hybrid-Templates und kompiliertes MJML ihre Spalten aus — MJML legt alle Spalten einer Section als benachbarte `<div class="mj-column-per-*">` in eine Zelle —, weshalb eine solche Zeile keine ablesbare Zellenzahl hat.

Jeder Container muss nebeneinander liegen, keiner darf leer sein, und daneben darf kein eigener Text der Zelle stehen. Eine Zelle, die eine dieser Bedingungen verletzt, ist eine einzelne Spalte.

::: tip
`display: inline-block` ist das, was einen Satz Container zu einem Satz Spalten macht, denn ein `<div>` auf Blockebene stapelt sich stattdessen. Diese Bedingung verhindert, dass zwei gestapelte Divs als ein Layout gelesen werden, das die Quelle nie angegeben hat.
:::

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
- **Verlinkte Bilder** — ein `<a>`, das ein `<img>` umschließt, wird ein `paragraph` mit dem Bild; das Link-Ziel entfällt. Ergänzen Sie es im Editor als `linkUrl` eines `image`-Blocks. Genau diese Einträge werden als `approximated` mit `Inline anchor wrapped in a paragraph block.` gemeldet.
- **Zeilen mit mehr als drei Zellen** — `ColumnLayout` fasst höchstens drei Spalten, eine breitere Zeile wird also auf eine zusammengefasst und gemeldet. Auch Verhältnisse außerhalb von `'2'` / `'2-1'` / `'1-2'` / `'3'` — etwa ein Sidebar-Paar im Verhältnis `1-2-1` — haben keine Entsprechung und werden als gleichmäßige Teilung importiert.
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

- Ein Eintrag pro Section, mit `sourceTag: 'tr'` und `templaticalBlockType: 'section'`. Der Status ist `converted`, wenn jede Zelle ihre eigene Spalte behalten hat, und `approximated` mit einer Notiz, wenn Zellen zusammengefasst wurden oder das Verhältnis keine Entsprechung hatte.
- Ein Eintrag mit `sourceTag: 'body'` und einer Notiz, wenn freistehender Inhalt der obersten Ebene in einer synthetischen einspaltigen Section gruppiert wird.
- Ein Eintrag mit `templaticalBlockType: null` und einer Notiz für eine verschachtelte Zeile, deren Spalten entfallen sind.

Ein Wrapper, den der Importer durchläuft, liefert keinen eigenen Eintrag: Es entsteht nichts und es geht nichts verloren. Eine Überschrift, die aus einem `<div>` gehoben wurde, wird daher unter ihrem eigenen Tag gemeldet, und die Spalten-Container einer Zelle tauchen nirgends auf.

::: warning Anzahl der Einträge geändert
Sections und verlorene Layouts werden jetzt gemeldet, wo das vorher nicht der Fall war. `report.summary.total` ist für dasselbe Dokument also höher, und `approximated` umfasst nun Fälle, die zuvor nur einen `warnings`-String erzeugten oder gar nicht gemeldet wurden. Code, der auf exakte Summen prüft, muss angepasst werden; Code, der nach `status` oder `templaticalBlockType` filtert, nicht.
:::
