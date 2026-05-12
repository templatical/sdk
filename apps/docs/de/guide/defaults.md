---
title: Block- & Template-Standardwerte
description: Passen Sie Standardeigenschaften für neu erstellte Blöcke und Template-Einstellungen mit blockDefaults und templateDefaults an.
---

# Block- & Template-Standardwerte

Blockeigenschaften (Farben, Schriftgrößen, Padding, Platzhaltertexte usw.) sind in Factory-Funktionen fest einprogrammiert. Mit `blockDefaults` und `templateDefaults` können Sie diese überschreiben, sodass jeder neue Block und jedes neue Template standardmäßig zu Ihrer Marke passt.

## Block-Standardwerte

Übergeben Sie ein `blockDefaults`-Objekt an `init()`. Jeder Schlüssel wird einem Blocktyp zugeordnet und akzeptiert eine partielle Überschreibung der Eigenschaften dieses Blocks:

```ts
import { init } from "@templatical/editor";

const editor = await init({
  container: "#editor",
  blockDefaults: {
    title: { color: "#000000" },
    paragraph: {},
    button: {
      backgroundColor: "#ff6600",
      textColor: "#ffffff",
      styles: { padding: { top: 20, bottom: 20 } },
    },
    divider: { color: "#eeeeee", thickness: 2 },
    image: { alt: "Brand image" },
  },
});
```

Standardwerte werden angewendet bei:

- Ziehen eines Blocks aus der Seitenleiste
- Programmatischem Aufruf von `createAndAddBlock()`

Standardwerte werden **nicht** angewendet bei:

- Duplizieren eines vorhandenen Blocks (die Werte des Quellblocks bleiben erhalten)
- Laden gespeicherter Inhalte aus der API

### Deep-Merge-Verhalten

Verschachtelte Objekte werden **deep-merged**, nicht flach ersetzt. Das bedeutet, Sie können einen einzelnen Padding-Wert überschreiben, ohne den Rest zu verlieren:

```ts
blockDefaults: {
  button: {
    // Nur das obere Padding ändert sich. right/bottom/left behalten ihre Standardwerte.
    styles: { padding: { top: 20 } },
    // Gleiches für buttonPadding — nur top ändert sich.
    buttonPadding: { top: 16 },
  },
}
```

Arrays werden **ersetzt**, nicht zusammengeführt. Beispielsweise ersetzt das Setzen von `table.rows` das gesamte Standard-Rows-Array.

### Unterstützte Blocktypen

| Schlüssel   | Blocktyp     |
| ----------- | ------------ |
| `title`     | Title        |
| `paragraph` | Paragraph    |
| `image`     | Image        |
| `button`    | Button       |
| `divider`   | Divider      |
| `section`   | Section      |
| `video`     | Video        |
| `social`    | Social Icons |
| `spacer`    | Spacer       |
| `html`      | HTML         |
| `menu`      | Menu         |
| `table`     | Table        |

Benutzerdefinierte Blöcke sind von `blockDefaults` nicht betroffen. Sie verwenden ihre eigenen `default`-Werte, die in der `CustomBlockDefinition`-Feldkonfiguration definiert sind.

### TypeScript-Typ

```ts
import type { BlockDefaults } from "@templatical/editor";
// oder
import type { BlockDefaults } from "@templatical/types";
```

Jeder Blocktyp-Schlüssel akzeptiert `Partial<Omit<BlockType, 'id' | 'type'>>` — Sie können jede Eigenschaft außer `id` und `type` überschreiben, die immer automatisch generiert werden. Siehe [Blocktypen](/de/guide/blocks) für die vollständige Liste der verfügbaren Eigenschaften pro Block.

## Template-Standardwerte

Übergeben Sie ein `templateDefaults`-Objekt, um die Standard-Template-Einstellungen zu überschreiben, die beim Erstellen eines neuen leeren Templates verwendet werden:

```ts
const editor = await init({
  container: "#editor",
  templateDefaults: {
    width: 640,
    backgroundColor: "#f5f5f5",
    fontFamily: "Helvetica, sans-serif",
    preheaderText: "Check out our latest news",
  },
});
```

### Wann Template-Standardwerte gelten

- **Kein Inhalt angegeben** — `templateDefaults` überschreiben die fest einprogrammierten Factory-Standardwerte (width: 600, bg: #ffffff usw.).
- **Inhalt angegeben** — Die Einstellungen des bereitgestellten Inhalts werden unverändert übernommen. `templateDefaults` haben keine Wirkung.

Mit anderen Worten, `templateDefaults` sind Fallbacks für fehlenden Inhalt, keine Überschreibungen für vorhandenen Inhalt.

### Verfügbare Einstellungen

| Eigenschaft       | Standard  | Beschreibung                   |
| ----------------- | --------- | ------------------------------ |
| `width`           | `600`     | Template-Breite in Pixeln      |
| `backgroundColor` | `#ffffff` | Hintergrundfarbe des Templates |
| `fontFamily`      | `Arial`   | Standard-Schriftfamilie        |
| `preheaderText`   | —         | E-Mail-Preheader-Text          |

### TypeScript-Typ

```ts
import type { TemplateDefaults } from "@templatical/editor";
// oder
import type { TemplateDefaults } from "@templatical/types";
```

## Integrierte Standardkonstanten

Das SDK exportiert die integrierten Standardwerte für jeden Blocktyp und die Template-Einstellungen als Konstanten. Verwenden Sie diese, um aktuelle Standardwerte zu inspizieren, zu erweitern oder benutzerdefinierte Presets zu erstellen:

```ts
import {
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  BUTTON_BLOCK_DEFAULTS,
} from "@templatical/types";

// Die Standardwerte für einen einzelnen Blocktyp inspizieren
console.log(TITLE_BLOCK_DEFAULTS);
// { content: '<p>Enter your title</p>', level: 2, color: '#1a1a1a', ... }

// Template-Standardwerte inspizieren
console.log(DEFAULT_TEMPLATE_DEFAULTS);
// { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial' }

// Ein benutzerdefiniertes Preset erstellen, indem die Standardwerte eines einzelnen Blocks erweitert werden
const myButtonDefaults = {
  ...BUTTON_BLOCK_DEFAULTS,
  backgroundColor: "#ff6600",
  borderRadius: 8,
};
```

### Verfügbare Konstanten

**Pro-Block-Konstanten** — jede enthält die Standardwerte der Eigenschaften für diesen Blocktyp (ausgenommen `id`, `type` und `styles`):

| Konstante                     | Blocktyp     |
| ----------------------------- | ------------ |
| `TITLE_BLOCK_DEFAULTS`        | Title        |
| `PARAGRAPH_BLOCK_DEFAULTS`    | Paragraph    |
| `IMAGE_BLOCK_DEFAULTS`        | Image        |
| `BUTTON_BLOCK_DEFAULTS`       | Button       |
| `DIVIDER_BLOCK_DEFAULTS`      | Divider      |
| `SECTION_BLOCK_DEFAULTS`      | Section      |
| `VIDEO_BLOCK_DEFAULTS`        | Video        |
| `SOCIAL_ICONS_BLOCK_DEFAULTS` | Social Icons |
| `SPACER_BLOCK_DEFAULTS`       | Spacer       |
| `HTML_BLOCK_DEFAULTS`         | HTML         |
| `MENU_BLOCK_DEFAULTS`         | Menu         |
| `TABLE_BLOCK_DEFAULTS`        | Table        |

**Kombinierte Konstanten:**

| Konstante                   | Beschreibung                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_BLOCK_DEFAULTS`    | Alle Blocktyp-Standardwerte in einem einzigen Objekt (Schlüssel entsprechen der `BlockDefaults`-Schnittstelle) |
| `DEFAULT_TEMPLATE_DEFAULTS` | Standardwerte der Template-Einstellungen (`width`, `backgroundColor`, `fontFamily`)                            |

Diese Konstanten sind die einzige Quelle der Wahrheit, die intern von den Factory-Funktionen verwendet wird. Wenn Sie nur einige Eigenschaften überschreiben müssen, brauchen Sie sie nicht zu referenzieren — übergeben Sie einfach Ihre Überschreibungen an `blockDefaults` und sie werden mit diesen Werten deep-merged.

## Programmatische Verwendung

Die zugrunde liegenden Factory-Funktionen akzeptieren Standardwerte auch direkt:

```ts
import {
  createBlock,
  createTitleBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { BlockDefaults } from "@templatical/types";

// Einzelner Block mit partiellen Überschreibungen
const title = createTitleBlock({ level: 2, color: "#000" });
const paragraph = createParagraphBlock({ content: "<p>Hello</p>" });

// Über createBlock mit vollständiger Standardwert-Map
const defaults: BlockDefaults = {
  title: { color: "#000000" },
  button: { backgroundColor: "#ff6600" },
};
const block = createBlock("title", defaults);

// Template mit benutzerdefinierten Einstellungen
const content = createDefaultTemplateContent("Helvetica, sans-serif", {
  width: 640,
  backgroundColor: "#f5f5f5",
});
```
