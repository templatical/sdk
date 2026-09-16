---
title: Editor accessibility
description: Keyboard, focus, dialogs, shadow DOM, and host duties for the editor chrome. Not the email quality linter.
---

# Editor accessibility

This page is the **editor UI** — rails, canvas chrome, dialogs, shortcuts. The email a recipient gets is a different surface: [`@templatical/quality`](/quality/) lints that JSON. Do not treat this page as a VPAT or a WCAG score for sent mail.

## Keyboard

Modifier is `metaKey || ctrlKey` (Command on macOS, Control elsewhere). The listener is on `document` so a click on a non-focusable block still receives the chord.

While a text field or TipTap surface is focused, undo/redo and Delete/Backspace stay with the field.

| Chord | Action |
|---|---|
| `Mod+S` | Save, when a templates provider can save |
| `Mod+Z` | Undo. TipTap handles this while editing text |
| `Mod+Shift+Z` | Redo. Same text-editing exception |
| `Escape` | Deselect the current block |
| `Delete` / `Backspace` | Remove the selected block. No-op while typing |

### Palette

Click, Enter, or Space on a sidebar palette item inserts that block **below the selection** (or at the end when nothing is selected). A nested column child cannot accept a section — MJML forbids `mj-section` in `mj-column` — so a section insert lands after the parent section. Same rule as `duplicateBlock`.

Drag-and-drop is pointer-emulated (`force-fallback`). There is no keyboard drag. Palette insert is the pointer-free add path.

### Saved-blocks pick session

While picking blocks to save:

| Chord | Action |
|---|---|
| `Escape` | Cancel the session |
| `Enter` | Confirm (disabled at zero picks) |
| `Delete` / `Backspace` | Swallowed — does not delete canvas blocks |

Arrow Up/Down on a focused reorder grip in the save dialog moves a preview row.

## Focus and shadow DOM

Default mount is an open shadow root on the container. `document.activeElement` and `window.getSelection()` stop at the shadow host, so chrome that needs the real focus target goes through the editor's own root (shadow root or `document` in light-DOM mode). Both expose the same `activeElement` / `getSelection` surface.

The keydown listener stays on `document`: a click on a non-focusable block leaves `activeElement` on `body`, and a shadow-root-bound listener would miss `Mod+Z` / `Mod+S`.

Opt out with `shadowDom: false`. Isolation, theming, and this focus split: [Shadow DOM](/guide/shadow-dom).

## Dialogs

Popups teleport to `.tpl-popover-root` inside the editor, never `document.body`. That root is a stacking context (`z-index: 10000`), so dialogs stay in the editor even when the host page has its own modals.

Height caps are a **percentage of the backdrop**, not `vh`. A host ancestor with `transform` / `filter` / `contain` becomes the containing block for `position: fixed`; a `vh` cap would overflow that box. Symptom table: [Troubleshooting](/getting-started/troubleshooting).

## Chrome vs canvas

Header, rails and dialogs follow `init({ locale })` and the UI theme (`data-tpl-theme`). The email canvas follows `settings.locale` and `settings.direction` — those become `<html lang>` / `<mjml dir>` on export. A German editor writing an English campaign keeps English countdown labels and `lang="en"` on the canvas.

Nested block chrome (action bar on a section child) uses `--tpl-chrome-*` tokens so a dark UI does not inherit the canvas's forced-light colors.

## Roles in the chrome

| Control | Pattern |
|---|---|
| Viewport toggle | `role="radiogroup"` / `role="radio"` + `aria-checked` |
| Merge-tag suggestion popup | combobox + listbox (`aria-activedescendant`) |
| Saved-blocks first load | `role="status"` + `aria-busy`; skeleton bars `aria-hidden` |
| Required custom-block field | visible `*` is `aria-hidden`; name is an `.tpl-sr-only` sibling |
| Native checkboxes | none in editor source — sliding `role="switch"` instead |

## Small screen

The supported floor is 768px. Below that, `SmallScreenNotice` sits above dialogs (later sibling of the popover root) and tells the author the chrome is not a phone UI.

## Host duties

These are the same constraints as [Embedding](/getting-started/embedding). They are load-bearing for AT as well as for sighted layout:

- Give the container a definite height.
- Do not put `transform`, `filter`, `backdrop-filter`, `contain`, or `isolation` on an ancestor of the container if you want dialogs to cover the viewport.
- Do not `all: initial` / `all: revert` the container — that wipes `--tpl-user-*` and can break the height chain.

## See also

- [`@templatical/quality`](/quality/) — accessibility, structure and link rules on the **template JSON**
- [Troubleshooting](/getting-started/troubleshooting)
- [Embedding](/getting-started/embedding)
