---
title: Funktionen für Autoren
description: Was man im Editor sieht — gespeicherte Blöcke, Kommentare, Versionsverlauf, Test-E-Mail, Issues, Medien — und welcher init()-Schlüssel oder welches Paket das jeweils einschaltet.
---

# Funktionen für Autoren

Was Autoren sehen. Jede Zeile ist aus, bis Sie den Schlüssel übergeben (bei Issues: das optionale Quality-Paket installieren). Der Editor mit nur `container` editiert; er speichert, kommentiert und sendet nicht.

Provider-Methoden laufen im Browser. Ein Steuerelement mit `false` ausblenden; dieselbe Regel auf dem Server durchsetzen. Siehe [Backend anbinden](/de/backend/).

## Speicher und Versand

| Funktion | Was Autoren tun | `init()`-Schlüssel | Docs | Playground |
|---|---|---|---|---|
| Speichern und laden | Template benennen, speichern, Autosave, Schutz vor ungespeicherten Änderungen | `templates` | [Speichern und laden](/de/backend/templates) | [templates](https://play.templatical.com/scenes/templates) |
| Versionsverlauf | Ältere Versionen durchgehen, Vorschau, Wiederherstellen | `versionHistory` | [Versionsverlauf](/de/backend/version-history) | [version-history](https://play.templatical.com/scenes/version-history) |
| Kommentare | Thread an einem Block, antworten, als erledigt markieren | `comments` | [Kommentare](/de/backend/comments) | [comments](https://play.templatical.com/scenes/comments) |
| Gespeicherte Blöcke | Gruppe merken, durchsuchen, einfügen | `savedBlocks` | [Gespeicherte Blöcke](/de/backend/saved-blocks) | [saved-blocks](https://play.templatical.com/scenes/saved-blocks) |
| Medienbibliothek | Durchsuchen, hochladen, zuschneiden, Ordner | `media` | [Medien](/de/backend/media) | [media](https://play.templatical.com/scenes/media) |
| Test-E-Mail | Diese Vorlage an ein Postfach senden | `testEmail` | [Test-E-Mails](/de/backend/test-email) | [test-email](https://play.templatical.com/scenes/test-email) |
| MJML- / HTML-Export | `toMjml()` / `toHtml()` an der Instanz | `render` (optional; lokaler Renderer geht auch) | [Rendering](/de/backend/render) | [render](https://play.templatical.com/scenes/render) |

Für gespeicherte Blöcke und Medien gibt es einen mitgelieferten browserlokalen Adapter, wenn die Oberfläche ohne eigenen Server reichen soll.

## Eingebautes Chrome

Kein Provider. Konfiguration über `init()` oder Template-Einstellungen.

| Funktion | Was Autoren tun | Docs | Playground |
|---|---|---|---|
| Merge-Tags | CRM-Felder mit lesbarem Label einfügen | [Merge-Tags](/de/guide/merge-tags) | [merge-tags](https://play.templatical.com/scenes/merge-tags) |
| Anzeigebedingungen | Block je Empfänger ein- oder ausblenden | [Anzeigebedingungen](/de/guide/display-conditions) | [display-conditions](https://play.templatical.com/scenes/display-conditions) |
| Issues | Zu einem Lint-Treffer springen, Fix anwenden | [Qualität](/de/quality/) — `@templatical/quality` installieren | [issues](https://play.templatical.com/scenes/issues) |
| Eigene Blöcke | Einen von Ihnen registrierten Typ ablegen | [Eigene Blöcke](/de/guide/custom-blocks) | [custom-blocks](https://play.templatical.com/scenes/custom-blocks) |

Issues ist ein optionales Peer: ohne das Paket wird der Tab nicht geladen.
