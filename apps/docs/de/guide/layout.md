---
title: Layout
description: Übergeben Sie eine JSON-Hülle mit einem Slot. Vorschau und Export legen die E-Mail des Autors hinein. Speichern tut das nicht.
---

# Layout

[Im Playground öffnen](https://play.templatical.com/scenes/layout)

Übergeben Sie ein JSON-Dokument mit genau einem `slot`. Vorschau und Export legen die E-Mail des Autors in diese Hülle. Speichern tut das nicht: `getContent()` ist nur die verfasste Vorlage.

```ts
init({ layout?: TemplateContent; sectionWrapper?: boolean })
renderToMjml(content, { layout?: TemplateContent })
```

Bauen Sie die Hülle mit `createSlotBlock()` und, für eine Karte, `createWrapperBlock()`. `createBlock('slot')` und `createBlock('wrapper')` werfen. `sectionWrapper` ist Editor-Chrome und unabhängig von `layout`. `renderToMjml` nimmt `sectionWrapper` nicht entgegen.

## Beispiel

Grauer Seitenhintergrund, eine Zeile „Im Browser ansehen“, die Autorensektionen in einer weißen Karte, Impressum unter der Karte. Das ist die umschließende Hülle: Vorschau und `toMjml()` / `toHtml()` setzen sie zusammen; die Bearbeitungsleinwand und `getContent()` nicht.

```ts
import {
  init,
  createSlotBlock,
  createWrapperBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
} from '@templatical/editor';

const layout = createDefaultTemplateContent();
layout.settings.backgroundColor = '#f3f4f6';
layout.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">Im Browser ansehen</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: '#ffffff',
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Impressum</a></p>',
  }),
];

const editor = await init({
  container: '#editor',
  layout,
  sectionWrapper: false,
});
```

```
mj-body                         ← grauer Untergrund (layout.settings.backgroundColor)
  mj-section                    ← Im Browser ansehen
  mj-wrapper                    ← weiße Karte
    [Autorensektionen…]
  mj-section                    ← Impressum
```

`sectionWrapper: false` blendet **Wrapper hinzufügen** an Autorensektionen aus. Sitzt der Slot in einem `wrapper`, würde das Steuerelement `mj-wrapper` in `mj-wrapper` erzeugen, was MJML verbietet. Lassen Sie `sectionWrapper` weg (oder übergeben Sie `true`), wenn Sie das Panel wollen; der Editor deaktiviert das Einschalten bei diesem Karten-Layout trotzdem.

## Der Vertrag

`layout` ist ein `TemplateContent` mit genau einem `slot`.

<!-- prettier-ignore -->
| Fläche | Mit `layout` |
| --- | --- |
| `getContent()` / `setContent()` / load / save / `onChange` / Verlauf | nur verfasste Vorlage |
| Bearbeitungsleinwand | nur verfasste Vorlage |
| Wrapper-Panel der Sektions-Symbolleiste | [Im Editor](#im-editor) |
| `renderToMjml(content)` (ohne `layout`-Argument) | nur verfasste Vorlage |
| Vorschauleinwand | zusammengesetzt |
| `editor.toMjml()` / `toHtml()` | zusammengesetzt |
| `RenderPayload.content` | zusammengesetzt |

`init` führt `validateLayout` auf der Hülle aus (nach Merge-Tag-Normalisierung). `applyLayout` läuft in der Vorschau und bei `toMjml` / `toHtml` / `renderToMjml(content, { layout })`. Es klont: IDs der Inhaltsblöcke bleiben; Layout-Block-IDs sind auf dem Klon neu.

::: tip Gespeichertes JSON
`getContent()`, load, save und die Bearbeitungsleinwand enthalten nie Layout-Blöcke. Versenden Sie mit `toMjml()` / `toHtml()`, oder rufen Sie `applyLayout` auf dem Server auf. Das Ausblenden von Wrapper hinzufügen entfernt `section.wrapper` nicht aus dem gespeicherten Inhalt.
:::

**`slot`** ist die Stelle, an der `content.blocks` landen. Genau eines im Layout-Baum. Zulässig als Kind von `layout.blocks` (oberste Ebene) oder von `wrapper.children`. Unzulässig in einer Sektionsspalte, in einem verschachtelten Wrapper und im Editor-Inhalt. Die Palette lässt ihn aus. Ein `slot`, der `renderToMjml` ohne `layout` erreicht, wirft.

**`wrapper`** ist die Layout-Karte: `styles.backgroundColor` / `styles.padding` / `borderRadius` werden zu `mj-wrapper`. Nur im Layout. Im Editor-Inhalt abgelehnt (`setContent` / `load` / `addBlock` / `createBlock('wrapper')`). Autorinnen nutzen weiterhin `section.wrapper` als Kurzform pro Sektion.

Layout-Factories und -Helfer (`createSlotBlock`, `createWrapperBlock`, `createParagraphBlock`, `createDefaultTemplateContent`, `applyLayout`, `validateLayout`, `isSlot`, `isWrapper`, `layoutWrapsSlot`) werden aus `@templatical/editor` exportiert. Headless-Rendering kann `applyLayout` aus `@templatical/types` ohne den Editor importieren.

`validateLayout` wirft:

```
[Templatical] layout: must contain exactly one slot block
[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section
[Templatical] layout: a wrapper cannot contain a wrapper
```

`setContent` / `load` / `addBlock` lehnen `slot` und `wrapper` im Inhalt ab.

MJML verbietet `mj-wrapper` in `mj-wrapper`. Sitzt der Slot in einem Wrapper, durchläuft `applyLayout` die eingeschleusten `content.blocks`. Jeder Block, der `mj-wrapper` erzeugen würde — `section.wrapper` gesetzt oder `type === 'wrapper'` — wirft:

```
[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)
```

Ein Slot in `children: [[slot]]` ist `mj-section` in `mj-column`, was MJML ebenfalls verbietet. Der Slot bleibt Kind des Body oder eines Wrappers.

## Kopf und Fuß

Keine Karte: der Slot ist Geschwister von Kopf und Fuß. Autor-`section.wrapper` ist dann ein Geschwister-`mj-wrapper` unter `mj-body` — gültig. Lassen Sie `sectionWrapper` weg, wenn Autorinnen weiterhin Wrapper hinzufügen sollen.

```ts
layout.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">Im Browser ansehen</a></p>',
  }),
  createSlotBlock(),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Impressum</a></p>',
  }),
];
```

```
mj-body                         ← grauer Untergrund
  mj-section                    ← Im Browser ansehen
  [Autorensektionen…]            ← darf section.wrapper enthalten
  mj-section                    ← Impressum
```

## Im Editor

Das Wrapper-Panel ist der Schalter **Wrapper hinzufügen** in der Sektions-Symbolleiste plus Farbe / Padding / Radius, wenn er an ist. Die Deaktivierung bei Karten-Layout und `sectionWrapper` sind unabhängig: `layout` zu setzen blendet das Panel nicht aus. Eine Hülle aus Kopf / Slot / Fuß bietet Wrapper hinzufügen weiterhin an.

Wenn `layout` gesetzt ist und der Slot in einem `wrapper` sitzt, kann der Schalter nicht eingeschaltet werden. Darunter steht eine gedämpfte Zeile:

> Dieser Editor rahmt die E-Mail bereits ein. Ein zusätzlicher Rahmen für diesen Abschnitt wird nicht unterstützt — Vorschau und Export schlagen fehl.

Hat eine geladene Vorlage bereits `section.wrapper`, bleibt der Schalter an und aktiviert, damit er ausgeschaltet werden kann. Der Hinweis bleibt.

```ts
init({ sectionWrapper?: boolean })
```

<!-- prettier-ignore -->
| Wert | Panel |
| --- | --- |
| weggelassen / `true` | sichtbar, plus die Deaktivierung bei Karten-Layout oben |
| `false` | ausgeblendet, auch dort, wo Wrapper hinzufügen zulässig ist (Kopf / Slot / Fuß, oder kein Layout) |

`sectionWrapper: false` entfernt `section.wrapper` nicht aus dem Inhalt, lehnt `updateBlock` nicht ab und ändert `getContent()` nicht. Ausblenden ändert nie einen Wert.

Wenn `sectionWrapper === false` und die ausgewählte Sektion bereits `wrapper` hat, wird das Panel weiterhin gerendert und der Schalter bleibt aktiviert, damit er ausgeschaltet werden kann. Ist er aus, verschwindet das Panel. Der Hinweis zum Karten-Layout erscheint weiterhin, wenn das Panel sichtbar ist.

## Einstellungen

Layout-`settings` ist ein vollständiges `TemplateSettings`. Gelesen wird nur `backgroundColor`.

<!-- prettier-ignore -->
| Feld | Gewinner |
| --- | --- |
| `backgroundColor` | Layout → `mj-body` |
| `width`, `fontFamily`, `textColor`, `linkColor`, `linkUnderline`, `locale`, `preheaderText`, `direction` | Inhalt |

Inhalts-`settings.backgroundColor` wird nicht verändert. Die Template-Einstellungen bearbeiten es weiterhin. Es ist nicht `mj-body`, wenn ein Layout angewendet wird. `direction` kommt aus der verfassten Vorlage. Layout setzt kein `dir`.

Sie können die Einstellungen des Inhalts auf das Layout kopieren und `backgroundColor` überschreiben.

## Headless-Nutzung

```ts
import { renderToMjml } from '@templatical/renderer';
import { applyLayout } from '@templatical/types';

const mjml = await renderToMjml(content, { layout });
const composed = applyLayout(layout, content);
```

Vorschau, `toMjml` und `toHtml` setzen zuerst zusammen, dann optional `resolvePreview`:

```
base = applyLayout(layout, content)
if (resolvePreview) base = await resolvePreview({ content: base, recipient })
```

Die Bearbeitungsleinwand nimmt diesen Pfad nie. Das Zusammensetzen des Layouts ist synchron.

Wenn `layout` gesetzt ist, ist `PreviewResolveContext.content` das zusammengesetzte Dokument. Geben Sie diese Form zurück. Nur den inneren `content` zurückzugeben, lässt die Hülle weg.

`renderToMjml(content)` ohne `layout`-Argument ruft `applyLayout` nicht auf.

Test-E-Mail: `payload.content` ist die verfasste Vorlage; MJML/HTML aus `toMjml` / `toHtml` enthält die Hülle.

Lint läuft über den Editor-Inhalt. Die Hülle wird nicht gelintet.

Ein Versandpfad, der gespeichertes JSON ohne `layout` neu rendert, lässt die Hülle weg. Übergeben Sie dasselbe `layout` an `renderToMjml` (oder rufen Sie `applyLayout` auf) auf dem Server.
