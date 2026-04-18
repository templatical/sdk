---
title: Sektionen und Spalten
description: Mehrspaltige Layouts mit dem SectionBlock-Container in Templatical.
---

# Sektionen und Spalten

Der `SectionBlock` ist das Layout-Primitiv in Templatical. Jedes mehrspaltige Layout wird erstellt, indem eine Sektion angelegt und Blöcke in deren Spalten platziert werden.

## Spaltenlayouts

::: tip E-Mail-Best-Practice
Bleiben Sie für die meisten E-Mails bei 1-2 Spalten. Dreispaltige Layouts werden auf Mobilgeräten beim vertikalen Stapeln der Spalten beengt, und einige E-Mail-Clients behandeln 3-spaltige Layouts inkonsistent.
:::

Die Eigenschaft `columns` akzeptiert eines von fünf Layout-Presets:

| Wert | Beschreibung | Spaltenbreiten |
|-------|-------------|---------------|
| `'1'` | Einzelne Spalte | 100% |
| `'2'` | Zwei gleiche Spalten | 50% / 50% |
| `'3'` | Drei gleiche Spalten | 33% / 33% / 33% |
| `'2-1'` | Zwei Drittel / ein Drittel | 66% / 33% |
| `'1-2'` | Ein Drittel / zwei Drittel | 33% / 66% |

```ts
type ColumnLayout = '1' | '2' | '3' | '2-1' | '1-2';
```

## Sektionen erstellen

Verwenden Sie `createSectionBlock` aus `@templatical/types`:

```ts
import {
  createSectionBlock,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
} from '@templatical/types';

// Leere zweispaltige Sektion
const section = createSectionBlock({ columns: '2' });

// Sektion mit vorbefüllten Spalten
const hero = createSectionBlock({
  columns: '1-2',
  children: [
    [createImageBlock({ src: 'https://cdn.example.com/logo.png', width: 120 })],
    [
      createTitleBlock({ content: '<h1>Welcome</h1>', level: 1 }),
      createParagraphBlock({ content: '<p>Get started in minutes.</p>' }),
    ],
  ],
});
```

## Das children-Array

`children` ist ein `Block[][]` -- ein Array von Arrays. Jedes innere Array repräsentiert die Blöcke innerhalb einer Spalte, geordnet von links nach rechts.

```ts
// Für ein '2'-Layout:
section.children = [
  [blockA, blockB],  // Linke Spalte
  [blockC],          // Rechte Spalte
];

// Für ein '3'-Layout:
section.children = [
  [blockA],  // Links
  [blockB],  // Mitte
  [blockC],  // Rechts
];
```

Die Länge von `children` muss mit der Anzahl der Spalten im gewählten Layout übereinstimmen. Wenn Sie `columns` ändern, passt der Editor `children` automatisch an -- überschüssige Spalten werden in die letzte Spalte zusammengeführt oder leere Arrays werden für neue Spalten hinzugefügt.

## Blöcke zu Spalten hinzufügen

Um einen Block programmatisch zu einer bestimmten Spalte hinzuzufügen:

```ts
// Eine Schaltfläche zur zweiten Spalte hinzufügen (Index 1)
section.children[1].push(
  createButtonBlock({
    text: 'Learn More',
    url: 'https://example.com/docs',
  }),
);
```

## Verschachtelung

Sektionen können nicht innerhalb anderer Sektionen verschachtelt werden. Jede Sektion befindet sich auf der obersten Ebene der Block-Liste des Templates. Innerhalb einer Spalte können Sie jeden Nicht-Sektion-Blocktyp platzieren: Titel, Absätze, Bilder, Schaltflächen, Tabellen, benutzerdefinierte Blöcke usw.

## Responsives Verhalten

Auf dem Desktop werden Spalten nebeneinander in ihren definierten Breiten gerendert. Auf kleineren Bildschirmen stapeln sich die Spalten vertikal in der Quellreihenfolge (linke Spalte oben). Dieses Stapelverhalten erfolgt automatisch und wird von der MJML-Ausgabe übernommen.

Sie können die Eigenschaft `visibility` für einzelne Blöcke innerhalb von Spalten verwenden, um Inhalte pro Breakpoint anzuzeigen oder auszublenden:

```ts
const block = createParagraphBlock({
  content: '<p>Desktop only sidebar content</p>',
});

block.visibility = {
  desktop: true,
  tablet: true,
  mobile: false,
};
```

Siehe [Styling](/de/guide/styling) für weitere Informationen zu responsiven Überschreibungen und Blocksichtbarkeit.

## Stile auf Sektionsebene

Sektionen unterstützen die gleichen `BlockStyles` wie andere Blöcke. Häufige Anwendungsfälle sind das Festlegen einer Hintergrundfarbe oder eines Paddings für die gesamte Zeile:

```ts
const section = createSectionBlock({ columns: '1' });

section.styles = {
  backgroundColor: '#f8fafc',
  padding: { top: 32, right: 24, bottom: 32, left: 24 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};
```
