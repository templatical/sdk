---
"@templatical/editor": patch
---

The header's Viewport, Dark mode and Preview controls now hold their position for the whole session

Entering preview mode added the Sample / Label switch to the header's centre group, and that group is an `auto` grid track between two equal `1fr` columns — so it is centred, and any width change redistributes symmetrically about the header's centre. Measured: the switch plus its gap added 229px, and Viewport, Dark mode and **Preview** each jumped 114.5px left while the version-history menu jumped 114.6px right. Leaving preview mode meant hunting for a button half a switch's width from where it had just been (#574).

Note the reported cause was the opposite of the real one: the switch already rendered *after* the Preview button, and the button moved *left*. DOM order is irrelevant here — a centred track moves everything when it changes width, whichever side of the change it sits on.

The fix is the invariant rather than the instance: **the centre track now carries only the three view controls, and nothing in it may be conditional.** Conditional controls moved to the edge-anchored columns, which grow away from their anchored edge and so move nothing already in them:

- The **Sample / Label switch** now floats at the top of the canvas, in the same zero-height overlay layer as the "Show all hidden blocks" pill (which moved down to make room). Absolutely-positioned children in a zero-height layer have no layout coupling, so neither pill can move the other, and the switch's width no longer reaches the header at all.
- **Version history** moved to the left column, joining the template name and its write time as "which template, and which version of it".
- Cloud's **collaborator bar** moved to the left column too. This was the worse case: it sits in the header for the whole session and changes width whenever somebody joins or leaves, so it slid the Preview button out from under the cursor with no user action at all.

The `center-extras` slot is gone rather than left empty — a slot is the one thing a guard test cannot stop someone filling.

**The two canvas pills now read as one family.** They share the overlay, so they had to: the "Show all hidden blocks" pill was hand-rolled at 30px with `rounded-full` and a filled amber surface, against the switch's 38px `--tpl-radius-sm` box. It now uses a shared `warningBtnCompactClass`, shaped like the existing danger skin — `--tpl-bg` fill, `--tpl-warning` border, the house's muted-at-rest label, and the amber fill arriving on hover instead of sitting there permanently.

That also retires a legibility defect. The old pill painted `--tpl-warning` on `--tpl-warning-light`, which is **1.85:1** in light mode. Putting the amber on the label instead — the literal reading of the danger skin — would only have reached 2.11:1, because `--tpl-warning` is a light amber (76.9% L) where `--tpl-danger` is a mid red. The amber therefore carries on the border and the label stays muted: **5.93:1 light, 5.99:1 dark.**

Both pills sit in one centred column in the overlay rather than at fixed offsets. Fixed offsets were tried and were wrong: pinning the restore pill low enough to clear the switch left it there when it rendered alone, which in editing mode — where the switch never shows — dropped it onto the first block's content.

Nothing changes for consumers: no public API, config key or CSS class was added, removed or renamed. The relocated controls keep their `data-testid`s.
