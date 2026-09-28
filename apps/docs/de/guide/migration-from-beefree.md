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
| `html-fallback` | Kein Block-Äquivalent; das Original-Markup ist ein `HtmlBlock`. |
| `skipped` | Keine Ausgabe (Formulare und alles, was der Konverter ablehnt). |

Das JSON, das BeeFrees Editor speichert (`page.rows`), ist die Eingabe. Ein kompiliertes HTML-Export ist ein anderes Envelope — [`@templatical/import-html`](/de/guide/migration-from-html).

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
| Divider | `divider` | Konvertiert (angenähert, wenn ein Divider mit Teilbreite links oder rechts ausgerichtet ist) |
| Spacer | `spacer` | Konvertiert |
| Social | `social` | Konvertiert |
| Html | `html` | Konvertiert |
| Menu | `menu` | Angenähert (Stile können abweichen) |
| Video | `video` | Konvertiert |
| Table | `table` | Konvertiert |

Unbekannte Modultypen werden als Fallback in HTML-Blöcke konvertiert.

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
- **Hintergrundfarbe** -- Zeilen- und Body-Hintergrundfarben bleiben erhalten
- **Textfarbe** -- `page.body.content.style.color` wird `settings.textColor` zugeordnet, `#1a1a1a`, wenn sie nicht gesetzt ist. Text-, Paragraph-, List-, Heading-, Menu- und Table-Module ohne eigene Farbe übernehmen sie.
- **Links** -- `page.body.content.computedStyle.linkColor` wird `settings.linkColor` zugeordnet. `settings.linkUnderline` ist `true`: BeeFree setzt Unterstreichungen pro Link, im Markup des jeweiligen Links.
- **Schriftfamilie** -- Die Standard-Schriftfamilie wird in `settings.fontFamily` übernommen. Ein Modul, dessen `font-family` `inherit`, `initial`, `unset` oder `revert` ist, setzt keine eigene Schrift und übernimmt `settings.fontFamily`.

## Bekannte Einschränkungen

- **Benutzerdefinierte Schriftarten** -- BeeFrees Deklarationen für benutzerdefinierte Schriftarten werden nicht automatisch importiert. Fügen Sie sie manuell über die Konfigurationsoption `fonts` hinzu.
- **Bedingte Anzeige** -- BeeFrees Regeln für dynamische Inhalte haben kein direktes Äquivalent und werden während der Konvertierung verworfen.
- **Icons** -- Benutzerdefinierte Icon-Uploads von BeeFree werden nicht migriert. Standard-Social-Plattform-Icons werden anhand des Namens zugeordnet.
- **Formulare** -- BeeFrees Formularblöcke haben kein Templatical-Äquivalent und werden übersprungen.
- **Linkfarben einzelner Blöcke** -- Die eigene Linkfarbe eines Textmoduls (`computedStyle.linkColor`) wird verworfen; seine Links übernehmen `settings.linkColor`.
- **Erweitertes Styling** -- Einige granulare BeeFree-Stileigenschaften (z. B. Padding-Überschreibungen pro Spalte, Hintergrundbilder in Inhaltsbereichen) werden möglicherweise nicht vollständig beibehalten.

## Konvertierte Templates überprüfen

Überprüfen Sie nach der Konvertierung die Ausgabe im Editor auf:

1. Fehlende Bilder (bei Bedarf erneut hochladen oder URLs aktualisieren)
2. Schriftrendering (fügen Sie der Editor-Konfiguration benutzerdefinierte Schriftarten hinzu)
3. Spaltenproportionen (passen Sie Layouts an, wenn die automatische Zuordnung nicht passt)
4. Abstände und Padding (Feinabstimmung im Block-Einstellungsbereich)
