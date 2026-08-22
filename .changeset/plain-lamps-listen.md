---
"@templatical/editor": patch
"@templatical/media-library": patch
---

Dialogs no longer get clipped when the host page traps fixed positioning

Reported on #575 as tall dialogs being cut off with no way to scroll to the buttons. The dialogs were already capped and internally scrollable — the cap was measuring the wrong box.

`TplModal`'s backdrop is `fixed; inset: 0`, which covers the viewport only while nothing traps it. Any ancestor with `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change: transform`, `contain: paint`, `container-type`, or a running transform animation becomes the containing block for fixed descendants, and the editor is a component mounted inside someone else's markup. When one of those sits above it, `inset: 0` resolves to that ancestor's box while a `vh` cap on the panel still resolves to the viewport. Measured in a 420px-tall host inside a 720px viewport: a 648px panel (90vh) clipped ~113px at the top and the bottom by the host's `overflow: hidden`, with the panel's own `overflow-y: visible` leaving no scrollbar to reach Send.

Every panel now caps against the backdrop instead — `max-h-[90%]` / `max-h-[80%]`, the same proportions the `vh` values expressed, so an untrapped editor looks exactly as it did. Percentages need an unbroken chain of definite heights, so the bare wrapper `TplModal` put between the backdrop and the panel now spans the backdrop's height; it stays shrink-to-fit horizontally, which is what keeps shrink-to-fit dialogs (the collapsed test-email form) from inflating to their `max-w-*`. The gutter moved from each panel's `mx-4` onto the backdrop's padding, so it also acts as a floor when the host box is small enough for a percentage gutter to vanish.

Applies to the test-email dialog, the save-block and saved-blocks-browser dialogs, the merge-tag and logic-tag pickers, the restore-version dialog, and the Cloud save gate. The two `100vw`/`92vw` width caps went the same way for the same reason. `RestoreVersionDialog` was uncapped entirely and now scrolls rather than clipping.

`@templatical/media-library` had the same mismatch in all four of its modals — the library itself, and the edit / replace / import-URL dialogs — and it matters there for the same reason: `MediaLibraryModal` teleports into the editor's `popoverTarget`, so it lands inside a consumer's markup too. `MediaReplaceModal` and `MediaImportUrlModal` were uncapped entirely and now scroll. Separately, `MediaLibraryModal`'s overlay had no centring at all — a 900x650 panel as a plain block child of `fixed; inset: 0`, so it rendered pinned to the viewport's top-left corner. It is now centred, which is also what makes its percentage cap resolve.

The rule is locked structurally by `overlay-height-scope.test.ts` (editor) and `overlay-height-scope-audit.test.ts` (media library), and behaviourally by `modal-height-clamp.spec.ts`, which arms a real fixed-position trap and asserts the panel and its Send button stay inside it.
