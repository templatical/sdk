---
"@templatical/import-beefree": minor
---

BeeFree custom social icons keep their own image and link inside the social row.

A `type: "custom"` icon, or an icon-set icon whose network has no Templatical platform (Spotify, Vimeo, SoundCloud…), becomes a custom icon in the same social block, in source order: `imageUrl` is the original file, `url` its link (a `mailto:` or `tel:` prefix is kept), and `alt` the icon's alt, then title, then name. It is reported `converted`. A custom upload keeps its own artwork even when it is named after a platform Templatical has, so a custom "Xing" icon stays a custom icon with its image. Known networks from BeeFree's icon sets still import as Templatical's platform icons.

This replaces the 0.60.0 mapping, which turned such an icon into the generic `website` icon and dropped its image, and it keeps what 0.58.0 kept (the file and the link), now inside the row instead of as a separate image block after it. Only an icon with no usable image file still becomes a platform icon: the recognised one, or `website`, reported `approximated` with a note naming the icon. Icon-set shapes and tones, spacing and the 4px gap under the row are unchanged.
