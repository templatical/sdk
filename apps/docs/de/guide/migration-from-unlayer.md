---
title: Migration von Unlayer
description: Konvertieren Sie Unlayer-E-Mail-Templates mit @templatical/import-unlayer ins Templatical-Format.
---

# Migration von Unlayer

Das Paket `@templatical/import-unlayer` konvertiert Unlayer-Design-JSON (die Ausgabe von `editor.saveDesign(...)` aus `react-email-editor` oder dem gehosteten Unlayer-Editor) in Templaticals `TemplateContent`-Format.

::: warning
Dieses Paket befindet sich in aktiver Entwicklung. Einige Inhaltstypen und erweiterte Funktionen werden möglicherweise noch nicht vollständig unterstützt. Testen Sie Ihre konvertierten Templates, bevor Sie sie in Produktion einsetzen.
:::

## Installation

```bash
npm install @templatical/import-unlayer
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertUnlayerTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-unlayer/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung

```ts
import { convertUnlayerTemplate } from '@templatical/import-unlayer';

// Laden Sie Ihr Unlayer-Design-JSON (was auch immer editor.saveDesign zurückgegeben hat)
const unlayerJson = await fetch('/api/unlayer-templates/123').then(r => r.json());

// Ins Templatical-Format konvertieren
const { content, report } = convertUnlayerTemplate(unlayerJson);

// Im Editor verwenden
const editor = await init({
  container: '#editor',
  content,
});

// Den Konvertierungsbericht auf Probleme prüfen
console.log(report);
```

Die Funktion gibt ein `ImportResult` zurück mit:
- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Inhaltsknotens (`converted`, `approximated`, `html-fallback` oder `skipped`)

## Block-Mapping

Unlayer-Inhaltstypen werden auf Templatical-Entsprechungen abgebildet:

| Unlayer-Inhalt | Templatical-Block | Status |
|---|---|---|
| Text | `paragraph` | Konvertiert |
| Heading | `title` | Konvertiert |
| Image | `image` | Konvertiert |
| Button | `button` | Konvertiert |
| Divider | `divider` | Konvertiert |
| Html | `html` | Konvertiert |
| Menu | `menu` | Angenähert (Stile können abweichen) |
| Social | `social` | Konvertiert (16 Plattformen abgebildet) |
| Video | `video` | Konvertiert |
| Timer | `html` | HTML-Fallback (manuell neu aufbauen) |
| Form | — | Übersprungen |

Unbekannte Inhaltstypen werden als Fallback in HTML-Blöcke konvertiert.

## Konvertierung des Spaltenlayouts

Unlayer organisiert Inhalte in Reihen mit Spalten, deren Breiten aus einem `cells`-Gewichtungsarray stammen. Diese werden auf Templaticals `SectionBlock` mit dem passenden `ColumnLayout` abgebildet:

| Unlayer-cells | Templatical-Layout |
|---|---|
| `[1]` (einzelne Spalte) | reduziert — kein Section-Wrapper |
| `[1, 1]` (gleiche Hälften) | `'2'` |
| `[1, 1, 1]` (gleiche Drittel) | `'3'` |
| `[1, 2]` | `'1-2'` |
| `[2, 1]` | `'2-1'` |
| 4+ Zellen | auf eine einzelne Spalte reduziert, mit Warnung |

Zellverhältnisse, die keinem Standardlayout entsprechen, werden auf das nächstliegende verfügbare abgebildet.

## Template-Einstellungen

Globale Template-Einstellungen werden übertragen, wo möglich:

- **Breite** — Unlayers `body.values.contentWidth` wird auf `settings.width` abgebildet
- **Hintergrundfarbe** — `body.values.backgroundColor` bleibt erhalten; Hintergründe auf Reihenebene werden auf den entsprechenden `SectionBlock` übertragen
- **Schriftfamilie** — `body.values.fontFamily.value` wird auf `settings.fontFamily` übertragen

## Bekannte Einschränkungen

- **Custom Fonts** — Unlayers Custom-Font-Deklarationen werden nicht automatisch importiert. Fügen Sie sie manuell über die `fonts`-Konfigurationsoption hinzu.
- **Anzeigebedingungen / dynamische Inhalte** — Unlayers Syntax für bedingte Inhalte hat keine direkte Entsprechung und wird bei der Konvertierung verworfen. Nutzen Sie Templaticals [Anzeigebedingungen](/de/guide/display-conditions), um sie neu aufzubauen.
- **Custom-Module / Blöcke aus kostenpflichtigen Tarifen** — Unlayers Custom Blocks werden in Platzhalter-HTML-Blöcke konvertiert. Bauen Sie sie als [Custom Block](/de/guide/custom-blocks) neu auf, wenn sie wiederverwendbar sind.
- **Formulare** — Unlayers Formular-Blöcke werden übersprungen. Die meisten E-Mail-Clients blockieren aus Sicherheitsgründen das Absenden von Formularen; bauen Sie den Call-to-Action als Button neu auf, der auf ein gehostetes Formular verlinkt.
- **Timer / Countdowns** — Werden als Platzhalter-HTML-Block importiert. Bauen Sie sie mit Templaticals `CountdownBlock` neu auf.
- **AMP for Email** — wird in Templatical derzeit nicht unterstützt.

## Konvertierte Templates überprüfen

Überprüfen Sie nach der Konvertierung die Ausgabe im Editor auf:

1. Fehlende Bilder (bei Bedarf neu hochladen oder URLs aktualisieren)
2. Schriftdarstellung (Custom Fonts zur Editor-Konfiguration hinzufügen)
3. Spaltenverhältnisse (Layouts anpassen, falls das automatische Mapping nicht passt)
4. Abstände und Padding (im Block-Einstellungspanel feinjustieren)
