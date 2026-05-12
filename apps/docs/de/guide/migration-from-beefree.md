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

```bash
npm install @templatical/import-beefree
```

## Verwendung

```ts
import { convertBeeFreeTemplate } from '@templatical/import-beefree';

// Laden Sie Ihr BeeFree-Template-JSON
const beefreeJson = await fetch('/api/beefree-templates/123').then(r => r.json());

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

Die Funktion gibt ein `ImportResult` zurück mit:
- `content` — den konvertierten `TemplateContent`, bereit für den Editor
- `report` — einen Konvertierungsbericht mit dem Status jedes Blocks (`converted`, `approximated`, `html-fallback` oder `skipped`)

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
| Divider | `divider` | Konvertiert |
| Spacer | `spacer` | Konvertiert |
| Social | `social` | Konvertiert (16 Plattformen zugeordnet) |
| Html | `html` | Konvertiert |
| Menu | `menu` | Angenähert (Stile können abweichen) |
| Video | `video` | Konvertiert |
| Table | `table` | Konvertiert |

Unbekannte Modultypen werden als Fallback in HTML-Blöcke konvertiert.

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

- **Breite** -- BeeFrees `page.body.content.style.width` wird `settings.width` zugeordnet
- **Hintergrundfarbe** -- Zeilen- und Body-Hintergrundfarben bleiben erhalten
- **Schriftfamilie** -- Die Standard-Schriftfamilie wird in `settings.fontFamily` übernommen

## Bekannte Einschränkungen

- **Benutzerdefinierte Schriftarten** -- BeeFrees Deklarationen für benutzerdefinierte Schriftarten werden nicht automatisch importiert. Fügen Sie sie manuell über die Konfigurationsoption `fonts` hinzu.
- **Bedingte Anzeige** -- BeeFrees Regeln für dynamische Inhalte haben kein direktes Äquivalent und werden während der Konvertierung verworfen.
- **Icons** -- Benutzerdefinierte Icon-Uploads von BeeFree werden nicht migriert. Standard-Social-Plattform-Icons werden anhand des Namens zugeordnet.
- **Formulare** -- BeeFrees Formularblöcke haben kein Templatical-Äquivalent und werden übersprungen.
- **Erweitertes Styling** -- Einige granulare BeeFree-Stileigenschaften (z. B. Padding-Überschreibungen pro Spalte, Hintergrundbilder in Inhaltsbereichen) werden möglicherweise nicht vollständig beibehalten.

## Konvertierte Templates überprüfen

Überprüfen Sie nach der Konvertierung die Ausgabe im Editor auf:

1. Fehlende Bilder (bei Bedarf erneut hochladen oder URLs aktualisieren)
2. Schriftrendering (fügen Sie der Editor-Konfiguration benutzerdefinierte Schriftarten hinzu)
3. Spaltenproportionen (passen Sie Layouts an, wenn die automatische Zuordnung nicht passt)
4. Abstände und Padding (Feinabstimmung im Block-Einstellungsbereich)
