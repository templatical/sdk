---
title: Migration von Unlayer
description: So migrierst du E-Mail-Templates von Unlayer zu Templatical — Schema-Mapping, manueller Konvertierungsweg und was als Nächstes kommt.
---

# Migration von Unlayer

Diese Anleitung hilft dir, E-Mail-Templates aus Unlayers `react-email-editor` (und dem Unlayer Cloud Editor) zu Templatical zu migrieren.

::: tip Automatischer Importer in Arbeit
Wir entwickeln einen automatischen **`@templatical/import-unlayer`** — gleicher Aufbau wie der bereits existierende [`@templatical/import-beefree`](/de/guide/migration-from-beefree). Aktiv in Entwicklung. Bis er ausgeliefert ist, dokumentiert diese Seite den manuellen Weg. Abonniere die [GitHub-Releases](https://github.com/templatical/sdk/releases) oder beobachte die [Discussions](https://github.com/templatical/sdk/discussions), um benachrichtigt zu werden, sobald er da ist.
:::

## Was du hast vs. was du brauchst

Unlayer speichert Templates als proprietäres JSON-Design-Objekt, das du dem Editor mit `editor.exportHtml(...)` oder `editor.saveDesign(...)` entnimmst. Templatical speichert Templates als anders strukturiertes proprietäres JSON mit expliziten Blocktypen, Design-Tokens und einem Inhaltsbaum.

Beide Formate beschreiben logisch dasselbe — eine E-Mail aus Reihen, Spalten und Inhaltsmodulen — aber Feldnamen, Verschachtelung und Funktionsumfang unterscheiden sich.

## Pfad 1 — Visuell neu aufbauen (empfohlen für kleine Bibliotheken)

Hast du **weniger als 20 Templates**, ist der schnellste Weg meist, sie in Templatical visuell nachzubauen:

1. Öffne dein bestehendes Unlayer-Template im Unlayer-Editor und behalte es als Referenz sichtbar.
2. Öffne den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Ziehe die entsprechenden Templatical-Blöcke für jedes Unlayer-Modul hinein — siehe die [Mapping-Tabelle](#unlayer-modul-mapping) unten.
4. Kopiere Textinhalte direkt. Lade Bilder über deine Medienbibliothek neu hoch.
5. Wende Theme-Farben, Schriftarten und Abstände über Templaticals Design-Tokens an.

Die meisten Templates sind in 5–15 Minuten umgezogen, sobald du das erste oder zweite gemacht hast.

## Pfad 2 — Ein einmaliges Konvertierungs-Skript schreiben

Hast du **Dutzende oder Hunderte Templates** und willst nicht auf den offiziellen Importer warten, kannst du mit der [Mapping-Tabelle](#unlayer-modul-mapping) ein einmaliges Skript schreiben. Die Form ist überschaubar:

```ts
import { writeFileSync } from 'node:fs';
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createSectionBlock,
} from '@templatical/types';
import type { TemplateContent, Block } from '@templatical/types';

interface UnlayerDesign {
  body: {
    rows: UnlayerRow[];
    values: { backgroundColor?: string; contentWidth?: string };
  };
}

function convertUnlayerDesign(design: UnlayerDesign): TemplateContent {
  const blocks: Block[] = design.body.rows.map(convertRow);

  return {
    blocks,
    settings: {
      width: parseInt(design.body.values.contentWidth ?? '600'),
      backgroundColor: design.body.values.backgroundColor ?? '#ffffff',
      // …weitere Settings je nach Bedarf
    },
  };
}

function convertRow(row: UnlayerRow): Block {
  // Spalten/Zellen auf Templaticals SectionBlock-Children abbilden.
  // Modulebene siehe Mapping-Tabelle unten.
  return createSectionBlock({ /* … */ });
}
```

Verwende die Factory-Funktionen aus [`@templatical/types`](/de/api/types) (`createTitleBlock`, `createImageBlock` usw.), um Blöcke zu bauen — sie setzen sinnvolle Defaults und vergeben UUIDv7-IDs für dich.

::: warning
Dein Konvertierungs-Skript wird Iteration brauchen. Lass es zuerst auf einer kleinen Stichprobe laufen, rendere das Ergebnis mit `@templatical/renderer` und vergleiche es visuell im Playground, bevor du deine Bibliothek im Bulk konvertierst.
:::

## Unlayer-Modul-Mapping {#unlayer-modul-mapping}

Eine Richtungs-Referenz, keine vollständige Spezifikation. Unlayer hat Tarif-gebundene Module und Custom Blocks ohne direkte Entsprechungen.

| Unlayer-Modul | Templatical-Block | Hinweise |
|---|---|---|
| `row` (mit `columns`) | `SectionBlock` (mit `columns`) | Section = Reihe + mehrspaltiges Layout. Templatical-Sections unterstützen 1–4 Spalten, die auf Mobil stapeln. |
| `column` | Section-Spalte | Eine Spalte innerhalb einer Section, hält eine Liste von Blöcken. |
| `heading` | `TitleBlock` | Heading-Level (h1–h6) mappen auf Templaticals `level`-Property. |
| `text` | `ParagraphBlock` | Inline-Rich-Text. Verwende TipTap-kompatibles HTML für Runs. |
| `image` | `ImageBlock` | `src`, `alt`, `href`, `width`. Bilder über deine Medienbibliothek neu hosten. |
| `button` | `ButtonBlock` | `text`, `href`, `backgroundColor`, `color`, Padding. |
| `divider` | `DividerBlock` | Farbe, Breite, Padding. |
| `social` | `SocialIconsBlock` | Jedes Icon → ein `SocialIcon`-Eintrag mit `platform` und `href`. |
| `menu` | `MenuBlock` | Menüeinträge → `MenuItemData`-Einträge. |
| `html` | `HtmlBlock` | Roher HTML-Pass-Through. |
| `video` | `VideoBlock` | `src`, `thumbnail`, `href`. |
| Spacer | `SpacerBlock` | Nur vertikaler Abstand. |
| Custom-Module / Tarif-gebundene Module | `HtmlBlock` (Fallback) | In einen rohen HTML-Block konvertieren oder als [Custom Block](/de/guide/custom-blocks) implementieren, wenn er wiederverwendbar ist. |

## Was sich nicht automatisch übertragen lässt

Diese Funktionen unterscheiden sich genug zwischen den beiden Produkten, dass du sie von Hand übersetzen musst:

- **Anzeigebedingungen** — Unlayers Conditional-Content-Syntax weicht von Templaticals [Anzeigebedingungen](/de/guide/display-conditions) ab. Plane das Umschreiben der Bedingungen ein.
- **Merge-Tags** — beide Produkte unterstützen Merge-Tags, aber die Platzhalter-Syntax kann abweichen. Prüfe [Templaticals Merge-Tag-Konfiguration](/de/guide/merge-tags) und passe die Tag-Tokens in deinen Texten an.
- **Custom CSS** — Unlayers Tarif-gebundenes Custom CSS lässt sich nicht direkt übertragen. Nutze stattdessen Templaticals [Theming-System](/de/guide/theming) und Design-Tokens.
- **AMP for Email** — wird in Templatical derzeit nicht unterstützt.
- **Page-/Popup-/Document-Templates** — Unlayers Nicht-E-Mail-Builder haben keine Templatical-Entsprechung.

## Wenn diese Anleitung etwas nicht abdeckt

[Eröffne eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt des Unlayer-JSONs und was du erreichen willst. Wir nutzen diese Rückmeldungen, um zu priorisieren, welche Unlayer-Funktionen der automatische Importer zuerst abdeckt.
