---
"@templatical/editor": patch
"@templatical/renderer": patch
"@templatical/types": patch
---

Background fills can be transparent

The color picker on a button face, a block background, and a section wrapper can store the keyword `transparent`, shown as a checker. Clear still means unset. A button with no fill exports `background-color="transparent"`, because MJML paints `#414141` when that attribute is left off. An `rgba()` with a real alpha is kept; an opaque `rgb()` still becomes hex.
