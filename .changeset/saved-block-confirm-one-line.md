---
"@templatical/editor": patch
---

The saved-block delete confirm stays on one line

A saved-block card's bottom row holds the entry's block-type icons, a "+N" count for any beyond five, the last-updated time and the row actions. Clicking Delete swaps the actions for an inline confirm, and its full question, "Delete this saved block?", didn't fit a crowded row: on an entry with five or more block types it wrapped onto two lines, made the card taller and squeezed the icons. German, French, Spanish, Catalan, Dutch and Japanese made it worse.

The confirm now shows a short label ("Delete?" in English, and a short form in every locale) and keeps the full question as its accessible name, so screen readers still announce "Delete this saved block?" and tests that find the button by that name keep working. When the row is crowded, only the timestamp gives way: it truncates and still shows the full date in its tooltip, while the icons and the confirm keep their size.
