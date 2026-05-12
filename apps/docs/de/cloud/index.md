---
title: Templatical Cloud
description: Premium-Hosted-Funktionen für Teams, die E-Mail-Tools in großem Umfang entwickeln.
---

# Templatical Cloud

Der Open-Source-Editor bietet alles, was Sie zum Erstellen und Rendern von E-Mail-Templates benötigen. **Templatical Cloud** ergänzt ihn um die Funktionen, die Teams brauchen, wenn sie E-Mail-Tools in großem Umfang ausliefern – KI-gestützte Inhaltserzeugung, Echtzeit-Zusammenarbeit, Medien-Management, Template-Bewertung und mehr.

## So funktioniert es

Cloud-Funktionen werden aktiviert, indem beim Initialisieren des Editors von `init()` auf `initCloud()` gewechselt wird. Derselbe visuelle Editor, den Sie bereits kennen, erhält zusätzliche Fähigkeiten, die vom Templatical-Cloud-Backend bereitgestellt werden.

```js
import { initCloud } from '@templatical/editor';

const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },
});
```

Alle Cloud-Funktionen kommunizieren über authentifizierte API-Endpunkte und WebSocket-Verbindungen, die automatisch vom SDK verwaltet werden.

## Funktionen

| Funktion | Beschreibung |
|---------|-------------|
| [KI-Assistent](/de/cloud/ai) | E-Mail-Inhalte aus Prompts erzeugen, Texte umschreiben, Umwandlung von Design zu Template |
| [Zusammenarbeit](/de/cloud/collaboration) | Echtzeit-Co-Editing mit Live-Cursorn und Block-Sperren |
| [Kommentare](/de/cloud/comments) | Inline-Review-Threads an einzelnen Blöcken |
| [Medienbibliothek](/de/cloud/media-library) | Bilder hochladen, organisieren und verwalten – mit Ordnern und Suche |
| [Template-Bewertung](/de/cloud/template-scoring) | Automatische Qualitätsprüfungen für Zustellbarkeit und Barrierefreiheit |
| [Gespeicherte Module](/de/cloud/saved-modules) | Wiederverwendbare Template-Abschnitte, die im Team geteilt werden |
| [Test-E-Mails](/de/cloud/test-emails) | Test-E-Mails direkt aus dem Editor senden |
| [Snapshots](/de/cloud/snapshots) | Versionsverlauf mit Side-by-Side-Vergleich und Wiederherstellung |
| [MCP-Integration](/de/cloud/mcp) | KI-Agenten anbinden, um Templates programmatisch zu erstellen und zu verändern |
| [Multi-Tenant](/de/cloud/multi-tenant) | Projekt- und Mandanten-Isolation mit API-Schlüsseln |
| [Headless-API](/de/cloud/headless-api) | Vollständiger programmatischer Zugriff auf Templates, Medien und Rendering |

## Preise

Pläne starten bei 99 $/Monat. Alle Pläne enthalten den vollständigen Editor, KI-Funktionen und Zusammenarbeit.

[Kostenlose Testversion starten](https://templatical.com) &nbsp;·&nbsp; [Preise ansehen](https://templatical.com/pricing) &nbsp;·&nbsp; [Vertrieb kontaktieren](mailto:sales@templatical.com)
