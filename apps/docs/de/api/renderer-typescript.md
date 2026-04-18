---
title: Renderer
description: API-Referenz für @templatical/renderer — konvertiert Template-JSON zu MJML.
---

# Renderer

`@templatical/renderer` konvertiert Templatical-Template-JSON in MJML. Funktioniert sowohl in Browser- als auch in Node.js-Umgebungen.

Der Renderer erzeugt ausschließlich MJML. Um MJML für den E-Mail-Versand zu HTML zu kompilieren, verwenden Sie eine beliebige MJML-Bibliothek ([mjml](https://www.npmjs.com/package/mjml) für Node.js, [spatie/mjml-php](https://github.com/spatie/mjml-php) für PHP usw.).

```bash
npm install @templatical/renderer
```

## `renderToMjml(content, options?)`

Rendert ein `TemplateContent`-Objekt zu einem MJML-String.

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = renderToMjml(templateContent);
```

**Parameter:**

| Parameter | Type | Beschreibung |
|-----------|------|-------------|
| `content` | `TemplateContent` | Das zu rendernde Template |
| `options` | `RenderOptions` | Optionale Rendering-Konfiguration |

**Rückgabewert:** `string` -- MJML-Markup

## RenderOptions

```ts
interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;      // Standard: true
}
```

| Option | Default | Beschreibung |
|--------|---------|-------------|
| `customFonts` | `[]` | Definitionen benutzerdefinierter Schriftarten für `<mj-font>`-Deklarationen in der gerenderten Ausgabe |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback-Schriftart-Stack |
| `allowHtmlBlocks` | `true` | Auf `false` setzen, um HTML-Blöcke aus der Ausgabe zu entfernen |

## Hilfsfunktionen

Der Renderer exportiert außerdem Hilfsfunktionen:

```ts
import {
  escapeHtml,
  escapeAttr,
  convertMergeTagsToValues,
  isHiddenOnAll,
  toPaddingString,
  generateSocialIconDataUri,
  renderBlock,
  getCssClassAttr,
  getCssClasses,
  getWidthPercentages,
  getWidthPixels,
  SOCIAL_ICONS,
  RenderContext,
} from '@templatical/renderer';
```

### `escapeHtml(text)`

Maskiert HTML-Entitäten (`<`, `>`, `&`, `"`, `'`) in einem String. Verwenden Sie dies, wenn Sie Benutzerinhalte in HTML einfügen:

```ts
escapeHtml('<script>alert("xss")</script>');
// '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

### `escapeAttr(text)`

Maskiert einen String für die sichere Verwendung in HTML-Attributwerten:

```ts
const alt = escapeAttr('Photo of "sunrise" at O\'Hare');
// 'Photo of &quot;sunrise&quot; at O&#x27;Hare'
```

### `convertMergeTagsToValues(html)`

Konvertiert HTML-Spans für Merge-Tags (vom Rich-Text-System des Editors intern verwendet) zurück in ihre einfache Textsyntax. Der Editor speichert Merge-Tags als `<span data-merge-tag="...">`-Elemente; diese Funktion entfernt die Spans und lässt die rohe Merge-Tag-Syntax übrig:

```ts
import { convertMergeTagsToValues } from '@templatical/renderer';

// Eingabe: internes HTML-Format des Editors
const editorHtml = '<span data-merge-tag="{{ first_name }}">First Name</span>';

const cleaned = convertMergeTagsToValues(editorHtml);
// Ausgabe: '{{ first_name }}'
```

::: tip
Sie müssen diese Funktion normalerweise nicht direkt aufrufen — der Renderer ruft sie intern beim Verarbeiten von Title- und Paragraph-Blöcken auf. Sie wird für fortgeschrittene Anwendungsfälle exportiert, in denen Sie mit Editor-HTML außerhalb der normalen Rendering-Pipeline arbeiten.
:::

### `isHiddenOnAll(block)`

Gibt `true` zurück, wenn bei der `visibility` eines Blocks alle Viewports auf `false` gesetzt sind. Nützlich, um Blöcke zu überspringen, die überhaupt nicht gerendert werden sollen:

```ts
if (isHiddenOnAll(block)) {
  // Diesen Block vollständig überspringen
}
```

### `toPaddingString(padding)`

Konvertiert einen `SpacingValue` in einen CSS-Padding-String:

```ts
toPaddingString({ top: 10, right: 20, bottom: 10, left: 20 });
// '10px 20px 10px 20px'
```

### `generateSocialIconDataUri(platform, style, size)`

Erzeugt eine base64-kodierte SVG-Data-URI für ein Social-Media-Plattform-Icon. Wird intern vom Renderer für Social-Icon-Blöcke verwendet:

```ts
const uri = generateSocialIconDataUri('twitter', 'circle', 32);
// 'data:image/svg+xml,...'
```

### `renderBlock(block, context)`

Rendert einen einzelnen Block in seine MJML-Darstellung. Wird intern von `renderToMjml()` verwendet, aber für fortgeschrittene Anwendungsfälle exportiert, in denen Sie einzelne Blöcke rendern müssen.

### `RenderContext`

Das an Block-Renderer übergebene Kontextobjekt. Enthält Rendering-Optionen und Schriftart-Konfiguration.

### `getCssClassAttr(block)` / `getCssClasses(block)`

Erzeugen CSS-Klassen-Attribute aus den Sichtbarkeitseinstellungen eines Blocks. Wird intern für responsives Ausblenden verwendet.

### `getWidthPercentages(layout)` / `getWidthPixels(layout, containerWidth)`

Berechnen Spaltenbreiten für ein gegebenes `ColumnLayout`. Gibt ein Array von Prozent- oder Pixelwerten pro Spalte zurück.

### `SOCIAL_ICONS`

Eine Zuordnung aller eingebauten SVG-Icon-Daten für soziale Plattformen, nach Plattform und Stil indiziert.

## MJML zu HTML kompilieren

Nach dem Rendern in MJML kompilieren Sie mit einer beliebigen MJML-Bibliothek zu HTML:

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const mjml = renderToMjml(templateContent);
const { html } = mjml2html(mjml);

// html ist bereit zum Versand über Ihren E-Mail-Dienst
```

Weitere Informationen zur Rendering-Pipeline finden Sie unter [Wie das Rendering funktioniert](/de/getting-started/how-rendering-works).
