---
"@templatical/editor": patch
---

The sidebar rail collapses again after a palette entry is clicked

Clicking a block in the palette left the rail stuck expanded: moving the pointer back to the canvas did nothing, and only a completed drag&drop released it (reported on #568). Because the expanded rail is 200px and overlays the canvas — `.tpl-body` starts at the collapsed 48px — it covered the block the click had just scrolled into view.

The rail suppresses its `mouseleave` collapse while a drag is in flight, so the fallback ghost isn't stamped with a mid-transition rect. That guard was set on Sortable's `choose` and cleared only on `end` — but `end` is not the counterpart of `choose`: Sortable gates it on `Sortable.active`, which only a drag that actually started ever sets. A click emits `choose` + `unchoose` and stops there, so the first click latched the guard on for the rest of the session. It is now cleared on `unchoose` as well, which fires on every release, at drop time — after the ghost rect has been captured, so the drag defense is unchanged.

The rail also no longer collapses out from under a keyboard user: while an entry inside it has `:focus-visible`, `mouseleave` leaves it open and focus leaving is what closes it. Collapsing to the 48px icon strip otherwise hides the label of the entry the user has focused. The test is `:focus-visible` rather than `:focus` on purpose — a mouse click leaves the clicked button focused, so `:focus` would pin the rail open exactly as the latched guard did.
