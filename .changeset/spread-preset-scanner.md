---
"@templatical/types": minor
"@templatical/editor": patch
---

Spread syntax presets with matching value and logic patterns use the built-in linear merge-tag scanner across localization and editor parsing. Different pattern sources or flags other than `g` and `y` keep custom regex matching. `@templatical/types` exports `builtInPresetOf(syntax)`, which returns the built-in preset name whose patterns a syntax uses.
