---
title: Blocktypen
description: Referenz für alle 14 integrierten Blocktypen in Templatical.
---

# Blocktypen

Blöcke sind die Baueinheiten jedes Templatical-Templates. Jeder Block repräsentiert ein eigenständiges Inhaltsstück -- einen Absatz, ein Bild, eine Schaltfläche. Blöcke können direkt im Template oder innerhalb von Sektionen für mehrspaltige Layouts platziert werden. Der Editor rendert sie von oben nach unten in der Reihenfolge, in der sie erscheinen.

Jeder Block erweitert eine gemeinsame `Block`-Basis mit geteilten Eigenschaften (`id`, `type`, `styles`, `displayCondition`, `customCss`, `visibility`), und jeder Typ fügt seine eigenen spezifischen Eigenschaften hinzu.

Um Blöcke programmatisch zu erstellen, siehe [Programmatische Templates](/de/guide/programmatic-templates). Für Standardwerte der Eigenschaften und wie Sie diese anpassen können, siehe [Block- & Template-Standardwerte](/de/guide/defaults).

## Den richtigen Block auswählen

| Bedarf | Block | Hinweise |
|------|-------|-------|
| Überschriften, Titel | [Title](#title) | Überschriften mit fester Größe (H1-H4) mit Formatierung auf Blockebene |
| Fließtext, Absätze | [Paragraph](#paragraph) | Rich Text mit Inline-Formatierung über TipTap |
| Fotos, Banner, Logos | [Image](#image) | Optionales Link-Wrapping, responsive Breite |
| Call-to-Action | [Button](#button) | Bulletproof-Schaltflächen, die in allen E-Mail-Clients funktionieren |
| Mehrspaltiges Layout | [Section](#section) | Der einzige Block, der andere Blöcke enthält |
| Visuelle Trennung | [Divider](#divider) | Horizontale Linie mit Stiloptionen |
| Vertikaler Abstand | [Spacer](#spacer) | Leerraum zwischen Blöcken |
| Social Links | [Social Icons](#social-icons) | 16 Plattformen, 5 Icon-Stile |
| Navigationslinks | [Menu](#menu) | Horizontale Linkliste mit Trennzeichen |
| Tabellarische Daten | [Table](#table) | Datentabelle mit optionaler Kopfzeilenformatierung |
| Video-Vorschau | [Video](#video) | Klickbares Thumbnail (E-Mail-Clients unterstützen keine eingebetteten Videos) |
| Rohes Markup | [HTML](#html) | Notausgang für benutzerdefinierten Code |
| Domänenspezifische Inhalte | [Custom](#custom) | Ihre eigenen Blocktypen mit Feldern und Liquid-Templates |

## Title

Ein Überschriften-Block mit festen Größenstufen. Verwenden Sie Titel für Überschriften, Sektionsüberschriften und andere prominente Texte.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `content` | `string` | HTML-Inhalt |
| `level` | `1 \| 2 \| 3 \| 4` | Überschriftsebene (H1=36px, H2=28px, H3=22px, H4=18px) |
| `color` | `string` | Textfarbe |
| `textAlign` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |
| `fontFamily` | `string` | Überschreibung der Schriftfamilie |

## Paragraph

Fließtext, der als HTML gerendert wird. Der Editor verwendet [Tiptap](https://tiptap.dev) für die Inline-Bearbeitung mit Formatierungssteuerungen (fett, kursiv, Links, Ausrichtung, Schriftgröße, Farbe usw.). Jede Formatierung wird inline angewendet -- es gibt keine Formatierungseigenschaften auf Blockebene.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `content` | `string` | HTML-Inhalt |

## Image

Zeigt ein Bild mit optionalem Link-Wrapping an.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `src` | `string` | Bild-URL |
| `alt` | `string` | Alternativtext |
| `width` | `number \| 'full'` | Anzeigebreite in px oder `'full'` für 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |
| `linkUrl` | `string` | Umschließt das Bild mit einem Link |
| `linkOpenInNewTab` | `boolean` | Verhalten des Linkziels |
| `placeholderUrl` | `string` | Platzhalter, der im Editor angezeigt wird, wenn `src` ein Merge-Tag verwendet |

## Button

Eine Call-to-Action-Schaltfläche mit anpassbarem Erscheinungsbild.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `text` | `string` | Schaltflächentext |
| `url` | `string` | Link-URL |
| `backgroundColor` | `string` | Hintergrundfarbe der Schaltfläche |
| `textColor` | `string` | Textfarbe der Schaltfläche |
| `borderRadius` | `number` | Eckenradius in px |
| `fontSize` | `number` | Schriftgröße in px |
| `buttonPadding` | `SpacingValue` | Innerer Abstand |
| `fontFamily` | `string` | Überschreibung der Schriftfamilie |
| `openInNewTab` | `boolean` | Verhalten des Linkziels |

## Divider

Ein horizontaler Linientrenner.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `lineStyle` | `'solid' \| 'dashed' \| 'dotted'` | Linienstil |
| `color` | `string` | Linienfarbe |
| `thickness` | `number` | Liniendicke in px |
| `width` | `number \| 'full'` | Linienbreite in px oder `'full'` für 100% |

## Spacer

Leerer vertikaler Raum.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `height` | `number` | Höhe in px |

## HTML

Fügt rohes HTML in das Template ein. Verwenden Sie dies für Inhalte, die mit anderen Blocktypen nicht ausgedrückt werden können.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `content` | `string` | Rohes HTML-Markup |

## Social Icons

Eine Reihe von Social-Media-Icons, die zu Plattformprofilen verlinken.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `icons` | `SocialIcon[]` | Liste der Social Icons |
| `iconStyle` | `'solid' \| 'outlined' \| 'rounded' \| 'square' \| 'circle'` | Visueller Stil |
| `iconSize` | `'small' \| 'medium' \| 'large'` | Icon-Größe |
| `spacing` | `number` | Abstand zwischen Icons in px |
| `align` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |

16 Plattformen werden unterstützt: Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Pinterest, E-Mail, WhatsApp, Telegram, Discord, Snapchat, Reddit, GitHub, Dribbble und Behance.

Jedes `SocialIcon` hat:

```ts
interface SocialIcon {
  id: string;
  platform: SocialPlatform;
  url: string;
}
```

## Menu

Ein horizontales Navigationsmenü mit Textlinks.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `items` | `MenuItemData[]` | Menüeinträge |
| `fontSize` | `number` | Schriftgröße in px |
| `fontFamily` | `string` | Überschreibung der Schriftfamilie |
| `color` | `string` | Textfarbe |
| `linkColor` | `string` (optional) | Linkfarbe |
| `textAlign` | `'left' \| 'center' \| 'right'` | Ausrichtung |
| `separator` | `string` | Zeichen zwischen Einträgen |
| `separatorColor` | `string` | Farbe des Trennzeichens |
| `spacing` | `number` | Abstand um das Trennzeichen |

Jedes `MenuItemData` hat:

```ts
interface MenuItemData {
  id: string;
  text: string;
  url: string;
  openInNewTab: boolean;
  bold: boolean;
  underline: boolean;
  color?: string;
}
```

## Table

Eine Datentabelle mit optionaler Formatierung der Kopfzeile.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `rows` | `TableRowData[]` | Tabellenzeilen |
| `hasHeaderRow` | `boolean` | Erste Zeile als Kopfzeile formatieren |
| `headerBackgroundColor` | `string` (optional) | Hintergrund der Kopfzeile |
| `borderColor` | `string` | Rahmenfarbe |
| `borderWidth` | `number` | Rahmenbreite in px |
| `cellPadding` | `number` | Zellenabstand in px |
| `fontSize` | `number` | Schriftgröße in px |
| `fontFamily` | `string` | Überschreibung der Schriftfamilie |
| `color` | `string` | Textfarbe |
| `textAlign` | `'left' \| 'center' \| 'right'` | Textausrichtung der Zelle |

## Video

Zeigt ein Video-Thumbnail an, das zur Video-URL verlinkt.

::: tip Hinweis zu E-Mail-Clients
E-Mail-Clients unterstützen keine eingebettete Videowiedergabe. Der Renderer gibt ein klickbares Thumbnail-Bild aus, das zur Video-URL verlinkt. Stellen Sie immer eine gute `thumbnailUrl` bereit -- das ist das Einzige, was Empfänger in ihrem Posteingang sehen.
:::

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `url` | `string` | Video-URL (YouTube, Vimeo usw.) |
| `thumbnailUrl` | `string` | URL des Thumbnail-Bildes |
| `alt` | `string` | Alternativtext für das Thumbnail |
| `width` | `number \| 'full'` | Anzeigebreite in px oder `'full'` für 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |
| `openInNewTab` | `boolean` | Verhalten des Linkziels |
| `placeholderUrl` | `string` | Nur im Editor sichtbarer Platzhalter |

## Section

Ein Layout-Container, der eine oder mehrere Spalten enthält. Siehe [Sektionen und Spalten](/de/guide/sections-and-columns) für alle Details.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `columns` | `ColumnLayout` | Preset für das Spaltenlayout |
| `children` | `Block[][]` | Array von Block-Arrays, eines pro Spalte |

## Custom

Ein benutzerdefinierter Blocktyp, der durch Felddefinitionen und ein Liquid-Template angetrieben wird. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks) für alle Details.

| Eigenschaft | Typ | Beschreibung |
|----------|------|-------------|
| `customType` | `string` | Eindeutige Kennung für den benutzerdefinierten Blocktyp |
| `fieldValues` | `Record<string, unknown>` | Aktuelle Werte für definierte Felder |
| `renderedHtml` | `string` | Zwischengespeichertes gerendertes Ergebnis |
| `dataSourceFetched` | `boolean` | Ob die Datenquelle abgerufen wurde |
