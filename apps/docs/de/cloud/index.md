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

Cloud ist eine Erstanbieter-Implementierung genau der [Provider-Verträge](/de/backend/), die auch der Open-Source-Editor bereitstellt — eine Editor-Komponente, ein Kern, ein Header hinter beiden Einstiegspunkten. Gespeicherte Blöcke und Test-E-Mails dürfen weiterhin Ihre sein, während Cloud den Rest übernimmt:

```ts
await initCloud({ container, auth, savedBlocks: mine, testEmail: mine });
```

Diese beiden lassen sich gefahrlos mischen, weil Cloud sie nie eigenständig nutzt. Die übrigen werden vollständig abgelehnt — außer `templates`, `comments` und `versionHistory`, die Cloud für ihre Konfiguration und Events annimmt. Ein abgelehnter, aus JavaScript übergebener Wert wird mit einer Konsolenwarnung ignoriert:

<!-- prettier-ignore -->
| Schlüssel | Was `initCloud()` damit macht |
| --- | --- |
| `templates` | **Speicher bleibt bei Cloud; Konfiguration und Events gehören Ihnen.** Die ID verankert Zusammenarbeit, Kommentare, KI-Umformulierung, Bewertung und den serverseitigen Export, weshalb `initCloud()` `load`/`create`/`save` behält. Der Schlüssel erreicht den Editor weiterhin für [seine Konfiguration und Events](/de/cloud/templates#eigene-implementierung) — `autoSave`, `unsavedChangesGuard`, `nameField`, `onSaved`, `onCreated`, `onLoaded` —, wobei etwaige Speichermethoden benannt und ignoriert werden. |
| `comments` | **Speicher bleibt bei Cloud; Konfiguration und Events gehören Ihnen.** Ein Kommentar ist an eine von Cloud ausgestellte Vorlagen-ID gebunden, und seine Autorenschaft wird vom Auth-Token signiert, weshalb `initCloud()` sein eigenes `list`/`create`/`update`/`delete`/`setResolved`/`subscribe` behält. Der Schlüssel erreicht den Editor weiterhin für [seine Events](/de/cloud/comments#eigene-implementierung) — `onCreated`, `onUpdated`, `onDeleted`, `onResolved`, `onUnresolved` —, wobei etwaige Speichermethoden benannt und ignoriert werden. |
| `versionHistory` | **Speicher bleibt bei Cloud; Events gehören Ihnen.** Eine Version ist an eine von Cloud ausgestellte Vorlagen-ID gebunden, und der eigene `templates`-Adapter von Cloud zeichnet automatische Versionen als Teil jedes Speicherns auf, weshalb `initCloud()` sein eigenes `list`/`get`/`create`/`restore` behält. Der Schlüssel erreicht den Editor weiterhin für [seine Events](/de/cloud/version-history#events) — `onCreated`, `onRestored` —, wobei etwaige Speichermethoden benannt und ignoriert werden. Anders als bei `savedBlocks` gibt es hier weder eine Boolean- noch eine vollständige Provider-Form: Der Typ ist ausschließlich `VersionHistoryOptions`. |
| `render` | **Cloud rendert für den Versand eigenständig** — Test-E-Mail, geplante Sendungen und Exporte. Ein Provider würde ändern, was Sie in der Vorschau sehen und exportieren, nie das, was Cloud versendet. |

Auch einen `user`-Schlüssel gibt es nicht — `initCloud()` befüllt ihn aus dem Claim des Auth-Tokens selbst, sodass eine von Ihnen übergebene Identität nur davon abweichen könnte, was das Backend ohnehin verifiziert.

Wenn Ihnen der ganze Satz gehören soll, nutzen Sie [`init()`](/de/backend/).

## Preise

Pläne starten bei 99 $/Monat. Alle Pläne enthalten den vollständigen Editor, KI-Funktionen und Zusammenarbeit.

[Kostenlose Testversion starten](https://templatical.com) &nbsp;·&nbsp; [Preise ansehen](https://templatical.com/pricing) &nbsp;·&nbsp; [Vertrieb kontaktieren](mailto:sales@templatical.com)
