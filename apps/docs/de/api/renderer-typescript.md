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

Rendert ein `TemplateContent`-Objekt zu einem MJML-String. Gibt ein `Promise<string>` zurück – asynchron, damit benutzerdefinierte Blöcke (deren Auflösung asynchrone Arbeit erfordern kann) inline gerendert werden können.

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(templateContent);
```

**Parameter:**

| Parameter | Type | Beschreibung |
|-----------|------|-------------|
| `content` | `TemplateContent` | Das zu rendernde Template |
| `options` | `RenderOptions` | Optionale Rendering-Konfiguration |

**Rückgabewert:** `Promise<string>` -- MJML-Markup

## RenderOptions

```ts
interface RenderOptions {
  customFonts?: CustomFont[];
  defaultFallbackFont?: string;
  allowHtmlBlocks?: boolean;      // Standard: true
  renderCustomBlock?: (block: CustomBlock) => Promise<string>;
  socialIconsBaseUrl?: string;
}
```

| Option | Default | Beschreibung |
|--------|---------|-------------|
| `customFonts` | `[]` | Definitionen benutzerdefinierter Schriftarten für `<mj-font>`-Deklarationen in der gerenderten Ausgabe |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback-Schriftart-Stack |
| `allowHtmlBlocks` | `true` | Auf `false` setzen, um HTML-Blöcke aus der Ausgabe zu entfernen |
| `renderCustomBlock` | -- | Wandelt benutzerdefinierte Blöcke in HTML um. Wird einmal pro benutzerdefiniertem Block aufgerufen. Editor-Konsumenten übergeben `editor.renderCustomBlock`; Headless-Konsumenten verwenden einen eigenen Resolver. Wenn weggelassen, fällt der Renderer auf das `renderedHtml`-Feld des Blocks zurück (falls vorhanden) und lässt den Block andernfalls weg. |
| `socialIconsBaseUrl` | versionsgebundene unpkg-URL | Basis-URL (ohne abschließenden Schrägstrich) für die PNG-Assets der Social-Media-Icons. Wird pro Icon zu `${baseUrl}/${style}/${platform}.png` aufgelöst. Siehe [Social-Media-Icons](#social-media-icons) unten. |

### Benutzerdefinierte Blöcke

Wenn der Inhaltsbaum benutzerdefinierte Blöcke enthält, fragt der Renderer den übergebenen `renderCustomBlock`-Callback, um jeden in HTML zu konvertieren. Aus dem Editor:

```ts
const mjml = await renderToMjml(editor.getContent(), {
  renderCustomBlock: editor.renderCustomBlock,
});
```

Headless- / Node.js-Konsumenten (ohne montierten Editor) können einen eigenen Resolver bereitstellen – zum Beispiel die gleiche Liquid-Vorlage gegen die `fieldValues` des Blocks ausführen:

```ts
import { Liquid } from 'liquidjs';

const engine = new Liquid();
const definitionsByType = new Map(/* Ihre CustomBlockDefinition-Liste, nach type indiziert */);

const mjml = await renderToMjml(content, {
  async renderCustomBlock(block) {
    const definition = definitionsByType.get(block.customType);
    if (!definition) return '';
    return engine.parseAndRender(definition.template, block.fieldValues);
  },
});
```

### Social-Media-Icons

Social-Icon-Blöcke werden als `<img src="…/{style}/{platform}.png">` ausgegeben. Der Standardwert von `socialIconsBaseUrl` verweist auf den versionsgebundenen unpkg-Mirror von `@templatical/renderer`, der vorgerasterte PNGs (16 Plattformen × 5 Stile) mit dem Paket ausliefert:

```
https://unpkg.com/@templatical/renderer@<version>/assets/social/{style}/{platform}.png
```

**Warum PNGs.** Outlook Desktop (Word-Rendering-Engine) unterstützt kein SVG und lehnt base64-Daten-URIs in `<img src>` ab. Gehostete PNGs sind das einzige Format, das in allen gängigen E-Mail-Clients zuverlässig dargestellt wird.

**Warum versionsgebunden.** E-Mails sind Archivinhalt — Empfänger öffnen Nachrichten Monate oder Jahre nach dem Versand. Die Versionsbindung friert die Icon-Darstellung zum Renderzeitpunkt ein, sodass ein späteres Redesign oder ein Regressionsfehler im Paket bereits zugestellte E-Mails nicht rückwirkend beschädigt. Außerdem entfällt eine 302-Weiterleitung pro Icon und es können langlebige, unveränderliche Cache-Header gesetzt werden.

**Selbst hosten.** Überschreiben Sie `socialIconsBaseUrl`, um die Assets über Ihr eigenes CDN auszuliefern — nützlich für Air-Gapped-Umgebungen, markenspezifische Themen oder um die Abhängigkeit von unpkg zu entfernen:

```ts
const mjml = await renderToMjml(content, {
  socialIconsBaseUrl: 'https://cdn.example.com/email-assets/social',
});
```

Die exakten Dateinamen, die der Renderer erwartet, sind `{style}/{platform}.png`, wobei `style` einer von `solid | outlined | rounded | square | circle` und `platform` einer von `facebook | twitter | instagram | linkedin | youtube | tiktok | pinterest | email | whatsapp | telegram | discord | snapchat | reddit | github | dribbble | behance | website` ist. Die ausgelieferten 192×192-PNGs sind ein sinnvoller Ausgangspunkt, wenn Sie sie spiegeln möchten.

Das Paket exportiert außerdem `DEFAULT_SOCIAL_ICONS_BASE_URL`, falls Sie URLs gegen denselben Standardwert komponieren möchten:

```ts
import { DEFAULT_SOCIAL_ICONS_BASE_URL } from '@templatical/renderer';
```

## Hilfsfunktionen

Der Renderer exportiert außerdem Hilfsfunktionen:

```ts
import {
  escapeHtml,
  escapeAttr,
  convertMergeTagsToValues,
  isHiddenOnAll,
  toPaddingString,
  renderBlock,
  getCssClassAttr,
  getCssClasses,
  getWidthPercentages,
  getWidthPixels,
  DEFAULT_SOCIAL_ICONS_BASE_URL,
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

### `renderBlock(block, context)`

Rendert einen einzelnen Block in seine MJML-Darstellung. Wird intern von `renderToMjml()` verwendet, aber für fortgeschrittene Anwendungsfälle exportiert, in denen Sie einzelne Blöcke rendern müssen.

### `RenderContext`

Das an Block-Renderer übergebene Kontextobjekt. Enthält Rendering-Optionen und Schriftart-Konfiguration.

### `getCssClassAttr(block)` / `getCssClasses(block)`

Erzeugen CSS-Klassen-Attribute aus den Sichtbarkeitseinstellungen eines Blocks. Wird intern für responsives Ausblenden verwendet.

### `getWidthPercentages(layout)` / `getWidthPixels(layout, containerWidth)`

Berechnen Spaltenbreiten für ein gegebenes `ColumnLayout`. Gibt ein Array von Prozent- oder Pixelwerten pro Spalte zurück.

### `DEFAULT_SOCIAL_ICONS_BASE_URL`

Der Standardwert von `RenderOptions.socialIconsBaseUrl` — die versionsgebundene unpkg-URL, die auf die in diesem Paket mitgelieferten PNGs der Social-Media-Icons verweist. Siehe [Social-Media-Icons](#social-media-icons).

## MJML zu HTML kompilieren

Nach dem Rendern in MJML kompilieren Sie mit einer beliebigen MJML-Bibliothek zu HTML:

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const mjml = await renderToMjml(templateContent);
const { html } = mjml2html(mjml);

// html ist bereit zum Versand über Ihren E-Mail-Dienst
```

Weitere Informationen zur Rendering-Pipeline finden Sie unter [Wie das Rendering funktioniert](/de/getting-started/how-rendering-works).
