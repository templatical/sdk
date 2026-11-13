---
title: Migration von BeeFree
description: Konvertieren Sie BeeFree-E-Mail-Templates mit @templatical/import-beefree in das Templatical-Format.
---

# Migration von BeeFree

Das Paket `@templatical/import-beefree` konvertiert BeeFree-(BEE-)JSON-Templates in das `TemplateContent`-Format von Templatical.

::: warning
Dieses Paket befindet sich in aktiver Entwicklung. Einige Blocktypen und erweiterte Funktionen werden möglicherweise noch nicht vollständig unterstützt. Testen Sie Ihre konvertierten Templates, bevor Sie sie in Produktion einsetzen.
:::

## Installation

::: code-group

```bash [npm]
npm install @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [yarn]
yarn add @templatical/import-beefree @templatical/editor @templatical/renderer
```

```bash [bun]
bun add @templatical/import-beefree @templatical/editor @templatical/renderer
```

:::

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertBeeFreeTemplate } from "https://cdn.jsdelivr.net/npm/@templatical/import-beefree/+esm";
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung {#usage}

```ts
import { convertBeeFreeTemplate } from "@templatical/import-beefree";
import { init } from "@templatical/editor";
import { renderToMjml } from "@templatical/renderer";

// Laden Sie Ihr BeeFree-Template-JSON
const res = await fetch("/api/beefree-templates/123");
const beefreeJson = await res.json();

// In das Templatical-Format konvertieren
const { content, report, customFonts } = convertBeeFreeTemplate(beefreeJson);

// Im Editor verwenden
const editor = await init({
  container: "#editor",
  content,
  fonts: { customFonts },
});

// Dieselben Schriften beim Rendern laden
const mjml = await renderToMjml(content, { customFonts });

// Den Konvertierungsbericht auf etwaige Probleme prüfen
console.log(report);
```

[Im Playground öffnen](https://play.templatical.com/scenes/import-beefree)

Die Funktion gibt ein `ImportResult` zurück mit:

- `content` — den konvertierten `TemplateContent`, bereit für den Editor
- `report` — einen Konvertierungsbericht mit dem Status jedes Blocks (`converted`, `approximated`, `html-fallback` oder `skipped`)
- `customFonts` — `{ name, url }[]` aus `page.body.webFonts`-Einträgen mit URL. Das Array geht an `init({ fonts: { customFonts } })` und an `renderToMjml`. System-Stacks (`Arial`, `Helvetica Neue`, …) und `inherit` fehlen. Eine Schrift, die das Template nutzt, die keine URL hat und kein solcher Stack ist, steht in `report.warnings`.

| Status          | Bedeutung                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `converted`     | Ohne Verlust auf einen Templatical-Block abgebildet.                                                                                                                                                                                                                                                                                                                                    |
| `approximated`  | Eine verlustbehaftete Abbildung. Die `note` nennt, wenn sie gesetzt ist, die genaue Änderung, etwa einen Clamp, einen nicht übernommenen Zeichenabstand eines Buttons oder eine Bild-Prozentbreite, die als px gespeichert wird. HTML in Tabellenzellen, das auf Klartext reduziert wird, wird hier gemeldet und in `report.warnings` genannt.                  |
| `html-fallback` | Kein Block-Äquivalent — ein unbekannter Modultyp (Formulare eingeschlossen), ein [Icons](#icons)-Modul mit Icons außer einem einzelnen Icon ohne Text, mit nicht-leerem Bild und positiver px-Dateibreite und -höhe, oder ein [Addon](#addons) ohne Payload, das der Importer liest. Die Ausgabe ist ein `HtmlBlock`; seinen Inhalt beschreibt die [Block-Zuordnung](#block-zuordnung). |
| `skipped`       | Keine Ausgabe, und `templaticalBlockType` ist `null`: ein leeres Modul, ein Icons-Modul ohne Icons, ein Spacer mit 0px Höhe oder ein [Divider ohne Linie](#undrawn-dividers), der keinen Platz einnimmt.                                                                                                                                                                                |

Das JSON, das BeeFrees Editor speichert (`page.rows`), ist die Eingabe. Ein kompiliertes HTML-Export ist ein anderes Envelope — [`@templatical/import-html`](/de/guide/migration-from-html).

## Sprachen {#languages}

Die Standardsprache stammt aus `language.value` bei `page.body.language`, `page.language`, dann der Wurzel, in dieser Reihenfolge. Übersetzungen in Modul-Deskriptoren (oder am Modul) werden zu `l10n`-Text: Heading `text`, Paragraph/List `html`, Button `label`, Image `alt`, Video `thumbAlt` sowie Menüeinträge `text` nach Position, aus `menuItemsList.translations` oder den `translations` des Moduls. Bei abweichender Anzahl der Menüeinträge entfällt die Menüübersetzung mit Warnung. `head.meta.preheader` liefert den Standard-Preheader; `head.meta.translations[locale].preheader` liefert seine Übersetzung.

Übersetzte `subject`, `title` und `description` bleiben beim Host und erzeugen Warnungen. Unbekannte Übersetzungsschlüssel, einschließlich URL- oder Bildquellenschlüssel, warnen einmal pro Schlüssel und Sprache. Übersetzungen für HTML-Fallbacks werden mit Warnung verworfen. Eine Übersetzung eines leeren Paragraph-Moduls, das als Spacer importiert wird, wird mit einer Warnung pro Sprache verworfen: `Dropped language "<locale>" on module "<module type>": the default paragraph is blank and imported as a spacer.` Dieser Verlust ist eine Annäherung: der Berichtseintrag des Moduls ist `approximated`, und seine `note` nennt die verworfenen Sprachen, angehängt an eine vorhandene Notiz (`Translations de, fr dropped: the default paragraph is blank and imported as a spacer.`). Eine leere Übersetzung eines Paragraphen mit Text bleibt der Inhalt dieser Sprache.

Die Abbildung folgt [Beefrees dokumentiertem JSON](https://docs.beefree.io/beefree-sdk/ai-and-mcp/ai-addons/deepl), geprüft am 2026-10-28. Die Fixtures stammen aus dieser Dokumentation, nicht aus echten mehrsprachigen Exporten.

Codes werden von `_` nach `-` normalisiert und müssen `isLocaleTag` bestehen. Nicht unterstützte Tags werden mit einer Warnung unter Angabe der Sprache verworfen. Texteinträge enthalten `{ value, sourceHash }`, gehasht aus dem importierten Standardwert. Aktivieren Sie `init({ localization: { locales } })` mit den importierten Sprachen, um das Sprachmenü anzuzeigen. Prüfen Sie das Ergebnis mit `template-tools validate imported.json --locale <tag>` und kontrollieren Sie `report.warnings`.

## Optionen {#options}

`convertBeeFreeTemplate` akzeptiert als zweites Argument `ConvertBeeFreeOptions`. `defaultLocale?: string` setzt `settings.locale`, wenn die Quelle keine Standardsprache angibt; andernfalls gilt `"en"`. Eine deklarierte Standardsprache hat Vorrang. Sprachcodes werden von `_` nach `-` normalisiert. Eine deklarierte Standardsprache oder ein `defaultLocale`, das danach kein Sprach-Tag ist, etwa ein Platzhalter <code v-pre>{{lang}}</code>, wird mit einem `report.warnings`-Eintrag ignoriert, der den Wert nennt; dann gilt der nächste gültige Wert oder `"en"`.

```ts
export interface ConvertBeeFreeOptions {
  defaultLocale?: string;
}
```

## Block-Zuordnung

BeeFree-Blocktypen werden den Templatical-Äquivalenten zugeordnet:

| BeeFree-Modul | Templatical-Block                                                           | Status                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Text          | `paragraph`                                                                 | Konvertiert                                                                                                                                                        |
| Paragraph     | `paragraph`, oder `spacer`, wenn der konvertierte Inhalt leer ist           | Konvertiert. Leer wird nur am konvertierten Inhalt entschieden (`isBlankRichText`). Leeres `paragraph.html`, `paragraph.html` aus nur Leerraum und ein Modul ohne `paragraph`- und ohne `text`-Payload sind nach der Konvertierung leer. Text in `text.html` ohne `paragraph`-Payload bleibt ein Paragraph. Die `height` des Spacers ist `Math.round` von `padding-top` + Zeilenbox + `padding-bottom`. Die Zeilenbox ist die Schriftgröße in px (14, wenn sie fehlt, und 0 bei der Länge `0px`) mal `line-height` (`120%` ist 1.2, eine einheitenlose Zahl ist das Verhältnis, auch `0`, eine `em`-Länge ist das Vielfache der Schriftgröße, also ist `2em` bei 14px 28, eine px-Länge ist die Zeilenbox, auch `0px`, und 1.2 gilt, wenn der Wert fehlt). Eine vorhandene `font-size` oder `line-height`, die nicht genau gelesen wird (`rem`, `pt`, `normal`, `calc(...)`, eine negative Zahl, eine nicht endliche Länge wie hunderte Stellen `em` oder `px`, alles andere Unlesbare), nutzt denselben Fallback, und der Eintrag ist `approximated`. Ist die berechnete Zeilenbox oder Höhe nicht endlich, nutzt der Spacer die Fallback-Höhe, `padding-top` + 14 × 1.2 + `padding-bottom`, die `note` erhält `its line box overflows, 1.2 × 14px is used`, und der Eintrag ist `approximated`. Ein nicht endliches `padding-top` oder `padding-bottom` wird vor beiden Summen als 0 gelesen, die `note` erhält `its padding is not read`, und der Eintrag ist `approximated`. Die Höhe ist immer eine endliche, nicht negative ganze Zahl. `styles.padding` ist auf jeder Seite 0, und die Hintergrundfarbe bleibt. Die `note` im Bericht ist ein Satz, der die Höhe nennt (`Blank paragraph imported as a 37px spacer.`). Ein schlicht leerer Paragraph, auch ohne Schriftgröße und `line-height`, bleibt `converted`. Ein ungelesener Wert verlängert diesen Satz (`Blank paragraph imported as a <N>px spacer; line-height <value> is not read, 1.2 is used.` oder `font-size <value> is not read, 14px is used.`). Hat das konvertierte HTML ein `<p>`, dessen `style` einen Kasten zeichnet, bleibt der Spacer und der Eintrag ist `approximated` mit `Blank paragraph imported as a <N>px spacer; its box styling is not carried.` Ein verlorener Kasten und ein ungelesener Wert stehen im selben Satz (`Blank paragraph imported as a <N>px spacer; its box styling is not carried; line-height 2rem is not read, 1.2 is used.`). Ein leerer Paragraph, dessen leeres `<p>` eine eigene `font-size` oder `line-height` trägt, wird weiter aus `paragraph.style` bemessen. Diese Deklarationen werden nicht gelesen, die `note` erhält `its paragraph typography is not read`, und der Eintrag ist `approximated`. Ist weder `font-size` noch `line-height` gesetzt, bleibt der Eintrag `converted`. |
| Heading       | `title`                                                                     | Konvertiert                                                                                                                                                        |
| List          | `paragraph`                                                                 | Konvertiert                                                                                                                                                        |
| Image         | `image`                                                                     | Konvertiert                                                                                                                                                        |
| Button        | `button`                                                                    | Konvertiert (angenähert, wenn Zeichenabstand, eine nicht lesbare Zeilenhöhe oder eine nicht lesbare Breite nicht übernommen wird, wenn teilweiser Fettdruck in der Beschriftung nicht übernommen wird, oder wenn eine Prozentbreite geklemmt wird oder keine nutzbare Größe hat) |
| Divider       | `divider`, oder `spacer`, wenn er [keine Linie zeichnet](#undrawn-dividers) | Konvertiert (angenähert, wenn ein Divider mit Teilbreite links oder rechts ausgerichtet ist; übersprungen, wenn er keine Linie zeichnet und keinen Platz einnimmt) |
| Spacer        | `spacer`, so hoch wie `spacer.style.height` (BeeFrees Standard von 60px, wenn sie fehlt oder nicht lesbar ist)               | Konvertiert (übersprungen bei 0px Höhe)                                                                                                                            |
| Social        | `social`                                                                    | Konvertiert (angenähert, wenn ein Icon kein bekanntes Netzwerk ist: es bleibt in der Zeile als generisches Website-Icon, und sein Bild wird nicht übernommen) |
| Icons         | `image` für ein Icon ohne Text, mit nicht-leerem Bild und positiver px-Dateibreite und -höhe, sonst `html` ([Icons](#icons)) | Konvertiert oder HTML-Fallback |
| Addon         | der Block für das Payload, das es trägt ([Addons](#addons))                 | Wie dieses Modul                                                                                                                                                   |
| Empty         | keiner                                                                      | Übersprungen                                                                                                                                                       |
| Html          | `html`                                                                      | Konvertiert. Nicht-leerer Inhalt wird als `<div style="font-family:<body font>;font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center">…</div>` umschlossen. `font-family` ist die Schrift von `page.body` (`canonicalFontStack` von `page.body.content.style["font-family"]`, der Wert, der vor dem Arial-Fallback als `settings.fontFamily` gespeichert wird), mit für das doppelt gesetzte Attribut escapten Anführungszeichen, und entfällt, wenn der Body keine Schrift setzt. `font-size` ist `16px`, `line-height` ist `normal` und `word-break` ist `normal`: BeeFree setzt am HTML-Modul-Inhalt weder Größe noch Zeilenhöhe noch Wortumbruch, daher gelten die Browser-Standards, und `mj-text` überschreibt alle drei. Leerer Inhalt oder Inhalt nur aus Leerraum wird ohne diesen Wrapper übernommen |
| Menu          | `menu`                                                                      | Angenähert ([Menü](#menu))                                                                                                                                         |
| Video         | `video`                                                                     | Konvertiert (angenähert im Modus `embedded` oder `custom` oder bei einer Breite unter 100%; [Video](#video))                                                     |
| Table         | `table`                                                                     | Konvertiert (angenähert, wenn HTML in Zellen auf Klartext reduziert wird, die Kopfzeile anders gestaltet ist oder die Rahmen je Seite abweichen oder nicht durchgezogen sind; [Tabelle](#table)) |

Unbekannte Modultypen — Formulare eingeschlossen — werden als Fallback in HTML-Blöcke konvertiert und als `html-fallback` gemeldet. Inhalt des Blocks ist `descriptor.text.html`, `descriptor.html.html` oder `descriptor.heading.text` des Moduls, das erste gesetzte Feld. Fehlen alle drei, ist es ein Kommentar `<!-- Unsupported BeeFree module: <type> -->`, der nichts rendert.

Text- und List-Module setzen `paragraphSpacing` auf `0`: BeeFree-Textabsätze haben Margin 0, und eine fehlende Lücke würde mit 8px gerendert. Ein `<p>` mit explizitem px-`margin-bottom`, oder die untere Länge einer `margin`-Kurzschreibweise, setzt diese Lücke stattdessen. Eine Länge, die nicht in px ist, wird ignoriert. Die erste solche Länge gilt, wenn Absätze voneinander abweichen. `computedStyle.paragraphSpacing` eines Paragraph-Moduls (die Lücke, die BeeFree zwischen seinen Absätzen rendert, meist `16px`) setzt `paragraphSpacing` und hat Vorrang vor einem Margin im HTML. Ein `<p>` in einem Text-, Paragraph- oder List-Modul ohne Zeilenbox (kein Text außer ASCII-Leerraum, kein geschütztes Leerzeichen und kein `<br>`, `<img>` oder anderes ersetztes Element oder Void-Element) wird am Quell-HTML des Moduls entfernt, vor dem Style-Durchlauf und bevor Merge-Tag-`<code>`-Chips ausgepackt werden, nur wenn sein Teilbaum in beliebiger Tiefe mindestens ein Element außer `<span>` enthält (zum Beispiel `strong`, `b`, `em`, `i`, `u`, `s`, `code`, `a`, `sub`, `sup` oder `font`) und weder sein eigenes `style` noch das `style` eines Nachfahren einen Kasten zeichnet. Ein Nachfahre, dessen `style` `display` auf `inline-block` oder `block` setzt und dazu eine `width` und eine `height` ungleich null hat, zählt als Tinte. Ein leeres `<p>`, oder ein `<p>`, das nur verschachtelte leere `<span>`-Elemente enthält, bleibt unverändert: BeeFree zeichnet es als Leerzeile, und der Renderer füllt diesen Absatz. Ein leerer Merge-Tag-`<code>`-Chip steht dann noch im Quelltext, ist also ein Element außer `<span>`, und sein `<p>` wird entfernt. `<p>&nbsp;</p>`, `<p><br></p>`, ein `<p>` mit Text und ein `<p>`, dessen `style` einen Kasten zeichnet, bleiben. Padding, height, min-height und margin zeichnen, außer jeder Token ist null, `none` oder `hidden`. `border` sowie `border-top`, `border-right`, `border-bottom` und `border-left` zeichnen, außer ein Token ist eine Länge null oder `none` oder `hidden`: `border:1px solid red`, `border-top:2px dashed #000` und `border:solid` bleiben, `border:0 solid red` und `border:1px none red` nicht. `border-style` und `border-*-style` zeichnen, außer jeder Token ist `none` oder `hidden`, daher bleibt `border-style:solid`. `border-width`, `border-*-width`, `border-color`, `border-*-color`, `border-radius` und jede andere `border-*`-Langform zeichnen allein nicht. `padding: 0`, `border: none` und Typografie wie `font-size` oder `line-height` zählen nicht. Ein `<p>`, das innerhalb eines anderen `<p>` öffnet, bleibt unverändert. Das Markup bleibt, wenn das Entfernen keinen sichtbaren Inhalt hinterlässt: keinen Text außer ASCII-Leerraum, keine Zeichenreferenz, kein Zeilenbox-Element, kein `<p>`, dessen eigenes `style` einen Kasten zeichnet, und kein Element in einem `<p>`, dessen `style` einen Kasten zeichnet oder einen bemessenen Block zeichnet. Ein Absatz mit Kasten zählt, daher behält `<p style="height:20px"></p><p><em></em></p>` den ersten Absatz und verwirft den zweiten. Ein leeres Geschwister bleibt, daher behält `<p style="height:20px"></p><p></p>` beide.

Der `style` eines Text-, Paragraph- oder List-Moduls gilt für jede Blockwurzel in seinem HTML (`p`, `h1`–`h6`, `div`, `ul`, `ol`, `li`). `text-align`, `line-height` und `font-size` stehen am Element. Die Zeilenbox nutzt die Schriftgröße des Elements, und gerenderter Text ist standardmäßig 14px, daher würde eine Größe nur auf einem inneren Span jede Zeile höher machen als in BeeFree. `color`, ein CSS-`font-weight` (`normal`, `bold`, `bolder`, `lighter`, ein CSS-weites Schlüsselwort wie `inherit` oder eine Zahl von 1 bis 1000; der Importer verwirft jeden anderen Wert, auch eine `var()`-Referenz), `font-family`-Stacks mit höchstens 256 Zeichen, `letter-spacing` und dieselbe `font-size` umschließen den Text einer Wurzel, die keinen verschachtelten Block enthält. Ein längerer Font-Stack wird mit einer `approximated`-Notiz verworfen. Eine Deklaration, die das HTML an diesem Element bereits setzt, bleibt. `line-height` kommt vom Modul und ersetzt jedes `line-height` im HTML; ein Prozentwert wird als einheitenloses Verhältnis gespeichert (`120%` ist `1.2`, `200%` ist `2`). `letter-spacing` von `0` oder `normal` wird weggelassen. Ein `<a>` behält eine `color`, die es bereits setzt. Sonst wird `linkColor` oder `link-color` des Moduls, aus `style` und dann aus `computedStyle`, auf den Anker geschrieben. Fehlen beide, übernimmt der Link `settings.linkColor`.

Ein List-Modul schreibt zusätzlich BeeFrees List-Box inline auf jedes `<ul>`, `<ol>` und `<li>`, damit sie den List-Abstand des Renderers schlägt (8px an der Liste, 4px an einem Eintrag, 24px Einzug). `margin-top` und `margin-bottom` der Liste sind `0`, und `margin` jedes Eintrags ist `0`. `list-style-type` ist `revert`. `padding-left` ist die Hälfte von `computedStyle.liIndent` an der äußeren Liste und der volle Einzug an einer verschachtelten Liste (`40px`, wenn der Einzug fehlt, also 20px und 40px); eine Liste von rechts nach links nutzt `padding-right`. Ein `margin`, ein Padding oder ein Marker, den das HTML bereits setzt, bleibt. Eine Liste in einem Text- oder Paragraph-Modul bleibt, wie sie geschrieben ist.

### Buttons {#buttons}

Ein Button behält Farben, Radius, Padding, Schriftgröße, Schriftfamilie, Breite und Rahmen. Eine transparente Füllung wird als `"transparent"` importiert. Jede Seite nutzt zuerst ein lesbares, nicht negatives px-`padding-<side>`-Langformat, danach die entsprechende Seite eines lesbaren `padding`-Kurzformats mit einem bis vier Werten. Ein explizites `0px` bleibt 0. Ein Kurzformat mit einer negativen Seite wird vollständig verworfen; bei einem negativen Langformat bleibt der Wert des Kurzformats verfügbar. Für eine fehlende oder nicht lesbare Seite gelten 12px oben und unten beziehungsweise 24px links und rechts.

`font-weight` wird zu `fontWeight`: eine Zahl bis einschließlich 450 oder `normal` ist `"regular"` (400); von 451 bis 600, einschließlich `600`, ist `"medium"` (500); über 600 oder `bold` / `bolder` wird weggelassen, und die Beschriftung rendert fett (700). Bei gleichem Abstand gewinnt die leichtere Stufe. Wenn jeder Textabschnitt der Beschriftung, der nicht nur aus Leerzeichen besteht, durch `<strong>`, `<b>` oder ein Inline-`font-weight` von mindestens 600 fett ist, wird `fontWeight` unabhängig von der im Button-Stil angegebenen Schriftstärke weggelassen. Eine fehlende oder nicht lesbare Stärke wird sonst als `"regular"` importiert. Die Beschriftung wird zu Klartext. Ist nur ein Teil fett und die zugeordnete Stärke `"regular"` oder `"medium"`, geht diese Hervorhebung verloren, und eine `note` nennt die importierte Stärke des Buttons. Ein `letter-spacing` außer `0` oder `normal` wird nicht übernommen. Eine kurze `note` nennt, was fehlt, und das Modul wird als `approximated` gemeldet.

`lineHeight` ist die Zeilenhöhe der Beschriftung als Vielfaches der Schriftgröße, und sie gilt für jede Zeile einer umbrochenen Beschriftung. Ein Prozentwert ist diese Zahl geteilt durch 100 (`200%` ist `2`), eine einheitenlose Zahl ist sie selbst (`1.5` ist `1.5`), eine px-Länge ist diese Pixelzahl geteilt durch die Schriftgröße (`28px` bei 14px ist `2`), und eine `em`-Länge ist die Zahl selbst (`2em` ist `2`), gerundet auf zwei Dezimalstellen. Ein führender Punkt (`.5em`) wird gelesen. Ein Wert, der auf 1,2 rundet, einschließlich `120%` und `1.2em`, oder ein fehlender Wert lässt `lineHeight` ungesetzt, sodass die Beschriftung `BUTTON_LINE_HEIGHT` (1,2) behält und der Button konvertiert bleibt. Jeder andere explizite Wert, der nicht übernommen werden kann (`2rem`, `normal`, `calc(...)`, eine nicht positive Zahl), lässt `lineHeight` ebenfalls ungesetzt, und die Notiz enthält `line-height <value> is not carried`, sodass der Button angenähert ist. `buttonPadding` ist das gelesene Quell-Padding.

| BeeFree-`width`                                              | `ButtonBlock.width`                                                                              | Status      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------- |
| fehlt, oder `auto`                                           | weggelassen (Breite der Beschriftung)                                                            | Konvertiert |
| `100%`, einschließlich eines Anteils, der auf 100 rundet (`99.995%`) | `"full"`                                                                                         | Konvertiert |
| ein Prozentwert über 0 und unter 100, etwa `40%` oder `33.333%` | dieser Prozentwert, auf zwei Nachkommastellen gerundet, nachgestellte Nullen entfallen (`"40%"`, `"33.33%"`) | Konvertiert |
| über `100%`                                                  | `"full"`, mit der Notiz `width N% was clamped to 100%`                                           | Angenähert  |
| `0%` oder darunter, einschließlich eines Anteils, der auf 0 rundet (`0.004%`) | weggelassen, mit der Notiz `width N% has no usable size`                                         | Angenähert  |
| eine positive px-Breite                                      | diese Pixelzahl, gerundet                                                                        | Konvertiert |
| `0px`, oder jeder andere nicht-leere Wert außer `auto` (`2em`, `calc(...)`) | weggelassen (Breite der Beschriftung), mit der Notiz `width <value> is not carried` | Angenähert |

`style.width` ist die Breite. `button.percWidth` wird nicht gelesen. Ein Prozentwert ist ein Anteil der Inhaltsbox der Spalte, und MJML rendert ihn nativ, daher schrumpft der Button auf dem Smartphone mit seiner Spalte.

Die Position des Buttons in der Spalte ist das `text-align` des Moduls (`left`, `center` oder `right`), oder das `text-align` des Button-Styles, wenn das Modul keines setzt. `border-top`, `border-right`, `border-bottom` und `border-left` werden zu `border`. Eine Seite, die nichts zeichnet — Breite 0, `none`, `hidden` oder transparent — wird mit Breite 0 gespeichert. Zeichnet keine Seite, wird `border` weggelassen. Ein Stil außer `solid`, `dashed` oder `dotted` wird als `solid` importiert.

### Bildbreite {#image-width}

| BeeFree-Bild                                                   | `ImageBlock.width`                                          | Status      |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ----------- |
| `computedStyle.class` enthält `fullwidth`                      | `"full"`                                                    | Konvertiert |
| `computedStyle.width` schmaler als der Platz des Bildes        | die px-Zahl, gerundet                                       | Konvertiert |
| `computedStyle.width` so breit wie der Platz oder breiter      | `"full"`                                                    | Konvertiert |
| `computedStyle.width` ein Prozentwert unter `100%`, etwa `50%` | dieser Anteil des Platzes in px, gerundet, mit einer `note` | Angenähert  |
| `computedStyle.width` `100%` oder mehr                         | `"full"`                                                    | Konvertiert |
| kein `computedStyle.width`                                     | `image.width`, nach derselben Regel                         | Konvertiert |
| gar keine Breite                                               | `"full"`                                                    | Konvertiert |

`image.width` und `image.height` sind die Größe der Bilddatei, `computedStyle.width` ist die Breite, in der BeeFree das Bild zeigt, für beide Größenklassen von BeeFree: ein `fixedwidth`-Bild in der im Editor gesetzten Breite, ein `autowidth`-Bild in der Breite seiner Datei, begrenzt auf die Spalte. Ältere Exporte schreiben `computedStyle.width` als Pixelzahl (`187.5`) und versehen ein Bild, das seine Spalte füllt, mit der Klasse `fullwidth`. Deren berechnete Breite lässt das Padding der Spalte aus, deshalb entscheidet die Klasse. Der Platz des Bildes ist die px-Breite seiner Spalte abzüglich des linken und rechten Paddings des Bildes. Diese Breite ist der Anteil der Spalte an `settings.width`: die px des Presets oder `columnWidths`, wenn die Zeile sie setzt. Das Spalten-Padding wird dem Modul hinzugefügt, nachdem die Breite gewählt ist. `ImageBlock` speichert px, die auf einem Smartphone ihre Größe behalten, wo ein Prozentwert mit der Spalte schrumpfen würde; deshalb wird eine Prozentbreite als `approximated` gemeldet. `image.height` wird nicht importiert, sodass das Bild in der angezeigten Breite das Seitenverhältnis der Datei behält. Ein Bild ohne `text-align` übernimmt seine Ausrichtung aus `computedStyle.class` (`left`, `center` oder `right`).

BeeFree behält auf dem Smartphone die Desktop-Breite eines Bildes, das in einer Spalte schmaler als die E-Mail sitzt. Der Import setzt `fluidOnMobile` bei einem solchen Bild auf `false`, wenn es diese Spalte füllt, sodass es nicht auf die gestapelte Spalte wächst. Ein Bild in einer zeilenbreiten Spalte und eines, das seine Spalte nicht füllt, lässt `fluidOnMobile` weg. Siehe [Breite auf Smartphones](/de/guide/images#width-on-phones).

### Divider-Breite

| BeeFree-`width`                                                    | `DividerBlock.width`                                    | Status      |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ----------- |
| fehlt, oder `100%`                                                 | `"full"`                                                | Konvertiert |
| ein Prozentwert unter `100%`, etwa `50%`                           | derselbe Prozentwert auf zwei Nachkommastellen, `"50%"` | Konvertiert |
| unter `0%` oder über `100%`                                        | begrenzt auf `"0%"` bzw. `"full"`                       | Angenähert  |
| px, schmaler als die Inhaltsbreite der eigenen Spalte              | die px-Zahl                                             | Konvertiert |
| px, so breit wie die Inhaltsbreite der eigenen Spalte oder breiter | `"full"`                                                | Konvertiert |
| eine negative px-Breite                                            | `0`                                                     | Angenähert  |
| jeder andere Wert                                                  | `"full"`                                                | Angenähert  |

Die Inhaltsbreite einer Spalte ist ihr Anteil an `settings.width` gemäß dem Spaltenlayout der Section oder gemäß `columnWidths`, wenn die Zeile sie setzt, abzüglich des linken und rechten Paddings des Dividers. Eine Zeile mit fünf oder mehr Spalten wird auf eine Spalte reduziert, und ihre Module nehmen die ganze `settings.width` ein. Eine vierspaltige Zeile behält vier Spalten. Die Warnung nennt eine Zeile mit fünf oder mehr Spalten.

Templatical zentriert jeden Divider. Ein Divider mit Teilbreite, den BeeFree links oder rechts ausrichtet (`computedStyle.align`), ist angenähert; seine `note` nennt die Ausrichtung.

### Divider ohne Linie {#undrawn-dividers}

Ein Divider zeichnet keine Linie, wenn sein `border-top` 0 breit ist, `none` oder `hidden` ist oder transparent ist: `transparent` oder eine Farbe mit Alpha 0 wie `rgba(0, 0, 0, 0)` oder `#ffffff00`. BeeFree-Vorlagen nutzen solche Divider als Abstand.

| BeeFree-Divider                                                             | Ergebnis                        | Status                                            |
| --------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| zeichnet eine Linie                                                         | `divider`, nach den Regeln oben | Konvertiert                                       |
| zeichnet keine Linie, Padding und transparenter Rahmen ergeben mehr als 0px | `spacer`                        | Konvertiert, mit einer `note`, die die Höhe nennt |
| zeichnet keine Linie und nimmt keinen Platz ein                             | kein Block                      | Übersprungen                                      |

Die `height` des Spacers ist das `padding-top` des Dividers plus `padding-bottom` plus die Breite eines transparenten Rahmens. Ein Rahmen mit `none` oder `hidden` nimmt keinen Platz ein, seine Breite zählt also nicht. Ein Spacer rendert kein Padding, deshalb ist sein eigenes Padding 0, und die `background-color` des Dividers wird übernommen. Ein Divider ganz ohne `border-top` wird als durchgezogene schwarze Linie von 1px importiert.

### Icons {#icons}

Das Icons-Modul (`mailup-bee-newsletter-modules-icons`) zeigt eine Reihe von Icons, jedes mit optionalem Text. BeeFree zeichnet jedes Icon in der Höhe `computedStyle.iconHeight` (32px, wenn nicht gesetzt), mit einer Breite nach der Dateigröße in `width` und `height` des Icons, innerhalb des Paddings aus `computedStyle.iconSpacing`.

| Icons-Modul                                                | Ergebnis                                         | Status                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| ein Icon, kein Text, nicht-leeres Bild, positive px-`width` und `height` | `image` in der Icon-Höhe                         | Konvertiert                                                            |
| mehrere Icons, Text oder ein Icon ohne Bild oder ohne positive px-`width` oder `height` | `html`: eine Tabelle mit den Icons nebeneinander | HTML-Fallback, mit der `note` `Icons module rebuilt as an HTML table.` |
| keine Icons                                                | kein Block                                       | Übersprungen                                                           |

Das Bild behält `alt` des Icons und verlinkt auf dessen `href`. Es steht, wo `text-align` des Moduls es hinsetzt, sein Padding ist das Padding des Moduls plus `iconSpacing`, und die Dateigröße wird zu `naturalWidth` und `naturalHeight`.

Die Tabelle setzt den `text` jedes Icons auf die Seite, die `textPosition` nennt (`left`, `right`, `top` oder `bottom`), in `color`, `font-family`, `font-size` und `font-weight` des Moduls, mit `computedStyle.itemsSpacing` zwischen den Icons. Icon und Text verlinken auf `href` und öffnen sich in `target`. Templatical hat keinen Block, der Icons in einer Reihe anordnet, deshalb wird die Tabelle als HTML bearbeitet.

Beide Ergebnisse verwerfen `href` oder `image` eines Icons, wenn die HTML-URL-Regel des Editors (`isSafeHtmlUrl` in `@templatical/types`) sie ablehnt, etwa eine `javascript:`-, `vbscript:`- oder Nicht-Bild-`data:`-URL, und fügen einen Eintrag in `report.warnings` hinzu, der sie nennt. Die Tabelle ist Markup, das der Importer schreibt, und ein HTML-Block wird unbereinigt gerendert.

### Addons {#addons}

Ein Addon-Modul (`mailup-bee-newsletter-modules-addon`) behält das Payload des Moduls, für das es steht. Es wird deshalb wie dieses Modul konvertiert: Das Payload bestimmt den Block und seinen Status. Sein Berichtseintrag behält `beeFreeModuleType: "mailup-bee-newsletter-modules-addon"`. Der Importer sucht diese Payloads im Descriptor, in dieser Reihenfolge:

| Payload                 | Konvertiert als |
| ----------------------- | --------------- |
| `image`                 | Image           |
| `html`                  | Html            |
| `heading`               | Heading         |
| `paragraph` oder `text` | Paragraph       |
| `list`                  | List            |
| `button`                | Button          |
| `divider`               | Divider         |
| `menuItemsList`         | Menu            |
| `iconsList`             | Icons           |

Ein Bild-Addon verlinkt nur auf `image.href`. Das GIPHY-Addon schreibt zusätzlich `image.url`, die Seite des GIFs auf giphy.com; sie wird nicht importiert. Ein Addon ohne eines dieser Payloads wird zum Kommentar `<!-- Unsupported BeeFree module: … -->` und als `html-fallback` gemeldet. Das Bild-Payload ist an einem echten GIPHY-Export geprüft; die übrigen folgen BeeFrees [Addon-Inhaltstypen](https://docs.beefree.io/beefree-sdk/builder-addons/custom-addons/custom-addon-types).

### Menü {#menu}

Die Einträge eines Menu-Moduls stehen in `descriptor.menuItemsList.items`. Der `text` eines Eintrags wird zum Eintragstext, `link.href` zu seiner URL (`#`, wenn leer), und `link.target: "_blank"` öffnet ihn in einem neuen Tab. `link.title` wird nicht übernommen.

| BeeFree                          | Menu-Block                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `style.font-size`                | `fontSize`; 15px, wenn fehlend oder unlesbar, und `0px` bleibt 0                                               |
| `style.color`                    | `color` und `separatorColor`; ohne Farbe übernimmt das Trennzeichen die Textfarbe des Templates                |
| `computedStyle.linkColor`        | `linkColor`                                                                                                    |
| `style.font-family`              | `fontFamily`                                                                                                   |
| `style.text-align`               | `textAlign`; `center`, wenn nicht gesetzt                                                                      |
| `computedStyle.separator`        | `separator`; keines (`""`), wenn BeeFree keines schreibt, da BeeFree dann keines zeichnet                      |
| `computedStyle.menuItemsSpacing` | `spacing`: die Hälfte von `padding-left` plus `padding-right`, damit der Abstand zwischen Einträgen gleich bleibt. Eine unlesbare Seite zählt als 0; ist keine Seite lesbar, 10px |
| `style.padding-*`                | `styles.padding`                                                                                               |

Ein Menü ist immer `approximated`: Das obere und untere Padding der Einträge, das mobile Hamburger-Menü (`computedStyle.hamburger`) und Link-Titel haben kein Feld im Menu-Block. Ein `computedStyle.layout` mit dem Wert `vertical` wird horizontal importiert, mit der `note` `BeeFree's vertical menu layout was imported horizontal.`

### Tabelle {#table}

Die Zeilen eines Table-Moduls sind `table.content.headers`, gefolgt von `table.content.rows`. Das `html` jeder Zelle wird auf Klartext reduziert, mit einem Leerzeichen, wo ein Absatz oder Zeilenumbruch endete; geht dabei Markup verloren, ist die Tabelle `approximated` und `report.warnings` nennt es. Das Zellen-Padding behält den Standardwert 8px, da BeeFree keine Einstellung dafür hat.

- **Kopfzeile** -- Der erste Eintrag von `headers` wird zu Zeile 0 mit `hasHeaderRow: true`, und `table.computedStyle.headersBackgroundColor` wird zu `headerBackgroundColor`. Templatical zeichnet die Kopfzeile fett in Farbe, Größe und Ausrichtung des Tabellenkörpers. Ein angegebenes `headersFontWeight` unter 600 oder ein `headersColor`, `headersFontSize` oder `headersTextAlign`, das vom Tabellenkörper abweicht, macht die Tabelle `approximated` mit einer `note`, die sie nennt, etwa `Header row font weight 400, color #505659 not kept; Templatical draws the header bold in the body's color, size and alignment.` Weitere Kopfzeilen werden als normale Zeilen importiert, `approximated`. Ein leeres `headers` ergibt `hasHeaderRow: false`.
- **Rahmen** -- `border-top`, `border-right`, `border-bottom` und `border-left` in `table.style` werden zu einem `borderWidth` und `borderColor` für jede Zellkante. Vier gleiche Seiten behalten ihre Breite und Farbe. Abweichende Seiten, auch eine Seite, die BeeFree weglässt, übernehmen die breiteste gezeichnete Seite, `approximated`. Ohne gezeichnete Seite (0 breit, `none`, `hidden` oder transparent) ist `borderWidth` 0. Ohne jeden Rahmenschlüssel gilt der Standard 1px `#e0e0e0`. Ein `dashed`- oder `dotted`-Rahmen wird durchgezogen gezeichnet, `approximated`.
- **Text** -- `font-size` (15px, wenn fehlend oder unlesbar; `0px` bleibt 0), `color`, `font-family` und `text-align` in `table.style` werden dem Block zugeordnet. `alternateRowBackgroundColor`, `linkColor`, `background-color`, `font-weight`, `line-height`, `letter-spacing` und `direction` haben kein Feld im Table-Block.

### Video {#video}

`video.src` eines Video-Moduls wird zu `url`, und `video.thumbAlt` wird zu `alt`. Die Ausrichtung ist `left`, `center` oder `right` in `computedStyle.class`, sonst `center`.

- **Modus** -- Im Modus `thumbnail` wird `video.thumbSrc` zu `thumbnailUrl`, `converted`. BeeFrees Play-Icon (`iconSrc`) zeichnet der Standard-Renderer nicht. `embedded` und `custom` spielen das Video an Ort und Stelle ab und haben kein Vorschaubild, daher ist der Block `approximated` mit leerem `thumbnailUrl`, und der Renderer leitet für YouTube- und Vimeo-Links ein Vorschaubild ab. Ein Video ohne Vorschaubild mit einem anderen Link rendert nichts, und `report.warnings` nennt es.
- **Breite** -- `computedStyle.width`, sonst `style.width`, folgt der Regel für die [Bildbreite](#image-width). 100% oder mehr, fehlend oder unlesbar ergibt `"full"`. Ein Prozentwert unter 100% wird zu px des verfügbaren Raums, `approximated`, mit einer `note` wie `Video width 50% was converted to 290px.` Eine px-Breite, die den Raum erreicht, ergibt `"full"`.

## Konvertierung von Spaltenlayouts {#column-layout-conversion}

BeeFree organisiert Inhalte in Zeilen mit Spalten. Diese werden einem Templatical-`SectionBlock` mit dem entsprechenden `ColumnLayout` zugeordnet:

| BeeFree-Spalten    | Templatical-Layout |
| ------------------ | ------------------ |
| 1 Spalte (100%)    | `'1'`              |
| 2 gleiche Spalten  | `'2'`              |
| 3 gleiche Spalten  | `'3'`              |
| 2 Spalten (~33/66) | `'1-2'`            |
| 2 Spalten (~66/33) | `'2-1'`            |
| 2 Spalten (25/75)  | `'1-3'`            |
| 2 Spalten (75/25)  | `'3-1'`            |
| 3 Spalten (25/50/25) | `'1-2-1'`        |
| 4 gleiche Spalten  | `'4'`              |

Ein Verhältnis, das einem Preset entspricht, behält dieses Layout und setzt kein `columnWidths`. `6-6` ist `2`, ein gleichmäßiges `4-4-4` ist `3`, ein gleichmäßiges `3-3-3-3` ist `4`, `8-4` ist `2-1`, `4-8` ist `1-2`, `9-3` ist `3-1`, `3-9` ist `1-3` und `3-6-3` ist `1-2-1`. Jedes andere Verhältnis von zwei, drei oder vier Spalten behält das gleichmäßige Layout dieser Anzahl (`2`, `3` oder `4`) und setzt `columnWidths` auf die auf 100 skalierten Anteile. `6-4-2` ist `[50, 33.33, 16.67]`, `3-3-6` ist `[25, 25, 50]`, `6-2-2-2` ist `[50, 16.67, 16.67, 16.66]`, `5-7` ist `[41.67, 58.33]`, `7-5` ist `[58.33, 41.67]`, `4-3-5` ist `[33.33, 25, 41.67]` und `2-8-2` ist `[16.67, 66.67, 16.66]`. Der Import gibt für dieses Verhältnis keine Warnung aus. Ein Anteil, der nicht über 0 liegt, lässt das gleichmäßige Layout ohne `columnWidths`. Wenn diese Anteile zusammen mehr als 0 ergeben, nennt eine Warnung das Verhältnis: `Row with 3 columns (6-0-6) was kept as an even split. A share that is not above 0 cannot be stored as column widths.` Eine Zeile, deren Anteile 0 oder weniger ergeben, erhält keine Warnung. Eine Zeile mit fünf oder mehr Spalten wird auf eine Spalte reduziert; die Warnung nennt dieses Verhältnis (`3-3-3-3-3`).

Padding, Hintergrund und Rahmen einer Spalte liegen auf der Spalte. Eine einspaltige Zeile übernimmt das Padding in das Sektions-Padding (addiert zum eigenen Padding der Zeile, das nicht importiert wird und daher bei 0 beginnt), nutzt die `background-color` der Spalte, wenn sie gesetzt ist, sonst den Inhaltshintergrund der Zeile, und bildet `border-top` / `border-right` / `border-bottom` / `border-left` auf den Rahmen der Sektion ab. Die Zeile wird in eine einspaltige Sektion gehüllt, sobald eines davon gesetzt ist. Padding, das nicht in px ist oder negativ ist, wird ignoriert. Ein Rahmenstil außer `solid`, `dashed` oder `dotted` wird als `solid` importiert.

Eine mehrspaltige Zeile, auch eine von fünf oder mehr Spalten auf eine Spalte reduzierte, addiert das Padding jeder Spalte zu ihren Modulen: links und rechts an jedem Modul, oben am ersten, unten am letzten.

In einer Zeile mit zwei bis vier Spalten wird der gezeichnete linke Rahmen der ersten Spalte zum linken Sektionsrahmen und der gezeichnete rechte Rahmen der letzten Spalte zum rechten Sektionsrahmen. Ein oberer oder unterer Rahmen wird zum Sektionsrahmen, wenn jede Spalte diese Seite mit derselben Breite, demselben Stil und derselben Farbe zeichnet. Für die Übernahme muss mindestens eine Spaltenseite gezeichnet sein; keine Spalte darf einen sichtbaren Hintergrund oder einen gezeichneten inneren Rahmen haben, ein oberer oder unterer Rahmen darf sich zwischen den Spalten nicht unterscheiden, und es darf keine Überschneidung mit einer gezeichneten Seite des Zeilenrahmens geben. Trifft eine dieser Bedingungen nicht zu, werden alle Seiten verworfen, auch die äußeren linken und rechten Kanten. Übernommene Rahmen lösen keine Spaltenbox-Warnung aus. Andernfalls werden Spaltenhintergründe und -rahmen mit einem `report.warnings`-Eintrag pro Zeile verworfen: `Column background/border was dropped; a multi-column row has no per-column box.` Eine von fünf oder mehr Spalten auf eine Spalte reduzierte Zeile behält dieses Verhalten. Ein transparenter Hintergrund oder ein Rahmen, der nichts zeichnet, warnt nicht. Wenn sich die Spalten auf dem Telefon stapeln, zeichnet BeeFree die linke Kante nur neben der ersten Spalte und die rechte nur neben der letzten, und ein oberer oder unterer Rahmen, den jede Spalte zeichnet, erscheint auch zwischen den gestapelten Spalten. Der Sektionsrahmen umschließt den gesamten Stapel ohne Linien zwischen den Spalten, und der Import gibt dafür keine Warnung aus.

## Template-Einstellungen

Globale Template-Einstellungen werden soweit möglich konvertiert:

- **Breite** -- `page.body.content.computedStyle.messageWidth` wird `settings.width` zugeordnet, mit `page.body.content.style.width` als Fallback und 600, wenn keines von beiden gesetzt ist
- **Hintergrundfarbe** -- `page.body.content.style.background-color` wird `settings.backgroundColor` zugeordnet, mit `page.body.container.style.background-color` als Fallback und `#ffffff`, wenn keines von beiden gesetzt ist. Das `content.style.background-color` einer Zeile wird zur `backgroundColor` ihrer Sektion (die innere Box); eine einspaltige Zeile mit Hintergrundfarbe wird in eine einspaltige Sektion gehüllt, damit die Farbe erhalten bleibt. Die eigene `background-color` einer einzelnen Spalte ersetzt sie, wenn sie gesetzt ist. Das `container.style.background-color` einer Zeile — das Band außerhalb dieser Box — wird zu `section.wrapper.backgroundColor` mit `wrapper.fullWidth: true`. Das Band läuft bis zum Fensterrand, und die Füllung der Sektion bleibt die Inhaltsfarbe, sodass der Inhalt in der Inhaltsbox bleibt. Der Wrapper entfällt, wenn das Band transparent ist oder dieselbe Farbe hat wie die Sektionsfüllung und der Container kein Bild hat.
- **Sichtbarkeit der Zeile** -- `content.computedStyle.hideContentOnMobile` und `hideContentOnDesktop` setzen die `visibility` der Sektion (`{ desktop, mobile }`). Eines der beiden Flags hüllt die Zeile in eine Sektion. Sind beide nicht gesetzt oder false, bleibt `visibility` ungesetzt.
- **Sichtbarkeit des Moduls** -- `descriptor.computedStyle.hideContentOnMobile` und `hideContentOnDesktop` setzen `visibility` (`{ desktop: !hideContentOnDesktop, mobile: !hideContentOnMobile }`) auf dem Block des Moduls und auf jedem zusätzlichen Block, den dasselbe Modul erzeugt. `true` oder `"true"` blendet diese Seite aus. Sind beide nicht gesetzt oder false, bleibt `visibility` ungesetzt. `hideContentOnAmp` und `hideContentOnHtml` werden ignoriert.
- **Stapeln auf Mobilgeräten** -- `content.computedStyle.rowColStackOnMobile: false` setzt `stackOnMobile: false` auf einer mehrspaltigen Sektion, sodass die Spalten auf dem Telefon nebeneinander bleiben. `true` oder ein fehlendes Flag lässt `stackOnMobile` ungesetzt, und die Spalten stapeln sich. Bei einer einspaltigen Zeile oder einer von fünf oder mehr Spalten auf eine Spalte reduzierten Zeile wird das Flag mit einer Warnung verworfen: `rowColStackOnMobile false was dropped; Templatical keeps columns side by side only on a multi-column section.`
- **Zeilenbreite** -- `content.style.width` ist die Inhaltsbox. Eine px-Breite ungleich `settings.width`, oder eine Breite, die nicht in px ist, erzeugt eine Warnung, die beide nennt, und lässt die Sektion auf der E-Mail-Breite. Eine Sektion hat keine eigene Breite.
- **Zeilenrahmen** -- `border-top`, `border-right`, `border-bottom` und `border-left` im `content.style` werden mit denselben Regeln wie ein Spaltenrahmen auf den Rahmen der Sektion abgebildet. Bei einer einspaltigen Zeile gewinnt der Spaltenrahmen, wenn beide zeichnen und sich unterscheiden, mit einer Warnung: `Row border was dropped; the column border is kept on the section.` In einer mehrspaltigen Zeile werden gezeichnete Seiten des Zeilenrahmens ohne Warnung mit übernommenen Spaltenseiten verbunden, wenn sie sich nicht überschneiden. Bei einer Überschneidung bleibt der Zeilenrahmen erhalten und die Spaltenrahmen werden mit der Spaltenbox-Warnung verworfen.
- **Hintergrundbilder** -- Das `background-image` im `content.style` einer Zeile wird zum `backgroundImage` ihrer Sektion, mit `background-size`, `background-position` und `background-repeat` (wo nicht gesetzt, mit den CSS-Anfangswerten), und hüllt eine einspaltige Zeile wie eine Farbe in eine Sektion. Das Bild des Bands im `container.style` wird zu `wrapper.backgroundImage` mit `wrapper.fullWidth: true`, auch hinter einer bemalten Inhaltsfläche. Ein Inhaltsbild bleibt auf der Sektion. Eine Größe, die eine Seite füllt (`100%` oder eine px-Breite mindestens so groß wie die E-Mail), wird `cover`, jede andere Länge oder Prozentangabe `auto`; eine Prozent-Position rastet auf das nächste von links, Mitte und rechts (oben, Mitte und unten) ein; `repeat-x` und `repeat-y` werden zu `repeat`. `report.warnings` nennt jeden Wert ohne exaktes Schlüsselwort.
- **Textfarbe** -- `page.body.content.style.color` wird `settings.textColor` zugeordnet, `#1a1a1a`, wenn sie nicht gesetzt ist. Text-, Paragraph-, List-, Heading-, Menu- und Table-Module ohne eigene Farbe übernehmen sie.
- **Links** -- `page.body.content.computedStyle.linkColor` wird `settings.linkColor` zugeordnet. `settings.linkUnderline` ist `true`: BeeFree setzt Unterstreichungen pro Link, im Markup des jeweiligen Links.
- **Schriftfamilie** -- Die Standard-Schriftfamilie wird in `settings.fontFamily` übernommen. Der gesamte Stack wird übernommen, sodass seine Fallbacks erhalten bleiben; ein Stack, der genau dem einer eingebauten Schriftart entspricht (`Arial, sans-serif`), wird als bloßer Name gespeichert. Ein Modul, dessen `font-family` `inherit`, `initial`, `unset` oder `revert` ist, setzt keine eigene Schrift und übernimmt `settings.fontFamily`. Eine Überschrift behält diese Familie, dazu Farbe und Ausrichtung (aus dem Heading-Style, dann dem Heading-Tag, dann dem Modul). Der Title-Block hat keine Felder für Schriftgröße, Gewicht, Zeilenhöhe oder Zeichenabstand, daher werden `font-size`, `font-weight`, `line-height` und `letter-spacing` einer Überschrift auf den Text geschrieben und überschreiben die Größe der Ebene, die fette Stärke und die Zeilenhöhe 1.3. Die Ebene ist die nächste von h1–h4 (36, 28, 22 und 18px) zu dieser Schriftgröße — dem Modul-Style, oder der `font-size` am Heading-Tag, wenn der Style sie auslässt — und bei Gleichstand bleibt die Quell-Ebene, sodass die Zeilenbox der Größe folgt. Liegt die gewählte Größe mehr als 1px daneben, wird der Block als angenähert gemeldet (`h4 chosen for 16px (source h1); line box differs`). Eine prozentuale Zeilenhöhe wird ein einheitenloses Verhältnis. `letter-spacing` von `0` oder `normal` wird weggelassen. Eine `font-size` am Heading-Tag bleibt, wenn der Style sie auslässt.
- **Merge-Tags** -- HTML-Zeichenreferenzen innerhalb von <code v-pre>{{ }}</code>, `{% %}` und `{# #}` werden in jeder übernommenen Zeichenkette dekodiert: Rich Text, Überschriften, Button-Beschriftungen, Links und Bildadressen, Alt-Texte, HTML und der Preheader. `&#39;` wird zu `'`, `&quot;` zu einem Anführungszeichen, `&gt;` zu `>`, `&amp;` zu `&` und `&nbsp;` zu einem normalen Leerzeichen (Twig liest ein geschütztes Leerzeichen nicht als Leerraum). Ein doppeltes Anführungszeichen innerhalb eines Tokens in einem HTML-Attribut bleibt als `&quot;` kodiert. Dieselben Referenzen außerhalb eines Tokens bleiben im Rich Text kodiert, außer einem verdoppelten `&amp;nbsp;` (und `&amp;#160;` / `&amp;#xa0;`), das als einzelne Referenz zurückgeschrieben wird. Eine Button-Beschriftung und eine Tabellenzelle sind Klartext, daher werden Referenzen dort ebenfalls dekodiert: der Renderer maskiert die Beschriftung, und ein kodiertes `&nbsp;` erschiene sonst als die Buchstaben `&amp;nbsp;`. Ein Token ohne schließendes Begrenzungszeichen bleibt unverändert. Ein `<code data-bee-type="mergetag">`-Wrapper um ein Merge-Tag in Text, einer Überschrift, einer Liste oder einer Button-Beschriftung wird entfernt und das Token darin bleibt erhalten; ein `<code data-bee-type="speciallink">`-Link-Chip wird entfernt und sein inneres HTML, einschließlich des Links, bleibt unverändert erhalten, wie in BeeFrees eigenem Export; jedes andere `<code>` bleibt stehen. Ein Chip, der nur Leerraum enthält, behält jedes geschützte Leerzeichen (U+00A0 oder eine Referenz, die dazu dekodiert: `&nbsp;`, `&#160;`, `&#xa0;`, beliebige Groß- und Kleinschreibung) als `&nbsp;` und schreibt jede Folge anderen Leerraums als ein normales Leerzeichen, in der Reihenfolge der Quelle. Ein Chip, der nur aus normalem Leerraum besteht, wird zu einem normalen Leerzeichen. Der Chip steht außerhalb jedes <code v-pre>{{ }}</code>- oder `{% %}`-Tokens. Ein Chip mit genau einem Token verwirft ein führendes normales Leerzeichen, behält ein führendes geschütztes Leerzeichen und behält ein Leerzeichen nach dem Token. Ein `<code>`, das nur ein Token hervorhebt, verwirft dasselbe normale führende Leerzeichen, und das `<code>` bleibt stehen.

## Bekannte Einschränkungen

- **Benutzerdefinierte Schriftarten** -- `customFonts` im Ergebnis listet jede BeeFree-Webschrift mit URL. Geben Sie das Array an die Editor-Option `fonts.customFonts` und an `renderToMjml`, sonst fällt die Schrift zurück. Eine vom Template genutzte Schrift ohne URL, die kein System-Stack ist, wird in `report.warnings` genannt.
- **Bedingte Anzeige** -- BeeFrees Regeln für dynamische Inhalte haben kein direktes Äquivalent und werden während der Konvertierung verworfen.
- **Icons** -- Ein Icons-Modul wird zu einer HTML-Tabelle, die als HTML bearbeitet wird, es sei denn, es ist genau ein Icon ohne Text, mit nicht-leerem Bild und positiver px-Dateibreite und -höhe ([Icons](#icons)). In einem Social-Modul wird die Plattform aus der Icon-Id gelesen, dann aus Name, Alt-Text, Titel oder dem Host des Links. Xing (`xing`, auch ein Host `xing.com`) wird auf die Plattform `xing` abgebildet. Ein Icon, das kein bekanntes Netzwerk ist, auch eines mit `type` `custom`, bleibt in derselben Zeile als Plattform `website`, mit dem Link, den diese Zuordnung bereits berechnet (das Präfix eingeschlossen, verworfen, wenn `isSafeHtmlUrl` ihn ablehnt). Sein Bild wird nicht übernommen, und die Notiz nennt es nach Titel, dann Alt-Text, dann Name. Das `text-align` der Zeile wird `align`. Der Abstand zwischen Icons ist links plus rechts von `computedStyle.padding`. `iconsDefaultWidth` wählt das nächste von small (24px), medium (32px) und large (48px). Ein Icon-Set in der Datei-URL wird abgebildet, wenn die Form passt (`circle`, `rounded` oder `square`); ein schwarzes oder weißes Set setzt den dunklen oder hellen Ton, und `circle-dark-gray` nutzt den dunklen Ton. Ein Set ohne passende Form bleibt bei den farbigen Standard-Icons und wird als `approximated` gemeldet. Ein unbekanntes Set `circle-*`, `rounded-*` oder `square-*`/`squared-*` übernimmt diese Form in Markenfarben und wird als `approximated` gemeldet. Das untere Padding des Social-Blocks erhält 4px, weil BeeFrees Inline-Block-Icon-Tabelle einen 4px-Zeilenbox-Steg unter den Icons lässt und die Spaltenzelle von MJML `font-size:0px` setzt.
- **Formulare** -- BeeFrees Formularmodule haben kein Templatical-Äquivalent. Jedes wird zu einem HTML-Block mit Status `html-fallback`; Felder und Absende-Aktion des Formulars werden nicht nachgebildet.
- **Spaltenbox in mehrspaltigen Zeilen** -- Padding wird in die Module übernommen. Ein sichtbarer Hintergrund oder ein gezeichneter Rahmen, der nicht zum Sektionsrahmen werden kann, wird mit einer Warnung pro Zeile verworfen (siehe [Konvertierung von Spaltenlayouts](#column-layout-conversion)). Ein Spacer ignoriert `styles.padding`, daher rendert Spalten-Padding, das auf einen Spacer gelegt wurde, nicht.
- **Mobiler Breakpoint** -- BeeFree stapelt bei `messageWidth + 20` (620px, wenn die E-Mail 600px breit ist). Templatical behält den MJML-Breakpoint von 480px. Der Import ändert ihn nicht.

## Konvertierte Templates überprüfen

Überprüfen Sie nach der Konvertierung die Ausgabe im Editor auf:

1. Fehlende Bilder (bei Bedarf erneut hochladen oder URLs aktualisieren)
2. Schriftrendering (`customFonts` an die Editor-Option `fonts` und an `renderToMjml` übergeben)
3. Spaltenproportionen (passen Sie Layouts an, wenn die automatische Zuordnung nicht passt)
4. Abstände und Padding (Feinabstimmung im Block-Einstellungsbereich)
