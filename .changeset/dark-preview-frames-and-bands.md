---
"@templatical/editor": patch
---

The dark-mode canvas preview now inverts section wrapper frames and layout bands. A section's wrapper frame stayed light while the section inside it turned dark, and with a `layout`, the band around the email (and the whole email inside it) stayed light in the preview. Both now invert together with the content they hold, once, and images on them still show as they are.
