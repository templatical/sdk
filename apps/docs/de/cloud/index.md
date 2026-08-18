---
title: Templatical Cloud
description: Premium-Hosted-Funktionen für Teams, die E-Mail-Tools in großem Umfang entwickeln.
---

# Templatical Cloud

Der selbst gehostete Editor bietet alles, was Sie zum Erstellen und Rendern von E-Mail-Templates benötigen. **Templatical Cloud** ergänzt ihn um die Funktionen, die Teams brauchen, wenn sie E-Mail-Tools in großem Umfang ausliefern – KI-gestützte Inhaltserzeugung, Echtzeit-Zusammenarbeit, Medien-Management, Template-Bewertung und mehr.

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
| [Rendering](/de/cloud/rendering) | `toMjml()` und `toHtml()` serverseitig — mit Countdown-GIF und Video-Play-Button, die ein Browser nicht erzeugen kann |
| [Gespeicherte Blöcke](/de/cloud/saved-blocks) | Wiederverwendbare Blockgruppen — eine Bibliothek pro Projekt, im Team geteilt, ohne eigenes Backend |
| [Templates](/de/cloud/templates) | Speichern, Laden, Autosave und der Schutz vor ungespeicherten Änderungen — ohne eigenen Speicher |
| [Test-E-Mails](/de/cloud/test-emails) | Test-E-Mails direkt aus dem Editor senden |
| [Versionsverlauf](/de/cloud/version-history) | Frühere Versionen durchsehen, in der Vorschau ansehen und wiederherstellen — ein offener Vertrag, den Cloud implementiert |
| [MCP-Integration](/de/cloud/mcp) | KI-Agenten anbinden, um Templates programmatisch zu erstellen und zu verändern |
| [Multi-Tenant](/de/cloud/multi-tenant) | Projekt- und Mandanten-Isolation mit API-Schlüsseln |
| [Headless-API](/de/cloud/headless-api) | Vollständiger programmatischer Zugriff auf Templates, Medien und Rendering |

## Eigene Implementierung

Cloud ist eine Erstanbieter-Implementierung genau der [Provider-Verträge](/de/backend/), die auch der Open-Source-Editor bereitstellt — eine Editor-Komponente, ein Kern, ein Header hinter beiden Einstiegspunkten. Zwei der sechs dürfen weiterhin Ihre sein, während Cloud den Rest übernimmt:

```ts
await initCloud({ container, auth, savedBlocks: mine, testEmail: mine });
```

Diese beiden lassen sich gefahrlos mischen, weil Cloud sie nie eigenständig nutzt. Die übrigen vier werden abgelehnt; ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert:

<!-- prettier-ignore -->
| Schlüssel | Warum `initCloud()` ihn ablehnt |
| --- | --- |
| `templates`, `versionHistory`, `comments`, `user` | **An eine von Cloud ausgestellte Vorlagen-ID gebunden.** Cloud verankert Versionen und Kommentare an eigenen IDs und signiert die Autorenschaft gegen das Auth-Token. |
| `render` | **Cloud rendert für den Versand eigenständig** — Test-E-Mail, geplante Sendungen und Exporte. Ein Provider würde ändern, was Sie in der Vorschau sehen und exportieren, nie das, was Cloud versendet. |

Wenn Ihnen der ganze Satz gehören soll, nutzen Sie [`init()`](/de/backend/).

## Preise

Pläne starten bei 99 $/Monat. Alle Pläne enthalten den vollständigen Editor, KI-Funktionen und Zusammenarbeit.

[Kostenlose Testversion starten](https://templatical.com) &nbsp;·&nbsp; [Preise ansehen](https://templatical.com/pricing) &nbsp;·&nbsp; [Vertrieb kontaktieren](mailto:sales@templatical.com)
