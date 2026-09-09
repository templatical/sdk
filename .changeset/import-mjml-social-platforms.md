---
"@templatical/import-mjml": patch
---

Recognise social platforms from icon-pack filenames and `alt`.

An `mj-social-element` whose `src` was `facebook-round-outlined.png` (or
`youtube-round-outlined.png`) imported as platform `"website"`, because
`normalizePlatform` only accepted a bare slug or a `-noshare` variant. Pack
suffixes (`-round`, `-outlined`, and the same tokens MJML uses for `-noshare`)
are now stripped until a known platform remains. When `name` and `src` still
do not match, `alt` is tried. `SocialIcon` is still `{ platform, url }` — `alt`
is a name signal, not a stored field.
