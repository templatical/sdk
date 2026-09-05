---
title: Migration von handgeschriebenem MJML
description: MJML-E-Mail-Templates mit @templatical/import-mjml in das Templatical-Format konvertieren.
---

# Migration von handgeschriebenem MJML

Diese Anleitung richtet sich an Teams, die E-Mail-Templates bisher in rohem [MJML](https://mjml.io) erstellt haben (mit Editoren wie VS Code, einem internen CLI oder einer selbstgebauten Build-Pipeline) und auf Templaticals visuellen Editor wechseln möchten. **`@templatical/import-mjml`** konvertiert ein MJML-Dokument direkt in Templaticals `TemplateContent`-Format — installieren Sie es, führen Sie es aus, und nutzen Sie die folgenden Abschnitte, um alles nachzuarbeiten, was es nicht automatisch abbilden kann.

## Installation

```bash
npm install @templatical/import-mjml
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertMjmlTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-mjml/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung" unten
</script>
```

## Verwendung

```ts
import { convertMjmlTemplate } from '@templatical/import-mjml';

// Den rohen MJML-Quelltext einer E-Mail laden
const res = await fetch('/path/to/email.mjml');
const mjml = await res.text();

// In das Templatical-Format konvertieren
const { content, report } = convertMjmlTemplate(mjml);

// Im Editor verwenden
const editor = await init({
  container: '#editor',
  content,
});

// Konvertierungsbericht auf Auffälligkeiten prüfen
console.log(report);
```

`convertMjmlTemplate` arbeitet synchron und gibt ein `ImportResult` zurück mit:
- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Quellelements (`converted`, `approximated`, `html-fallback` oder `skipped`)

## Den Bericht lesen

Jeder Eintrag in `report.entries` beschreibt ein Quellelement:

| Status | Bedeutung |
|---|---|
| `converted` | Jedes Attribut mit einer Templatical-Entsprechung wurde übernommen. |
| `approximated` | Auf den richtigen Block abgebildet, aber ein Wert musste auf einen begrenzten Wertebereich angepasst werden — `note` nennt den ursprünglichen Wert. |
| `html-fallback` | Keine Block-Entsprechung vorhanden; das ursprüngliche Markup bleibt in einem `HtmlBlock` erhalten. |
| `skipped` | Es wurde nichts erzeugt (`templaticalBlockType: null`). |

```ts
console.log(report.summary);
// { total: 24, converted: 21, approximated: 2, htmlFallback: 1, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximiert:`, entry.note);
  }
}
// <mj-section> approximiert: Column widths 40%, 60% have no exact Templatical layout; resolved to "1-2".
```

Ein `note` bei einem `approximated`-Eintrag nennt immer den ersetzten Wert — ein Diff von `report.entries` zwischen zwei Durchläufen zeigt so genau, was eine Migration verändert hat.

## Was hier eigentlich passiert

Diese Migration ist etwas kontraintuitiv. Templaticals Renderer erzeugt *MJML als Ausgabe* — auf den ersten Blick sehen MJML und Templatical identisch aus. Aber:

- **MJML** ist eine Markup-Sprache. Sie schreiben XML-ähnliche Tags (`<mj-section>`, `<mj-column>`, `<mj-text>`) und der MJML-Compiler verwandelt das in tabellenbasiertes HTML.
- **Templatical** speichert Templates als JSON-Baum mit typisierten Blöcken (`SectionBlock`, `ParagraphBlock` usw.) und rendert diesen Baum beim Export zu MJML.

Um ein MJML-Template in Templatical zu bringen, parsen Sie das MJML und bauen einen äquivalenten JSON-Baum auf — einschließlich der Auflösung von MJMLs eigenen Attribut-Vererbungsregeln (`mj-all`, Tag-Defaults, `mj-class`), bevor jedes Element abgebildet wird. Genau das leistet `@templatical/import-mjml`; die Mapping-Tabelle unten zeigt, was es umsetzt.

## Pfad 1 — Visuell mit dem MJML als Referenz neu aufbauen

Bei einer Handvoll Templates ist der Neuaufbau von Hand neben Ihrer MJML-Quelle oft schneller, als ein Paket zu installieren:

1. Öffnen Sie Ihre MJML-Quelle im Editor Ihrer Wahl.
2. Öffnen Sie den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Kompilieren Sie Ihr MJML einmal zu HTML und sehen Sie es sich an — das ist Ihr visuelles Ziel.
4. Ziehen Sie die entsprechenden Templatical-Blöcke hinein (siehe [Mapping-Tabelle](#mjml-tag-mapping) unten).
5. Kopieren Sie Textinhalte direkt. Bilder über Ihre Medienbibliothek neu hosten.
6. Bilden Sie Styling über Templaticals [Design-Tokens](/de/guide/theming) ab, statt über inline `mj-attributes`.

Die meisten MJML-Templates sind in 10–20 Minuten umgezogen, sobald Sie eines oder zwei gemacht haben. Bei größeren Mengen führen Sie zuerst `@templatical/import-mjml` aus und nutzen diesen Pfad nur, um nachzuarbeiten, was als HTML-Fallback-Block gelandet ist.

## Pfad 2 — Templaticals Renderer zur Verifikation nutzen

Sobald ein Template in Templatical vorliegt — importiert oder von Hand nachgebaut:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
// Vergleichen Sie dieses MJML mit Ihrem ursprünglichen MJML-Quelltext.
```

Ein Diff zwischen Original und dem von Templatical erzeugten MJML zeigt strukturelle Unterschiede. Eine sinnvolle Sanity-Prüfung vor einer Bulk-Migration.

## MJML-Tag-Mapping {#mjml-tag-mapping}

| MJML-Tag | Templatical-Block | Hinweise |
|---|---|---|
| `mj-section` (mit `mj-column`s) | `SectionBlock` mit `columns` | Mehrspaltige Layouts funktionieren gleich; Spaltenbreiten kommen aus MJMLs `width`-Attribut oder werden gleichmäßig verteilt. |
| `mj-column` | Section-Spalte | Eine Spalte hält eine Liste verschachtelter Blöcke. |
| `mj-group` | `SectionBlock.stackOnMobile: false` | Kein eigener Block — markiert, dass die Spalten der Section auf Mobilgeräten nebeneinander bleiben, statt zu stapeln. |
| `mj-text` | `TitleBlock` / `TableBlock` / `MenuBlock` / `ParagraphBlock` | Strukturell aufgelöst: Eine einzelne Überschrift als Wurzelelement wird zu `TitleBlock`, eine einzelne `<table>` zu `TableBlock`, ausschließlich Top-Level-Links ohne Paragraph-Wrapper zu `MenuBlock`, alles andere zu `ParagraphBlock`. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, Padding. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, Schrift, Padding. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, Padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` (mit `mj-social-element`) | `SocialIconsBlock` | Jedes `mj-social-element` → ein `SocialIcon`-Eintrag. |
| `mj-navbar` (mit `mj-navbar-link`) | `MenuBlock` | Jeder Link → `MenuItemData`. |
| `mj-table` | `TableBlock` | Bildet `<tr>`/`<td>`/`<th>`-Zeilen und -Zellen auf Templaticals Tabellen-Daten ab; eine führende `<th>`-Zeile setzt `hasHeaderRow`. |
| `mj-raw` | `HtmlBlock` | Inneres Markup bleibt wortgetreu erhalten. |
| `mj-wrapper` | `SectionBlock.wrapper` | Das äußere Band der Section, **keine eigene Section**. Eine einzelne Section darin fließt in deren `wrapper`; mehrere teilen sich dasselbe Band und werden als `approximated` markiert. |
| `mj-hero`, `mj-carousel`, `mj-accordion` | `HtmlBlock` | Wird in einen HTML-Block mit erhaltenem Original-Markup konvertiert. |
| `mj-head`-Inhalte | Template-`settings` | `mj-preview` → `preheaderText`; `mj-attributes`/`mj-font`/`mj-style` setzen Schriftart, Textfarbe und Link-Farbe/-Unterstreichung des Dokuments. `mj-title` hat keine Entsprechung in den Settings und wird mit einer Warnung verworfen. |

## Wo das Mapping verlustbehaftet ist

MJML, das Templaticals eigener Renderer erzeugt hat, durchläuft den Importer ohne Näherungen bei Layout, Styling oder Anzeigebedingungen. Die einzige Lücke betrifft den Blocktyp: Ein `VideoBlock` und ein `HtmlBlock` rendern beide als reines MJML ohne Kennzeichnung ihrer Herkunft, sodass beim erneuten Import jeweils ein anderer Blocktyp entsteht (siehe unten). Handgeschriebenes MJML konvertiert für jedes Tag in der Mapping-Tabelle oben sauber; alles, was die Tabelle nicht abdeckt, landet als `HtmlBlock` mit dem ursprünglichen Markup. Innerhalb dessen, was die Tabelle abdeckt, sind einige Konvertierungen Näherungen statt exakter Treffer:

- **Spalten-Geometrie** — Templatical unterstützt fünf Spalten-Layouts (`1`, `2`, `3`, `2-1`, `1-2`). MJML erlaubt beliebig viele Spalten in beliebigem Verhältnis, daher wird ein Verhältnis außerhalb dieser fünf auf das nächstliegende Layout aufgelöst, und der Inhalt einer vierten oder weiteren Spalte fließt in die letzte Spalte.
- **Social-Icon-Größen** — `SocialIconsBlock` unterstützt drei Größen (24px, 32px, 48px). Eine `icon-size` an einem `mj-social-element` außerhalb dieser drei wird auf die nächstliegende aufgelöst.
- **Überschriften-Ebenen** — ein `<h5>` oder `<h6>` innerhalb von `mj-text` wird auf Überschriften-Ebene 4 begrenzt, die höchste, die ein `TitleBlock` unterstützt.
- **Video-Blöcke** — ein `VideoBlock` wird genauso gerendert wie ein verlinkter `ImageBlock`, sodass nichts im MJML ihn als Video kennzeichnet. Beim Import daraus entsteht ein `ImageBlock` mit demselben Vorschaubild und Link; der Inhalt bleibt erhalten, der Blocktyp nicht.
- **HTML-Blöcke** — aus demselben Grund rendert der Inhalt eines `HtmlBlock` als reines `mj-text`-Markup ohne jede Kennzeichnung als HTML. Beim Import daraus entsteht ein `ParagraphBlock` mit demselben Markup.
- **Block-IDs** — jeder importierte Block erhält eine neu generierte ID. IDs erscheinen nirgends im gerenderten MJML, daher überlebt nichts, das an einer ID hängt — zum Beispiel ein Cloud-Kommentarthread — einen Durchlauf durch Export und Re-Import.

## Was sich nicht automatisch überträgt

- **`mj-include`** — der Importer liest einen einzelnen MJML-String ohne Dateisystemzugriff, daher wird ein nicht auflösbares `<mj-include>` übersprungen (`skipped`), mit einer Warnung, die das `path`-Attribut nennt. Inkludierten Inhalt vor dem Import inlinen.
- **Custom MJML-Components** — ein nicht erkanntes `mj-*`-Tag landet automatisch als `HtmlBlock` mit dem gerenderten Markup. Implementieren Sie es als [Templatical Custom Block](/de/guide/custom-blocks), wenn Sie es stattdessen als nativen Block editierbar haben möchten.

## Wenn diese Anleitung etwas nicht abdeckt

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres MJMLs und was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-mjml` zu verbessern.
