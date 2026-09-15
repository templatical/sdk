---
title: Tastatur
description: Tastenkürzel der Editor-Oberfläche — Speichern, Rückgängig, Löschen, Palette, Auswahl für gespeicherte Blöcke. Drag-and-Drop ist nur per Zeiger.
---

# Tastatur

Der Modifier ist `metaKey || ctrlKey` (Command unter macOS, Control sonst). Der Listener hängt an `document`, damit ein Klick auf einen nicht fokussierbaren Block den Akkord trotzdem erreicht.

Solange ein Textfeld oder eine TipTap-Fläche fokussiert ist, bleiben Undo/Redo und Entf/Rücktaste beim Feld.

| Akkord | Aktion |
|---|---|
| `Mod+S` | Speichern, wenn ein Templates-Provider speichern kann |
| `Mod+Z` | Rückgängig. TipTap übernimmt das beim Texteditieren |
| `Mod+Shift+Z` | Wiederholen. Dieselbe Text-Ausnahme |
| `Escape` | Aktuellen Block abwählen |
| `Delete` / `Backspace` | Ausgewählten Block entfernen. Beim Tippen ohne Wirkung |

## Palette

Klick, Enter oder Leertaste auf ein Paletten-Element fügt den Block **unter der Auswahl** ein (oder am Ende, wenn nichts ausgewählt ist). Ein verschachteltes Spaltenkind kann keine Sektion aufnehmen — MJML verbietet `mj-section` in `mj-column` — daher landet ein Sektions-Insert hinter der Elternsektion. Dieselbe Regel wie `duplicateBlock`.

Drag-and-Drop ist zeigeremuliert (`force-fallback`). Es gibt keinen Tastatur-Drag.

## Auswahl gespeicherter Blöcke

Während Blöcke zum Speichern gewählt werden:

| Akkord | Aktion |
|---|---|
| `Escape` | Sitzung abbrechen |
| `Enter` | Bestätigen (bei null Auswahl deaktiviert) |
| `Delete` / `Backspace` | Verschluckt — löscht keine Canvas-Blöcke |

Pfeil hoch/runter an einem fokussierten Sortiergriff im Speichern-Dialog verschiebt eine Vorschauzeile.
