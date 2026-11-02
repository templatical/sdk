---
"@templatical/editor": patch
---

A jump from a `localization.untranslated`, `localization.stale` or `localization.merge-tags-differ` finding in Issues opens the block badge's popover in that finding's own state, with its explanation and actions, even when another state of the block outranks it. The badge keeps its priority state, and closing and reopening the popover returns to it.

An open **Make default language** dialog closes when its language is removed or can no longer become the default after the template's content is replaced, for example by a collaboration recovery or AI. Translate keeps the previous value of an HTML field whose result adds or changes a `style` value the field's default doesn't hold, and counts it with the fields kept because their tags changed.
