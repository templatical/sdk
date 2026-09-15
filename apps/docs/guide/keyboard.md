---
title: Keyboard
description: Editor chrome shortcuts — save, undo, delete, palette insert, saved-blocks pick session. Drag-and-drop is pointer-only.
---

# Keyboard

Modifier is `metaKey || ctrlKey` (Command on macOS, Control elsewhere). The listener is on `document` so a click on a non-focusable block still receives the chord.

While a text field or TipTap surface is focused, undo/redo and Delete/Backspace stay with the field.

| Chord | Action |
|---|---|
| `Mod+S` | Save, when a templates provider can save |
| `Mod+Z` | Undo. TipTap handles this while editing text |
| `Mod+Shift+Z` | Redo. Same text-editing exception |
| `Escape` | Deselect the current block |
| `Delete` / `Backspace` | Remove the selected block. No-op while typing |

## Palette

Click, Enter, or Space on a sidebar palette item inserts that block **below the selection** (or at the end when nothing is selected). A nested column child cannot accept a section — MJML forbids `mj-section` in `mj-column` — so a section insert lands after the parent section. Same rule as `duplicateBlock`.

Drag-and-drop is pointer-emulated (`force-fallback`). There is no keyboard drag.

## Saved-blocks pick session

While picking blocks to save:

| Chord | Action |
|---|---|
| `Escape` | Cancel the session |
| `Enter` | Confirm (disabled at zero picks) |
| `Delete` / `Backspace` | Swallowed — does not delete canvas blocks |

Arrow Up/Down on a focused reorder grip in the save dialog moves a preview row.
