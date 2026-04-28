---
title: Migration von handgeschriebenem MJML
description: So migrierst du bestehende MJML-E-Mail-Templates in Templaticals visuellen Editor — Mapping-Tabelle, Vorgehen beim Neuaufbau und was als Nächstes kommt.
---

# Migration von handgeschriebenem MJML

Diese Anleitung richtet sich an Teams, die E-Mail-Templates bisher in rohem [MJML](https://mjml.io) erstellt haben (mit Editoren wie VS Code, einem internen CLI oder einer selbstgebauten Build-Pipeline) und auf Templaticals visuellen Editor wechseln möchten.

::: tip Automatischer Importer in Entwicklung
Wir entwickeln einen automatischen **`@templatical/import-mjml`**, der ein MJML-Dokument parst und einen Templatical-`TemplateContent`-Baum erzeugt. Aktiv in Entwicklung. Bis er ausgeliefert ist, dokumentiert diese Seite den manuellen Weg.

MJML → Templatical ist schwerer vollständig zu automatisieren als BeeFree → Templatical, weil MJML eine echte Obermenge dessen ist, was Templaticals JSON-Baum ausdrücken kann (es lässt sich gültiges MJML schreiben, das keinen Templatical-Block-Equivalent hat). Der Importer wird die häufigen Muster abdecken und für alles außerhalb des Mappings auf `HtmlBlock` zurückfallen.
:::

## Was hier eigentlich passiert

Diese Migration ist etwas kontraintuitiv. Templaticals Renderer erzeugt *MJML als Ausgabe* — auf den ersten Blick sehen MJML und Templatical identisch aus. Aber:

- **MJML** ist eine Markup-Sprache. Du schreibst XML-ähnliche Tags (`<mj-section>`, `<mj-column>`, `<mj-text>`) und der MJML-Compiler verwandelt das in tabellenbasiertes HTML.
- **Templatical** speichert Templates als JSON-Baum mit typisierten Blöcken (`SectionBlock`, `ParagraphBlock` usw.) und rendert diesen Baum beim Export zu MJML.

Um ein MJML-Template in Templatical zu bringen, musst du das **MJML parsen** und einen **äquivalenten JSON-Baum aufbauen**. Dafür gibt es noch kein integriertes Werkzeug — siehe "Automatischer Importer in Entwicklung" oben.

## Pfad 1 — Visuell mit dem MJML als Referenz neu aufbauen (empfohlen)

Hast du **weniger als 20 MJML-Templates**, ist das mit Abstand der schnellste Weg:

1. Öffne deine MJML-Quelle im Editor deiner Wahl.
2. Öffne den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Kompiliere dein MJML einmal zu HTML und sieh es dir an — das ist dein visuelles Ziel.
4. Ziehe die entsprechenden Templatical-Blöcke hinein (siehe [Mapping-Tabelle](#mjml-tag-mapping) unten).
5. Kopiere Textinhalte direkt. Bilder über deine Medienbibliothek neu hosten.
6. Bilde Styling über Templaticals [Design-Tokens](/de/guide/theming) ab, statt über inline `mj-attributes`.

Die meisten MJML-Templates sind in 10–20 Minuten umgezogen, sobald du eines oder zwei gemacht hast.

## Pfad 2 — Templaticals Renderer zur Verifikation nutzen

Sobald du ein Template visuell nachgebaut hast:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = renderToMjml(content);
// Vergleiche dieses MJML mit deinem ursprünglichen MJML-Quelltext.
```

Ein Diff zwischen Original und dem von Templatical erzeugten MJML zeigt strukturelle Unterschiede. Eine sinnvolle Sanity-Prüfung vor einer Bulk-Migration.

## Pfad 3 — Ein einmaliges Konvertierungs-Skript schreiben

Hast du Hunderte MJML-Templates und willst automatische Konvertierung versuchen, bevor der offizielle Importer da ist, ist der praktische Ansatz, einen kleinen XML-/HTML-Parser zu nutzen (`htmlparser2`, `node-html-parser`), den MJML-Baum zu durchwandern und für jedes Tag Templaticals [Block-Factories](/de/api/types) aufzurufen.

Hier die grobe Form:

```ts
import { parse } from 'node-html-parser';
import {
  createSectionBlock,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
} from '@templatical/types';
import type { TemplateContent, Block } from '@templatical/types';

function mjmlToTemplate(mjml: string): TemplateContent {
  const root = parse(mjml);
  const body = root.querySelector('mj-body');

  const blocks: Block[] = (body?.childNodes ?? [])
    .map((node) => convertNode(node))
    .filter((b): b is Block => b !== null);

  return {
    blocks,
    settings: {
      width: parseInt(body?.getAttribute('width') ?? '600'),
      backgroundColor: body?.getAttribute('background-color') ?? '#ffffff',
    },
  };
}

function convertNode(node: any): Block | null {
  switch (node.tagName?.toLowerCase()) {
    case 'mj-section':
      return convertSection(node);
    case 'mj-text':
      return convertText(node);
    // …weitere Cases — siehe Mapping-Tabelle unten
    default:
      return null; // oder Fallback auf HtmlBlock
  }
}
```

::: warning
Ein selbst geschriebener Parser wird Edge Cases übersehen — verschachtelte `mj-wrapper`, Custom Components, bedingte Tags, Includes (`mj-include`) und Attribut-Vererbung über `mj-attributes`. Lass die Konvertierung zuerst auf einer kleinen Stichprobe laufen und vergleiche visuell, bevor du im Bulk konvertierst.
:::

## MJML-Tag-Mapping {#mjml-tag-mapping}

| MJML-Tag | Templatical-Block | Hinweise |
|---|---|---|
| `mj-section` (mit `mj-column`s) | `SectionBlock` mit `columns` | Mehrspaltige Layouts funktionieren gleich; Spaltenbreiten kommen aus MJMLs `width`-Attribut oder werden gleichmäßig verteilt. |
| `mj-column` | Section-Spalte | Eine Spalte hält eine Liste verschachtelter Blöcke. |
| `mj-text` | `ParagraphBlock` (oder `TitleBlock` bei einer Überschrift) | Anhand inline-styled Heading-Level entscheiden, ob Title oder Paragraph. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, Padding. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, Schrift, Padding. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, Padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` (mit `mj-social-element`) | `SocialIconsBlock` | Jedes `mj-social-element` → ein `SocialIcon`-Eintrag. |
| `mj-navbar` (mit `mj-navbar-link`) | `MenuBlock` | Jeder Link → `MenuItemData`. |
| `mj-table` | `TableBlock` | `<tr>`- und `<td>`-Zeilen/Zellen auf Templaticals Tabellen-Daten abbilden. |
| `mj-raw` | `HtmlBlock` | HTML-Pass-Through. |
| `mj-wrapper` | `SectionBlock` (oft) | Ein Wrapper ohne Spalten wird zu einer Section mit einer Spalte. |
| `mj-hero`, `mj-carousel`, `mj-accordion` | `HtmlBlock` (Fallback) | Templatical hat noch keine direkten Entsprechungen — das gerenderte HTML in einen rohen HTML-Block übernehmen oder auf den Importer warten. |
| `mj-head`-Inhalte | Template-`settings` | `mj-title`, `mj-preview`, `mj-attributes`, `mj-font`, `mj-style` mappen auf `TemplateSettings.preheaderText`, eigene Schriften und Theme-Overrides. |

## Was sich nicht automatisch übertragen lässt

- **`mj-attributes`-Defaults** — MJML erlaubt globale Defaults für jedes Tag. Übertrage diese in Templaticals [Block-Defaults](/de/guide/defaults) und [Theme-Overrides](/de/guide/theming).
- **`mj-include`** — MJMLs Include-Direktive hat keine direkte Entsprechung. Inkludierten Inhalt während der Konvertierung inlinen.
- **Custom MJML-Components** — wenn du eigene MJML-Komponenten registriert hast, musst du sie entweder (a) als [Templatical Custom Blocks](/de/guide/custom-blocks) implementieren oder (b) auf `HtmlBlock` mit dem gerenderten HTML zurückfallen.
- **Bedingte MSO-Tags innerhalb von `mj-raw`** — bewahre sie, indem du das ursprüngliche Markup in einen `HtmlBlock` packst.

## Wenn diese Anleitung etwas nicht abdeckt

[Eröffne eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt deines MJMLs und was du erreichen willst. Wir nutzen diese Rückmeldungen, um zu priorisieren, welche MJML-Muster der automatische Importer zuerst abdeckt.
