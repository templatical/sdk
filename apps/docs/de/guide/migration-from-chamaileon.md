---
title: Migration von Chamaileon
description: Chamaileon-E-Mail-Templates mit @templatical/import-chamaileon in das Templatical-Format konvertieren.
---

# Migration von Chamaileon

Diese Anleitung richtet sich an Teams, die E-Mail-Templates in [Chamaileon](https://chamaileon.io) erstellt haben — im gehosteten Editor oder über ein Produkt, das das SDK einbettet — und auf Templaticals visuellen Editor wechseln möchten. **`@templatical/import-chamaileon`** konvertiert ein Chamaileon-Persist-Dokument in Templaticals `TemplateContent`-Format. Installieren Sie es, führen Sie es aus, und nutzen Sie die folgenden Abschnitte, um alles nachzuarbeiten, was es nicht automatisch abbilden kann.

Die Eingabe ist `editorInstance.methods.getDocument()`, nicht `getEmailHtml()` / der HTML-Generator.

## Installation

```bash
npm install @templatical/import-chamaileon
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertChamaileonTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-chamaileon/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung

```ts
import { convertChamaileonTemplate } from '@templatical/import-chamaileon';

const document = await editorInstance.methods.getDocument();

const { content, report } = convertChamaileonTemplate(document);

const editor = await init({
  container: '#editor',
  content,
});

console.log(report);
```

`convertChamaileonTemplate` arbeitet synchron und gibt ein `ImportResult` zurück mit:

- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes erzeugten Blocks (`converted`, `approximated`, `html-fallback` oder `skipped`)

Es akzeptiert das Dokument auch als serialisierten JSON-String, für Aufrufer, die es auf diese Weise speichern oder übertragen.

::: tip
Übergeben Sie das Persist-Dokument aus `getDocument()`. Dieses Objekt ist `{ body, variables?, components?, title?, previewText?, subjectLine?, fontFiles? }` mit `body.type === "body"`. Der HTML-Generator (`getEmailHtml()`) ist eine andere Oberfläche — kompiliertes Tabellen-Markup, das zu [`@templatical/import-html`](/de/guide/migration-from-html) gehört, nicht zu diesem Paket. Ein Rateversuch zwischen den beiden würde Markup durch den falschen Konverter schicken.

E-Mail-JSON 2.0 bis 4.1 wird nach einem Schlüssel-Normalisierer akzeptiert. Kebab-Case-Styles (`background-color`) und CamelCase (`backgroundColor`) sind dieselbe Eigenschaft, zwei Versionen. Inline-Farbobjekte `{ reference, default }` werden auf `default` aufgelöst, oder auf den passenden Eintrag in `variables[]`, wenn `default` fehlt. Der `reference`-Name ist ein Design-Token, kein Empfängerfeld, und wird daher nicht als Merge-Tag gespeichert.
:::

## Bericht

Jeder Eintrag in `report.entries` beschreibt einen erzeugten Block:

| Status | Bedeutung |
|---|---|
| `converted` | Auf einen Templatical-Block abgebildet, ohne Verlust. |
| `approximated` | Auf den richtigen Block abgebildet, mit einer Begrenzung oder einem Flatten — `note` nennt die Änderung. |
| `html-fallback` | Keine Block-Entsprechung vorhanden; der rohe Knoten bleibt als JSON in einem `HtmlBlock` erhalten. |
| `skipped` | Eine leere Schleife oder Bedingung — es gab keine Kinder zu konvertieren. |

```ts
console.log(report.summary);
// { total: 24, converted: 18, approximated: 5, htmlFallback: 0, skipped: 1 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`${entry.sourceTag} approximiert:`, entry.note);
  }
}
```

Eine `note` bei einem `approximated`-Eintrag nennt den ursprünglichen Wert. `report.warnings` trägt Verluste auf Dokumentebene, die an keinem einzelnen Eintrag hängen — eine nicht-leere `subjectLine` oder `fontFiles`, und eine Anzahl von Farbvariablen, die auf ihre Default-Werte aufgelöst wurden.

## Dokumentform

Chamaileon speichert ein Design als Baum typisierter Knoten unter `body`:

```
document
  body (type "body")
    children: fullwidth | block-level-loop | block-level-conditional
      fullwidth.children: box | multicolumn | leaf
        box.children: box | multicolumn | leaf
        multicolumn.children: column only
          column.children: box | multicolumn | leaf
```

Blätter in der dokumentierten Elementliste: `text`, `typed-text`, `button`, `image`, `dynamic-image`, `divider`, `social`, `video`, `code`. `eid` wird verworfen — Templatical vergibt eigene IDs. `placeholder` ist Editor-Chrome und wird übersprungen. `customData` wird ignoriert.

- **Chamaileon** speichert diesen Persist-Baum, plus optionale `variables[]` (Design-Tokens) und `fontFiles`.
- **Templatical** speichert Templates als JSON-Baum mit typisierten Blöcken (`SectionBlock`, `ParagraphBlock` usw.) und rendert diesen Baum beim Export zu MJML.

`@templatical/import-chamaileon` durchläuft `body.children`, flacht `box` und verschachtelte `multicolumn` ab und baut daraus die entsprechenden Templatical-Blöcke. Die Mapping-Tabelle unten zeigt, was er dabei umsetzt.

## Visueller Neuaufbau

Bei einer Handvoll Templates ist der Neuaufbau von Hand neben einer Chamaileon-Vorschau oft schneller, als ein Paket zu installieren:

1. Öffnen Sie das Chamaileon-Design — den Editor selbst oder eine Vorschau von `getEmailHtml()` — in einem Fenster.
2. Öffnen Sie den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Nutzen Sie diese Vorschau als visuelles Ziel. Übergeben Sie `getEmailHtml()` nicht an diesen Konverter.
4. Ziehen Sie die entsprechenden Templatical-Blöcke hinein (siehe [Mapping-Tabelle](#chamaileon-node-mapping) unten).
5. Kopieren Sie Textinhalte direkt. Hosten Sie Bilder über Ihre Medienbibliothek neu.
6. Bilden Sie Styling über Templaticals [Design-Tokens](/de/guide/theming) ab.

Die meisten Chamaileon-Templates sind in 10–20 Minuten umgezogen, sobald Sie eines oder zwei gemacht haben. Bei größeren Mengen führen Sie zuerst `@templatical/import-chamaileon` aus und nutzen diesen Pfad nur, um nachzuarbeiten, was als `approximated`, `skipped` oder als `html-fallback`-Block gelandet ist.

## Renderer-Prüfung

Sobald ein Template in Templatical vorliegt — importiert oder von Hand nachgebaut:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
```

Ein visueller Vergleich mit Chamaileons eigener Vorschau zeigt, was der Bericht nicht zeigen kann. Mehrere der unten genannten Verluste — `hoverBackgroundColor`, seitenweise Rahmen auf Blättern — werden an der Stelle verworfen, an der sie gelesen werden, mit einer `note`, wenn der Konverter irgendwo andocken kann.

Es gibt kein Round-Trip-Orakel. Templatical rendert kein Chamaileon-JSON, und dieses Paket verarbeitet `getEmailHtml()` nicht.

## Knoten-Abbildung {#chamaileon-node-mapping}

| Chamaileon | Templatical-Block | Hinweise |
|---|---|---|
| `body` | Template-`settings` | `bodyWidth` → `settings.width`; `backgroundColor` → `settings.backgroundColor`; `previewText` → `settings.preheaderText`, wenn nicht leer. |
| `fullwidth` | `SectionBlock` | Äußeres `backgroundColor` → `wrapper.backgroundColor`; `contentBackgroundColor` → `section.styles.backgroundColor`; `contentPadding*` → Padding. Ein Fullwidth ohne `multicolumn` ist `columns: "1"`. |
| `box` | In das Elternelement abgeflacht | Transparente Boxen verschwinden ohne Eintrag. Eine bemalte Box, die einziges Kind eines Fullwidth ohne Content-Fill ist, kopiert diese Farbe auf die Sektion. Eine bemalte Box unter Geschwistern wird abgeflacht, `approximated`. |
| `multicolumn` + `column` | Section-`columns` / `children[i]` | Pixelbreiten werden in Prozent von `bodyWidth` umgerechnet und auf Templaticals fünf Layouts gematcht. Eine verschachtelte `multicolumn` kann kein verschachtelter `SectionBlock` werden — innere Spalten fließen in die Elternspalte, `approximated`. |
| `text` | `TitleBlock` oder `ParagraphBlock` | Abgeleitet aus dem HTML in `attrs.text`: eine einzelne Überschrift, die den gesamten Inhalt umschließt, wird zum Title; alles andere zum Paragraph. |
| `typed-text` | `TitleBlock` oder `ParagraphBlock` | `style.subType === "title"` → Title; `"list"` → Paragraph, `approximated`; sonst Paragraph. |
| `button` | `ButtonBlock` | `href` → `url`; Beschriftung ohne Tags. Ein ungesetztes Fill ist ein Outlined-Button — Fill wird `#ffffff` (nicht das Factory-`#333333`), der Eintrag ist `approximated`. |
| `image` | `ImageBlock` | `src` aus `attrs`, dann `style`; `altText` → `alt`. |
| `dynamic-image` | `ImageBlock` | `approximated`; die `note` nennt den Quelltyp. |
| `divider` | `DividerBlock` | 2.0 `attrs.lineStyle` und 4.1 `style.width` / `type` / `color` (Linienstärke, nicht Blockbreite). |
| `social` | `SocialIconsBlock` | `elements[]` ist die Quelle der Wahrheit. Unbekannte Plattformnamen werden zu `website`. Icon-Größe rastet auf 24 / 32 / 48 px. |
| `video` | `VideoBlock` | `link` → `url`; `src` → `thumbnailUrl`. Ein fehlendes Thumbnail bleibt der leere Factory-String. |
| `code` | `HtmlBlock` | Aus `attrs.html` / `attrs.code` / `attrs.content` (erstes gesetztes Feld). |
| `block-level-loop`, `block-level-conditional`, `branch`, `loop`, `conditional` | Kinder, oder Skip | Leer → `skipped`. Nicht leer → Kinder werden konvertiert, als wäre der Wrapper nicht da; jeder erzeugte Eintrag ist `approximated`. Der Ausdruck wird nicht auf `displayCondition` abgebildet. |
| Jeder andere `type` | `HtmlBlock` | Der rohe Knoten bleibt als JSON erhalten, markiert als `html-fallback`. |

`hideOnMobile` / `hideOnDesktop` werden auf `visibility` abgebildet. Fehlt, wenn beide Flags falsch sind.

## Verlustbehaftete Konvertierung

- **Verschachtelte `multicolumn`** — eine Zeile innerhalb einer Spalte kann kein verschachtelter `SectionBlock` werden. Die Kinder der inneren Spalten werden in Dokumentreihenfolge in die Elternspalte eingefügt, `approximated`, `note` `"nested multicolumn flattened (N columns)"`. Blätter werden konvertiert; die Geometrie ist der Verlust.
- **4+ Spalten** — Templatical unterstützt fünf Spalten-Layouts (`1`, `2`, `3`, `2-1`, `1-2`). Eine `multicolumn` mit 4, 5 oder 6 Spalten wird auf `"3"` gefaltet; überzählige Kinder hängen an den letzten Slot, `approximated`, Originalbreiten in der `note`.
- **Outlined-Buttons** — ungesetztes `background-color` plus farbiger Rahmen hat keine Templatical-Entsprechung. Nach `createButtonBlock` wird Fill als `#ffffff` geschrieben, damit das Factory-`#333333` einen Ghost-Button nicht in eine dunkle Pille verwandelt. Der Outline entfällt; der Eintrag ist `approximated`.
- **Schleifen und Bedingungen** — Chamaileons `attrs.expression` ist kein Liquid und keine MJML-Anzeigebedingungs-Syntax. Leere Knoten `skipped`. Gefüllte Knoten konvertieren ihre Kinder und verwerfen die Verzweigung; den Ausdruck in `displayCondition` zu stecken, würde über den Dialekt lügen.
- **Box-Farbe unter Geschwistern** — eine verschachtelte Box mit echtem Fill, Padding oder Radius, die nicht das einzige Kind eines sonst unbemalten Fullwidth ist, wird abgeflacht. Die Farbe entfällt, `approximated`. Eine neue Top-Level-Sektion würde die Zeile teilen; eine verschachtelte Sektion ist in einer Spalte unzulässig.
- **Variablen-Referenzen** — `{ reference, default }` wird auf eine konkrete Farbe aufgelöst. Der Referenzname überlebt nicht als Merge-Tag.
- **Social-Icon-Größen und unbekannte Plattformen** — Größe rastet auf small / medium / large; ein unbekannter `type` wird zu `website`.
- **Überschriften-Ebenen** — `TitleBlock` unterstützt die Ebenen 1 bis 4. Ein einzelnes `<h5>` oder `<h6>` wird auf 4 begrenzt.
- **Block-IDs** — jeder importierte Block erhält eine neu generierte ID. Chamaileons `eid` wird verworfen.

::: tip
Verschachtelte Spalten und bemalte Boxen werden abgeflacht, weil MJML eine Sektion innerhalb einer Spalte verbietet und `addBlock` das ebenfalls tut. Ein erfundener verschachtelter `SectionBlock` würde nicht rendern; erfundene zusätzliche Top-Level-Sektionen würden eine Zeile teilen, die eine einzige Band war. Blätter werden in beiden Fällen konvertiert. Leere Schleifen werden übersprungen statt zu einem undurchsichtigen `HtmlBlock`, sodass eine gefüllte Schleife aus Produktzeilen als konvertierte Kinder erhalten bleibt.
:::

## Nicht abgebildete Felder

- **`subjectLine`** — Templatical-Templates haben kein Betreff-Feld. Ein nicht-leerer Wert wird in `report.warnings` genannt.
- **`fontFiles`** — keine Schrift-Datei-Tabelle auf Dokumentebene. Ein nicht-leeres Objekt wird in `report.warnings` genannt. Text, der davon abhing, wird in der Ersatzschriftart gerendert.
- **`title`** (der Dokumentname) — still; er ist nicht empfängerseitig.
- **`hoverBackgroundColor`** — kein Hover-Fill auf `ButtonBlock`.
- **Seitenweise Rahmen auf Blättern** — an der Stelle verworfen, an der sie gelesen werden.
- **`fullWidthOnMobile` als reines Mobil-Flag** — auf Templatical-Blöcken nicht ausgedrückt.
- **`components[]`** — 4.x-Stilvorlagen-Bibliothek. Nicht in v1; der eigene Style am Knoten gilt weiterhin.
- **`lock` / `marker`** — Editor-Chrome; ignoriert.
- **`placeholder`** — Block-Bibliotheks-Chrome auf `fullwidth`; übersprungen.

Ein frisch importiertes Template scheitert bei der Ankunft häufig an den Barrierefreiheits-Regeln von `@templatical/quality`, und der `validate`-Befehl des [Agent Skill](/de/guide/agent-skill) beendet sich dabei mit einem Exit-Code ungleich 0. Aus Chamaileon exportierte Bilder tragen typischerweise keinen `alt`-Text, und der Importer übernimmt diese Lücke originalgetreu — eine Beschreibung zu erfinden wäre selbst ein Anti-Pattern für Barrierefreiheit. Die strukturelle Validierung besteht; die Befunde betreffen den Inhalt. Fügen Sie den importierten Bildern Alt-Text hinzu, und die Befunde verschwinden.

## Weitere Fälle

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres Chamaileon-`getDocument()`-JSON und dem, was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-chamaileon` zu verbessern.
