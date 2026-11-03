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
npm install @templatical/import-beefree
```

```bash [pnpm]
pnpm add @templatical/import-beefree
```

```bash [yarn]
yarn add @templatical/import-beefree
```

```bash [bun]
bun add @templatical/import-beefree
```

:::

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertBeeFreeTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-beefree/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung {#usage}

```ts
import { convertBeeFreeTemplate } from '@templatical/import-beefree';

// Laden Sie Ihr BeeFree-Template-JSON
const res = await fetch('/api/beefree-templates/123');
const beefreeJson = await res.json();

// In das Templatical-Format konvertieren
const { content, report } = convertBeeFreeTemplate(beefreeJson);

// Im Editor verwenden
const editor = await init({
  container: '#editor',
  content,
});

// Den Konvertierungsbericht auf etwaige Probleme prüfen
console.log(report);
```

[Im Playground öffnen](https://play.templatical.com/scenes/import-beefree)

Die Funktion gibt ein `ImportResult` zurück mit:
- `content` — den konvertierten `TemplateContent`, bereit für den Editor
- `report` — einen Konvertierungsbericht mit dem Status jedes Blocks (`converted`, `approximated`, `html-fallback` oder `skipped`)

| Status | Bedeutung |
|---|---|
| `converted` | Ohne Verlust auf einen Templatical-Block abgebildet. |
| `approximated` | Abgebildet, mit Clamp oder Flatten — `note` sagt, was sich geändert hat. |
| `html-fallback` | Kein Block-Äquivalent — ein unbekannter Modultyp (Formulare eingeschlossen), ein [Icons](#icons)-Modul, das nicht genau ein Icon ohne Text enthält, oder ein [Addon](#addons) ohne Payload, das der Importer liest. Die Ausgabe ist ein `HtmlBlock`; seinen Inhalt beschreibt die [Block-Zuordnung](#block-zuordnung). |
| `skipped` | Keine Ausgabe, und `templaticalBlockType` ist `null`: ein leeres Modul, ein Icons-Modul ohne Icons oder ein [Divider ohne Linie](#undrawn-dividers), der keinen Platz einnimmt. |

Das JSON, das BeeFrees Editor speichert (`page.rows`), ist die Eingabe. Ein kompiliertes HTML-Export ist ein anderes Envelope — [`@templatical/import-html`](/de/guide/migration-from-html).

## Sprachen {#languages}

Die Standardsprache stammt aus `language.value` bei `page.body.language`, `page.language`, dann der Wurzel, in dieser Reihenfolge. Übersetzungen in Modul-Deskriptoren (oder am Modul) werden zu `l10n`-Text: Heading `text`, Paragraph/List `html`, Button `label`, Image `alt`, Video `thumbAlt` sowie Menüeinträge `text` nach Position. Bei abweichender Anzahl der Menüeinträge entfällt die Menüübersetzung mit Warnung. `head.meta.preheader` liefert den Standard-Preheader; `head.meta.translations[locale].preheader` liefert seine Übersetzung.

Übersetzte `subject`, `title` und `description` bleiben beim Host und erzeugen Warnungen. Unbekannte Übersetzungsschlüssel, einschließlich URL- oder Bildquellenschlüssel, warnen einmal pro Schlüssel und Sprache. Übersetzungen für HTML-Fallbacks werden mit Warnung verworfen.

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

| BeeFree-Modul | Templatical-Block | Status |
|---|---|---|
| Text | `paragraph` | Konvertiert |
| Paragraph | `paragraph` | Konvertiert |
| Heading | `title` | Konvertiert |
| List | `paragraph` | Konvertiert |
| Image | `image` | Konvertiert |
| Button | `button` | Konvertiert |
| Divider | `divider`, oder `spacer`, wenn er [keine Linie zeichnet](#undrawn-dividers) | Konvertiert (angenähert, wenn ein Divider mit Teilbreite links oder rechts ausgerichtet ist; übersprungen, wenn er keine Linie zeichnet und keinen Platz einnimmt) |
| Spacer | `spacer` | Konvertiert |
| Social | `social` | Konvertiert |
| Icons | `image` für ein Icon ohne Text, sonst `html` ([Icons](#icons)) | Konvertiert oder HTML-Fallback |
| Addon | der Block für das Payload, das es trägt ([Addons](#addons)) | Wie dieses Modul |
| Empty | keiner | Übersprungen |
| Html | `html` | Konvertiert |
| Menu | `menu` | Angenähert (Stile können abweichen) |
| Video | `video` | Konvertiert |
| Table | `table` | Konvertiert |

Unbekannte Modultypen — Formulare eingeschlossen — werden als Fallback in HTML-Blöcke konvertiert und als `html-fallback` gemeldet. Inhalt des Blocks ist `descriptor.text.html`, `descriptor.html.html` oder `descriptor.heading.text` des Moduls, das erste gesetzte Feld. Fehlen alle drei, ist es ein Kommentar `<!-- Unsupported BeeFree module: <type> -->`, der nichts rendert.

### Bildbreite {#image-width}

| BeeFree-Bild | `ImageBlock.width` | Status |
|---|---|---|
| `computedStyle.class` enthält `fullwidth` | `"full"` | Konvertiert |
| `computedStyle.width` schmaler als der Platz des Bildes | die px-Zahl, gerundet | Konvertiert |
| `computedStyle.width` so breit wie der Platz oder breiter | `"full"` | Konvertiert |
| `computedStyle.width` ein Prozentwert unter `100%`, etwa `50%` | dieser Anteil des Platzes in px, gerundet, mit einer `note` | Angenähert |
| `computedStyle.width` `100%` oder mehr | `"full"` | Konvertiert |
| kein `computedStyle.width` | `image.width`, nach derselben Regel | Konvertiert |
| gar keine Breite | `"full"` | Konvertiert |

`image.width` und `image.height` sind die Größe der Bilddatei, `computedStyle.width` ist die Breite, in der BeeFree das Bild zeigt, für beide Größenklassen von BeeFree: ein `fixedwidth`-Bild in der im Editor gesetzten Breite, ein `autowidth`-Bild in der Breite seiner Datei, begrenzt auf die Spalte. Ältere Exporte schreiben `computedStyle.width` als Pixelzahl (`187.5`) und versehen ein Bild, das seine Spalte füllt, mit der Klasse `fullwidth`. Deren berechnete Breite lässt das Padding der Spalte aus, das der Import nicht übernimmt, deshalb entscheidet die Klasse. Der Platz des Bildes ist die Inhaltsbreite seiner Spalte abzüglich des linken und rechten Paddings des Bildes. `ImageBlock` speichert px, die auf einem Smartphone ihre Größe behalten, wo ein Prozentwert mit der Spalte schrumpfen würde; deshalb wird eine Prozentbreite als `approximated` gemeldet. `image.height` wird nicht importiert, sodass das Bild in der angezeigten Breite das Seitenverhältnis der Datei behält. Ein Bild ohne `text-align` übernimmt seine Ausrichtung aus `computedStyle.class` (`left`, `center` oder `right`).

### Divider-Breite

| BeeFree-`width` | `DividerBlock.width` | Status |
|---|---|---|
| fehlt, oder `100%` | `"full"` | Konvertiert |
| ein Prozentwert unter `100%`, etwa `50%` | derselbe Prozentwert auf zwei Nachkommastellen, `"50%"` | Konvertiert |
| unter `0%` oder über `100%` | begrenzt auf `"0%"` bzw. `"full"` | Angenähert |
| px, schmaler als die Inhaltsbreite der eigenen Spalte | die px-Zahl | Konvertiert |
| px, so breit wie die Inhaltsbreite der eigenen Spalte oder breiter | `"full"` | Konvertiert |
| eine negative px-Breite | `0` | Angenähert |
| jeder andere Wert | `"full"` | Angenähert |

Die Inhaltsbreite einer Spalte ist ihr Anteil an `settings.width` gemäß dem Spaltenlayout der Section, abzüglich des linken und rechten Paddings des Dividers. Eine Zeile mit vier oder mehr Spalten wird auf eine Spalte reduziert, und ihre Module nehmen die ganze `settings.width` ein.

Templatical zentriert jeden Divider. Ein Divider mit Teilbreite, den BeeFree links oder rechts ausrichtet (`computedStyle.align`), ist angenähert; seine `note` nennt die Ausrichtung.

### Divider ohne Linie {#undrawn-dividers}

Ein Divider zeichnet keine Linie, wenn sein `border-top` 0 breit ist, `none` oder `hidden` ist oder transparent ist: `transparent` oder eine Farbe mit Alpha 0 wie `rgba(0, 0, 0, 0)` oder `#ffffff00`. BeeFree-Vorlagen nutzen solche Divider als Abstand.

| BeeFree-Divider | Ergebnis | Status |
|---|---|---|
| zeichnet eine Linie | `divider`, nach den Regeln oben | Konvertiert |
| zeichnet keine Linie, Padding und transparenter Rahmen ergeben mehr als 0px | `spacer` | Konvertiert, mit einer `note`, die die Höhe nennt |
| zeichnet keine Linie und nimmt keinen Platz ein | kein Block | Übersprungen |

Die `height` des Spacers ist das `padding-top` des Dividers plus `padding-bottom` plus die Breite eines transparenten Rahmens. Ein Rahmen mit `none` oder `hidden` nimmt keinen Platz ein, seine Breite zählt also nicht. Ein Spacer rendert kein Padding, deshalb ist sein eigenes Padding 0, und die `background-color` des Dividers wird übernommen. Ein Divider ganz ohne `border-top` wird als durchgezogene schwarze Linie von 1px importiert.

### Icons {#icons}

Das Icons-Modul (`mailup-bee-newsletter-modules-icons`) zeigt eine Reihe von Icons, jedes mit optionalem Text. BeeFree zeichnet jedes Icon in der Höhe `computedStyle.iconHeight` (32px, wenn nicht gesetzt), mit einer Breite nach der Dateigröße in `width` und `height` des Icons, innerhalb des Paddings aus `computedStyle.iconSpacing`.

| Icons-Modul | Ergebnis | Status |
|---|---|---|
| ein Icon, kein Text, `width` und `height` angegeben | `image` in der Icon-Höhe | Konvertiert |
| mehrere Icons, Text oder ein Icon ohne bekannte Dateigröße | `html`: eine Tabelle mit den Icons nebeneinander | HTML-Fallback, mit der `note` `Icons module rebuilt as an HTML table.` |
| keine Icons | kein Block | Übersprungen |

Das Bild behält `alt` des Icons und verlinkt auf dessen `href`. Es steht, wo `text-align` des Moduls es hinsetzt, sein Padding ist das Padding des Moduls plus `iconSpacing`, und die Dateigröße wird zu `naturalWidth` und `naturalHeight`.

Die Tabelle setzt den `text` jedes Icons auf die Seite, die `textPosition` nennt (`left`, `right`, `top` oder `bottom`), in `color`, `font-family`, `font-size` und `font-weight` des Moduls, mit `computedStyle.itemsSpacing` zwischen den Icons. Icon und Text verlinken auf `href` und öffnen sich in `target`. Templatical hat keinen Block, der Icons in einer Reihe anordnet, deshalb wird die Tabelle als HTML bearbeitet.

Beide Ergebnisse verwerfen `href` oder `image` eines Icons, wenn die HTML-URL-Regel des Editors (`isSafeHtmlUrl` in `@templatical/types`) sie ablehnt, etwa eine `javascript:`-, `vbscript:`- oder Nicht-Bild-`data:`-URL, und fügen einen Eintrag in `report.warnings` hinzu, der sie nennt. Die Tabelle ist Markup, das der Importer schreibt, und ein HTML-Block wird unbereinigt gerendert.

### Addons {#addons}

Ein Addon-Modul (`mailup-bee-newsletter-modules-addon`) behält das Payload des Moduls, für das es steht. Es wird deshalb wie dieses Modul konvertiert: Das Payload bestimmt den Block und seinen Status. Sein Berichtseintrag behält `beeFreeModuleType: "mailup-bee-newsletter-modules-addon"`. Der Importer sucht diese Payloads im Descriptor, in dieser Reihenfolge:

| Payload | Konvertiert als |
|---|---|
| `image` | Image |
| `html` | Html |
| `heading` | Heading |
| `paragraph` oder `text` | Paragraph |
| `list` | List |
| `button` | Button |
| `divider` | Divider |
| `menu` | Menu |
| `iconsList` | Icons |

Ein Bild-Addon verlinkt nur auf `image.href`. Das GIPHY-Addon schreibt zusätzlich `image.url`, die Seite des GIFs auf giphy.com; sie wird nicht importiert. Ein Addon ohne eines dieser Payloads wird zum Kommentar `<!-- Unsupported BeeFree module: … -->` und als `html-fallback` gemeldet. Das Bild-Payload ist an einem echten GIPHY-Export geprüft; die übrigen folgen BeeFrees [Addon-Inhaltstypen](https://docs.beefree.io/beefree-sdk/builder-addons/custom-addons/custom-addon-types).

## Konvertierung von Spaltenlayouts

BeeFree organisiert Inhalte in Zeilen mit Spalten. Diese werden einem Templatical-`SectionBlock` mit dem entsprechenden `ColumnLayout` zugeordnet:

| BeeFree-Spalten | Templatical-Layout |
|---|---|
| 1 Spalte (100%) | `'1'` |
| 2 gleiche Spalten | `'2'` |
| 3 gleiche Spalten | `'3'` |
| 2 Spalten (~33/66) | `'1-2'` |
| 2 Spalten (~66/33) | `'2-1'` |

Spaltenbreiten, die nicht einem Standardverhältnis entsprechen, werden dem am nächsten liegenden verfügbaren Layout zugeordnet.

## Template-Einstellungen

Globale Template-Einstellungen werden soweit möglich konvertiert:

- **Breite** -- `page.body.content.computedStyle.messageWidth` wird `settings.width` zugeordnet, mit `page.body.content.style.width` als Fallback und 600, wenn keines von beiden gesetzt ist
- **Hintergrundfarbe** -- `page.body.content.style.background-color` wird `settings.backgroundColor` zugeordnet, mit `page.body.container.style.background-color` als Fallback und `#ffffff`, wenn keines von beiden gesetzt ist. Das `content.style.background-color` einer Zeile wird zur `backgroundColor` ihrer Sektion; eine einspaltige Zeile mit Hintergrundfarbe wird in eine einspaltige Sektion gehüllt, damit die Farbe erhalten bleibt. Die Farbe im `container.style` einer Zeile — das Band über die volle Breite hinter der Zeile — wird nicht gelesen und geht verloren.
- **Hintergrundbilder** -- Das `background-image` im `content.style` einer Zeile wird zum `backgroundImage` ihrer Sektion, mit `background-size`, `background-position` und `background-repeat` (wo nicht gesetzt, mit den CSS-Anfangswerten), und hüllt eine einspaltige Zeile wie eine Farbe in eine Sektion. Das Bild des Bands im `container.style` erscheint nur, solange die Inhaltsfläche weder ein Bild noch eine Farbe hat: Dann zeichnet die Sektion es in Inhaltsbreite, sonst wird es verworfen. Eine Größe, die eine Seite füllt (`100%` oder eine px-Breite mindestens so groß wie die E-Mail), wird `cover`, jede andere Länge oder Prozentangabe `auto`; eine Prozent-Position rastet auf das nächste von links, Mitte und rechts (oben, Mitte und unten) ein; `repeat-x` und `repeat-y` werden zu `repeat`. `report.warnings` nennt jedes Bild eines Bands und jeden Wert ohne exaktes Schlüsselwort.
- **Textfarbe** -- `page.body.content.style.color` wird `settings.textColor` zugeordnet, `#1a1a1a`, wenn sie nicht gesetzt ist. Text-, Paragraph-, List-, Heading-, Menu- und Table-Module ohne eigene Farbe übernehmen sie.
- **Links** -- `page.body.content.computedStyle.linkColor` wird `settings.linkColor` zugeordnet. `settings.linkUnderline` ist `true`: BeeFree setzt Unterstreichungen pro Link, im Markup des jeweiligen Links.
- **Schriftfamilie** -- Die Standard-Schriftfamilie wird in `settings.fontFamily` übernommen. Der gesamte Stack wird übernommen, sodass seine Fallbacks erhalten bleiben; ein Stack, der genau dem einer eingebauten Schriftart entspricht (`Arial, sans-serif`), wird als bloßer Name gespeichert. Ein Modul, dessen `font-family` `inherit`, `initial`, `unset` oder `revert` ist, setzt keine eigene Schrift und übernimmt `settings.fontFamily`.

## Bekannte Einschränkungen

- **Benutzerdefinierte Schriftarten** -- BeeFrees Deklarationen für benutzerdefinierte Schriftarten werden nicht automatisch importiert. Fügen Sie sie manuell über die Konfigurationsoption `fonts` hinzu.
- **Bedingte Anzeige** -- BeeFrees Regeln für dynamische Inhalte haben kein direktes Äquivalent und werden während der Konvertierung verworfen.
- **Icons** -- Ein Icons-Modul mit Text oder mehreren Icons wird zu einer HTML-Tabelle, die als HTML bearbeitet wird ([Icons](#icons)). In einem Social-Modul werden benutzerdefinierte Icon-Uploads nicht migriert; Standard-Social-Plattform-Icons werden anhand des Namens zugeordnet.
- **Formulare** -- BeeFrees Formularmodule haben kein Templatical-Äquivalent. Jedes wird zu einem HTML-Block mit Status `html-fallback`; Felder und Absende-Aktion des Formulars werden nicht nachgebildet.
- **Linkfarben einzelner Blöcke** -- Die eigene Linkfarbe eines Textmoduls (`computedStyle.linkColor`) wird verworfen; seine Links übernehmen `settings.linkColor`.
- **Erweitertes Styling** -- Einige granulare BeeFree-Stileigenschaften (z. B. Padding-Überschreibungen pro Spalte) werden möglicherweise nicht vollständig beibehalten.

## Konvertierte Templates überprüfen

Überprüfen Sie nach der Konvertierung die Ausgabe im Editor auf:

1. Fehlende Bilder (bei Bedarf erneut hochladen oder URLs aktualisieren)
2. Schriftrendering (fügen Sie der Editor-Konfiguration benutzerdefinierte Schriftarten hinzu)
3. Spaltenproportionen (passen Sie Layouts an, wenn die automatische Zuordnung nicht passt)
4. Abstände und Padding (Feinabstimmung im Block-Einstellungsbereich)
