---
title: Programmatische Templates
description: Erstellen Sie E-Mail-Template-Inhalte programmatisch mit Factory-Funktionen.
---

# Programmatische Templates

Die meisten Benutzer werden Templates visuell im Drag-and-Drop-Editor gestalten. Aber manchmal müssen Sie Templates im Code erstellen -- um Standardinhalte zu initialisieren, Templates aus API-Daten zu erstellen oder E-Mails programmatisch auf dem Server zu generieren.

Templatical bietet Factory-Funktionen für jeden Blocktyp. Verwenden Sie sie, um Templates im Code zu erstellen, und übergeben Sie diese dann an `init()` oder rendern Sie sie direkt mit dem Renderer.

## Leeres Template

```ts
import { createDefaultTemplateContent } from '@templatical/types';

const content = createDefaultTemplateContent();
// { blocks: [], settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial' } }
```

`createDefaultTemplateContent()` akzeptiert einen optionalen Schriftfamilien-String:

```ts
const content = createDefaultTemplateContent('Georgia, serif');
```

## Ein Template aufbauen

Jeder Blocktyp hat eine entsprechende `create*Block()`-Funktion. Jede akzeptiert ein optionales Teilobjekt, um Standardwerte zu überschreiben. Alle Factory-Funktionen generieren automatisch eine eindeutige `id` für jeden Block.

```ts
import {
  createDefaultTemplateContent,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
} from '@templatical/types';

const content = createDefaultTemplateContent();

content.blocks = [
  createTitleBlock({
    content: '<h1 style="text-align: center;">Welcome aboard</h1>',
    level: 1,
  }),
  createImageBlock({
    src: 'https://example.com/hero.jpg',
    alt: 'Welcome hero image',
    width: 'full',
  }),
  createDividerBlock(),
  createParagraphBlock({
    content: '<p>Thanks for signing up. Here is what happens next.</p>',
  }),
  createButtonBlock({
    text: 'Get Started',
    url: 'https://example.com/dashboard',
    backgroundColor: '#1a73e8',
    textColor: '#ffffff',
    borderRadius: 6,
  }),
];
```

## Block-Factory-Referenz

### Title

```ts
createTitleBlock({
  content: '<h1>Welcome, {{name}}!</h1>',
  level: 1,
  textAlign: 'center',
})
```

### Paragraph

```ts
createParagraphBlock({
  content: '<p>Thanks for signing up. Here is what happens next.</p>',
})
```

### Image

```ts
createImageBlock({
  src: 'https://cdn.example.com/hero.png',
  alt: 'Hero banner',
  width: 560,
  linkUrl: 'https://example.com',
})
```

### Button

```ts
createButtonBlock({
  text: 'Get Started',
  url: 'https://example.com/signup',
  backgroundColor: '#6366f1',
  borderRadius: 8,
})
```

### Divider

```ts
createDividerBlock({
  lineStyle: 'dashed',
  color: '#e5e7eb',
  thickness: 2,
})
```

### Spacer

```ts
createSpacerBlock({ height: 40 })
```

### HTML

```ts
createHtmlBlock({
  content: '<div style="text-align:center;">Custom markup</div>',
})
```

### Social Icons

```ts
createSocialIconsBlock({
  iconStyle: 'circle',
  iconSize: 'large',
  icons: [
    { id: crypto.randomUUID(), platform: 'twitter', url: 'https://x.com/acme' },
    { id: crypto.randomUUID(), platform: 'github', url: 'https://github.com/acme' },
  ],
})
```

### Menu

```ts
createMenuBlock({
  items: [
    { id: crypto.randomUUID(), text: 'Home', url: 'https://example.com', openInNewTab: false, bold: false, underline: false },
    { id: crypto.randomUUID(), text: 'Blog', url: 'https://example.com/blog', openInNewTab: false, bold: false, underline: false },
    { id: crypto.randomUUID(), text: 'Docs', url: 'https://docs.example.com', openInNewTab: true, bold: false, underline: false },
  ],
  separator: '-',
})
```

### Table

```ts
createTableBlock({
  hasHeaderRow: true,
  rows: [
    { id: crypto.randomUUID(), cells: [{ id: crypto.randomUUID(), content: 'Plan' }, { id: crypto.randomUUID(), content: 'Price' }] },
    { id: crypto.randomUUID(), cells: [{ id: crypto.randomUUID(), content: 'Starter' }, { id: crypto.randomUUID(), content: '$9/mo' }] },
    { id: crypto.randomUUID(), cells: [{ id: crypto.randomUUID(), content: 'Pro' }, { id: crypto.randomUUID(), content: '$29/mo' }] },
  ],
})
```

### Video

```ts
createVideoBlock({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  alt: 'Product demo video',
})
```

### Section

```ts
createSectionBlock({
  columns: '2',
  children: [
    [createParagraphBlock({ content: '<p>Left column</p>' })],
    [createImageBlock({ src: 'https://cdn.example.com/photo.jpg' })],
  ],
})
```

Die Eigenschaft `columns` akzeptiert: `'1'` (einspaltig), `'2'` (zwei gleiche), `'3'` (drei gleiche), `'2-1'` (zwei Drittel / ein Drittel), `'1-2'` (ein Drittel / zwei Drittel). Siehe [Sektionen und Spalten](/de/guide/sections-and-columns) für alle Details.

### Custom

`createCustomBlock` nimmt eine `CustomBlockDefinition` entgegen (keinen partiellen Block). Es generiert Feldwerte aus den Feld-Standardwerten der Definition. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks) für die Definition benutzerdefinierter Blocktypen.

## Dienstprogramme

### Generische Factory

Erstellen Sie einen beliebigen Block anhand einer Typzeichenkette:

```ts
import { createBlock } from '@templatical/types';

const block = createBlock('title'); // TitleBlock with defaults
```

### Klonen

Deep-cloning eines Blocks mit einer neuen ID:

```ts
import { cloneBlock } from '@templatical/types';

const copy = cloneBlock(existingBlock);
// copy.id !== existingBlock.id
```

### Typ-Guards

Einen `Block`-Union auf einen bestimmten Typ eingrenzen:

```ts
import { isTitle, isParagraph, isImage, isButton, isSection } from '@templatical/types';

if (isTitle(block)) {
  console.log(block.level); // TypeScript knows this is TitleBlock
}

if (isParagraph(block)) {
  console.log(block.content); // TypeScript knows this is ParagraphBlock
}

if (isImage(block)) {
  console.log(block.src);
}
```

Jeder Blocktyp hat einen entsprechenden Guard: `isTitle()`, `isParagraph()`, `isImage()`, `isButton()`, `isDivider()`, `isSpacer()`, `isHtml()`, `isSocialIcons()`, `isMenu()`, `isTable()`, `isVideo()`, `isSection()`, `isCustomBlock()`.

## Template-Einstellungen

Template-Einstellungen steuern die globalen Eigenschaften der E-Mail:

```ts
const content = createDefaultTemplateContent();

content.settings.width = 640;
content.settings.backgroundColor = '#f5f5f5';
content.settings.fontFamily = 'Helvetica, Arial, sans-serif';
content.settings.preheaderText = 'Your weekly digest is here';
```

| Einstellung | Typ | Beschreibung |
|---|---|---|
| `width` | `number` | E-Mail-Breite in Pixeln |
| `backgroundColor` | `string` | Äußere Hintergrundfarbe |
| `fontFamily` | `string` | Standard-Font-Stack |
| `preheaderText` | `string` | Vorschautext, der in der Posteingangsliste angezeigt wird |

Für Standardwerte und wie Sie diese anpassen können, siehe [Block- & Template-Standardwerte](/de/guide/defaults).

## Gespeicherte Inhalte laden

Übergeben Sie zuvor gespeichertes JSON zurück an den Editor:

```ts
const saved = await fetch('/api/templates/123').then(r => r.json());

const editor = await init({
  container: '#editor',
  content: saved,
});
```

Sie können den Inhalt auch nach der Initialisierung aktualisieren:

```ts
editor.setContent(newContent);
```

## Nächste Schritte

- [Blocktypen](/de/guide/blocks) -- Eigenschaftenreferenz für alle 14 Blocktypen.
- [Wie das Rendering funktioniert](/de/getting-started/how-rendering-works) -- Die JSON → MJML-Pipeline.
- [Benutzerdefinierte Blöcke](/de/guide/custom-blocks) -- Definieren Sie Ihre eigenen Blocktypen.
