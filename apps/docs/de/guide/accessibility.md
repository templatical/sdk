---
title: Barrierefreiheit im Editor
description: Tastatur, Fokus, Dialoge, Shadow DOM und Pflichten des Hosts für das Editor-Chrome. Nicht der E-Mail-Linter.
---

# Barrierefreiheit im Editor

Diese Seite betrifft die **Editor-Oberfläche** — Leisten, Canvas-Chrome, Dialoge, Tastenkürzel. Die E-Mail, die ankommt, ist eine andere Fläche: [`@templatical/quality`](/de/quality/) prüft dieses JSON. Diese Seite ist kein VPAT und keine WCAG-Note für den Versand.

## Tastatur

Der Modifier ist `metaKey || ctrlKey` (Command unter macOS, Control sonst). Der Listener hängt an `document`, damit ein Klick auf einen nicht fokussierbaren Block den Akkord trotzdem erreicht.

Solange ein Textfeld oder eine TipTap-Fläche fokussiert ist, bleiben Undo/Redo und Entf/Rücktaste beim Feld.

| Akkord | Aktion |
|---|---|
| `Mod+S` | Speichern, wenn ein Templates-Provider speichern kann |
| `Mod+Z` | Rückgängig. TipTap übernimmt das beim Texteditieren |
| `Mod+Shift+Z` | Wiederholen. Dieselbe Text-Ausnahme |
| `Escape` | Aktuellen Block abwählen |
| `Delete` / `Backspace` | Ausgewählten Block entfernen. Beim Tippen ohne Wirkung |

### Palette

Klick, Enter oder Leertaste auf ein Paletten-Element fügt den Block **unter der Auswahl** ein (oder am Ende, wenn nichts ausgewählt ist). Ein verschachteltes Spaltenkind kann keine Sektion aufnehmen — MJML verbietet `mj-section` in `mj-column` — daher landet ein Sektions-Insert hinter der Elternsektion. Dieselbe Regel wie `duplicateBlock`.

Drag-and-Drop ist zeigeremuliert (`force-fallback`). Es gibt keinen Tastatur-Drag. Paletten-Insert ist der zeigerfreie Weg zum Hinzufügen.

### Auswahl gespeicherter Blöcke

Während Blöcke zum Speichern gewählt werden:

| Akkord | Aktion |
|---|---|
| `Escape` | Sitzung abbrechen |
| `Enter` | Bestätigen (bei null Auswahl deaktiviert) |
| `Delete` / `Backspace` | Verschluckt — löscht keine Canvas-Blöcke |

Pfeil hoch/runter an einem fokussierten Sortiergriff im Speichern-Dialog verschiebt eine Vorschauzeile.

## Fokus und Shadow DOM

Der Standard-Mount ist ein offener Shadow Root am Container. `document.activeElement` und `window.getSelection()` enden am Shadow-Host, daher geht Chrome, das das echte Fokus-Ziel braucht, über die eigene Wurzel des Editors (Shadow Root oder `document` im Light-DOM-Modus). Beide bieten dieselbe `activeElement`-/`getSelection`-Oberfläche.

Der Keydown-Listener bleibt an `document`: ein Klick auf einen nicht fokussierbaren Block lässt `activeElement` auf `body`, und ein Listener am Shadow Root würde `Mod+Z` / `Mod+S` verpassen.

Abschalten mit `shadowDom: false`. Isolation, Theming und diese Fokus-Teilung: [Shadow DOM](/de/guide/shadow-dom).

## Dialoge

Popups teleportieren in `.tpl-popover-root` im Editor, nie nach `document.body`. Diese Wurzel ist ein Stacking-Kontext (`z-index: 10000`), sodass Dialoge im Editor bleiben, auch wenn die Host-Seite eigene Modals hat.

Höhenbegrenzungen sind ein **Prozentsatz des Backdrops**, nicht `vh`. Ein Vorfahre mit `transform` / `filter` / `contain` wird Containing Block für `position: fixed`; eine `vh`-Kappe würde diese Box überlaufen. Symptom-Tabelle: [Fehlerbehebung](/de/getting-started/troubleshooting).

## Chrome vs Canvas

Kopfzeile, Leisten und Dialoge folgen `init({ locale })` und dem UI-Theme (`data-tpl-theme`). Die E-Mail-Leinwand folgt `settings.locale` und `settings.direction` — daraus werden `<html lang>` / `<mjml dir>` beim Export. Ein deutscher Editor, der eine englische Kampagne schreibt, behält englische Countdown-Beschriftungen und `lang="en"` auf der Leinwand.

Verschachteltes Block-Chrome (Aktionsleiste an einem Sektionskind) nutzt `--tpl-chrome-*`-Tokens, damit eine dunkle UI nicht die erzwungene helle Canvas-Farbe erbt.

## Rollen im Chrome

| Steuerung | Muster |
|---|---|
| Viewport-Umschalter | `role="radiogroup"` / `role="radio"` + `aria-checked` |
| Merge-Tag-Vorschläge | Combobox + Listbox (`aria-activedescendant`) |
| Erster Load gespeicherter Blöcke | `role="status"` + `aria-busy`; Skelettbalken `aria-hidden` |
| Pflichtfeld in Custom Blocks | sichtbares `*` ist `aria-hidden`; der Name steht in einem `.tpl-sr-only`-Geschwister |
| Native Checkboxen | keine im Editor-Quelltext — stattdessen ein Sliding-`role="switch"` |

## Kleiner Bildschirm

Die unterstützte Untergrenze ist 768px. Darunter sitzt `SmallScreenNotice` über den Dialogen (späteres Geschwister der Popover-Wurzel) und sagt, dass das Chrome keine Phone-UI ist.

## Pflichten des Hosts

Dieselben Constraints wie [Einbetten](/de/getting-started/embedding). Sie gelten für AT ebenso wie für das Layout:

- Dem Container eine definite Höhe geben.
- Kein `transform`, `filter`, `backdrop-filter`, `contain` oder `isolation` an einem Vorfahren des Containers, wenn Dialoge den Viewport bedecken sollen.
- Kein `all: initial` / `all: revert` am Container — das löscht `--tpl-user-*` und kann die Höhenkette zerbrechen.

## Siehe auch

- [`@templatical/quality`](/de/quality/) — Barrierefreiheit, Struktur und Links auf dem **Template-JSON**
- [Fehlerbehebung](/de/getting-started/troubleshooting)
- [Einbetten](/de/getting-started/embedding)
