---
"@templatical/import-beefree": patch
---

BeeFree social rows keep a known icon shape when the colour variant is new, and they keep the 4px gap under the icons.

An unlisted `circle-*`, `rounded-*`, `square-*` or `squared-*` set imports as that shape in brand colours and is reported approximated, a named set with no matching shape stays the solid brand icons and is reported approximated, and the social block's bottom padding includes the 4px line-box strut BeeFree leaves under its inline-block icon table, which MJML's `font-size:0px` column cell would otherwise drop.
