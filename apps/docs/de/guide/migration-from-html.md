---
title: Migration von HTML
description: HTML-E-Mail-Templates mit @templatical/import-html in das Templatical-Format konvertieren.
---

# Migration von HTML

Das Paket `@templatical/import-html` konvertiert HTML-E-Mail-Templates in das `TemplateContent`-Format von Templatical. Es ist auf das tabellenbasierte HTML zugeschnitten, das echte Marketing-E-Mails tatsächlich verschicken — Ausgaben von MJML, Mailchimp/SendGrid/Campaign-Monitor-Exports, handgeschriebene Kampagnen.

::: warning
Dieses Paket ist in aktiver Entwicklung. Modernes HTML (Flex/Grid) wird als HTML-Fallback-Block erhalten, statt neu zerlegt zu werden — prüfe konvertierte Templates vor dem Produktiveinsatz.
:::

## Installation

```bash
npm install @templatical/import-html
```

## Verwendung

```ts
import { convertHtmlTemplate } from '@templatical/import-html';

// Den rohen HTML-Quelltext einer E-Mail laden
const html = await fetch('/path/to/email.html').then((r) => r.text());

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
| `<td>` mit einem einzigen gestylten `<a>` | `button` | Konvertiert (Cell-as-Button-Muster) |
| `<table>` (Layout, mehrere Zeilen/Spalten) | `section` (eine pro `<tr>`) | Konvertiert |
| `<table>` (Datentabelle — nur Text in Zellen) | `html` | HTML-Fallback |
| Unbekannte / Custom-Elemente | `html` | HTML-Fallback |

Alles, was sich nicht zuordnen lässt, wird wortgetreu in einem HTML-Block erhalten — sichtbarer Inhalt geht nicht verloren.

## Spalten-Layout

Jeder `<tr>` einer Layout-Tabelle wird zu einem `SectionBlock`:

| Zellen pro Zeile | Templatical-Layout |
|---|---|
| 1 | `'1'` |
| 2 | `'2'` |
| 3 | `'3'` |
| 4+ | auf `'1'` reduziert mit Warnung |

Templatical-Sections können nicht verschachtelt werden. Tabellen, die in einem `<td>` verschachtelt sind, werden flachgelegt — ihre Blöcke wandern in die übergeordnete Zelle.

## CSS-Behandlung

`<style>`-Blöcke werden vor der Konvertierung auf passende Elemente aufgelöst:

- **Inline-Styles haben Vorrang** vor Regeln aus `<style>`-Blöcken.
- **`@media`-Queries werden übersprungen** — sie würden beim Flachlegen immer greifen. Der Editor rendert in einem festen Viewport.
- **`@font-face`, `@keyframes`, `@supports`** werden übersprungen.
- **Pseudo-Klassen (`:hover`, `::before`)** werden übersprungen.
- **Externe Stylesheets (`<link rel="stylesheet">`)** werden nicht geladen.
- **`!important`-Marker** werden entfernt.

Beste Treue erreichst du, indem du Styles vor dem Import inlinst. Produktions-Pipelines erledigen das in der Regel ohnehin.

## Template-Einstellungen

- **Breite** — `width`-Attribut bzw. `style="width:…"` der äußersten `<table>`. Standard: `600`.
- **Hintergrundfarbe** — `background-color` des `<body>`. Standard: `#ffffff`.
- **Schriftart** — `font-family` des `<body>`. Standard: `Arial`.
- **Preheader** — erstes `<div style="display:none">` oben im Body (Konvention).

## Bekannte Einschränkungen

- **Modernes HTML (Flex/Grid/`<div>`-Layouts)** — niedrige Treue, meist HTML-Fallback. Der Importer ist für tabellenbasiertes E-Mail-HTML optimiert.
- **Custom Fonts** — `@font-face` wird nicht importiert. Schriften manuell über die [`fonts`-Konfiguration](/de/guide/fonts) einbinden.
- **Anzeigebedingungen / Merge-Tags** — proprietäre Platzhalter-Syntax (`{{var}}`, `*|VAR|*`, `<%= var %>`) bleibt als reiner Text erhalten. Mit Templaticals [Merge-Tags](/de/guide/merge-tags) bzw. [Anzeigebedingungen](/de/guide/display-conditions) neu aufbauen.
- **Externe Ressourcen** — `<link>`, externe Stylesheets, Web Fonts und Remote-Bilder werden nicht geladen. Bild-`src`-URLs bleiben unverändert.
- **Outlook-MSO-Conditionals** — bleiben innerhalb des umgebenden Blocks als HTML erhalten (in Nicht-Outlook-Clients ohnehin inert).
- **Formularelemente (`<form>`/`<input>`/`<button>`)** — bleiben als HTML-Fallback. Die meisten Mail-Clients blockieren Formular-Submits ohnehin; baue den CTA als Button mit Link auf eine gehostete Seite.
- **AMP for Email** — wird in Templatical derzeit nicht unterstützt.

## Konvertierte Templates prüfen

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
