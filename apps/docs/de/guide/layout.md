---
title: Layout
description: Legen Sie um jede E-Mail eine Hülle, die Sie vorgeben — Kopf, Fuß, Untergrund und eine optionale Karte — angewendet in Vorschau und Rendering, nie in die Vorlage geschrieben.
---

# Layout

Eine Hülle um jede E-Mail, die Sie als Host vorgeben — Link zur Browseransicht, Impressum, Markenkopf, grauer Untergrund und optional eine Karte um die Autorensektionen — als Templatical-JSON. Angewendet in Vorschau und Rendering. Nie in die Vorlage geschrieben.

Der verfasste Inhalt bleibt, wie er heute ist. Layout ist die Überlagerung.

## Der Vertrag

```ts
init({ layout?: TemplateContent; sectionWrapper?: boolean })
initCloud({ layout?: TemplateContent; sectionWrapper?: boolean })
renderToMjml(content, { layout?: TemplateContent })
```

`layout` ist ein `TemplateContent` mit genau einem `slot`. Bauen Sie es mit `createSlotBlock()` und, für eine Karte, `createWrapperBlock()`. `createBlock('slot')` und `createBlock('wrapper')` werfen. `sectionWrapper` ist Editor-Chrome, unabhängig von `layout`. `renderToMjml` nimmt es nicht entgegen.

<!-- prettier-ignore -->
| Fläche | Mit `layout` |
| --- | --- |
| `getContent()` / `setContent()` / load / save / `onChange` / Verlauf | unverändert |
| Bearbeitungsleinwand | unverändert |
| Wrapper-Panel der Sektions-Symbolleiste | [Im Editor](#im-editor) |
| `renderToMjml(content)` (ohne `layout`-Argument) | unverändert |
| Vorschauleinwand | zusammengesetzt |
| `editor.toMjml()` / `toHtml()` | zusammengesetzt |
| `RenderPayload.content` | zusammengesetzt |
| Cloud-Versand | kein Client-Splice |

`init` / `initCloud` normalisieren Merge-Tags in der Hülle, dann `validateLayout`. `applyLayout` läuft in der Vorschau und bei `toMjml` / `toHtml` / `renderToMjml(content, { layout })`. Es klont. Inhalts-Block-IDs bleiben; Layout-Block-IDs werden auf dem Klon neu vergeben.

::: tip Überlagerung
Ein Fehler, der Layout-Blöcke in `getContent()` schreibt oder `section.wrapper` beim Speichern umschreibt, verletzt diesen Vertrag. Das Ausblenden des Wrapper-Panels ist Darstellung; das Feld wird nicht entfernt.
:::

`slot` ist das Loch. Genau eines im Layout-Baum. Zulässig als Kind von `layout.blocks` (oberste Ebene) oder von `wrapper.children`. Unzulässig in einer Sektionsspalte, in einem verschachtelten Wrapper und im Editor-Inhalt. Die Palette lässt ihn aus. Ein `slot`, der `renderToMjml` ohne `layout` erreicht, wirft.

`wrapper` ist das Band: `styles.backgroundColor` / `styles.padding` / `borderRadius` → `mj-wrapper`. Nur im Layout. Im Editor-Inhalt abgelehnt (`setContent` / `load` / `addBlock` / `createBlock('wrapper')`). `section.wrapper` bleibt die Kurzform für eine Sektion.

`applyLayout`, `validateLayout`, `createSlotBlock`, `createWrapperBlock`, `isSlot`, `isWrapper` und `layoutWrapsSlot` werden aus `@templatical/types` exportiert und aus `@templatical/editor` re-exportiert.

## Im Editor

Das Wrapper-Panel ist der Schalter **Wrapper hinzufügen** in der Sektions-Symbolleiste plus die Felder für Farbe / Padding / Radius, wenn er an ist. Die Deaktivierung bei Karten-Layout und `sectionWrapper` setzen sich zusammen; keine folgt aus der anderen. `layout` zu setzen blendet das Panel nicht aus — ein Geschwister-Slot-Layout braucht Wrapper hinzufügen weiterhin.

Wenn `layout` gesetzt ist und der Slot in einem `wrapper` sitzt, ist der Schalter zum Einschalten deaktiviert. Darunter steht eine gedämpfte Zeile:

> Dieser Editor rahmt die E-Mail bereits ein. Ein zusätzlicher Rahmen für diesen Abschnitt wird nicht unterstützt — Vorschau und Export schlagen fehl.

Hat eine geladene Vorlage bereits `section.wrapper`, bleibt der Schalter an und aktiviert, damit er ausgeschaltet werden kann. Der Hinweis bleibt. Geschwister-Slot-Layouts (Kopf / Slot / Fuß, keine Karte): der Schalter bleibt voll nutzbar.

```ts
init({ sectionWrapper?: boolean })
initCloud({ sectionWrapper?: boolean })
```

<!-- prettier-ignore -->
| Wert | Panel |
| --- | --- |
| weggelassen / `true` | heutige UI, plus die Deaktivierung bei Karten-Layout oben |
| `false` | ausgeblendet, auch dort, wo Wrapper hinzufügen zulässig ist (Geschwister-Layout oder kein Layout) |

`false` entfernt `section.wrapper` nicht aus dem Inhalt, lehnt `updateBlock` nicht ab und ändert `getContent()` nicht. Ausblenden ändert nie einen Wert.

Bereits eingeschaltete Wrapper bleiben erreichbar. Wenn `sectionWrapper === false` und die ausgewählte Sektion bereits `wrapper` hat, wird das Panel weiterhin gerendert und der Schalter bleibt aktiviert, damit er ausgeschaltet werden kann. Ist er aus, verschwindet das Panel. Der Hinweis zum Karten-Layout erscheint weiterhin, wenn das Panel sichtbar ist.

## Eine Karte um den Inhalt

Geschwister-Hülle — Kopf, Slot, Fuß, grauer Untergrund. Autor-`section.wrapper` ist ein Geschwister-`mj-wrapper` unter `mj-body`.

```ts
import { init } from '@templatical/editor';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
} from '@templatical/types';

const layout = createDefaultTemplateContent();
layout.settings.backgroundColor = '#f3f4f6';
layout.blocks = [
  createParagraphBlock({
    content: '<p><a href="https://example.com/view">View in browser</a></p>',
  }),
  createSlotBlock(),
  createParagraphBlock({ content: '<p>Impressum</p>' }),
];

const editor = await init({
  container: '#editor',
  layout,
});
```

```
mj-body                         ← layout.settings.backgroundColor
  [Layout-Blöcke oberhalb des Slots]
  [content.blocks, unangetastet]
  [Layout-Blöcke unterhalb des Slots]
```

Karte um den Slot — der Wrapper ist die Karte:

```ts
import { createWrapperBlock } from '@templatical/types';

layout.blocks = [
  createParagraphBlock({
    content: '<p><a href="https://example.com/view">View in browser</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: '#ffffff',
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({ content: '<p>Impressum</p>' }),
];
```

```
mj-body                         ← grauer Untergrund
  mj-section                    ← Ansicht im Browser
  mj-wrapper                    ← weiße Karte
    [Autorensektionen…]
  mj-section                    ← Impressum
```

Gültiges MJML, wenn die eingeschleusten Blöcke kein `mj-wrapper` erzeugen. Der Slot ist ein Loch in einem `Block[]` — Kinder des Body oder des Wrappers. Ein Slot in `children: [[slot]]` ist `mj-section` in `mj-column`.

## Einstellungen

Layout ist das Dokument; Inhalt ist die Nachricht. Layout-`settings` ist ein vollständiges `TemplateSettings`. Gelesen wird nur `backgroundColor`.

<!-- prettier-ignore -->
| Feld | Gewinner |
| --- | --- |
| `backgroundColor` | Layout → `mj-body` |
| `width`, `fontFamily`, `textColor`, `linkColor`, `linkUnderline`, `locale`, `preheaderText`, `direction` | Inhalt |

Inhalts-`settings.backgroundColor` wird nicht verändert. Die Template-Einstellungen bearbeiten es weiterhin. Es ist nicht `mj-body`, wenn ein Layout angewendet wird. `direction` ist Inhalt der Vorlage. Layout setzt kein `dir`.

Sie können die Einstellungen des Inhalts kopieren und `backgroundColor` überschreiben.

## Zusammensetzung

```
base = applyLayout(layout, content)
if (resolvePreview) base = await resolvePreview({ content: base, recipient })
```

Vorschauleinwand, `toMjml` und `toHtml` verwenden `base`. Die Bearbeitungsleinwand nimmt diesen Pfad nie. Das Zusammensetzen des Layouts ist synchron — kein Platzhalter für eine reine Layout-Vorschau. `supersedesSamples` bleibt ausschließlich `resolvePreview`.

Wenn `layout` gesetzt ist, ist `PreviewResolveContext.content` das zusammengesetzte Dokument. Geben Sie diese Form zurück. Nur den inneren `content` zurückzugeben, lässt die Hülle weg.

Headless:

```ts
import { renderToMjml } from '@templatical/renderer';
import { applyLayout } from '@templatical/types';

const mjml = await renderToMjml(content, { layout });
const composed = applyLayout(layout, content);
```

Sitzt der Slot in einem Wrapper, durchläuft `applyLayout` die eingeschleusten `content.blocks`. Würde ein Block `mj-wrapper` erzeugen — `section.wrapper` gesetzt oder `type === 'wrapper'` — wirft es. Kein Ineinanderziehen, kein Weglassen, keine Vorschau einer Lüge.

```
[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)
```

Ist der Slot auf oberster Ebene, ist eingeschleustes `section.wrapper` ein Geschwister unter `mj-body`.

Auswege: Slot als Geschwister (keine Karte); Nutzende lassen Wrapper hinzufügen aus; `sectionWrapper: false`, sodass das Steuerelement nicht angeboten wird.

`validateLayout` wirft:

```
[Templatical] layout: must contain exactly one slot block
[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section
[Templatical] layout: a wrapper cannot contain a wrapper
```

`setContent` / `load` / `addBlock` lehnen `slot` und `wrapper` im Inhalt ab. `renderToMjml(content)` ohne `layout`-Argument darf `applyLayout` nicht aufrufen.

## Hinweise

1. **Bearbeitungsleinwand.** Die Hülle gilt nur für Vorschau und Rendering.
2. **Untergrundfarbe.** „Hintergrund“ in den Template-Einstellungen ist nicht `mj-body`, wenn `layout` gesetzt ist.
3. **Layout-Karte vs. `section.wrapper`.** Slot in einem Wrapper + eingeschleustes `mj-wrapper` wirft. Der Editor deaktiviert in diesem Fall das Einschalten von Wrapper hinzufügen. Wer das Steuerelement gar nicht anbieten will, setzt `sectionWrapper: false` — das Ausblenden ist Darstellung; ein vorhandenes `wrapper`-Feld wird nicht entfernt.
4. **Gespeichertes JSON.** `getContent()` hat keine Hülle. Versand muss `toMjml` / `toHtml` verwenden (oder denselben Splice auf dem Server).
5. **Cloud-Versand.** Die Vorschau wendet Layout an; der Cloud-Versand tut das erst, wenn das Backend zusammensetzt.
6. **`resolvePreview`.** Erhält das zusammengesetzte Dokument.
7. **Test-E-Mail.** `payload.content` ist ohne Hülle; MJML/HTML aus `toMjml` / `toHtml` ist mit Hülle.
8. **Lint.** Läuft über den Editor-Inhalt. Die Hülle ist Sache des Hosts.
9. **Slot-Form.** Genau einer; Kind der obersten Ebene oder eines Wrappers. Null, zwei oder in einer Spalte → Fehler bei `init` / `renderToMjml`.
10. **Palette-`wrapper` später.** Derselbe Typ, dann für Inhalt freigegeben. Wrapper dürfen weiterhin nicht verschachtelt werden. Der Import approximiert bis dahin weiterhin.
