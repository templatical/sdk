---
title: Styling
description: Block-Stile, Abstände, responsive Überschreibungen, Sichtbarkeit und Einstellungen auf Template-Ebene in Templatical.
---

# Styling

Jeder Block in Templatical trägt eine Eigenschaft `styles` für Layout und Erscheinungsbild sowie `visibility` und `customCss` für feinkörnige Kontrolle.

## BlockStyles

Die Schnittstelle `BlockStyles` steuert Padding, Margin, Hintergrund und responsive Überschreibungen.

```ts
interface BlockStyles {
  padding: SpacingValue;
  margin: SpacingValue;
  backgroundColor?: string;
  responsive?: ResponsiveStyles;
}
```

```ts
import { createParagraphBlock } from '@templatical/types';

const block = createParagraphBlock({
  content: '<p>Styled text</p>',
});

block.styles = {
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  backgroundColor: '#f0f9ff',
};
```

## SpacingValue

Padding und Margin verwenden den Typ `SpacingValue` mit vier Richtungswerten in Pixeln.

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
  margin: { top: 8, right: 0, bottom: 8, left: 0 },
};
```

## Responsive Überschreibungen

Die Eigenschaft `responsive` innerhalb von `BlockStyles` ermöglicht es Ihnen, partielle Stil-Überschreibungen auf Tablet- und Mobile-Breakpoints anzuwenden.

```ts
interface ResponsiveStyles {
  tablet?: Partial<BlockStyles>;
  mobile?: Partial<BlockStyles>;
}
```

Der Editor verwendet diese Viewport-Breiten im Vorschaumodus:

| Viewport | Vorschaubreite |
|----------|---------------|
| Desktop | Template-Breite (Standard 600px) |
| Tablet | 768px |
| Mobile | 375px |

Responsive Überschreibungen werden mit den Basisstilen zusammengeführt. Geben Sie nur die Eigenschaften an, die Sie ändern möchten:

```ts
block.styles = {
  padding: { top: 32, right: 48, bottom: 32, left: 48 },
  responsive: {
    tablet: {
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    mobile: {
      padding: { top: 16, right: 12, bottom: 16, left: 12 },
    },
  },
};
```

## Block-Sichtbarkeit

Die Eigenschaft `visibility` auf jedem Block steuert, ob er bei jedem Breakpoint gerendert wird.

```ts
interface BlockVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}
```

Alle drei sind standardmäßig `true`. Setzen Sie einen Breakpoint auf `false`, um den Block bei dieser Größe auszublenden:

```ts
// Nur auf dem Desktop anzeigen
block.visibility = {
  desktop: true,
  tablet: false,
  mobile: false,
};
```

Dies ist nützlich, um unterschiedliche Inhalte bei unterschiedlichen Bildschirmgrößen anzuzeigen -- zum Beispiel eine detaillierte Tabelle auf dem Desktop und eine vereinfachte Liste auf dem Mobilgerät.

## Benutzerdefiniertes CSS

Jeder Block hat eine optionale String-Eigenschaft `customCss` zum Einfügen von beliebigem CSS. Das CSS wird in der gerenderten Ausgabe auf den Block beschränkt.

```ts
block.customCss = `
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;
```

::: warning
Die meisten CSS-Eigenschaften funktionieren nicht zuverlässig über E-Mail-Clients hinweg. Eigenschaften wie `display: flex`, `grid`, `position`, `box-shadow` und CSS-Animationen werden von vielen Clients ignoriert (insbesondere Outlook). Halten Sie sich an `padding`, `margin`, `border`, `border-radius`, `background-color` und `text-align`, um die beste Kompatibilität zu erzielen. Testen Sie immer in echten E-Mail-Clients, bevor Sie versenden.
:::

## Einstellungen auf Template-Ebene

Neben einzelnen Blockstilen hat das Template selbst globale Einstellungen, die das Gesamtlayout beeinflussen.

| Einstellung | Typ | Beschreibung |
|---------|------|-------------|
| `width` | `number` | Template-Inhaltsbreite in px (typischerweise 600) |
| `backgroundColor` | `string` | Äußere Hintergrundfarbe hinter dem Template |
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
