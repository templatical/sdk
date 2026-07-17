---
title: Styling
description: Block-Stile, Abstände, Sichtbarkeit und Einstellungen auf Template-Ebene in Templatical.
---

# Styling

Jeder Block in Templatical trägt eine Eigenschaft `styles` für Layout und Erscheinungsbild sowie `visibility` für viewport-spezifische Kontrolle.

## BlockStyles

Die Schnittstelle `BlockStyles` steuert Padding und Hintergrund.

```ts
interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}
```

```ts
import { createParagraphBlock } from '@templatical/types';

const block = createParagraphBlock({
  content: '<p>Styled text</p>',
});

block.styles = {
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
  backgroundColor: '#f0f9ff',
};
```

## SpacingValue

Padding verwendet den Typ `SpacingValue` mit vier Richtungswerten in Pixeln.

```ts
interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

Alle vier Eigenschaften sind erforderlich. Verwenden Sie `0` für Seiten, die keinen Abstand benötigen:

```ts
block.styles = {
  padding: { top: 0, right: 16, bottom: 0, left: 16 },
};
```

## Block-Sichtbarkeit

Die Eigenschaft `visibility` auf jedem Block steuert, ob er bei jedem Breakpoint gerendert wird.

```ts
interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}
```

Beide sind standardmäßig `true`. Setzen Sie einen Breakpoint auf `false`, um den Block bei dieser Größe auszublenden:

```ts
// Nur auf dem Desktop anzeigen
block.visibility = {
  desktop: true,
  mobile: false,
};
```

Dies ist nützlich, um unterschiedliche Inhalte bei unterschiedlichen Bildschirmgrößen anzuzeigen -- zum Beispiel eine detaillierte Tabelle auf dem Desktop und eine vereinfachte Liste auf dem Mobilgerät.

## Einstellungen auf Template-Ebene

Neben einzelnen Blockstilen hat das Template selbst globale Einstellungen, die das Gesamtlayout beeinflussen.

| Einstellung | Typ | Beschreibung |
|---------|------|-------------|
| `width` | `number` | Template-Inhaltsbreite in px (typischerweise 600) |
| `backgroundColor` | `string` | Äußere Hintergrundfarbe hinter dem Template |
| `textColor` | `string` | Standard-Textfarbe, die jeder Textblock (Title, Paragraph, Menu, Table) erbt, sofern der Block keine eigene Farbe oder Inline-Textfarbe setzt. Standard: `#1a1a1a`. |
| `linkColor` | `string` | Dokumentweite Linkfarbe für jeden Link (Rich-Text und Menu). Optional – wenn nicht gesetzt, erben Links die umgebende Textfarbe. Eine block- oder elementspezifische Farbe überschreibt weiterhin. |
| `linkUnderline` | `boolean` | Ob Body-Links (Rich-Text) unterstrichen werden. Standard: `true`. Buttons und Menu-Elemente behalten ihre eigene text-decoration. |
| `fontFamily` | `string` | Standard-Schriftfamilie für alle Blöcke |

Diese werden über die `init()`-Konfiguration des Editors oder durch direkte Änderung des Template-JSON konfiguriert:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  content: {
    settings: {
      width: 640,
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    blocks: [],
  },
});
```

Einzelne Blöcke können die `fontFamily` auf Template-Ebene überschreiben, indem sie ihre eigene `fontFamily`-Eigenschaft setzen. Wenn ein Block keine Schriftfamilie angibt, erbt er von den Template-Einstellungen.

Die Textfarbe funktioniert genauso: Textblöcke (Title, Paragraph, Menu, Table) erben `textColor` aus den Template-Einstellungen, und jeder Block, der seine eigene Farbe setzt, überschreibt sie. Passe den Dokument-Standard über `init({ templateDefaults: { textColor } })` an.

Links folgen derselben Kaskade: Setze eine Dokument-`linkColor`, um allen Links (Rich-Text und Menu) eine Farbe zu geben, oder lasse sie ungesetzt, damit Links die umgebende Textfarbe erben. `linkUnderline` (standardmäßig aktiv) unterstreicht Body-Links – Buttons und Menu-Elemente behalten ihre eigene text-decoration. Eine block- oder elementspezifische Farbe (z. B. die Farbe eines Menu-Elements) überschreibt weiterhin die Dokument-Linkfarbe.
